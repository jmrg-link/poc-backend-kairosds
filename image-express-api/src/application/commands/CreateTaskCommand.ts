import { ICommand } from '@application/core';
import { TaskEntity, TaskStatus } from '@domain/entities/TaskEntity';

/**
 * Comando para crear una tarea
 * @class CreateTaskCommand
 */
export class CreateTaskCommand implements ICommand {
  constructor(
    public readonly imagePath: string,
    public readonly price: number,
    public readonly idempotencyKey?: string
  ) {}

  /**
   * Convierte a entidad Task
   * @returns {Partial<TaskEntity>} Entidad parcial
   */
  toEntity(): Partial<TaskEntity> {
    return {
      status: TaskStatus.PENDING,
      price: this.price,
      originalPath: this.imagePath,
      images: [],
      idempotencyKey: this.idempotencyKey,
    };
  }
}
