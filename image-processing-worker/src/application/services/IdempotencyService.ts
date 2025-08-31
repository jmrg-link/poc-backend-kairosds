import { RedisCache } from '@infrastructure/cache';

/**
 * Servicio de idempotencia
 * @class IdempotencyService
 */
export class IdempotencyService {
  private readonly prefix = 'idempotency:';
  private readonly ttl = 86400; // 24 horas

  constructor(private readonly cache: RedisCache) {}

  /**
   * Verifica si existe una clave de idempotencia
   * @param {string} key - Clave
   * @returns {Promise<string | null>} Resultado previo o null
   */
  async check(key: string): Promise<string | null> {
    return await this.cache.get(this.prefix + key);
  }

  /**
   * Guarda resultado con clave de idempotencia
   * @param {string} key - Clave
   * @param {object} result - Resultado
   * @returns {Promise<void>}
   */
  async store(key: string, result: object): Promise<void> {
    await this.cache.set(this.prefix + key, JSON.stringify(result), this.ttl);
  }
}
