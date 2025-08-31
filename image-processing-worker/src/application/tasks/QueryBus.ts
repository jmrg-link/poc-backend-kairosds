import { IQuery, IQueryHandler } from './Query';

/**
 * Bus de consultas para patrón CQRS
 * @class QueryBus
 */
export class QueryBus {
  private readonly handlers = new Map<string, IQueryHandler<IQuery<unknown>, unknown>>();

  /**
   * Registra un handler para una consulta específica por nombre
   * @template TQuery
   * @template TResult
   * @param {string} queryName - Nombre de la consulta
   * @param {IQueryHandler<TQuery, TResult>} handler - Handler de la consulta
   */
  registerByName<TQuery extends IQuery<TResult>, TResult>(
    queryName: string,
    handler: IQueryHandler<TQuery, TResult>
  ): void {
    this.handlers.set(queryName, handler as IQueryHandler<IQuery<unknown>, unknown>);
  }

  /**
   * Ejecuta una consulta
   * @template TResult
   * @param {IQuery<TResult>} query - Consulta a ejecutar
   * @returns {Promise<TResult>} Resultado de la consulta
   */
  async execute<TResult>(query: IQuery<TResult>): Promise<TResult> {
    const queryName = query.constructor.name;
    const handler = this.handlers.get(queryName);

    if (!handler) {
      throw new Error(`Handler para consulta ${queryName} no encontrado`);
    }

    return handler.execute(query) as Promise<TResult>;
  }

  /**
   * Verifica si existe un handler para la consulta
   * @param {IQuery<unknown>} query - Consulta a verificar
   * @returns {boolean} True si existe handler
   */
  hasHandler(query: IQuery<unknown>): boolean {
    return this.handlers.has(query.constructor.name);
  }
}
