import { ICommandHandler } from '@application/tasks';
import { CreateTaskCommand } from '@application/commands/CreateTaskCommand';
import { ITaskRepository } from '@application/repositories';
import { TaskQueueProducer } from '@infrastructure/queues';
import { TaskResponseDto } from '@domain/dtos';
import { generateUUID } from '@core/helpers/crypto';

/**
 * Handler para el comando CreateTask
 * @class CreateTaskCommandHandler
 */
export class CreateTaskCommandHandler
  implements ICommandHandler<CreateTaskCommand, TaskResponseDto>
{
  constructor(
    private readonly repository: ITaskRepository,
    private readonly queue: TaskQueueProducer
  ) {}

  /**
   * Ejecuta el comando de creación de tarea
   * @param {CreateTaskCommand} command - Comando a ejecutar
   * @returns {Promise<TaskResponseDto>} Tarea creada
   */
  async execute(command: CreateTaskCommand): Promise<TaskResponseDto> {
    if (command.idempotencyKey) {
      const existing = await this.repository.findByIdempotencyKey(command.idempotencyKey);
      if (existing) {
        return this.mapToResponse(existing);
      }
    }

    const taskEntity = command.toEntity();
    if (!taskEntity.idempotencyKey) {
      taskEntity.idempotencyKey = generateUUID();
    }

    const task = await this.repository.create(taskEntity);
    await this.queue.addTask(task._id!.toString(), command.imagePath);

    return this.mapToResponse(task);
  }

  /**
   * Mapea entidad a DTO de respuesta
   * @private
   * @param {TaskEntity} task - Entidad tarea
   * @returns {TaskResponseDto} DTO respuesta
   */
  private mapToResponse(task: any): TaskResponseDto {
    return {
      taskId: task._id!,
      status: task.status,
      price: task.price,
      ...(task.images?.length > 0 && { images: task.images }),
      ...(task.error && { error: task.error }),
      ...(task.createdAt && { createdAt: task.createdAt }),
      ...(task.updatedAt && { updatedAt: task.updatedAt }),
    };
  }
}
