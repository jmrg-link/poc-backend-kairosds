import { ErrorHandler, ErrorResponse } from './ErrorHandler';
import { BusinessError } from '../BusinessError';

/**
 * Manejador de errores de negocio
 * @class BusinessErrorHandler
 * @extends ErrorHandler
 */
export class BusinessErrorHandler extends ErrorHandler {
  canHandle(error: unknown): boolean {
    return error instanceof BusinessError;
  }

  handle(error: unknown): ErrorResponse {
    const businessError = error as BusinessError;
    return {
      error: businessError.code,
      message: businessError.message,
      statusCode: businessError.statusCode,
      details: businessError.details,
    };
  }
}
