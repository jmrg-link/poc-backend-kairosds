import { Schema, Connection } from 'mongoose';
import { TaskEntity, TaskStatus } from '@domain/entities/TaskEntity';

const TaskSchema = new Schema<TaskEntity>(
  {
    status: {
      type: String,
      enum: Object.values(TaskStatus),
      default: TaskStatus.PENDING,
      required: true,
      index: true,
    },
    price: {
      type: Number,
      required: true,
      min: 5,
      max: 50,
    },
    originalPath: {
      type: String,
      required: true,
    },
    images: [
      {
        resolution: {
          type: String,
          enum: ['1024', '800'],
          required: true,
        },
        path: {
          type: String,
          required: true,
        },
      },
    ],
    error: {
      type: String,
    },
    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true,
    },
  },
  {
    timestamps: true,
  }
);

TaskSchema.index({ status: 1, createdAt: -1 });

/**
 * Obtiene el modelo Task para una conexión
 * @param {Connection} db - Conexión MongoDB
 * @returns {Model} Modelo Task
 */
export function getTaskModel(db: Connection) {
  return db.model<TaskEntity>('Task', TaskSchema, 'tasks');
}
