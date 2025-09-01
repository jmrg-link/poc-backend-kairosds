import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { generateMD5 } from '@core/helpers/crypto';
import { logger } from '@core/helpers/logger';
import { getRootPath } from '@core/helpers/fileDirectory';

interface ProcessedImageResult {
  resolution: string;
  path: string;
}

/**
 * @class SharpImageProcessor
 * @description Servicio de procesamiento de imágenes que genera variantes en diferentes resoluciones
 * manteniendo el aspect ratio original. Las imágenes procesadas se almacenan siguiendo
 * la estructura /output/{nombre_original}/{resolucion}/{md5}.{ext}
 */
export class SharpImageProcessor {
  private readonly resolutions = [1024, 800];

  /**
   * @method process
   * @description Procesa una imagen original generando variantes en las resoluciones definidas.
   * Cada variante se nombra con el hash MD5 de su contenido para garantizar unicidad.
   * @param {string} originalPath - Ruta absoluta al archivo de imagen original
   * @returns {Promise<ProcessedImageResult[]>} Array con información de las variantes generadas
   * @throws {Error} Si la imagen no puede ser procesada o guardada
   */
  public async process(originalPath: string): Promise<ProcessedImageResult[]> {
    const results: ProcessedImageResult[] = [];
    const ext = path.extname(originalPath);
    const originalFileName = path.basename(originalPath, ext);

    const parts = originalFileName.split('-');
    let cleanName = originalFileName;

    if (parts.length > 2) {
      const lastPart = parts[parts.length - 1];
      const secondLastPart = parts[parts.length - 2];

      if (lastPart.length === 12 && /^\d+$/.test(secondLastPart)) {
        cleanName = parts.slice(0, -2).join('-');
      }
    }

    logger.info('Starting image processing', {
      originalPath,
      cleanName,
    });

    for (const resolution of this.resolutions) {
      const outputDir = path.join(getRootPath(), 'output', cleanName, resolution.toString());

      await fs.mkdir(outputDir, { recursive: true });

      const processedBuffer = await sharp(originalPath)
        .resize(resolution, null, {
          withoutEnlargement: true,
          fit: 'inside',
        })
        .toBuffer();

      const md5Hash = generateMD5(processedBuffer);
      const outputPath = path.join(outputDir, `${md5Hash}${ext}`);

      await fs.writeFile(outputPath, processedBuffer);

      results.push({
        resolution: resolution.toString(),
        path: outputPath,
      });

      logger.info('Generated variant', {
        resolution,
        path: outputPath,
        md5: md5Hash,
      });
    }

    return results;
  }
}
