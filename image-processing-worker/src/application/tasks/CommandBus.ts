import { ICommand, ICommandHandler } from './Command';

/**
 * Bus de comandos para patrón CQRS
 * @class CommandBus
 */
export class CommandBus {
  private readonly handlers = new Map<string, ICommandHandler<ICommand, unknown>>();

  /**
   * Registra un handler para un comando específico por nombre
   * @template TCommand
   * @template TResult
   * @param {string} commandName - Nombre del comando
   * @param {ICommandHandler<TCommand, TResult>} handler - Handler del comando
   */
  registerByName<TCommand extends ICommand, TResult>(
    commandName: string,
    handler: ICommandHandler<TCommand, TResult>
  ): void {
    this.handlers.set(commandName, handler as ICommandHandler<ICommand, unknown>);
  }

  /**
   * Ejecuta un comando
   * @template TResult
   * @param {ICommand} command - Comando a ejecutar
   * @returns {Promise<TResult>} Resultado del comando
   */
  async execute<TResult>(command: ICommand): Promise<TResult> {
    const commandName = command.constructor.name;
    const handler = this.handlers.get(commandName);

    if (!handler) {
      throw new Error(`Handler para comando ${commandName} no encontrado`);
    }

    return handler.execute(command) as Promise<TResult>;
  }

  /**
   * Verifica si existe un handler para el comando
   * @param {ICommand} command - Comando a verificar
   * @returns {boolean} True si existe handler
   */
  hasHandler(command: ICommand): boolean {
    return this.handlers.has(command.constructor.name);
  }
}
