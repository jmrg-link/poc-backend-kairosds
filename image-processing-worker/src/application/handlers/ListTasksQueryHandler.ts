/**
 * Handler para consulta ListTasks con caché
 * @class ListTasksQueryHandler
 * @implements {IQueryHandler<ListTasksQuery, ListTasksResult>}
 */
import { IQueryHandler } from '@application/tasks';
import { ListTasksQuery, ListTasksResult } from '@application/queries/ListTasksQuery';
import { ITaskRepository } from '@application/repositories';
import { CacheService } from '@application/services/CacheService';
import { TaskEntity } from '@domain/entities';
import crypto from 'crypto';
import { logger } from '@core/helpers/logger';

export class ListTasksQueryHandler implements IQueryHandler<ListTasksQuery, ListTasksResult> {
  private readonly LIST_TTL = 30;
  private readonly COUNT_TTL = 45;

  /**
   * Constructor del handler
   * @param {ITaskRepository} repository - Repositorio de tareas
   * @param {CacheService} cacheService - Servicio de caché
   */
  constructor(
    private readonly repository: ITaskRepository,
    private readonly cacheService: CacheService
  ) {}

  /**
   * Ejecuta la consulta para listar tareas con caché
   * @param {ListTasksQuery} query - Consulta con filtros y paginación
   * @returns {Promise<ListTasksResult>} Lista paginada de tareas
   */
  async execute(query: ListTasksQuery): Promise<ListTasksResult> {
    const skip = query.getSkip();
    const filter: Partial<TaskEntity> = {};

    if (query.status) {
      filter.status = query.status;
    }

    const listKey = this.generateCacheKey('list', { filter, skip, limit: query.limit });
    const countKey = this.generateCacheKey('count', filter);

    const [tasks, total] = await Promise.all([
      this.cacheService.getOrSet(
        listKey,
        () => this.repository.find(filter, skip, query.limit),
        this.LIST_TTL
      ),
      this.cacheService.getOrSet(countKey, () => this.repository.count(filter), this.COUNT_TTL),
    ]);

    logger.info('Lista de tareas procesada', {
      page: query.page,
      limit: query.limit,
      total,
      status: query.status,
    });

    return {
      data: tasks.map(this.mapToDto),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  /**
   * Genera clave única de caché para queries
   * @private
   * @param {string} prefix - Prefijo de la clave
   * @param {object} params - Parámetros de la query
   * @returns {string} Clave de caché
   */
  private generateCacheKey(prefix: string, params: object): string {
    const hash = crypto
      .createHash('md5')
      .update(JSON.stringify(params))
      .digest('hex')
      .substring(0, 16);

    return `tasks:${prefix}:${hash}`;
  }

  /**
   * Mapea entidad a DTO
   * @private
   * @param {TaskEntity} task - Entidad tarea
   * @returns {TaskResponseDto} DTO de respuesta
   */
  private mapToDto(task: TaskEntity): any {
    return {
      taskId: task._id!,
      status: task.status as 'pending' | 'processing' | 'completed' | 'failed',
      price: task.price,
      ...(task.images?.length > 0 && { images: task.images }),
      ...(task.error && { error: task.error }),
      ...(task.createdAt && { createdAt: task.createdAt }),
      ...(task.updatedAt && { updatedAt: task.updatedAt }),
    };
  }
}
