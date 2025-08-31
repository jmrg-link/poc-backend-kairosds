/**
 * Estados posibles de una tarea
 * @enum {string}
 */
export enum TaskStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * Imagen procesada
 * @interface ProcessedImage
 */
export interface ProcessedImage {
  resolution: '1024' | '800';
  path: string;
}

/**
 * Entidad de tarea
 * @interface TaskEntity
 */
export interface TaskEntity {
  status: TaskStatus;
  price: number;
  originalPath: string;
  images: ProcessedImage[];
  _id?: string;
  error?: string;
  idempotencyKey?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Manejador de transiciones de estado
 * @class TaskStatusTransition
 */
export class TaskStatusTransition {
  private static readonly transitions: Record<TaskStatus, TaskStatus[]> = {
    [TaskStatus.PENDING]: [TaskStatus.PROCESSING, TaskStatus.FAILED],
    [TaskStatus.PROCESSING]: [TaskStatus.COMPLETED, TaskStatus.FAILED],
    [TaskStatus.COMPLETED]: [],
    [TaskStatus.FAILED]: [],
  };

  /**
   * Verifica si una transición es válida
   * @static
   * @param {TaskStatus} from - Estado origen
   * @param {TaskStatus} to - Estado destino
   * @returns {boolean} true si es válida
   */
  static canTransition(from: TaskStatus, to: TaskStatus): boolean {
    return this.transitions[from]?.includes(to) || false;
  }

  /**
   * Valida y lanza error si la transición no es válida
   * @static
   * @param {TaskStatus} from - Estado origen
   * @param {TaskStatus} to - Estado destino
   * @throws {Error} Si la transición no es válida
   */
  static validateTransition(from: TaskStatus, to: TaskStatus): void {
    if (!this.canTransition(from, to)) {
      throw new Error(`Transición inválida: ${from} -> ${to}`);
    }
  }
}
