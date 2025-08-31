/**
 * Interfaz base para todos los comandos
 * @interface ICommand
 */
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
