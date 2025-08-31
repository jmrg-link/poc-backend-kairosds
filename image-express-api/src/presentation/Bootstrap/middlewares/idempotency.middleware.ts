import { Request, Response, NextFunction } from 'express';

/**
 * Middleware de idempotencia
 * @param {Request} req - Request Express
 * @param {Response} _res - Response Express
 * @param {NextFunction} next - Next middleware
 */
export function idempotencyMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const key = req.headers['x-idempotency-key'] as string | undefined;
  if (key) {
    (req as Request & { idempotencyKey?: string }).idempotencyKey = key;
  }

  next();
}
