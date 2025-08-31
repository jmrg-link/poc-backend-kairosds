import { IsNotEmpty, IsMongoId } from 'class-validator';

export class GetTaskParamsDto {
  @IsNotEmpty({ message: 'taskId es requerido' })
  @IsMongoId({ message: 'taskId debe ser un ObjectId válido' })
  taskId!: string;
}
