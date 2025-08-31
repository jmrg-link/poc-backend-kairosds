import { Request, Response, NextFunction } from 'express';
import multer from 'multer';

/**
 * Middleware de manejo de errores de Multer
 * @param {Error} error - Error capturado
 * @param {Request} _req - Request Express
 * @param {Response} res - Response Express
 * @param {NextFunction} next - Next middleware
 */
export function multerErrorMiddleware(
  error: Error,
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({
        error: 'FILE_TOO_LARGE',
        message: 'El archivo excede el tamaño máximo de 10MB',
      });
    } else if (error.code === 'LIMIT_FILE_COUNT') {
      res.status(400).json({
        error: 'TOO_MANY_FILES',
        message: 'Solo se permite un archivo por solicitud',
      });
    } else {
      res.status(400).json({
        error: 'UPLOAD_ERROR',
        message: error.message,
      });
    }
  } else {
    next(error);
  }
}
