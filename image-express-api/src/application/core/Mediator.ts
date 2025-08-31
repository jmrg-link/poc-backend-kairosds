import { CommandBus } from './CommandBus';
import { QueryBus } from './QueryBus';
import { ICommand, IQuery } from './index';

/**
 * Mediator para coordinar Commands y Queries
 * @class Mediator
 */
export class Mediator {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus
  ) {}

  /**
   * Envía un comando al Command Bus
   * @template TResult
   * @param {ICommand} command - Comando a enviar
   * @returns {Promise<TResult>} Resultado del comando
   */
  async send<TResult>(command: ICommand): Promise<TResult> {
    return this.commandBus.execute<TResult>(command);
  }

  /**
   * Envía una consulta al Query Bus
   * @template TResult
   * @param {IQuery<TResult>} query - Consulta a enviar
   * @returns {Promise<TResult>} Resultado de la consulta
   */
  async query<TResult>(query: IQuery<TResult>): Promise<TResult> {
    return this.queryBus.execute<TResult>(query);
  }
}
