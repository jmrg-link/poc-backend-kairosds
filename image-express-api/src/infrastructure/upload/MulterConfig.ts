/**
 * Configuración de Multer para upload de imágenes
 */
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { Request } from 'express';
import { envs } from '@config/envs';
import { rootPath } from '@core/helpers/fileDirectory';

const VALID_IMAGE_MIMES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'] as const;

/**
 * Configuración de almacenamiento en disco
 */
const diskStorage = multer.diskStorage({
  destination: function (_req: Request, _file: Express.Multer.File, cb) {
    try {
      const inputDir = path.join(rootPath, 'storage', 'images', 'input');
      if (!fs.existsSync(inputDir)) {
        fs.mkdirSync(inputDir, { recursive: true });
      }
      cb(null, inputDir);
    } catch (err) {
      cb(err as Error, envs.STORAGE.INPUT_PATH);
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
 * Filtro de archivos para imágenes
 * @param {Request} _req - Request Express
 * @param {Express.Multer.File} file - Archivo subido
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
 * Configuración para upload en disco
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
 * Configuración para upload en memoria
 */
export const uploadToMemory = multer({
  storage: multer.memoryStorage(),
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
  },
});
