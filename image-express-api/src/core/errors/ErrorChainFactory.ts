import { ErrorHandler } from './error-handlers/ErrorHandler';
import { ValidationErrorHandler } from './error-handlers/ValidationErrorHandler';
import { MongoErrorHandler } from './error-handlers/MongoErrorHandler';
import { NotFoundErrorHandler } from './error-handlers/NotFoundErrorHandler';
import { BusinessErrorHandler } from './error-handlers/BusinessErrorHandler';

/**
 * Factory para crear la cadena de responsabilidad de errores
 * @class ErrorChainFactory
 */
export class ErrorChainFactory {
  /**
   * Crea la cadena de manejadores de error
   * @static
   * @returns {ErrorHandler} Primer handler de la cadena
   */
  static createChain(): ErrorHandler {
    const validationHandler = new ValidationErrorHandler();
    const mongoHandler = new MongoErrorHandler();
    const notFoundHandler = new NotFoundErrorHandler();
    const businessHandler = new BusinessErrorHandler();

    validationHandler.setNext(mongoHandler).setNext(notFoundHandler).setNext(businessHandler);

    return validationHandler;
  }
}
