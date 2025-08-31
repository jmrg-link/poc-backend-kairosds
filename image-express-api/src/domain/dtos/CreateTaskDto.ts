import { IsUrl, IsString, ValidateIf } from 'class-validator';
import { Request } from 'express';

/**
 * DTO para creación de tarea
 * @class CreateTaskDto
 */
export class CreateTaskDto {
  @ValidateIf(o => !o.imageUrl)
  @IsString()
  imagePath?: string;

  @ValidateIf(o => !o.imagePath)
  @IsUrl()
  imageUrl?: string;
}

/**
 * Request extendido para creación de tareas
 * @interface CreateTaskRequest
 */
export interface CreateTaskRequest extends Request {
  body: CreateTaskDto;
  file?: Express.Multer.File;
}
