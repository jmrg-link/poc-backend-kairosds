import { IsEnum, IsOptional, IsArray, IsString } from 'class-validator';
import { TaskStatus } from '@domain/entities/TaskEntity';

/**
 * DTO para actualización de tarea
 * @class UpdateTaskDto
 */
export class UpdateTaskDto {
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsArray()
  images?: Array<{
    resolution: string;
    path: string;
  }>;

  @IsOptional()
  @IsString()
  error?: string;
}
