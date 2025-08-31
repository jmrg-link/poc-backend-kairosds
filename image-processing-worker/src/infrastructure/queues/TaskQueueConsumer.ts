import { Worker, Job } from 'bullmq';
import { envs } from '@config/envs';
import { logger } from '@core/helpers/logger';
import { RedisConnection } from '@infrastructure/cache/RedisConnection';
import { CQRSModule, Mediator } from '@application/tasks';
import { UpdateTaskStatusCommand } from '@application/commands';
import { TaskStatus } from '@domain/entities';
import { SharpImageProcessor } from '@infrastructure/image-processing/SharpImageProcessor';
import { TaskRepository } from '@infrastructure/repositories/TaskRepository';
import { DatabaseConnector } from '@infrastructure/databases/DatabaseConnector';
import { CacheService } from '@application/services/CacheService';
import { RedisCache } from '@infrastructure/cache/RedisCache';
import { TaskQueueProducer } from '@infrastructure/queues/TaskQueueProducer';

/**
 * @class TaskQueueConsumer
 * @description Consume y procesa trabajos de la cola de BullMQ para el procesamiento de imágenes.
 */
export class TaskQueueConsumer {
  private worker: Worker;
  private mediator: Mediator;
  private repository: TaskRepository;

  /**
   * @constructor
   */
  constructor() {
    const db = DatabaseConnector.getImageDb();
    this.repository = new TaskRepository(db);
    const redisCache = new RedisCache();
    const cacheService = new CacheService(redisCache);
    const queueProducer = new TaskQueueProducer();

    this.mediator = CQRSModule.configure(this.repository, queueProducer, cacheService);
    this.worker = new Worker(envs.QUEUE.NAME, this.processJob.bind(this), {
      connection: RedisConnection.getConfig(),
      concurrency: envs.QUEUE.CONCURRENCY,
    });
  }

  /**
   * @method start
   * @description Inicia el worker para que comience a procesar trabajos.
   */
  public start(): void {
    logger.info(`Worker listening for jobs on queue: ${envs.QUEUE.NAME}`);

    this.worker.on('completed', (job: Job) => {
      logger.info(`Job ${job.id} completed successfully.`);
    });

    this.worker.on('failed', (job: Job | undefined, err: Error) => {
      logger.error(`Job ${job?.id} failed with error: ${err.message}`);
    });
  }

  /**
   * @private
   * @method processJob
   * @description Lógica de procesamiento para cada trabajo consumido de la cola.
   * @param {Job} job - El trabajo de BullMQ a procesar.
   */
  private async processJob(job: Job): Promise<void> {
    const { taskId, imagePath } = job.data;
    const imageProcessor = new SharpImageProcessor();

    try {
      const task = await this.repository.findById(taskId);
      if (task?.status === TaskStatus.COMPLETED) {
        logger.info('Tarea ya completada, saltando procesamiento', { taskId });
        return;
      }

      await this.updateStatus(taskId, TaskStatus.PROCESSING);

      const processedImages = await imageProcessor.process(imagePath);

      await this.updateStatus(taskId, TaskStatus.COMPLETED, { images: processedImages });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown processing error';
      await this.updateStatus(taskId, TaskStatus.FAILED, { error: errorMessage });
      throw error;
    }
  }

  /**
   * @private
   * @method updateStatus
   * @description Envía un comando a través del Mediator para actualizar el estado de la tarea.
   * @param {string} taskId - ID de la tarea.
   * @param {TaskStatus} status - El nuevo estado.
   * @param {Record<string, unknown>} [data] - Datos adicionales.
   */
  private async updateStatus(
    taskId: string,
    status: TaskStatus,
    data?: Record<string, unknown>
  ): Promise<void> {
    const command = new UpdateTaskStatusCommand(taskId, status, data);
    await this.mediator.send(command);
  }
}
