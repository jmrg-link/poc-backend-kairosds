import { ImageEntity } from '@domain/entities/ImageEntity';

/**
 * Interfaz del repositorio de imágenes
 * @interface IImageRepository
 */
export interface IImageRepository {
  create(image: Partial<ImageEntity>): Promise<ImageEntity>;
  findByTaskId(taskId: string): Promise<ImageEntity[]>;
  deleteByTaskId(taskId: string): Promise<void>;
}
