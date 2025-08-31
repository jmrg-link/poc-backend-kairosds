import { Request, Response, NextFunction, RequestHandler } from 'express';
import { validate, ValidationError } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { ClassConstructor } from 'class-transformer/types/interfaces';

/**
 * @function formatValidationErrors
 * @description Transforma un array de errores de class-validator en un mensaje de error legible
 * @param {ValidationError[]} errors - Array de errores generados por class-validator
 * @returns {string} Mensaje de error concatenado con todos los constraints separados por punto y coma
 * @example
 * formatValidationErrors([{constraints: {isNotEmpty: 'Field is required'}}])
 * // Returns: "Field is required"
 */
function formatValidationErrors(errors: ValidationError[]): string {
  return errors.map(error => Object.values(error.constraints || {}).join(', ')).join('; ');
}

/**
 * @function validationMiddleware
 * @description Middleware para validar el body de las peticiones HTTP contra un DTO usando class-validator.
 * Omite la validación para peticiones multipart/form-data ya que estas se manejan por Multer.
 * @template T - Tipo del DTO que extiende de object
 * @param {ClassConstructor<T>} type - Constructor de la clase DTO para validación
 * @param {boolean} [skipMissingProperties=false] - Si true, no valida propiedades faltantes
 * @returns {RequestHandler} Middleware de Express que valida el body
 * @throws {ValidationError} Lanza error con nombre 'ValidationError' si la validación falla
 * @sideeffects Añade req.validatedBody con el DTO validado y transformado
 * @example
 * router.post('/tasks', validationMiddleware(CreateTaskDto), controller.create)
 */
export function validationMiddleware<T extends object>(
  type: ClassConstructor<T>,
  skipMissingProperties = false
): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (typeof (req as any).is === 'function' && (req as any).is('multipart/form-data')) {
        return next();
      }

      if ((req as any).file) {
        return next();
      }

      const dto = plainToClass(type, req.body);
      const errors = await validate(dto, {
        skipMissingProperties,
        whitelist: true,
        forbidNonWhitelisted: true,
      });

      if (errors.length > 0) {
        const formattedError = new Error(formatValidationErrors(errors));
        formattedError.name = 'ValidationError';
        next(formattedError);
      } else {
        req.validatedBody = dto as T;
        next();
      }
    } catch (error) {
      next(error);
    }
  };
}

/**
 * @function paramsValidationMiddleware
 * @description Middleware para validar los parámetros de ruta (req.params) contra un DTO.
 * Especialmente útil para validar IDs en rutas como /tasks/:taskId
 * @template T - Tipo del DTO que extiende de object
 * @param {ClassConstructor<T>} type - Constructor de la clase DTO para validación de parámetros
 * @returns {RequestHandler} Middleware de Express que valida los parámetros de ruta
 * @throws {ParamValidationError} Lanza error con nombre 'ParamValidationError' si la validación falla
 * @sideeffects Añade req.validatedParams con los parámetros validados y transformados
 * @example
 * router.get('/tasks/:taskId', paramsValidationMiddleware(GetTaskParamsDto), controller.getById)
 */
export function paramsValidationMiddleware<T extends object>(
  type: ClassConstructor<T>
): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = plainToClass(type, req.params);
      const errors = await validate(dto);

      if (errors.length > 0) {
        const formattedError = new Error(formatValidationErrors(errors));
        formattedError.name = 'ParamValidationError';
        next(formattedError);
      } else {
        req.validatedParams = dto as unknown as Record<string, string>;
        next();
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      const validationError = new Error('Formato de parámetro inválido');
      validationError.name = 'ParamValidationError';
      next(validationError);
    }
  };
}

/**
 * @function queryValidationMiddleware
 * @description Middleware para validar los query parameters (req.query) contra un DTO.
 * Útil para validar filtros, paginación y otros parámetros de consulta
 * @template T - Tipo del DTO que extiende de object
 * @param {ClassConstructor<T>} type - Constructor de la clase DTO para validación de query params
 * @returns {RequestHandler} Middleware de Express que valida los query parameters
 * @throws {QueryValidationError} Lanza error con nombre 'QueryValidationError' si la validación falla
 * @sideeffects Añade req.validatedQuery con los query params validados y transformados
 * @example
 * router.get('/tasks', queryValidationMiddleware(PaginationDto), controller.list)
 */
export function queryValidationMiddleware<T extends object>(
  type: ClassConstructor<T>
): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = plainToClass(type, req.query);
      const errors = await validate(dto);

      if (errors.length > 0) {
        const formattedError = new Error(formatValidationErrors(errors));
        formattedError.name = 'QueryValidationError';
        next(formattedError);
      } else {
        req.validatedQuery = dto as unknown as Record<string, string>;
        next();
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      const validationError = new Error('Formato de query parameter inválido');
      validationError.name = 'QueryValidationError';
      next(validationError);
    }
  };
}

/**
 * @interface Express.Request
 * @description Extensión de la interfaz Request de Express para incluir propiedades personalizadas
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      validatedBody?: any;
      validatedParams?: Record<string, string>;
      validatedQuery?: Record<string, string>;
    }
  }
}
