import { ICommand } from '@application/tasks';
import { TaskStatus } from '@domain/entities/TaskEntity';

/**
 * Comando para actualizar estado de tarea
 * @class UpdateTaskStatusCommand
 */
export class UpdateTaskStatusCommand implements ICommand {
  constructor(
    public readonly taskId: string,
    public readonly status: TaskStatus,
    public readonly data?: Record<string, unknown>
  ) {}
}
