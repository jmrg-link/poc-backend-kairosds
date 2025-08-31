import 'reflect-metadata';
import { startupTimeLocal, startupTimeUTC } from '@core/helpers';
import ansiColors from 'ansi-colors';
import { DatabaseConnector } from '@infrastructure/databases';
import { RedisCache } from '@infrastructure/cache';
import { TaskQueueProducer } from '@infrastructure/queues';
import { TaskEvents } from '@infrastructure/queues/events/TaskEvents';
import { envs } from '@config/envs';
import { createServer } from '@presentation/Bootstrap/server';

process.env.TZ = 'Europe/Madrid';

/**
 * Punto de entrada principal de la aplicación
 * Inicializa todas las conexiones y levanta el servidor HTTP
 */
async function main(): Promise<void> {
  console.log(
    ansiColors.grey(`Server initialization started at ${startupTimeLocal} UTC: ${startupTimeUTC}`)
  );

  await DatabaseConnector.initialize(envs.MONGODB_URI);
  RedisCache.initialize();
  TaskEvents.initialize();
  TaskQueueProducer.initialize();

  const server = createServer();
  const PORT = envs.SERVER.PORT || 3000;
  server.listen(PORT, () => {
    console.log(ansiColors.green(`API Server listening on port ${PORT}`));
    console.log(ansiColors.blue(`Documentation: http://localhost:${PORT}/api-docs`));
  });
}

main().catch(error => {
  console.error(ansiColors.red('Failed to start the application:'), error);
  process.exit(1);
});
