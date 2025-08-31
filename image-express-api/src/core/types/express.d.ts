import { Request, Response } from 'express';

/**
 * Configuración de paginación procesada
 * @interface PaginationData
 */
export interface PaginationData {
  page: number;
  limit: number;
  offset: number;
}

/**
 * Request tipado con genéricos
 * @interface ExpressRequest
 */
export interface ExpressRequest<
  P = unknown,
  ResBody = unknown,
  ReqBody = unknown,
  ReqQuery = unknown,
> extends Request<P, ResBody, ReqBody, ReqQuery> {
  idempotencyKey?: string;
  userId?: string;
  pagination?: PaginationData;
  validatedQuery?: any;
  validatedBody?: any;
  validatedParams?: any;
}

/**
 * Response tipado
 * @interface ExpressResponse
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ExpressResponse<T = unknown> extends Response<T> {}

declare global {
  namespace Express {
    interface Request {
      pagination?: PaginationData;
      validatedQuery?: any;
      validatedBody?: any;
      validatedParams?: any;
      idempotencyKey?: string;
      userId?: string;
    }
  }
}
