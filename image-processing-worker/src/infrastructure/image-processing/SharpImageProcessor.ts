import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { generateMD5 } from '@core/helpers/crypto';
import { logger } from '@core/helpers/logger';
import { rootPath } from '@core/helpers/fileDirectory';

/**
 * @interface ProcessedImageResult
 * @description Define la estructura del resultado de una imagen procesada.
 */
interface ProcessedImageResult {
  resolution: string;
  path: string;
}

/**
 * @class SharpImageProcessor
 * @description Encapsula la lógica de procesamiento de imágenes utilizando la librería Sharp.
 */
export class SharpImageProcessor {
  private readonly resolutions = [1024, 800];

  /**
   * @method process
   * @description Redimensiona una imagen a las resoluciones predefinidas.
   * @param {string} originalPath - La ruta al archivo de imagen original.
   * @returns {Promise<ProcessedImageResult[]>} Una promesa que resuelve a un array con los resultados.
   */
  public async process(originalPath: string): Promise<ProcessedImageResult[]> {
    const results: ProcessedImageResult[] = [];
    const ext = path.extname(originalPath);
    const originalName = path.basename(originalPath, ext);
    const parts = originalName.split('-');
    let baseName = originalName;

    if (parts.length > 2) {
      const lastPart = parts[parts.length - 1];
      const secondLastPart = parts[parts.length - 2];

      if (lastPart.length === 12 && /^\d+$/.test(secondLastPart)) {
        baseName = parts.slice(0, -2).join('-');
      }
    }

    logger.info('Starting image processing', { originalPath, baseName });

    // Extraer el taskId de la ruta original
    const pathParts = originalPath.split(path.sep);
    const imagesIndex = pathParts.indexOf('images');
    const taskId = imagesIndex !== -1 ? pathParts[imagesIndex + 1] : 'default';

    for (const res of this.resolutions) {
      const outputDir = path.join(rootPath, 'storage', 'images', taskId, 'variants', res.toString());
      await fs.mkdir(outputDir, { recursive: true });

      const processedBuffer = await sharp(originalPath)
        .resize(res)
        .toBuffer();

      const md5Hash = generateMD5(processedBuffer);
      const outputPath = path.join(outputDir, `${md5Hash}${ext}`);

      await fs.writeFile(outputPath, processedBuffer);

      results.push({
        resolution: res.toString(),
        path: outputPath,
      });

      logger.info(`Generated variant`, {
        resolution: res,
        path: outputPath,
        md5: md5Hash
      });
    }

    return results;
  }
}
