import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { Request } from 'express';
import { getInputStoragePath } from '@core/helpers/fileDirectory';

const VALID_IMAGE_MIMES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'] as const;

/**
 * @description Configuración de almacenamiento en disco para Multer.
 * Los archivos se guardan temporalmente en el directorio de entrada
 * antes de ser movidos a su ubicación final por el servicio de tareas.
 */
const diskStorage = multer.diskStorage({
  destination: function (_req: Request, _file: Express.Multer.File, cb) {
    try {
      const inputDir = getInputStoragePath();

      if (!fs.existsSync(inputDir)) {
        fs.mkdirSync(inputDir, { recursive: true });
      }

      cb(null, inputDir);
    } catch (err) {
      cb(err as Error, getInputStoragePath());
    }
  },
  filename: function (_req: Request, file: Express.Multer.File, cb) {
    const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(6).toString('hex');
    const ext = path.extname(file.originalname).toLowerCase();
    const name = path.basename(file.originalname, ext);
    const sanitizedName = name.replace(/[^a-zA-Z0-9-_]/g, '_');
    cb(null, `${sanitizedName}-${uniqueSuffix}${ext}`);
  },
});

/**
 * @description Filtro para validar que los archivos subidos sean imágenes válidas
 * @param {Request} _req - Request de Express
 * @param {Express.Multer.File} file - Archivo siendo validado
 * @param {multer.FileFilterCallback} cb - Callback de validación
 */
const imageFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const isValidMime = VALID_IMAGE_MIMES.includes(
    file.mimetype as (typeof VALID_IMAGE_MIMES)[number]
  );

  if (!isValidMime) {
    cb(
      new Error(
        `Tipo de archivo no soportado: ${file.mimetype}. Solo se permiten: ${VALID_IMAGE_MIMES.join(', ')}`
      )
    );
    return;
  }

  cb(null, true);
};

/**
 * @description Configuración de Multer para almacenamiento en disco.
 * Limita el tamaño de archivo a 10MB y acepta solo un archivo por petición.
 */
export const uploadToDisk = multer({
  storage: diskStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
  },
});

/**
 * @description Configuración de Multer para almacenamiento en memoria.
 * Útil para operaciones que requieren procesar el archivo antes de guardarlo.
 */
export const uploadToMemory = multer({
  storage: multer.memoryStorage(),
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
  },
});
