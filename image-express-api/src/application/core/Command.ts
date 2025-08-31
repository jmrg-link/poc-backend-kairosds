/**
 * Interfaz marcadora base para todos los comandos CQRS
 *
 * Esta interfaz vacía es intencional y sirve como marcador de tipo
 * para identificar objetos como comandos en el patrón CQRS.
 *
 * @interface ICommand
 *
 * @example
 * ```typescript
 * export class CreateUserCommand implements ICommand {
 *   constructor(
 *     public readonly name: string,
 *     public readonly email: string
 *   ) {}
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ICommand {}

/**
 * Interfaz para manejadores de comandos
 * @template TCommand
 * @template TResult
 */
export interface ICommandHandler<TCommand extends ICommand, TResult = void> {
  /**
   * Ejecuta el comando
   * @param {TCommand} command - Comando a ejecutar
   * @returns {Promise<TResult>} Resultado del comando
   */
  execute(command: TCommand): Promise<TResult>;
}

/**
 * Tipo para constructor de comando
 * @template T
 */
export type CommandConstructor<T extends ICommand> = new (...args: unknown[]) => T;
