/**
 * Servicio para descarga de imágenes desde URLs
 * @class ImageDownloadService
 */
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import slugify from 'slugify';
import { envs } from '@config/envs';
import { BusinessError } from '@core/errors';

interface StreamResponse {
  data: NodeJS.ReadableStream;
  headers: Record<string, string>;
  status: number;
}

export class ImageDownloadService {
  private readonly uploadsDir = envs.STORAGE.INPUT_PATH;
  private readonly timeout = 30000;

  /**
   * Descarga imagen desde URL
   * @param {string} url - URL de la imagen a descargar
   * @returns {Promise<string>} Path de la imagen descargada
   * @throws {BusinessError} Si falla la descarga
   */
  async download(url: string): Promise<string> {
    try {
      const response = (await axios({
        method: 'GET',
        url: url,
        responseType: 'stream',
        timeout: this.timeout,
      })) as unknown as StreamResponse;

      const contentType = response.headers['content-type'];
      if (!contentType?.startsWith('image/')) {
        throw new BusinessError(
          `URL no contiene una imagen válida: ${contentType}`,
          'INVALID_CONTENT_TYPE',
          400
        );
      }

      const ext = this.getExtensionFromMime(contentType);
      let base = 'image';
      try {
        const urlObj = new URL(url);
        const original = path.basename(urlObj.pathname, path.extname(urlObj.pathname));
        base = slugify(original, { lower: true, strict: true }) || 'image';
      } catch {
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        base || undefined;
        console.log(`Error al procesar URL: ${url}`);
      }
      const filename = `${base}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
      const filepath = path.join(this.uploadsDir, filename);
      await fs.mkdir(this.uploadsDir, { recursive: true });
      const writer = await fs.open(filepath, 'w');
      const stream = writer.createWriteStream();

      response.data.pipe(stream);

      return new Promise((resolve, reject) => {
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        stream.on('finish', async () => {
          try {
            await writer.close();
            resolve(filepath);
          } catch (error) {
            reject(error);
          }
        });
        stream.on('error', reject);
      });
    } catch (error) {
      if (error instanceof BusinessError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';

      throw new BusinessError(`Error descargando imagen: ${errorMessage}`, 'DOWNLOAD_ERROR', 500);
    }
  }

  /**
   * Obtiene extensión desde MIME type
   * @private
   * @param {string} mime - MIME type del archivo
   * @returns {string} Extensión correspondiente
   */
  private getExtensionFromMime(mime: string): string {
    const mimeToExt: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
    };
    return mimeToExt[mime] || '.jpg';
  }
}
