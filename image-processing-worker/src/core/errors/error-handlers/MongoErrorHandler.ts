import { ErrorHandler, ErrorResponse } from './ErrorHandler';

interface MongoErrorWithCode extends Error {
  code?: number;
  keyPattern?: Record<string, unknown>;
}

/**
 * Manejador de errores MongoDB
 * @class MongoErrorHandler
 * @extends ErrorHandler
 */
export class MongoErrorHandler extends ErrorHandler {
  canHandle(error: unknown): boolean {
    if (error instanceof Error) {
      return (
        error.name === 'MongoError' ||
        error.name === 'MongoServerError' ||
        error.name === 'CastError'
      );
    }
    return false;
  }

  handle(error: unknown): ErrorResponse {
    const mongoError = error as MongoErrorWithCode;

    if (mongoError.code === 11000) {
      return {
        error: 'DUPLICATE_KEY',
        message: 'El registro ya existe',
        statusCode: 409,
        details: mongoError.keyPattern,
      };
    }

    if ((error as Error).name === 'CastError') {
      return {
        error: 'INVALID_ID',
        message: 'ID inválido',
        statusCode: 400,
      };
    }

    return {
      error: 'DATABASE_ERROR',
      message: 'Error en la base de datos',
      statusCode: 503,
    };
  }
}
