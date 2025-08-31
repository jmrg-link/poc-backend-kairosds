import { Request, Response, NextFunction } from 'express';
import {
  ValidationErrorHandler,
  NotFoundErrorHandler,
  BusinessErrorHandler,
  MongoErrorHandler,
  ErrorHandler,
  ErrorResponse,
} from '@core/errors/error-handlers';
import { NotFoundError } from '@core/errors';
import ansiColors from 'ansi-colors';

/**
 * @class ParamValidationErrorHandler
 * @extends ErrorHandler
 * @description Handler para errores de validación de parámetros de ruta
 */
class ParamValidationErrorHandler extends ErrorHandler {
  /**
   * @method canHandle
   * @param {unknown} error - Error a evaluar
   * @returns {boolean} true si es un error de validación de parámetros
   */
  canHandle(error: unknown): boolean {
    return error instanceof Error && error.name === 'ParamValidationError';
  }

  /**
   * @method handle
   * @param {unknown} error - Error a procesar
   * @returns {ErrorResponse} Respuesta estructurada
   */
  handle(error: unknown): ErrorResponse {
    const err = error as Error;
    return {
      error: 'PARAM_VALIDATION_ERROR',
      message: err.message || 'Parámetro de ruta inválido',
      statusCode: 400,
    };
  }
}

/**
 * @class QueryValidationErrorHandler
 * @extends ErrorHandler
 * @description Handler para errores de validación de query parameters
 */
class QueryValidationErrorHandler extends ErrorHandler {
  /**
   * @method canHandle
   * @param {unknown} error - Error a evaluar
   * @returns {boolean} true si es un error de validación de query
   */
  canHandle(error: unknown): boolean {
    return error instanceof Error && error.name === 'QueryValidationError';
  }

  /**
   * @method handle
   * @param {unknown} error - Error a procesar
   * @returns {ErrorResponse} Respuesta estructurada
   */
  handle(error: unknown): ErrorResponse {
    const err = error as Error;
    return {
      error: 'QUERY_VALIDATION_ERROR',
      message: err.message || 'Query parameter inválido',
      statusCode: 400,
    };
  }
}

/**
 * @class FormValidationErrorHandler
 * @extends ErrorHandler
 * @description Handler para errores de validación del body del formulario
 */
class FormValidationErrorHandler extends ErrorHandler {
  /**
   * @method canHandle
   * @param {unknown} error - Error a evaluar
   * @returns {boolean} true si es un error de validación del body
   */
  canHandle(error: unknown): boolean {
    return error instanceof Error && error.name === 'ValidationError';
  }

  /**
   * @method handle
   * @param {unknown} error - Error a procesar
   * @returns {ErrorResponse} Respuesta estructurada
   */
  handle(error: unknown): ErrorResponse {
    const err = error as Error;
    return {
      error: 'VALIDATION_ERROR',
      message: err.message || 'Datos de entrada inválidos',
      statusCode: 400,
    };
  }
}

/**
 * @function buildErrorHandlerChain
 * @description Construye la cadena de responsabilidad para el manejo de errores.
 * Sigue el principio Open/Closed: abierto a extensión, cerrado a modificación.
 * @returns {ErrorHandler} El primer eslabón de la cadena
 * @private
 */
function buildErrorHandlerChain(): ErrorHandler {
  const paramValidationHandler = new ParamValidationErrorHandler();
  const queryValidationHandler = new QueryValidationErrorHandler();
  const formValidationHandler = new FormValidationErrorHandler();
  const validationHandler = new ValidationErrorHandler();
  const notFoundHandler = new NotFoundErrorHandler();
  const businessHandler = new BusinessErrorHandler();
  const mongoHandler = new MongoErrorHandler();

  paramValidationHandler
    .setNext(queryValidationHandler)
    .setNext(formValidationHandler)
    .setNext(validationHandler)
    .setNext(notFoundHandler)
    .setNext(businessHandler)
    .setNext(mongoHandler);

  return paramValidationHandler;
}

/**
 * @function errorMiddleware
 * @description Middleware global para el manejo centralizado de errores en la aplicación.
 * Implementa el patrón Chain of Responsibility para procesar diferentes tipos de errores.
 * @param {Error} error - El error capturado por Express
 * @param {Request} req - Objeto request de Express
 * @param {Response} res - Objeto response de Express
 * @param {NextFunction} _next - Función next de Express (no utilizada pero requerida por la firma)
 * @returns {void}
 * @example
 * app.use(errorMiddleware);
 */
export function errorMiddleware(
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (process.env.NODE_ENV !== 'test' || !(error instanceof NotFoundError)) {
    console.error(
      ansiColors.red(`[ERROR] ${req.method} ${req.path}`),
      ansiColors.yellow(error.message)
    );
  }

  const errorChain = buildErrorHandlerChain();
  const response = errorChain.process(error);

  res.status(response.statusCode).json(response);
}

/**
 * @function notFoundHandler
 * @description Middleware para manejar rutas no encontradas (404)
 * @param {Request} req - Objeto request de Express
 * @param {Response} res - Objeto response de Express
 * @param {NextFunction} _next - Función next de Express (no utilizada)
 * @returns {void}
 */
export function notFoundHandler(req: Request, res: Response, _next: NextFunction): void {
  res.status(404).json({
    error: 'NOT_FOUND',
    message: `La ruta ${req.method} ${req.path} no existe`,
    statusCode: 404,
  });
}

/**
 * @function asyncHandler
 * @description Wrapper para manejar errores en funciones asíncronas automáticamente
 * @param {(req: Request, res: Response, next: NextFunction) => Promise<void>} fn - Función asíncrona a envolver
 * @returns {(req: Request, res: Response, next: NextFunction) => void} Función envuelta que captura errores automáticamente
 * @example
 * router.get('/users', asyncHandler(async (req, res) => {
 *   const users = await getUsersAsync();
 *   res.json(users);
 * }));
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
