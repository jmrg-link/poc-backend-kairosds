import { ICommand } from '@application/core';

/**
 * Comando para procesar imagen
 * @class ProcessImageCommand
 */
export class ProcessImageCommand implements ICommand {
  constructor(
    public readonly taskId: string,
    public readonly imagePath: string
  ) {}
}
