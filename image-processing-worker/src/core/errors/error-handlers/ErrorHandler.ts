/**
 * Respuesta estructurada de error
 * @interface ErrorResponse
 */
export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  details?: Record<string, unknown>;
}

/**
 * Clase abstracta base para el patrón Chain of Responsibility
 * @abstract
 * @class ErrorHandler
 */
export abstract class ErrorHandler {
  protected nextHandler: ErrorHandler | null = null;

  /**
   * Establece el siguiente manejador en la cadena
   * @param {ErrorHandler} handler - Siguiente manejador
   * @returns {ErrorHandler} Handler establecido
   */
  setNext(handler: ErrorHandler): ErrorHandler {
    this.nextHandler = handler;
    return handler;
  }

  /**
   * Determina si puede manejar el error
   * @abstract
   * @param {unknown} error - Error a evaluar
   * @returns {boolean} true si puede manejar
   */
  abstract canHandle(error: unknown): boolean;

  /**
   * Procesa el error
   * @abstract
   * @param {unknown} error - Error a procesar
   * @returns {ErrorResponse} Respuesta estructurada
   */
  abstract handle(error: unknown): ErrorResponse;

  /**
   * Procesa el error a través de la cadena
   * @param {unknown} error - Error a procesar
   * @returns {ErrorResponse} Respuesta estructurada
   */
  process(error: unknown): ErrorResponse {
    if (this.canHandle(error)) {
      return this.handle(error);
    }

    if (this.nextHandler) {
      return this.nextHandler.process(error);
    }

    return {
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Ha ocurrido un error inesperado',
      statusCode: 500,
    };
  }
}
