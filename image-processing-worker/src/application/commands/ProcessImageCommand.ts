import { ICommand } from '@application/tasks';

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
