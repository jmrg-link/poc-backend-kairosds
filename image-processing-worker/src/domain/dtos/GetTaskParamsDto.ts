import { IsMongoId, IsNotEmpty } from 'class-validator';
import { ParamsDictionary } from 'express-serve-static-core';

/**
 * DTO para parámetros de consulta de tarea
 * @class GetTaskParamsDto
 */
export class GetTaskParamsDto implements ParamsDictionary {
  [key: string]: string;

  /**
   * ID de la tarea en formato ObjectId
   * @example "65d4a54b89c5e342b2c2c5f6"
   */
  @IsNotEmpty({ message: 'taskId es requerido' })
  @IsMongoId({ message: 'taskId debe ser un ObjectId válido' })
  taskId!: string;
}
