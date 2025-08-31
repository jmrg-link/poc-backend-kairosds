/**
 * Handler para comando UpdateTaskStatus
 * @class UpdateTaskStatusCommandHandler
 */
import { ICommandHandler } from '@application/core';
import { UpdateTaskStatusCommand } from '@application/commands';
import { ITaskRepository } from '@application/repositories';
import { CacheService } from '@application/services/CacheService';
import { TaskStatusTransition } from '@domain/entities';
import { NotFoundError } from '@core/errors';
import { logger } from '@core/helpers/logger';

export class UpdateTaskStatusCommandHandler
  implements ICommandHandler<UpdateTaskStatusCommand, void>
{
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
   * Ejecuta el comando de actualización de estado
   * @param {UpdateTaskStatusCommand} command - Comando con datos
   * @returns {Promise<void>}
   */
  async execute(command: UpdateTaskStatusCommand): Promise<void> {
    const task = await this.repository.findById(command.taskId);

    if (!task) {
      throw new NotFoundError(`Tarea ${command.taskId} no encontrada`);
    }

    TaskStatusTransition.validateTransition(task.status, command.status);

    await this.repository.updateStatus(command.taskId, command.status, command.data);

    await this.invalidateTaskCache(command.taskId);

    logger.info('Estado de tarea actualizado', {
      taskId: command.taskId,
      previousStatus: task.status,
      newStatus: command.status,
    });
  }

  /**
   * Invalida caché relacionado con la tarea
   * @private
   * @param {string} taskId - ID de la tarea
   * @returns {Promise<void>}
   */
  private async invalidateTaskCache(taskId: string): Promise<void> {
    await Promise.all([
      this.cacheService.invalidatePattern(`task:${taskId}`),
      this.cacheService.invalidatePattern('tasks:list:*'),
      this.cacheService.invalidatePattern('tasks:count:*'),
    ]);
  }
}
