import { Request, Response, NextFunction } from 'express';
import { TaskService } from '../services/TaskService';
import { CreateTaskRequest, GetTaskParamsDto, PaginationDto } from '@domain/dtos';
import { TaskQueueProducer } from '@infrastructure/queues';
import { RedisCache } from '@infrastructure/cache';
import { Job } from 'bullmq';

/**
 * @interface PaginationRequest
 * @description Extiende Request de Express para incluir información de paginación
 * @extends {Request}
 */
interface PaginationRequest extends Request {
  pagination?: {
    page: number;
    limit: number;
    offset: number;
  };
}

/**
 * @interface QueueJobState
 * @description Define los estados posibles de un trabajo en la cola de BullMQ
 */
interface QueueJobState {
  state: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'paused';
}

/**
 * @interface JobData
 * @description Estructura de datos para la información de un trabajo en la cola
 */
interface JobData {
  id: string | undefined;
  name: string | undefined;
  data: unknown;
  returnvalue: unknown;
  failedReason?: string;
  timestamp: number | undefined;
  attemptsMade: number;
}

/**
 * @interface FileUploadRequest
 * @description Extiende Request para incluir información de archivo subido
 * @extends {Request}
 */
interface FileUploadRequest extends Request {
  idempotencyKey?: string;
  file?: Express.Multer.File;
}

/**
 * @class TaskController
 * @description Controlador principal para la gestión de tareas de procesamiento de imágenes.
 * Maneja todas las operaciones CRUD y de gestión del ciclo de vida de las tareas.
 * @since 1.0.0
 */
export class TaskController {
  /**
   * @private
   * @static
   * @readonly
   * @property {string[]} ALLOWED_MIME_TYPES - Tipos MIME permitidos para upload
   */
  private static readonly ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

  /**
   * @private
   * @static
   * @readonly
   * @property {number} MAX_FILE_SIZE - Tamaño máximo de archivo en bytes (10MB)
   */
  private static readonly MAX_FILE_SIZE = 10 * 1024 * 1024;

  /**
   * @private
   * @static
   * @readonly
   * @property {number} DEFAULT_PAGE - Página por defecto para paginación
   */
  private static readonly DEFAULT_PAGE = 1;

  /**
   * @private
   * @static
   * @readonly
   * @property {number} DEFAULT_LIMIT - Límite por defecto de elementos por página
   */
  private static readonly DEFAULT_LIMIT = 10;

  /**
   * @private
   * @static
   * @readonly
   * @property {number} MAX_JOBS_PER_REQUEST - Máximo de trabajos a retornar por petición
   */
  private static readonly MAX_JOBS_PER_REQUEST = 49;

  /**
   * @constructor
   * @description Inicializa el controlador con el servicio de tareas
   * @param {TaskService} taskService - Instancia del servicio de tareas
   */
  constructor(private readonly taskService: TaskService) {}

  /**
   * @method create
   * @async
   * @description Crea una nueva tarea de procesamiento desde ruta local, URL o archivo
   * @param {CreateTaskRequest & {idempotencyKey?: string}} req - Petición con datos de la tarea
   * @param {Response} res - Objeto de respuesta de Express
   * @param {NextFunction} next - Función para pasar al siguiente middleware
   * @returns {Promise<void>}
   * @throws {ValidationError} Si los datos de entrada no son válidos
   * @throws {BusinessError} Si hay un error de lógica de negocio
   */
  async create(
    req: CreateTaskRequest & { idempotencyKey?: string },
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await this.taskService.createTaskFromRequest(req);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * @method createWithUpload
   * @async
   * @description Crea una tarea desde un archivo subido directamente
   * @param {FileUploadRequest} req - Petición con el archivo subido
   * @param {Response} res - Objeto de respuesta de Express
   * @param {NextFunction} next - Función para pasar al siguiente middleware
   * @returns {Promise<void>}
   * @throws {Error} Si no se proporciona archivo o el formato es inválido
   */
  async createWithUpload(req: FileUploadRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({
          error: 'FILE_REQUIRED',
          message: 'Se requiere un archivo de imagen',
          statusCode: 400,
        });
        return;
      }

      if (!TaskController.ALLOWED_MIME_TYPES.includes(req.file.mimetype)) {
        res.status(400).json({
          error: 'INVALID_FILE_TYPE',
          message: 'Tipo de archivo no soportado. Solo se permiten: JPEG, PNG, WebP',
          statusCode: 400,
        });
        return;
      }

      if (req.file.size > TaskController.MAX_FILE_SIZE) {
        res.status(413).json({
          error: 'FILE_TOO_LARGE',
          message: 'El archivo excede el tamaño máximo de 10MB',
          statusCode: 413,
        });
        return;
      }

      const result = await this.taskService.createTaskFromRequest(req as CreateTaskRequest);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * @method getById
   * @async
   * @description Obtiene los detalles de una tarea específica por su ID
   * @param {Request} req - Petición HTTP con el ID en los parámetros
   * @param {Response} res - Objeto de respuesta de Express
   * @param {NextFunction} next - Función para pasar al siguiente middleware
   * @returns {Promise<void>}
   * @throws {NotFoundError} Si la tarea no existe
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { taskId } = req.params as unknown as GetTaskParamsDto;
      const task = await this.taskService.getTaskById(taskId);
      res.json(task);
    } catch (error) {
      next(error);
    }
  }

  /**
   * @method list
   * @async
   * @description Obtiene una lista paginada de tareas con filtros opcionales
   * @param {PaginationRequest & Request<unknown, unknown, unknown, PaginationDto>} req - Petición con paginación
   * @param {Response} res - Objeto de respuesta de Express
   * @param {NextFunction} next - Función para pasar al siguiente middleware
   * @returns {Promise<void>}
   */
  async list(
    req: PaginationRequest & Request<unknown, unknown, unknown, PaginationDto>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const page = req.pagination?.page ?? TaskController.DEFAULT_PAGE;
      const limit = req.pagination?.limit ?? TaskController.DEFAULT_LIMIT;
      const { status } = req.query;

      const result = await this.taskService.listTasks({
        page: Number(page),
        limit: Number(limit),
        status,
      });

      res.json({
        data: result.data,
        pagination: {
          page: result.pagination.page,
          limit: result.pagination.limit,
          total: result.pagination.total,
          totalPages: result.pagination.totalPages,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @method retry
   * @async
   * @description Re-encola una tarea fallida para nuevo procesamiento
   * @param {Request} req - Petición HTTP con el ID de la tarea
   * @param {Response} res - Objeto de respuesta de Express
   * @param {NextFunction} next - Función para pasar al siguiente middleware
   * @returns {Promise<void>}
   * @throws {NotFoundError} Si la tarea no existe
   * @throws {BusinessError} Si la tarea no está en estado FAILED
   */
  async retry(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { taskId } = req.params as unknown as GetTaskParamsDto;
      const result = await this.taskService.retryTask(taskId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * @method getQueueStats
   * @async
   * @description Obtiene estadísticas de la cola de procesamiento
   * @param {Request} _req - Petición HTTP (no utilizada)
   * @param {Response} res - Objeto de respuesta de Express
   * @param {NextFunction} next - Función para pasar al siguiente middleware
   * @returns {Promise<void>}
   * @internal
   */
  async getQueueStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const queue = TaskQueueProducer.getQueue();
      const counts = await queue.getJobCounts(
        'waiting',
        'active',
        'completed',
        'failed',
        'delayed',
        'paused'
      );
      res.json(counts);
    } catch (error) {
      next(error);
    }
  }

  /**
   * @method getQueueJobsByState
   * @async
   * @description Obtiene trabajos de la cola filtrados por estado
   * @param {Request} req - Petición con el estado en los parámetros
   * @param {Response} res - Objeto de respuesta de Express
   * @param {NextFunction} next - Función para pasar al siguiente middleware
   * @returns {Promise<void>}
   * @internal
   */
  async getQueueJobsByState(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { state } = req.params as unknown as QueueJobState;
      const queue = TaskQueueProducer.getQueue();
      const jobs = await queue.getJobs([state], 0, TaskController.MAX_JOBS_PER_REQUEST, true);

      const jobsData: JobData[] = jobs.map((job: Job) => ({
        id: job.id,
        name: job.name,
        data: job.data,
        returnvalue: job.returnvalue,
        failedReason: job.failedReason,
        timestamp: job.timestamp,
        attemptsMade: job.attemptsMade,
      }));

      res.json(jobsData);
    } catch (error) {
      next(error);
    }
  }

  /**
   * @method deleteJobById
   * @async
   * @description Elimina un trabajo específico de la cola
   * @param {Request} req - Petición con el ID del trabajo
   * @param {Response} res - Objeto de respuesta de Express
   * @param {NextFunction} next - Función para pasar al siguiente middleware
   * @returns {Promise<void>}
   * @internal
   */
  async deleteJobById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const queue = TaskQueueProducer.getQueue();
      await queue.remove(id);
      res.json({ deleted: true, jobId: id });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @method getRedisKeys
   * @async
   * @description Lista claves de Redis que coinciden con un patrón
   * @param {Request} req - Petición con patrón opcional en query
   * @param {Response} res - Objeto de respuesta de Express
   * @param {NextFunction} next - Función para pasar al siguiente middleware
   * @returns {Promise<void>}
   * @internal
   */
  async getRedisKeys(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const pattern = (req.query.pattern as string) || '*';
      const client = RedisCache.getClient();
      const keys = await client.keys(pattern);

      res.json({
        pattern,
        count: keys.length,
        keys,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @method getRedisValue
   * @async
   * @description Obtiene el valor de una clave específica de Redis
   * @param {Request} req - Petición con la clave en query params
   * @param {Response} res - Objeto de respuesta de Express
   * @param {NextFunction} next - Función para pasar al siguiente middleware
   * @returns {Promise<void>}
   * @internal
   */
  async getRedisValue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const key = req.query.key as string;

      if (!key) {
        res.status(400).json({
          error: 'KEY_REQUIRED',
          message: 'Key parameter is required',
          statusCode: 400,
        });
        return;
      }

      const client = RedisCache.getClient();
      const raw = await client.get(key);

      let value: unknown = raw;
      try {
        value = raw ? JSON.parse(raw) : raw;
      } catch {
        /* empty */
      }

      res.json({ key, value });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @method getAllRedisKeys
   * @async
   * @description Obtiene todas las claves de Redis relacionadas con BullMQ
   * @param {Request} _req - Petición HTTP (no utilizada)
   * @param {Response} res - Objeto de respuesta de Express
   * @param {NextFunction} next - Función para pasar al siguiente middleware
   * @returns {Promise<void>}
   * @internal
   */
  async getAllRedisKeys(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const client = RedisCache.getClient();
      const keys = await client.keys('bull:image-processing:*');
      const infoMapKeys = await Promise.all(
        keys.map(async key => {
          const type = await client.type(key);
          let value;

          switch (type) {
            case 'hash':
              value = await client.hgetall(key);
              break;
            case 'list':
              value = await client.lrange(key, 0, -1);
              break;
            case 'set':
              value = await client.smembers(key);
              break;
            case 'zset':
              value = await client.zrange(key, 0, -1, 'WITHSCORES');
              break;
            case 'string':
              value = await client.get(key);
              break;
            default:
              value = `Tipo '${type}' no manejado.`;
          }

          return { key, type, value };
        })
      );

      res.json({
        keys: {
          info: infoMapKeys,
          count: infoMapKeys.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @method getAllRedisEvents
   * @async
   * @description Obtiene todos los streams de eventos de Redis
   * @param {Request} _req - Petición HTTP (no utilizada)
   * @param {Response} res - Objeto de respuesta de Express
   * @param {NextFunction} next - Función para pasar al siguiente middleware
   * @returns {Promise<void>}
   * @internal
   */
  async getAllRedisEvents(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const client = RedisCache.getClient();
      const eventKeys = await client.keys('*:events');
      const processedEvents = await Promise.all(
        eventKeys.map(async key => {
          const streamData = await client.xrange(key, '-', '+');
          const parsedEvents = streamData.map(message => {
            const [id, fields] = message;
            const data: { [key: string]: string } = {};
            for (let i = 0; i < fields.length; i += 2) {
              data[fields[i]] = fields[i + 1];
            }
            return { id, data };
          });

          return { key, events: parsedEvents };
        })
      );

      res
        .json({
          count: processedEvents.length,
          eventStreams: processedEvents.map(stream => ({
            streamKey: stream.key,
            events: stream.events,
          })),
        })
        .status(200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * @method deleteRedisAll
   * @async
   * @description Elimina claves de Redis que coinciden con un patrón
   * @param {Request} req - Petición con patrón opcional en query
   * @param {Response} res - Objeto de respuesta de Express
   * @param {NextFunction} next - Función para pasar al siguiente middleware
   * @returns {Promise<void>}
   * @internal
   */
  async deleteRedisAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const pattern = (req.query.pattern as string) || 'bull*';
      const client = RedisCache.getClient();
      const keys = await client.keys(pattern);

      if (keys.length > 0) {
        await client.del(keys);
      }

      res.json({
        pattern,
        deleted: keys.length,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @method deleteRedisKey
   * @async
   * @description Elimina una clave específica de Redis
   * @param {Request} req - Petición con la clave en los parámetros
   * @param {Response} res - Objeto de respuesta de Express
   * @param {NextFunction} next - Función para pasar al siguiente middleware
   * @returns {Promise<void>}
   * @internal
   */
  async deleteRedisKey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { key } = req.params;
      const client = RedisCache.getClient();
      const result = await client.del(key);

      res.json({
        key,
        deleted: result > 0,
      });
    } catch (error) {
      next(error);
    }
  }
}
