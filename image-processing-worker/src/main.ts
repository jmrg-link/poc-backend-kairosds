/**
 * @file Punto de entrada principal para el Image Processing Worker.
 */
import 'reflect-metadata';
import { envs } from '@config/envs';
import { logger } from '@core/helpers/logger';
import { DatabaseConnector } from '@infrastructure/databases/DatabaseConnector';
import { RedisCache } from '@infrastructure/cache/RedisCache';
import { TaskQueueConsumer } from '@infrastructure/queues/TaskQueueConsumer';

/**
 * @function main
 * @description Inicializa y arranca el worker.
 */
async function main() {
  try {
    logger.info('Initializing worker...');

    await DatabaseConnector.initialize(envs.MONGODB_URI);
    await RedisCache.initialize();

    const consumer = new TaskQueueConsumer();
    consumer.start();

    logger.info('Worker started successfully and is waiting for jobs.');
  } catch (error) {
    logger.error('Failed to start the worker:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

main();
