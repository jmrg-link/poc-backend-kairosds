import { RedisCache } from '@infrastructure/cache';

/**
 * @class IdempotencyService
 * @description Servicio para gestión de idempotencia en operaciones HTTP.
 * Previene la ejecución duplicada de operaciones utilizando Redis como almacén temporal.
 * @since 1.0.0
 */
export class IdempotencyService {
  /**
   * @private
   * @readonly
   * @property {string} prefix - Prefijo para las claves de Redis
   */
  private readonly prefix = 'idempotency:';

  /**
   * @private
   * @readonly
   * @property {number} ttl - Tiempo de vida en segundos (24 horas)
   */
  private readonly ttl = 86400;

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
