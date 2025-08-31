/**
 * Tipos de eventos de cola
 * @enum {string}
 */
export enum TaskEventType {
  TASK_CREATED = 'task.created',
  TASK_PROCESSING = 'task.processing',
  TASK_COMPLETED = 'task.completed',
  TASK_FAILED = 'task.failed',
  TASK_RETRY = 'task.retry',
}

/**
 * Payload base para eventos de tarea
 * @interface BaseTaskEvent
 */
export interface BaseTaskEvent {
  taskId: string;
  timestamp: number;
  eventType: TaskEventType;
}

/**
 * Evento de tarea creada
 * @interface TaskCreatedEvent
 */
export interface TaskCreatedEvent extends BaseTaskEvent {
  eventType: TaskEventType.TASK_CREATED;
  imagePath: string;
  price: number;
  idempotencyKey?: string;
}

/**
 * Evento de tarea en procesamiento
 * @interface TaskProcessingEvent
 */
export interface TaskProcessingEvent extends BaseTaskEvent {
  eventType: TaskEventType.TASK_PROCESSING;
  workerId: string;
}

/**
 * Evento de tarea completada
 * @interface TaskCompletedEvent
 */
export interface TaskCompletedEvent extends BaseTaskEvent {
  eventType: TaskEventType.TASK_COMPLETED;
  images: Array<{
    resolution: '1024' | '800';
    path: string;
    md5: string;
    size: number;
  }>;
  processingTime: number;
}

/**
 * Evento de tarea fallida
 * @interface TaskFailedEvent
 */
export interface TaskFailedEvent extends BaseTaskEvent {
  eventType: TaskEventType.TASK_FAILED;
  error: string;
  attempts: number;
  willRetry: boolean;
}

/**
 * Unión de todos los tipos de eventos
 */
export type TaskEvent =
  | TaskCreatedEvent
  | TaskProcessingEvent
  | TaskCompletedEvent
  | TaskFailedEvent;
