import { createHash, randomBytes } from 'node:crypto';
import { Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

/**
 * Genera un identificador único (UUID)
 * @returns {string} UUID generado
 */
export function generateUUID(): string {
  return uuidv4();
}

/**
 * Genera un hash MD5 de un string o buffer
 * @param {string | Buffer} data - Datos a hashear
 * @returns {string} Hash MD5 en formato hexadecimal
 */
export function generateMD5(data: string | Buffer): string {
  return createHash('md5').update(data).digest('hex');
}

/**
 * Genera un ObjectId de MongoDB
 * @returns {string} Representación string del ObjectId
 */
export function generateId(): string {
  return new Types.ObjectId().toString();
}

/**
 * Genera un token aleatorio
 * @param {number} [bytes=16] - Número de bytes aleatorios
 * @returns {string} Token aleatorio en formato hexadecimal
 */
export function generateToken(bytes: number = 16): string {
  return randomBytes(bytes).toString('hex');
}

/**
 * Genera un hash SHA256
 * @param {string | Buffer} data - Datos a hashear
 * @returns {string} Hash SHA256 en formato hexadecimal
 */
export function generateSHA256(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Genera un nombre de archivo único con timestamp y sufijo aleatorio
 * @param {string} originalName - Nombre original del archivo
 * @returns {string} Nombre de archivo único
 */
export function generateUniqueFilename(originalName: string): string {
  const timestamp = Date.now();
  const randomSuffix = randomBytes(6).toString('hex');
  const extension = originalName.split('.').pop();
  const baseName = originalName.replace(/\.[^/.]+$/, '');
  return `${baseName}-${timestamp}-${randomSuffix}.${extension}`;
}

/**
 * Genera un identificador único corto (8 caracteres)
 * @returns {string} ID corto aleatorio
 */
export function generateShortId(): string {
  return randomBytes(4).toString('hex');
}

/**
 * Valida si un string es un ObjectId válido de MongoDB
 * @param {string} id - String a validar
 * @returns {boolean} True si es un ObjectId válido
 */
export function isValidObjectId(id: string): boolean {
  return Types.ObjectId.isValid(id);
}
