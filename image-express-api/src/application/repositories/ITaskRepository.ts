import { TaskEntity } from '@domain/entities/TaskEntity';

/**
 * Interfaz del repositorio de tareas
 * @interface ITaskRepository
 */
export interface ITaskRepository {
  create(task: Partial<TaskEntity>): Promise<TaskEntity>;
  findById(id: string): Promise<TaskEntity | null>;
  findByIdempotencyKey(key: string): Promise<TaskEntity | null>;
  updateStatus(id: string, status: string, data?: Record<string, unknown>): Promise<void>;
  find(filter: Partial<TaskEntity>, skip: number, limit: number): Promise<TaskEntity[]>;
  count(filter: Partial<TaskEntity>): Promise<number>;
}
