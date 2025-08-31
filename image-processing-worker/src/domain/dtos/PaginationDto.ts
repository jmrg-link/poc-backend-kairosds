import { IsOptional, IsInt, Min, Max, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { TaskStatus } from '@domain/entities/TaskEntity';

/**
 * DTO para paginación y filtros
 * @class PaginationDto
 */
export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page debe ser un entero' })
  @Min(1, { message: 'page debe ser >= 1' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit debe ser un entero' })
  @Min(1, { message: 'limit debe ser >= 1' })
  @Max(100, { message: 'limit debe ser <= 100' })
  limit?: number = 10;

  @IsOptional()
  @IsIn(['pending', 'processing', 'completed', 'failed'])
  status?: TaskStatus;
}
