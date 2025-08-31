import { RedisCache } from '@infrastructure/cache';

/**
 * Servicio de caché genérico
 * @class CacheService
 */
export class CacheService {
  constructor(private readonly cache: RedisCache) {}

  /**
   * Obtiene o calcula valor con caché
   * @template T
   * @param {string} key - Clave
   * @param {Function} fn - Función para calcular
   * @param {number} ttl - TTL en segundos
   * @returns {Promise<T>} Valor
   */
  async getOrSet<T>(key: string, fn: () => Promise<T>, ttl: number = 60): Promise<T> {
    const cached = await this.cache.get(key);
    if (cached) {
      return JSON.parse(cached) as T;
    }

    const value = await fn();
    await this.cache.set(key, JSON.stringify(value), ttl);

    return value;
  }

  /**
   * Invalida caché por patrón
   * @param {string} pattern - Patrón de claves
   * @returns {Promise<void>}
   */
  async invalidatePattern(pattern: string): Promise<void> {
    const client = RedisCache.getClient();
    const keys = await client.keys(pattern);

    if (keys.length > 0) {
      await client.del(...keys);
    }
  }
}
