import { Router } from 'express';
/**
 * Interfaz para clase de rutas
 * @interface RouteClass
 */
export interface RouteClass {
  routes: Router;
  name: string;
}

/**
 * Interfaz para request con idempotencia
 * @interface RequestWithIdempotency
 */
export interface RequestWithIdempotency extends Request {
  idempotencyKey?: string;
}
