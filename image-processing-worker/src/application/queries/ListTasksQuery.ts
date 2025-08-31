import { IQuery } from '@application/tasks';
import { TaskStatus } from '@domain/entities/TaskEntity';
import { TaskResponseDto } from '@domain/dtos';

/**
 * Tipo de resultado para listado paginado de tareas
 * @interface ListTasksResult
 */
export interface ListTasksResult {
  data: TaskResponseDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Query para listar tareas
 * @class ListTasksQuery
 */
export class ListTasksQuery implements IQuery<ListTasksResult> {
  constructor(
    public readonly page: number,
    public readonly limit: number,
    public readonly status?: TaskStatus
  ) {}

  /**
   * Calcula skip para paginación
   * @returns {number} Cantidad a saltar
   */
  getSkip(): number {
    return (this.page - 1) * this.limit;
  }
}
