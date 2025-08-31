/**
 * Interfaz base para todas las consultas CQRS
 * @interface IQuery
 * @template _TResult - Tipo de resultado que devuelve la consulta (prefijo _ indica no usado)
 */

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface IQuery<_TResult = unknown> {}

/**
 * Interfaz para manejadores de consultas
 * @template TQuery - Tipo de consulta que maneja
 * @template TResult - Tipo de resultado que devuelve
 */
export interface IQueryHandler<TQuery extends IQuery<TResult>, TResult = unknown> {
  /**
   * Ejecuta la consulta
   * @param {TQuery} query - Consulta a ejecutar
   * @returns {Promise<TResult>} Resultado de la consulta
   */
  execute(query: TQuery): Promise<TResult>;
}

/**
 * Tipo para constructor de consulta
 * @template T - Tipo de consulta
 */
export type QueryConstructor<T extends IQuery<unknown>> = new (...args: unknown[]) => T;
