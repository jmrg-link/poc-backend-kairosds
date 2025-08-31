/**
 * DTO de respuesta de tarea
 * @interface TaskResponseDto
 */
export interface TaskResponseDto {
  taskId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  price: number;
  images?: Array<{
    resolution: '1024' | '800';
    path: string;
  }>;
  error?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
