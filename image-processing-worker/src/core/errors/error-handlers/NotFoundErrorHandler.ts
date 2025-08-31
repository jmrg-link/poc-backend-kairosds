import { ErrorHandler, ErrorResponse } from './ErrorHandler';

/**
 * Manejador de errores NotFound
 * @class NotFoundErrorHandler
 * @extends ErrorHandler
 */
export class NotFoundErrorHandler extends ErrorHandler {
  canHandle(error: unknown): boolean {
    if (error instanceof Error) {
      return error.name === 'NotFoundError';
    }
    return false;
  }

  handle(error: unknown): ErrorResponse {
    const err = error as Error;
    return {
      error: 'NOT_FOUND',
      message: err.message || 'Recurso no encontrado',
      statusCode: 404,
    };
  }
}
