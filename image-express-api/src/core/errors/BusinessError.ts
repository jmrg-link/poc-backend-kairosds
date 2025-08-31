import { CustomError } from './CustomError';

/**
 * Error de lógica de negocio
 * @class BusinessError
 * @extends CustomError
 */
export class BusinessError extends CustomError {
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    statusCode: number = 400,
    details?: Record<string, unknown>
  ) {
    super(message, statusCode);
    this.code = code;
    this.details = details;
    this.name = 'BusinessError';
  }
}
