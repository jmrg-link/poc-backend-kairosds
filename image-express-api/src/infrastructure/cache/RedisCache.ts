import Redis from 'ioredis';
import { envs } from '@config/envs';

/**
 * Servicio de caché con Redis
 * @class RedisCache
 */
export class RedisCache {
  private static client: Redis;

  /**
   * Inicializa conexión Redis
   * @static
   * @returns {Promise<void>}
   */
  static initialize(): void {
    this.client = new Redis({
      host: envs.REDIS.HOST,
      port: envs.REDIS.PORT,
      password: envs.REDIS.PASSWORD,
      db: envs.REDIS.DB,
      retryStrategy: times => Math.min(times * 50, 2000),
    });

    this.client.on('connect', () => console.log('✓ Redis connected'));
    this.client.on('error', err => console.error('Redis error:', err));
  }

  /**
   * Obtiene valor del caché
   * @param {string} key - Clave
   * @returns {Promise<string | null>} Valor o null
   */
  async get(key: string): Promise<string | null> {
    return await RedisCache.client.get(key);
  }

  /**
   * Guarda valor en caché
   * @param {string} key - Clave
   * @param {string} value - Valor
   * @param {number} ttl - TTL en segundos
   * @returns {Promise<void>}
   */
  async set(key: string, value: string, ttl: number = 60): Promise<void> {
    await RedisCache.client.setex(key, ttl, value);
  }

  /**
   * Elimina valor del caché
   * @param {string} key - Clave
   * @returns {Promise<void>}
   */
  async del(key: string): Promise<void> {
    await RedisCache.client.del(key);
  }

  /**
   * Obtiene cliente Redis
   * @static
   * @returns {Redis} Cliente Redis
   */
  static getClient(): Redis {
    return this.client;
  }
}
