import fs from 'fs';
import path from 'path';

/**
 * @function getRootPath
 * @description Obtiene la ruta raíz de la aplicación
 * @returns {string} Ruta absoluta del directorio raíz
 */
export function getRootPath(): string {
  return process.cwd();
}

/**
 * @function getInputStoragePath
 * @description Obtiene la ruta del directorio de almacenamiento de entrada
 * @returns {string} Ruta absoluta del directorio de imágenes de entrada
 */
export function getInputStoragePath(): string {
  return process.env.STORAGE_INPUT_PATH ?? path.join(getRootPath(), 'storage/images/input');
}

/**
 * @function getOutputStoragePath
 * @description Obtiene la ruta del directorio de almacenamiento de salida
 * @returns {string} Ruta absoluta del directorio de imágenes procesadas
 */
export function getOutputStoragePath(): string {
  return process.env.STORAGE_OUTPUT_PATH ?? path.join(getRootPath(), 'output');
}

/**
 * @function getTempPath
 * @description Obtiene la ruta del directorio temporal
 * @returns {string} Ruta absoluta del directorio temporal
 */
export function getTempPath(): string {
  return path.join(getRootPath(), 'temp');
}

/**
 * @function readFileSync
 * @description Lee un archivo de forma síncrona
 * @param {string} filePath - Ruta del archivo a leer
 * @returns {string} Contenido del archivo como string
 * @throws {Error} Si el archivo no existe o no se puede leer
 */
export function readFileSync(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

/**
 * @function readFile
 * @description Lee un archivo de forma asíncrona
 * @param {string} filePath - Ruta del archivo a leer
 * @returns {Promise<string>} Contenido del archivo como string
 * @throws {Error} Si el archivo no existe o no se puede leer
 */
export async function readFile(filePath: string): Promise<string> {
  return fs.promises.readFile(filePath, 'utf8');
}

/**
 * @function pathExists
 * @description Verifica si un archivo o directorio existe
 * @param {string} path - Ruta a verificar
 * @returns {boolean} True si existe, false en caso contrario
 */
export function pathExists(path: string): boolean {
  return fs.existsSync(path);
}

/**
 * @function ensureDirectory
 * @description Crea un directorio de forma recursiva si no existe
 * @param {string} dirPath - Ruta del directorio a crear
 * @returns {Promise<void>}
 * @throws {Error} Si no se puede crear el directorio
 */
export async function ensureDirectory(dirPath: string): Promise<void> {
  await fs.promises.mkdir(dirPath, { recursive: true });
}

/**
 * @function initializeStorageDirectories
 * @description Crea todos los directorios de almacenamiento necesarios para la aplicación
 * @returns {Promise<void>}
 * @throws {Error} Si no se pueden crear los directorios
 */
export async function initializeStorageDirectories(): Promise<void> {
  const directories = [
    getInputStoragePath(),
    getOutputStoragePath(),
    getTempPath(),
    path.join(getRootPath(), 'logs'),
  ];

  for (const dir of directories) {
    await ensureDirectory(dir);
  }
}

/**
 * @function getFileStats
 * @description Obtiene información estadística de un archivo
 * @param {string} filePath - Ruta del archivo
 * @returns {Promise<fs.Stats>} Estadísticas del archivo
 * @throws {Error} Si el archivo no existe
 */
export async function getFileStats(filePath: string): Promise<fs.Stats> {
  return fs.promises.stat(filePath);
}

/**
 * @function deleteFile
 * @description Elimina un archivo del sistema de archivos
 * @param {string} filePath - Ruta del archivo a eliminar
 * @returns {Promise<void>}
 * @throws {Error} Si no se puede eliminar el archivo
 */
export async function deleteFile(filePath: string): Promise<void> {
  await fs.promises.unlink(filePath);
}

/**
 * @function listFiles
 * @description Lista todos los archivos en un directorio
 * @param {string} dirPath - Ruta del directorio
 * @returns {Promise<string[]>} Array con nombres de archivos
 * @throws {Error} Si el directorio no existe o no se puede leer
 */
export async function listFiles(dirPath: string): Promise<string[]> {
  return fs.promises.readdir(dirPath);
}

/**
 * @function moveFile
 * @description Mueve un archivo de una ubicación a otra
 * @param {string} sourcePath - Ruta origen
 * @param {string} destPath - Ruta destino
 * @returns {Promise<void>}
 * @throws {Error} Si no se puede mover el archivo
 */
export async function moveFile(sourcePath: string, destPath: string): Promise<void> {
  await fs.promises.rename(sourcePath, destPath);
}

/**
 * @function copyFile
 * @description Copia un archivo de una ubicación a otra
 * @param {string} sourcePath - Ruta origen
 * @param {string} destPath - Ruta destino
 * @returns {Promise<void>}
 * @throws {Error} Si no se puede copiar el archivo
 */
export async function copyFile(sourcePath: string, destPath: string): Promise<void> {
  await fs.promises.copyFile(sourcePath, destPath);
}

export const paths = {
  root: getRootPath(),
  storage: {
    input: getInputStoragePath(),
    output: getOutputStoragePath(),
  },
  temp: getTempPath(),
};

export const readFiles = {
  readFileSync,
};

export const rootPath = getRootPath();
