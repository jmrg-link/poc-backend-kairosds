import { TaskRepository } from '../repositories';
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
 * @property {string} [taskId] - ID de la tarea asociada al log.
 * @property {string} [idempotencyKey] - Clave de idempotencia de la operación.
 * @property {'upload' | 'url' | 'path'} [source] - Origen de la imagen para la tarea.
 * @property {TaskStatus} [status] - Estado de la tarea en el momento del log.
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
 * @description Orquesta la lógica de negocio para la gestión de tareas.
 * Actúa como intermediario entre el controlador y las capas de datos e infraestructura (repositorios, colas).
 */
export class TaskService {
  /**
   * @constructor
   * @param {TaskRepository} repository - Repositorio para interactuar con la base de datos de tareas.
   * @param {TaskQueueProducer} queue - Productor para encolar trabajos de procesamiento.
   * @param {ImageDownloadService} imageDownloadService - Servicio para descargar imágenes desde URLs.
   */
  constructor(
    private readonly repository: TaskRepository,
    private readonly queue: TaskQueueProducer,
    private readonly imageDownloadService: ImageDownloadService
  ) {}

  /**
   * @method createTaskFromRequest
   * @description Orquesta la creación completa de una tarea a partir de una petición HTTP.
   * Determina el origen de la imagen (subida, URL, ruta local), la procesa,
   * crea el registro en la base de datos, mueve el archivo original a su ubicación final y encola la tarea.
   * @param {CreateTaskRequest & { idempotencyKey?: string }} req - La petición HTTP completa.
   * @returns {Promise<TaskResponseDto>} Un DTO con la información de la tarea creada.
   * @throws {BusinessError} Si no se proporciona una fuente de imagen válida.
   */
  async createTaskFromRequest(
    req: CreateTaskRequest & { idempotencyKey?: string }
  ): Promise<TaskResponseDto> {
    let finalImagePath: string;
    let source: LogContext['source'];
    const startTime = Date.now();

    try {
      if (req.file) {
        source = 'upload';
        finalImagePath = req.file.path;
        logger.info('Procesando imagen desde upload', {
          source,
          filename: req.file.filename,
          size: req.file.size,
        });
      } else if (req.body.imageUrl) {
        source = 'url';
        logger.info('Iniciando descarga de imagen', {
          source,
          url: req.body.imageUrl,
        });
        finalImagePath = await this.imageDownloadService.download(req.body.imageUrl);
        logger.info('Imagen descargada exitosamente', {
          source,
          path: finalImagePath,
          downloadTime: Date.now() - startTime,
        });
      } else if (req.body.imagePath) {
        source = 'path';
        finalImagePath = req.body.imagePath;
        logger.info('Usando imagen desde path local', {
          source,
          path: finalImagePath,
        });
      } else {
        throw new BusinessError(
          'Se requiere imagePath, imageUrl o archivo',
          'MISSING_IMAGE_SOURCE',
          400
        );
      }

      const task = await this.createTask(finalImagePath, req.idempotencyKey);
      try {
        const baseImagesDir = path.join(rootPath, 'storage', 'images');
        const taskDir = path.join(baseImagesDir, task.taskId);
        await fs.mkdir(taskDir, { recursive: true });

        // Preservar el nombre original del archivo sin los sufijos de Multer
        const originalFileName = path.basename(finalImagePath);
        const ext = path.extname(originalFileName);
        const nameWithoutExt = path.basename(originalFileName, ext);

        const parts = nameWithoutExt.split('-');
        let cleanName = nameWithoutExt;

        if (parts.length > 2) {
          const lastPart = parts[parts.length - 1];
          const secondLastPart = parts[parts.length - 2];

          if (lastPart.length === 12 && /^\d+$/.test(secondLastPart)) {
            cleanName = parts.slice(0, -2).join('-');
          }
        }

        const dest = path.join(taskDir, `${cleanName}${ext}`);

        await fs.rename(finalImagePath, dest);
        await this.repository.updateOriginalPath(task.taskId, dest);
        await this.queue.addTask(task.taskId, dest);

        logger.info('Tarea encolada para procesamiento (ruta definitiva)', {
          taskId: task.taskId,
          destination: dest,
        });
      } catch (moveErr) {
        logger.error('Error al mover archivo original', {
          error: moveErr instanceof Error ? moveErr.message : 'unknown',
        });
      }

      logger.info('Tarea creada exitosamente', {
        taskId: task.taskId,
        source,
        idempotencyKey: req.idempotencyKey,
        processingTime: Date.now() - startTime,
      });

      return task;
    } catch (error) {
      logger.error('Error creando tarea desde request', {
        source,
        idempotencyKey: req.idempotencyKey,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime,
      });
      throw error;
    }
  }

  /**
   * @method createTask
   * @description Lógica central para la creación de una tarea en la base de datos.
   * Maneja la idempotencia y la asignación de un precio aleatorio.
   * @param {string} imagePath - Ruta temporal de la imagen a procesar.
   * @param {string} [idempotencyKey] - Clave opcional para garantizar una única ejecución.
   * @returns {Promise<TaskResponseDto>} El DTO de la tarea creada o existente.
   */
  async createTask(imagePath: string, idempotencyKey?: string): Promise<TaskResponseDto> {
    const context: LogContext = {
      idempotencyKey,
      imagePath,
    };

    if (idempotencyKey) {
      const existing = await this.repository.findByIdempotencyKey(idempotencyKey);
      if (existing) {
        logger.info('Retornando tarea existente por idempotencia', {
          ...context,
          taskId: existing._id,
        });
        return this.mapEntityToDto(existing);
      }
    }

    const price = this.generateRandomPrice();
    const effectiveIdempotencyKey = idempotencyKey ?? generateUUID();
    const task = await this.repository.create({
      status: TaskStatus.PENDING,
      price,
      originalPath: imagePath,
      images: [],
      idempotencyKey: effectiveIdempotencyKey,
    });

    context.taskId = task._id!.toString();
    logger.info('Tarea creada en BD (pendiente de encolar tras mover original)', {
      ...context,
      price,
      status: TaskStatus.PENDING,
    });

    return this.mapEntityToDto(task);
  }

  /**
   * @method getTaskById
   * @description Busca y devuelve una tarea por su identificador único.
   * @param {string} taskId - ID de la tarea a buscar.
   * @returns {Promise<TaskResponseDto>} El DTO de la tarea encontrada.
   * @throws {NotFoundError} Si no se encuentra ninguna tarea con el ID proporcionado.
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
   * @description Obtiene una lista paginada de tareas, permitiendo filtrar por estado.
   * @param {object} options - Opciones de paginación y filtrado.
   * @param {number} options.page - Número de página a obtener.
   * @param {number} options.limit - Cantidad de resultados por página.
   * @param {TaskStatus} [options.status] - Estado opcional para filtrar las tareas.
   * @returns {Promise<object>} Un objeto con la lista de tareas y la información de paginación.
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
    const filter: Partial<TaskEntity> = {};

    if (options.status) {
      filter.status = options.status;
    }

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
   * @description Permite reintentar una tarea que se encuentra en estado 'failed'.
   * Cambia el estado a 'pending' y la vuelve a encolar para su procesamiento.
   * @param {string} taskId - ID de la tarea a reintentar.
   * @returns {Promise<TaskResponseDto>} El DTO de la tarea actualizada.
   * @throws {NotFoundError} Si la tarea no existe.
   * @throws {BusinessError} Si la tarea no está en estado 'failed'.
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

    await this.repository.updateStatus(taskId, TaskStatus.PENDING);
    await this.queue.addTask(taskId, task.originalPath);

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
   * @description Actualiza el estado de una tarea, validando que la transición de estado sea permitida.
   * @param {string} taskId - ID de la tarea a actualizar.
   * @param {TaskStatus} newStatus - Nuevo estado para la tarea.
   * @param {Record<string, unknown>} [data] - Datos adicionales para almacenar junto con la actualización.
   * @returns {Promise<void>}
   * @throws {NotFoundError} Si la tarea no existe.
   * @throws {Error} Si la transición de estado no es válida según `TaskStatusTransition`.
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
   * @method generateRandomPrice
   * @description Genera un precio aleatorio para una tarea.
   * @returns {number} Un número entero entre 5 y 50.
   */
  private generateRandomPrice(): number {
    return Math.floor(Math.random() * 46) + 5;
  }

  /**
   * @private
   * @method mapEntityToDto
   * @description Convierte una entidad `TaskEntity` a un `TaskResponseDto` para ser enviada como respuesta.
   * @param {TaskEntity} task - La entidad de la tarea.
   * @returns {TaskResponseDto} El DTO de respuesta.
   */
  private mapEntityToDto(task: TaskEntity): TaskResponseDto {
    const response: TaskResponseDto = {
      taskId: task._id!.toString(),
      status: task.status as 'pending' | 'processing' | 'completed' | 'failed',
      price: task.price,
    };

    if (task.status === TaskStatus.COMPLETED && task.images && task.images.length > 0) {
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
