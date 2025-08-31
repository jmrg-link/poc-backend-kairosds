/**
 * @file Implementación del repositorio de tareas para MongoDB.
 * @class TaskRepository
 * @implements {ITaskRepository}
 * @description Proporciona una capa de abstracción para interactuar con la colección de tareas en la base de datos,
 * implementando las operaciones definidas en `ITaskRepository`.
 */
import { Connection, Model } from 'mongoose';
import { TaskEntity } from '@domain/entities/TaskEntity';
import { ITaskRepository } from '@application/repositories/ITaskRepository';
import { getTaskModel } from '@infrastructure/schemas';

export class TaskRepository implements ITaskRepository {
  private readonly model: Model<TaskEntity>;

  /**
   * @constructor
   * @description Inicializa el repositorio obteniendo el modelo de Mongoose para las tareas
   * a partir de una conexión de base de datos existente.
   * @param {Connection} db - Conexión a la base de datos de MongoDB.
   */
  constructor(db: Connection) {
    this.model = getTaskModel(db);
  }

  /**
   * @method create
   * @description Inserta un nuevo documento de tarea en la base de datos.
   * @param {Partial<TaskEntity>} task - Objeto con los datos de la tarea a crear.
   * @returns {Promise<TaskEntity>} La entidad de la tarea recién creada.
   */
  async create(task: Partial<TaskEntity>): Promise<TaskEntity> {
    const created = await this.model.create(task);
    return created.toObject();
  }

  /**
   * @method findById
   * @description Busca una única tarea por su `_id` de MongoDB.
   * @param {string} id - El identificador único de la tarea.
   * @returns {Promise<TaskEntity | null>} La entidad de la tarea si se encuentra, o `null` en caso contrario.
   */
  async findById(id: string): Promise<TaskEntity | null> {
    return await this.model.findById(id).lean();
  }

  /**
   * @method findByIdempotencyKey
   * @description Busca una única tarea utilizando su clave de idempotencia.
   * @param {string} key - La clave de idempotencia utilizada al crear la tarea.
   * @returns {Promise<TaskEntity | null>} La entidad de la tarea si se encuentra, o `null`.
   */
  async findByIdempotencyKey(key: string): Promise<TaskEntity | null> {
    return await this.model.findOne({ idempotencyKey: key }).lean();
  }

  /**
   * @method updateStatus
   * @description Actualiza el estado y opcionalmente otros datos de una tarea existente.
   * También actualiza el campo `updatedAt` a la fecha y hora actuales.
   * @param {string} id - El ID de la tarea a actualizar.
   * @param {string} status - El nuevo estado para la tarea.
   * @param {Record<string, unknown>} [data] - Un objeto con campos adicionales para actualizar.
   * @returns {Promise<void>}
   */
  async updateStatus(id: string, status: string, data?: Record<string, unknown>): Promise<void> {
    const update = {
      status,
      ...data,
      updatedAt: new Date(),
    };

    await this.model.findByIdAndUpdate(id, update);
  }

  /**
   * @method find
   * @description Realiza una búsqueda de tareas aplicando filtros y paginación.
   * Los resultados se ordenan por fecha de creación descendente.
   * @param {Partial<TaskEntity>} filter - Objeto con los criterios de filtro.
   * @param {number} skip - Número de documentos a omitir (para paginación).
   * @param {number} limit - Número máximo de documentos a devolver.
   * @returns {Promise<TaskEntity[]>} Un array con las tareas encontradas.
   */
  async find(filter: Partial<TaskEntity>, skip: number, limit: number): Promise<TaskEntity[]> {
    return await this.model.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
  }

  /**
   * @method count
   * @description Cuenta el número total de documentos que coinciden con un filtro.
   * @param {Partial<TaskEntity>} filter - Objeto con los criterios de filtro.
   * @returns {Promise<number>} El número total de tareas que coinciden con el filtro.
   */
  async count(filter: Partial<TaskEntity>): Promise<number> {
    return await this.model.countDocuments(filter);
  }

  /**
   * @method updateOriginalPath
   * @description Actualiza la ruta del archivo de imagen original de una tarea específica.
   * @param {string} id - El ID de la tarea a actualizar.
   * @param {string} newPath - La nueva ruta definitiva del archivo original.
   * @returns {Promise<void>}
   */
  async updateOriginalPath(id: string, newPath: string): Promise<void> {
    await this.model.findByIdAndUpdate(id, { originalPath: newPath, updatedAt: new Date() });
  }
}
