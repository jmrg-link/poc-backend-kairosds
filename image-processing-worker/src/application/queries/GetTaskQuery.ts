import { IQuery } from '@application/tasks';
import { TaskResponseDto } from '@domain/dtos';

/**
 * Query para obtener una tarea
 * @class GetTaskQuery
 */
export class GetTaskQuery implements IQuery<TaskResponseDto> {
  constructor(public readonly taskId: string) {}
}
