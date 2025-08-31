import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

/**
 * Configura los fixtures de prueba
 * Crea la estructura de directorios y archivos necesarios para las pruebas
 */
export function setupTestFixtures(): void {
  const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '../fixtures');
  const imagesDir = join(fixturesDir, 'images');

  if (!existsSync(imagesDir)) {
    mkdirSync(imagesDir, { recursive: true });

    const dummyImage = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64'
    );

    writeFileSync(join(imagesDir, 'puppy_01.jpg'), new Uint8Array(dummyImage.buffer, dummyImage.byteOffset, dummyImage.byteLength));
    writeFileSync(join(imagesDir, 'puppy_02.jpg'), new Uint8Array(dummyImage.buffer, dummyImage.byteOffset, dummyImage.byteLength));
    writeFileSync(join(imagesDir, 'puppy_03.jpg'), new Uint8Array(dummyImage.buffer, dummyImage.byteOffset, dummyImage.byteLength));

    console.log('✅ Fixtures de prueba creados en:', imagesDir);
  }
}