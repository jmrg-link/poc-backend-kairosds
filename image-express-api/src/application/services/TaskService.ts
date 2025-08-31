import { TaskRepository } from '@presentation/Task/repositories/TaskRepository';
import { TaskQueueProducer } from '@infrastructure/queues';
import { BusinessError, NotFoundError } from '@core/errors';
import { TaskStatus, TaskStatusTransition, TaskEntity } from '@domain/entities';
import { TaskResponseDto } from '@domain/dtos';
import { ImageDownloadService } from '@application/services';
import { CreateTaskRequest } from '@domain/dtos';
import { generateUUID } from '@core/helpers/crypto';
import { logger } from '@core/helpers/logger';
import fs from 'fs/promises';
import path from 'path';
import { rootPath } from '@core/helpers/fileDirectory';

/**
 * @interface LogContext
 * @description Define una estructura estandarizada para los logs,
 * permitiendo un seguimiento consistente a través de las operaciones.
 * @property {string} [taskId] - ID de la tarea asociada al log
 * @property {string} [idempotencyKey] - Clave de idempotencia de la operación
 * @property {'upload' | 'url' | 'path'} [source] - Origen de la imagen para la tarea
 * @property {TaskStatus} [status] - Estado de la tarea en el momento del log
 */
interface LogContext {
  taskId?: string;
  idempotencyKey?: string;
  source?: 'upload' | 'url' | 'path';
  status?: TaskStatus;
  [key: string]: unknown;
}

/**
 * @class TaskService
 * @description Orquesta la lógica de negocio para la gestión de tareas de procesamiento de imágenes.
 * Actúa como intermediario entre el controlador y las capas de datos e infraestructura.
 * Implementa idempotencia, manejo de estados y coordinación con colas de procesamiento.
 */
export class TaskService {
  private static readonly MIN_PRICE = 5;
  private static readonly MAX_PRICE = 50;
  private static readonly STORAGE_BASE_PATH = path.join(rootPath, 'storage', 'images');

  /**
   * @constructor
   * @param {TaskRepository} repository - Repositorio para interactuar con la base de datos de tareas
   * @param {TaskQueueProducer} queue - Productor para encolar trabajos de procesamiento
   * @param {ImageDownloadService} imageDownloadService - Servicio para descargar imágenes desde URLs
   */
  constructor(
    private readonly repository: TaskRepository,
    private readonly queue: TaskQueueProducer,
    private readonly imageDownloadService: ImageDownloadService
  ) {}

  /**
   * @method createTaskFromRequest
   * @description Orquesta la creación completa de una tarea a partir de una petición HTTP.
   * Determina el origen de la imagen, la procesa, crea el registro en la base de datos,
   * mueve el archivo a su ubicación final y encola la tarea para procesamiento.
   * @param {CreateTaskRequest & { idempotencyKey?: string }} req - La petición HTTP completa
   * @returns {Promise<TaskResponseDto>} DTO con la información de la tarea creada
   * @throws {BusinessError} Si no se proporciona una fuente de imagen válida
   */
  async createTaskFromRequest(
    req: CreateTaskRequest & { idempotencyKey?: string }
  ): Promise<TaskResponseDto> {
    const startTime = Date.now();
    const context: LogContext = { idempotencyKey: req.idempotencyKey };

    try {
      const { imagePath, source } = await this.resolveImagePath(req);
      context.source = source;

      const task = await this.createTask(imagePath, req.idempotencyKey);
      context.taskId = task.taskId;

      const finalPath = await this.moveImageToTaskDirectory(task.taskId, imagePath);

      if (finalPath !== imagePath) {
        await this.repository.updateOriginalPath(task.taskId, finalPath);
        await this.queue.addTask(task.taskId, finalPath);
        logger.info('Tarea encolada para procesamiento (ruta definitiva)', {
          taskId: task.taskId,
          destination: finalPath,
        });
      } else {
        await this.queue.addTask(task.taskId, imagePath);
        logger.info('Tarea encolada con ruta original', {
          taskId: task.taskId,
          path: imagePath,
        });
      }

      logger.info('Tarea creada exitosamente', {
        ...context,
        processingTime: Date.now() - startTime,
      });

      return task;
    } catch (error) {
      logger.error('Error creando tarea desde request', {
        ...context,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime,
      });
      throw error;
    }
  }

  /**
   * @method createTask
   * @description Lógica central para la creación de una tarea en la base de datos.
   * Maneja la idempotencia verificando tareas existentes antes de crear una nueva.
   * @param {string} imagePath - Ruta temporal de la imagen a procesar
   * @param {string} [idempotencyKey] - Clave opcional para garantizar una única ejecución
   * @returns {Promise<TaskResponseDto>} El DTO de la tarea creada o existente
   */
  async createTask(imagePath: string, idempotencyKey?: string): Promise<TaskResponseDto> {
    if (idempotencyKey) {
      const existing = await this.repository.findByIdempotencyKey(idempotencyKey);
      if (existing) {
        logger.info('Retornando tarea existente por idempotencia', {
          taskId: existing._id,
          idempotencyKey,
          imagePath,
        });
        return this.mapEntityToDto(existing);
      }
    }

    const effectiveIdempotencyKey = idempotencyKey ?? generateUUID();
    const task = await this.repository.create({
      status: TaskStatus.PENDING,
      price: this.generateRandomPrice(),
      originalPath: imagePath,
      images: [],
      idempotencyKey: effectiveIdempotencyKey,
    });

    logger.info('Tarea creada en BD (pendiente de encolar tras mover original)', {
      taskId: task._id!.toString(),
      price: task.price,
      status: TaskStatus.PENDING,
      imagePath,
    });

    return this.mapEntityToDto(task);
  }

  /**
   * @method getTaskById
   * @description Busca y devuelve una tarea por su identificador único
   * @param {string} taskId - ID de la tarea a buscar
   * @returns {Promise<TaskResponseDto>} El DTO de la tarea encontrada
   * @throws {NotFoundError} Si no se encuentra ninguna tarea con el ID proporcionado
   */
  async getTaskById(taskId: string): Promise<TaskResponseDto> {
    const task = await this.repository.findById(taskId);

    if (!task) {
      logger.warn('Tarea no encontrada', { taskId });
      throw new NotFoundError(`La tarea con ID ${taskId} no existe`);
    }

    logger.info('Tarea obtenida', {
      taskId,
      status: task.status,
    });

    return this.mapEntityToDto(task);
  }

  /**
   * @method listTasks
   * @description Obtiene una lista paginada de tareas con opción de filtrado por estado
   * @param {object} options - Opciones de paginación y filtrado
   * @param {number} options.page - Número de página a obtener
   * @param {number} options.limit - Cantidad de resultados por página
   * @param {TaskStatus} [options.status] - Estado opcional para filtrar las tareas
   * @returns {Promise<object>} Lista de tareas y metadatos de paginación
   */
  async listTasks(options: { page: number; limit: number; status?: TaskStatus }): Promise<{
    data: TaskResponseDto[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const skip = (options.page - 1) * options.limit;
    const filter: Partial<TaskEntity> = options.status ? { status: options.status } : {};

    const [tasks, total] = await Promise.all([
      this.repository.find(filter, skip, options.limit),
      this.repository.count(filter),
    ]);

    logger.info('Listado de tareas', {
      page: options.page,
      limit: options.limit,
      total,
      status: options.status,
    });

    return {
      data: tasks.map(task => this.mapEntityToDto(task)),
      pagination: {
        page: options.page,
        limit: options.limit,
        total,
        totalPages: Math.ceil(total / options.limit),
      },
    };
  }

  /**
   * @method retryTask
   * @description Permite reintentar una tarea que se encuentra en estado FAILED.
   * Cambia el estado a PENDING y la vuelve a encolar para su procesamiento.
   * @param {string} taskId - ID de la tarea a reintentar
   * @returns {Promise<TaskResponseDto>} El DTO de la tarea actualizada
   * @throws {NotFoundError} Si la tarea no existe
   * @throws {BusinessError} Si la tarea no está en estado FAILED
   */
  async retryTask(taskId: string): Promise<TaskResponseDto> {
    const task = await this.repository.findById(taskId);

    if (!task) {
      logger.warn('Intento de retry en tarea inexistente', { taskId });
      throw new NotFoundError(`La tarea con ID ${taskId} no existe`);
    }

    if (task.status !== TaskStatus.FAILED) {
      logger.warn('Intento de retry en estado inválido', {
        taskId,
        currentStatus: task.status,
      });
      throw new BusinessError(
        `Solo se pueden reintentar tareas fallidas. Estado actual: ${task.status}`,
        'INVALID_RETRY_STATE',
        400
      );
    }

    await Promise.all([
      this.repository.updateStatus(taskId, TaskStatus.PENDING),
      this.queue.addTask(taskId, task.originalPath),
    ]);

    logger.info('Tarea reintentada', {
      taskId,
      previousStatus: TaskStatus.FAILED,
      newStatus: TaskStatus.PENDING,
    });

    task.status = TaskStatus.PENDING;
    return this.mapEntityToDto(task);
  }

  /**
   * @method updateTaskStatus
   * @description Actualiza el estado de una tarea validando que la transición sea permitida
   * @param {string} taskId - ID de la tarea a actualizar
   * @param {TaskStatus} newStatus - Nuevo estado para la tarea
   * @param {Record<string, unknown>} [data] - Datos adicionales para almacenar
   * @returns {Promise<void>}
   * @throws {NotFoundError} Si la tarea no existe
   * @throws {Error} Si la transición de estado no es válida
   */
  async updateTaskStatus(
    taskId: string,
    newStatus: TaskStatus,
    data?: Record<string, unknown>
  ): Promise<void> {
    const task = await this.repository.findById(taskId);

    if (!task) {
      logger.warn('Actualización de estado en tarea inexistente', { taskId, newStatus });
      throw new NotFoundError(`La tarea con ID ${taskId} no existe`);
    }

    TaskStatusTransition.validateTransition(task.status, newStatus);
    await this.repository.updateStatus(taskId, newStatus, data);

    logger.info('Estado de tarea actualizado', {
      taskId,
      previousStatus: task.status,
      newStatus,
      hasData: !!data,
    });
  }

  /**
   * @private
   * @method resolveImagePath
   * @description Determina y resuelve la ruta de la imagen según su origen
   * @param {CreateTaskRequest & { idempotencyKey?: string }} req - Petición con los datos de origen
   * @returns {Promise<{imagePath: string, source: LogContext['source']}>} Ruta y origen de la imagen
   * @throws {BusinessError} Si no se proporciona una fuente válida
   */
  private async resolveImagePath(
    req: CreateTaskRequest & { idempotencyKey?: string }
  ): Promise<{ imagePath: string; source: LogContext['source'] }> {
    if (req.file) {
      logger.info('Procesando imagen desde upload', {
        source: 'upload',
        filename: req.file.filename,
        size: req.file.size,
      });
      return { imagePath: req.file.path, source: 'upload' };
    }

    if (req.body.imageUrl) {
      const startTime = Date.now();
      logger.info('Iniciando descarga de imagen', {
        source: 'url',
        url: req.body.imageUrl,
      });

      const downloadedPath = await this.imageDownloadService.download(req.body.imageUrl);

      logger.info('Imagen descargada exitosamente', {
        source: 'url',
        path: downloadedPath,
        downloadTime: Date.now() - startTime,
      });

      return { imagePath: downloadedPath, source: 'url' };
    }

    if (req.body.imagePath) {
      logger.info('Usando imagen desde path local', {
        source: 'path',
        path: req.body.imagePath,
      });
      return { imagePath: req.body.imagePath, source: 'path' };
    }

    throw new BusinessError(
      'Se requiere imagePath, imageUrl o archivo',
      'MISSING_IMAGE_SOURCE',
      400
    );
  }

  /**
   * @private
   * @method moveImageToTaskDirectory
   * @description Mueve la imagen a su directorio de tarea dedicado
   * @param {string} taskId - ID de la tarea
   * @param {string} sourcePath - Ruta origen de la imagen
   * @returns {Promise<string>} Ruta final de la imagen
   */
  private async moveImageToTaskDirectory(taskId: string, sourcePath: string): Promise<string> {
    try {
      const taskDir = path.join(TaskService.STORAGE_BASE_PATH, taskId);
      await fs.mkdir(taskDir, { recursive: true });

      const destPath = path.join(taskDir, `original${path.extname(sourcePath)}`);

      try {
        await fs.access(sourcePath);
        await fs.rename(sourcePath, destPath);
        return destPath;
      } catch (accessError) {
        logger.warn('Archivo origen no accesible, usando ruta original', {
          taskId,
          originalPath: sourcePath,
          error: accessError instanceof Error ? accessError.message : 'unknown',
        });
        return sourcePath;
      }
    } catch (error) {
      logger.error('Error al mover archivo original', {
        taskId,
        sourcePath,
        error: error instanceof Error ? error.message : 'unknown',
      });
      return sourcePath;
    }
  }

  /**
   * @private
   * @method generateRandomPrice
   * @description Genera un precio aleatorio para una tarea
   * @returns {number} Un número entero entre MIN_PRICE y MAX_PRICE
   */
  private generateRandomPrice(): number {
    return (
      Math.floor(Math.random() * (TaskService.MAX_PRICE - TaskService.MIN_PRICE + 1)) +
      TaskService.MIN_PRICE
    );
  }

  /**
   * @private
   * @method mapEntityToDto
   * @description Convierte una entidad TaskEntity a un TaskResponseDto
   * @param {TaskEntity} task - La entidad de la tarea
   * @returns {TaskResponseDto} El DTO de respuesta
   */
  private mapEntityToDto(task: TaskEntity): TaskResponseDto {
    const response: TaskResponseDto = {
      taskId: task._id!.toString(),
      status: task.status as 'pending' | 'processing' | 'completed' | 'failed',
      price: task.price,
    };

    if (task.status === TaskStatus.COMPLETED && task.images?.length) {
      response.images = task.images;
    }

    if (task.status === TaskStatus.FAILED && task.error) {
      response.error = task.error;
    }

    if (task.createdAt) {
      response.createdAt = task.createdAt;
    }

    if (task.updatedAt) {
      response.updatedAt = task.updatedAt;
    }

    return response;
  }
}
