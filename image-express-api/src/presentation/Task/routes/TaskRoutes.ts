/**
 * Configuración de rutas para el módulo de tareas
 * @class TaskRoutes
 */
import { Router } from 'express';
import { TaskController } from '../controllers';
import { TaskRepository } from '../repositories';
import { TaskService } from '../services/TaskService';
import { TaskQueueProducer } from '@infrastructure/queues';
import { DatabaseConnector } from '@infrastructure/databases';
import { uploadToDisk } from '@infrastructure/upload/MulterConfig';
import { ImageDownloadService } from '@application/services';

import {
  validationMiddleware,
  paramsValidationMiddleware,
  queryValidationMiddleware,
  idempotencyMiddleware,
  pagination,
} from '@presentation/Bootstrap/middlewares';
import { CreateTaskDto, GetTaskParamsDto, PaginationDto } from '@domain/dtos';

export class TaskRoutes {
  /**
   * @static
   * @getter
   * @description Punto de entrada principal para acceder al router de tareas.
   * Este getter estático inicializa todas las dependencias necesarias
   * y configura los endpoints con sus respectivos middlewares y controladores.
   * @returns {Router} Una instancia de Express Router con todas las rutas de tareas configuradas.
   */
  static get routes(): Router {
    const router = Router();
    const controller = this.createTaskController();

    /**
     * @section Endpoints Públicos de la API
     * @description Rutas documentadas en Swagger para la interacción principal con el servicio.
     */

    /**
     * @route GET /tasks
     * @description Obtiene una lista paginada de tareas. Soporta filtros por estado.
     * @middleware pagination - Procesa los parámetros de paginación (page, limit).
     * @middleware queryValidationMiddleware - Valida los parámetros de consulta contra `PaginationDto`.
     */
    router.get(
      '/tasks',
      [pagination, queryValidationMiddleware(PaginationDto)],
      controller.list.bind(controller)
    );

    /**
     * @route POST /tasks
     * @description Crea una nueva tarea de procesamiento de imagen.
     * Acepta datos tanto de un cuerpo JSON (`imageUrl`, `imagePath`) como de un formulario `multipart/form-data` con un campo 'image'.
     * @middleware idempotencyMiddleware - Asegura que la operación no se procese múltiples veces si se reintenta.
     * @middleware uploadToDisk.single('image') - Procesa la subida de un archivo de imagen.
     * @middleware validationMiddleware - Valida el cuerpo de la solicitud contra `CreateTaskDto`.
     */
    router.post(
      '/tasks',
      [idempotencyMiddleware, uploadToDisk.single('image'), validationMiddleware(CreateTaskDto)],
      controller.create.bind(controller)
    );

    /**
     * @route POST /tasks/upload
     * @description Endpoint específico para la creación de tareas mediante la subida directa de un archivo.
     * @middleware idempotencyMiddleware - Previene la duplicación de tareas.
     * @middleware uploadToDisk.single('image') - Maneja la subida del archivo.
     */
    router.post(
      '/tasks/upload',
      [idempotencyMiddleware, uploadToDisk.single('image')],
      controller.createWithUpload.bind(controller)
    );

    /**
     * @route GET /tasks/:taskId
     * @description Consulta el estado y los detalles de una tarea específica por su ID.
     * @middleware paramsValidationMiddleware - Valida que el `taskId` en la URL sea válido.
     */
    router.get(
      '/tasks/:taskId',
      [paramsValidationMiddleware(GetTaskParamsDto)],
      controller.getById.bind(controller)
    );

    /**
     * @route POST /tasks/:taskId/retry
     * @description Reintenta el procesamiento de una tarea que ha fallado previamente.
     * @middleware paramsValidationMiddleware - Valida el `taskId`.
     */
    router.post(
      '/tasks/:taskId/retry',
      [paramsValidationMiddleware(GetTaskParamsDto)],
      controller.retry.bind(controller)
    );

    /**
     * @section Endpoints Internos y de Depuración
     * @description Rutas para la administración, monitoreo y depuración del sistema.
     * No forman parte de la API pública.
     */

    /**
     * @subsection Rutas de Inspección de la Cola (BullMQ)
     */
    router.get('/queue/stats', controller.getQueueStats.bind(controller));
    router.get('/queue/jobs/:state', controller.getQueueJobsByState.bind(controller));
    router.delete('/queue/jobs/:id', controller.deleteJobById.bind(controller));

    /**
     * @subsection Rutas de Inspección de Caché (Redis)
     */
    router.get('/redis/all/events', controller.getAllRedisEvents.bind(controller));
    router.get('/redis/all/keys', controller.getAllRedisKeys.bind(controller));
    router.get('/redis/keys', controller.getRedisKeys.bind(controller));
    router.get('/redis/get', controller.getRedisValue.bind(controller));
    router.delete('/redis/keys', controller.deleteRedisAll.bind(controller));
    router.delete('/redis/keys/:key', controller.deleteRedisKey.bind(controller));

    return router;
  }

  /**
   * @private
   * @static
   * @method createTaskController
   * @description Método de fábrica para crear e inicializar el `TaskController` con todas sus dependencias.
   * Centraliza la inyección de dependencias para el controlador de tareas.
   * @returns {TaskController} Una instancia completamente configurada de `TaskController`.
   */
  private static createTaskController(): TaskController {
    const db = DatabaseConnector.getImageDb();
    const queue = new TaskQueueProducer();
    const repository = new TaskRepository(db);
    const imageDownloadService = new ImageDownloadService();
    const service = new TaskService(repository, queue, imageDownloadService);

    return new TaskController(service);
  }
}
