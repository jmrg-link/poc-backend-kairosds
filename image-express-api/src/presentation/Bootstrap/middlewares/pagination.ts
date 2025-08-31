import { Request, Response, NextFunction } from 'express';

/**
 * Middleware de paginación
 * @param {Request} req - Request Express
 * @param {Response} _res - Response Express
 * @param {NextFunction} next - Next middleware
 */
export function pagination(req: Request, _res: Response, next: NextFunction): void {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;

  req.pagination = {
    page: Math.max(1, page),
    limit: Math.min(100, Math.max(1, limit)),
    offset: (Math.max(1, page) - 1) * Math.min(100, Math.max(1, limit)),
  };

  next();
}
