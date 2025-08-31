import { Queue } from 'bullmq';
import { RedisConnection } from '@infrastructure/cache/RedisConnection';
import { envs } from '@config/envs';

/**
 * Productor de cola para tareas de procesamiento
 * @class TaskQueueProducer
 */
export class TaskQueueProducer {
  private static queue: Queue;

  /**
   * Inicializa la cola de tareas
   * @static
   * @returns {Promise<void>}
   */
  static async initialize(): Promise<void> {
    this.queue = new Queue(envs.QUEUE.NAME, {
      connection: RedisConnection.getConfig(),
    });
  }

  /**
   * Añade una tarea a la cola
   * @param {string} taskId - ID de la tarea
   * @param {string} imagePath - Path de la imagen
   * @returns {Promise<void>}
   */
  async addTask(taskId: string, imagePath: string): Promise<void> {
    await TaskQueueProducer.queue.add(
      'process-image',
      {
        taskId,
        imagePath,
        timestamp: Date.now(),
      },
      {
        attempts: envs.QUEUE.MAX_RETRIES,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      }
    );
  }

  /**
   * Obtiene la cola
   * @static
   * @returns {Queue} Cola de BullMQ
   */
  static getQueue(): Queue {
    return this.queue;
  }
}
