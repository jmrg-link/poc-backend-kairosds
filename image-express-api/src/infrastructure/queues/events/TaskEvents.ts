import { QueueEvents } from 'bullmq';
import { RedisConnection } from '@infrastructure/cache/RedisConnection';
import { RedisCache } from '@infrastructure/cache/RedisCache';
import { envs } from '@config/envs';
import { TaskEventType } from './EventTypes';
import { logger } from '@core/helpers';

/**
 * Gestor de eventos de tareas usando BullMQ
 * @class TaskEvents
 */
export class TaskEvents {
  private static queueEvents: QueueEvents;

  /**
   * Inicializa eventos de BullMQ
   * @static
   */
  static initialize(): void {
    this.queueEvents = new QueueEvents(envs.QUEUE.NAME, {
      connection: RedisConnection.getConfig(),
    });

    this.setupEventListeners();
    logger.info('TaskEvents initialized');
  }

  /**
   * Configura listeners de eventos BullMQ
   * @private
   * @static
   */
  private static setupEventListeners(): void {
    this.queueEvents.on('waiting', ({ jobId }) => {
      logger.info('Job waiting', { jobId, event: 'waiting' });
    });

    this.queueEvents.on('active', ({ jobId }) => {
      logger.info('Job active', { jobId, event: 'active' });
      void this.publishTaskEvent(TaskEventType.TASK_PROCESSING, {
        taskId: jobId,
        workerId: process.env.WORKER_ID ?? 'api-worker',
      });
    });

    this.queueEvents.on('completed', ({ jobId, returnvalue }) => {
      logger.info('Job completed', { jobId, returnvalue, event: 'completed' });

      let parsedResult;
      try {
        parsedResult = typeof returnvalue === 'string' ? JSON.parse(returnvalue) : returnvalue;
      } catch {
        parsedResult = {};
      }

      void this.publishTaskEvent(TaskEventType.TASK_COMPLETED, {
        taskId: jobId,
        images: parsedResult?.images ?? [],
        processingTime: parsedResult?.processingTime ?? 0,
      });
    });

    this.queueEvents.on('failed', ({ jobId, failedReason }) => {
      logger.error('Job failed', { jobId, failedReason, event: 'failed' });
      void this.publishTaskEvent(TaskEventType.TASK_FAILED, {
        taskId: jobId,
        error: failedReason || 'Unknown error',
        attempts: 1,
        willRetry: true,
      });
    });
  }

  /**
   * Publica evento en Redis pub/sub
   * @private
   * @static
   * @param {TaskEventType} eventType - Tipo de evento
   * @param {Record<string, unknown>} data - Datos del evento
   */
  private static async publishTaskEvent(
    eventType: TaskEventType,
    data: Record<string, unknown>
  ): Promise<void> {
    try {
      const eventPayload = {
        taskId: data.taskId,
        timestamp: Date.now(),
        eventType,
        ...data,
      };

      const redis = RedisCache.getClient();
      await redis.publish('task-events', JSON.stringify(eventPayload));

      logger.info('Task event published', { eventType, taskId: data.taskId });
    } catch (error) {
      logger.error('Error publishing task event', { eventType, data, error });
    }
  }

  /**
   * Cierra conexión de eventos
   * @static
   */
  static async close(): Promise<void> {
    await this.queueEvents.close();
  }
}
