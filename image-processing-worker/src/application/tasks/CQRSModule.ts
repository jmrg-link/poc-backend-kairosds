import { CommandBus, QueryBus, Mediator } from './index';
import {
  CreateTaskCommandHandler,
  UpdateTaskStatusCommandHandler,
  GetTaskQueryHandler,
  ListTasksQueryHandler,
} from '@application/handlers';
import { ITaskRepository } from '@application/repositories';
import { CacheService } from '@application/services/CacheService';
import { TaskQueueProducer } from '@infrastructure/queues';

/**
 * Módulo de configuración CQRS
 * @class CQRSModule
 */
export class CQRSModule {
  /**
   * Configura y crea el mediator con todos los handlers registrados
   * @param {ITaskRepository} taskRepository - Repositorio de tareas
   * @param {TaskQueueProducer} queueProducer - Productor de cola
   * @param {CacheService} cacheService - Servicio de caché
   * @returns {Mediator} Mediator configurado
   */
  static configure(
    taskRepository: ITaskRepository,
    queueProducer: TaskQueueProducer,
    cacheService: CacheService
  ): Mediator {
    const commandBus = new CommandBus();
    const queryBus = new QueryBus();

    commandBus.registerByName(
      'CreateTaskCommand',
      new CreateTaskCommandHandler(taskRepository, queueProducer)
    );

    commandBus.registerByName(
      'UpdateTaskStatusCommand',
      new UpdateTaskStatusCommandHandler(taskRepository, cacheService)
    );

    queryBus.registerByName('GetTaskQuery', new GetTaskQueryHandler(taskRepository, cacheService));

    queryBus.registerByName(
      'ListTasksQuery',
      new ListTasksQueryHandler(taskRepository, cacheService)
    );

    return new Mediator(commandBus, queryBus);
  }
}
