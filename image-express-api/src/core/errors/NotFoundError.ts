import { CustomError } from './CustomError';

/**
 * Error de recurso no encontrado
 * @class NotFoundError
 * @extends CustomError
 */
export class NotFoundError extends CustomError {
  constructor(message: string = 'Recurso no encontrado') {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}
