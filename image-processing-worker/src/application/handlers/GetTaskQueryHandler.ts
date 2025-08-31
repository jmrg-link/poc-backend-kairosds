/**
 * Handler para consulta GetTask con caché
 * @class GetTaskQueryHandler
 * @implements {IQueryHandler<GetTaskQuery, TaskResponseDto>}
 */
import { IQueryHandler } from '@application/tasks';
import { GetTaskQuery } from '@application/queries/GetTaskQuery';
import { ITaskRepository } from '@application/repositories';
import { CacheService } from '@application/services/CacheService';
import { TaskResponseDto } from '@domain/dtos';
import { NotFoundError } from '@core/errors';
import { TaskStatus } from '@domain/entities/TaskEntity';
import { logger } from '@core/helpers/logger';

export class GetTaskQueryHandler implements IQueryHandler<GetTaskQuery, TaskResponseDto> {
  private readonly TTL_SECONDS = 60;

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
   * Ejecuta la consulta para obtener una tarea con caché
   * @param {GetTaskQuery} query - Consulta con ID de tarea
   * @returns {Promise<TaskResponseDto>} Tarea encontrada
   * @throws {NotFoundError} Si la tarea no existe
   */
  async execute(query: GetTaskQuery): Promise<TaskResponseDto> {
    const cacheKey = `task:${query.taskId}`;

    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        const task = await this.repository.findById(query.taskId);

        if (!task) {
          throw new NotFoundError(`Tarea ${query.taskId} no encontrada`);
        }

        logger.info('Tarea obtenida desde base de datos', {
          taskId: query.taskId,
          status: task.status,
        });

        return this.mapToDto(task);
      },
      this.TTL_SECONDS
    );
  }

  /**
   * Mapea entidad a DTO
   * @private
   * @param {TaskEntity} task - Entidad tarea
   * @returns {TaskResponseDto} DTO de respuesta
   */
  private mapToDto(task: any): TaskResponseDto {
    return {
      taskId: task._id!,
      status: task.status as 'pending' | 'processing' | 'completed' | 'failed',
      price: task.price,
      ...(task.status === TaskStatus.COMPLETED &&
        task.images?.length > 0 && { images: task.images }),
      ...(task.status === TaskStatus.FAILED && task.error && { error: task.error }),
      ...(task.createdAt && { createdAt: task.createdAt }),
      ...(task.updatedAt && { updatedAt: task.updatedAt }),
    };
  }
}
