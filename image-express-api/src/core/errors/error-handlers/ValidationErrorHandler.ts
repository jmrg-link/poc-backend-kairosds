import { ValidationError } from 'class-validator';
import { ErrorHandler, ErrorResponse } from './ErrorHandler';

/**
 * Manejador de errores de validación
 * @class ValidationErrorHandler
 * @extends ErrorHandler
 */
export class ValidationErrorHandler extends ErrorHandler {
  canHandle(error: unknown): boolean {
    if (Array.isArray(error)) {
      return error.length > 0 && error[0] instanceof ValidationError;
    }

    return error instanceof ValidationError;
  }

  handle(error: unknown): ErrorResponse {
    const details: Record<string, string[]> = {};
    if (Array.isArray(error)) {
      const validationErrors = error as ValidationError[];
      validationErrors.forEach(err => {
        if (err.constraints) {
          details[err.property] = Object.values(err.constraints);
        }
      });
    }

    return {
      error: 'VALIDATION_ERROR',
      message: 'Los datos proporcionados no son válidos',
      statusCode: 422,
      details,
    };
  }
}
