import { ConnectionOptions } from 'bullmq';
import { envs } from '@config/envs';

/**
 * Configuración de conexión Redis para BullMQ
 * @class RedisConnection
 */
export class RedisConnection {
  /**
   * Obtiene configuración de conexión
   * @static
   * @returns {ConnectionOptions} Opciones de conexión
   */
  static getConfig(): ConnectionOptions {
    return {
      host: envs.REDIS.HOST,
      port: envs.REDIS.PORT,
      password: envs.REDIS.PASSWORD,
      db: envs.REDIS.DB,
    };
  }
}
