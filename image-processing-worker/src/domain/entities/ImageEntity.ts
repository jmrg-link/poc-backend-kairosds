/**
 * Entidad de imagen
 * @interface ImageEntity
 */
export interface ImageEntity {
  _id?: string;
  taskId: string;
  path: string;
  resolution: string;
  md5: string;
  size?: number;
  format?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
