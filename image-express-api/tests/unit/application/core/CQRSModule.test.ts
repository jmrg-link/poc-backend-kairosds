import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { CQRSModule } from '../../../../src/application/core/CQRSModule';
import { Mediator } from '../../../../src/application/core/Mediator';
import { ITaskRepository } from '../../../../src/application/repositories';
import { CacheService } from '../../../../src/application/services/CacheService';
import { TaskQueueProducer } from '../../../../src/infrastructure/queues';
import { CreateTaskCommand } from '../../../../src/application/commands/CreateTaskCommand';
import { UpdateTaskStatusCommand } from '../../../../src/application/commands/UpdateTaskStatusCommand';
import { GetTaskQuery } from '../../../../src/application/queries/GetTaskQuery';
import { ListTasksQuery } from '../../../../src/application/queries/ListTasksQuery';
import { TaskStatus, TaskEntity } from '../../../../src/domain/entities/TaskEntity';

/**
 * @description Interfaz para resultados de creación de tareas
 */
interface CreateTaskResult {
  taskId: string;
  status: string;
  price: number;
}

/**
 * @description Interfaz para resultados de consulta de tareas
 */
interface GetTaskResult {
  taskId: string;
  status: string;
  price: number;
  images?: Array<{ resolution: string; path: string }>;
}

/**
 * @description Interfaz para resultados paginados de lista de tareas
 */
interface ListTasksResult {
  data: Array<{
    taskId: string;
    status: string;
    price: number;
    images?: Array<{ resolution: string; path: string }>;
    createdAt?: Date;
    updatedAt?: Date;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * @description Interfaz para estadísticas de cola
 */
interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}

/**
 * @description Factory para crear mocks de dependencias en tests de integración CQRS
 * 
 * Proporciona métodos estáticos para crear instancias mockeadas de:
 * - TaskRepository para persistencia de datos
 * - TaskQueueProducer para gestión de colas
 * - CacheService para gestión de caché
 */
class MockFactory {
  /**
   * @description Crea mock del repositorio de tareas con tipado completo
   * @returns {jest.Mocked<ITaskRepository>} Mock del repositorio tipado
   */
  static createTaskRepository(): jest.Mocked<ITaskRepository> {
    return {
      create: jest.fn<() => Promise<TaskEntity>>(),
      findById: jest.fn<() => Promise<TaskEntity | null>>(),
      findByIdempotencyKey: jest.fn<() => Promise<TaskEntity | null>>(),
      updateStatus: jest.fn<() => Promise<void>>(),
      updateOriginalPath: jest.fn<() => Promise<void>>(),
      update: jest.fn<() => Promise<void>>(),
      find: jest.fn<() => Promise<TaskEntity[]>>(),
      count: jest.fn<() => Promise<number>>(),
    } as jest.Mocked<ITaskRepository>;
  }

  /**
   * @description Crea mock del productor de cola de tareas
   * @returns {jest.Mocked<TaskQueueProducer>} Mock del productor de cola tipado
   */
  static createTaskQueueProducer(): jest.Mocked<TaskQueueProducer> {
    return {
      addTask: jest.fn<() => Promise<void>>(),
      removeTask: jest.fn<() => Promise<void>>(),
      getQueueStats: jest.fn<() => Promise<QueueStats>>(),
      getJobs: jest.fn<() => Promise<unknown[]>>(),
      clearQueue: jest.fn<() => Promise<void>>(),
      close: jest.fn<() => Promise<void>>(),
    } as unknown as jest.Mocked<TaskQueueProducer>;
  }

  /**
   * @description Crea mock del servicio de caché con métodos reales
   * @returns {jest.Mocked<CacheService>} Mock del servicio de caché tipado
   */
  static createCacheService(): jest.Mocked<CacheService> {
    return {
      getOrSet: jest.fn<() => Promise<unknown>>(),
      invalidatePattern: jest.fn<() => Promise<void>>(),
      cache: {} as unknown
    } as unknown as jest.Mocked<CacheService>;
  }
}

/**
 * @description Suite de pruebas para CQRSModule
 * 
 * Valida la configuración e integración del módulo CQRS:
 * - Configuración correcta del Mediator con CommandBus y QueryBus
 * - Registro automático de todos los handlers de comandos y consultas
 * - Inyección correcta de dependencias (repository, queue, cache)
 * - Funcionamiento integrado del sistema CQRS completo
 * - Ejecución end-to-end de comandos y consultas a través del mediator
 * - Manejo de errores y propagación correcta
 * - Aislamiento entre diferentes instancias de mediator
 */
describe('CQRSModule', () => {
  let mockTaskRepository: jest.Mocked<ITaskRepository>;
  let mockQueueProducer: jest.Mocked<TaskQueueProducer>;
  let mockCacheService: jest.Mocked<CacheService>;
  let mediator: Mediator;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockTaskRepository = MockFactory.createTaskRepository();
    mockQueueProducer = MockFactory.createTaskQueueProducer();
    mockCacheService = MockFactory.createCacheService();
  });

  /**
   * @description Tests de configuración básica del módulo CQRS
   */
  describe('configure', () => {
    /**
     * @test Debe crear y retornar un Mediator configurado correctamente
     * @given Dependencias válidas (repository, queue, cache)
     * @when Se invoca el método configure del módulo
     * @then Debe retornar una instancia válida de Mediator
     */
    it('debe crear y retornar un Mediator configurado', () => {
      mediator = CQRSModule.configure(
        mockTaskRepository,
        mockQueueProducer,
        mockCacheService
      );
      
      expect(mediator).toBeInstanceOf(Mediator);
      expect(mediator).toBeDefined();
    });

    /**
     * @test Debe configurar el handler CreateTaskCommand con todas sus dependencias
     * @given Un mediator configurado con mocks
     * @when Se envía un CreateTaskCommand válido
     * @then Debe ejecutar el handler con repository y queue correctamente
     */
    it('debe configurar el handler CreateTaskCommand correctamente', async () => {
      mediator = CQRSModule.configure(
        mockTaskRepository,
        mockQueueProducer,
        mockCacheService
      );
      
      const command = new CreateTaskCommand('/test/image.jpg', 25, 'test-key');
      const mockTask: TaskEntity = {
        _id: 'task-id',
        status: TaskStatus.PENDING,
        price: 25,
        originalPath: '/test/image.jpg',
        images: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockTaskRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockTaskRepository.create.mockResolvedValue(mockTask);
      mockQueueProducer.addTask.mockResolvedValue();
      
      const result = await mediator.send<CreateTaskResult>(command);
      
      expect(mockTaskRepository.findByIdempotencyKey).toHaveBeenCalledWith('test-key');
      expect(mockTaskRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: TaskStatus.PENDING,
          price: 25,
          originalPath: '/test/image.jpg',
        })
      );
      expect(mockQueueProducer.addTask).toHaveBeenCalledWith('task-id', '/test/image.jpg');
      expect(result).toEqual(expect.objectContaining({
        taskId: 'task-id',
        status: 'pending',
        price: 25,
      }));
    });

    /**
     * @test Debe configurar el handler UpdateTaskStatusCommand con invalidación de caché
     * @given Un mediator configurado
     * @when Se envía un UpdateTaskStatusCommand
     * @then Debe ejecutar el handler y invalidar el patrón de caché correspondiente
     */
    it('debe configurar el handler UpdateTaskStatusCommand correctamente', async () => {
      mediator = CQRSModule.configure(
        mockTaskRepository,
        mockQueueProducer,
        mockCacheService
      );
      
      const command = new UpdateTaskStatusCommand('task-123', TaskStatus.COMPLETED);
      const existingTask: TaskEntity = {
        _id: 'task-123',
        status: TaskStatus.PROCESSING,
        price: 30,
        originalPath: '/test/existing.jpg',
        images: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockTaskRepository.findById.mockResolvedValue(existingTask);
      mockTaskRepository.updateStatus.mockResolvedValue();
      mockCacheService.invalidatePattern.mockResolvedValue();
      
      await mediator.send(command);
      
      expect(mockTaskRepository.findById).toHaveBeenCalledWith('task-123');
      expect(mockTaskRepository.updateStatus).toHaveBeenCalledWith('task-123', TaskStatus.COMPLETED, undefined);
      expect(mockCacheService.invalidatePattern).toHaveBeenCalledWith('task:task-123');
    });

    /**
     * @test Debe configurar el handler GetTaskQuery con estrategia de caché
     * @given Un mediator configurado
     * @when Se ejecuta una GetTaskQuery con datos en caché
     * @then Debe retornar datos del caché sin consultar repository
     */
    it('debe configurar el handler GetTaskQuery correctamente', async () => {
      mediator = CQRSModule.configure(
        mockTaskRepository,
        mockQueueProducer,
        mockCacheService
      );
      
      const query = new GetTaskQuery('task-456');
      const cachedResult: GetTaskResult = {
        taskId: 'task-456',
        status: 'completed',
        price: 30,
        images: [
          { resolution: '1024', path: '/output/1024/image.jpg' },
        ],
      };
      
      mockCacheService.getOrSet.mockResolvedValue(cachedResult);
      
      const result = await mediator.query<GetTaskResult>(query);
      
      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        'task:task-456',
        expect.any(Function),
        60
      );
      expect(result).toEqual(cachedResult);
    });

    /**
     * @test Debe buscar en BD cuando no hay caché en GetTaskQuery
     * @given Un mediator configurado y caché que ejecuta la función fallback
     * @when Se ejecuta una GetTaskQuery
     * @then Debe buscar en la base de datos a través del getOrSet
     */
    it('debe buscar en BD cuando no hay cache en GetTaskQuery', async () => {
      mediator = CQRSModule.configure(
        mockTaskRepository,
        mockQueueProducer,
        mockCacheService
      );
      
      const query = new GetTaskQuery('task-789');
      const dbTask: TaskEntity = {
        _id: 'task-789',
        status: TaskStatus.PROCESSING,
        price: 35,
        originalPath: '/test/image2.jpg',
        images: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockTaskRepository.findById.mockResolvedValue(dbTask);
      mockCacheService.getOrSet.mockImplementation(async <T>(_key: string, fn: () => Promise<T>) => {
        return await fn();
      });
      
      await mediator.query<GetTaskResult>(query);
      
      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        'task:task-789',
        expect.any(Function),
        60
      );
      expect(mockTaskRepository.findById).toHaveBeenCalledWith('task-789');
    });

    /**
     * @test Debe configurar el handler ListTasksQuery con paginación y caché
     * @given Un mediator configurado
     * @when Se ejecuta una ListTasksQuery con filtros y paginación
     * @then Debe ejecutar el handler con parámetros correctos y caché
     */
    it('debe configurar el handler ListTasksQuery correctamente', async () => {
      mediator = CQRSModule.configure(
        mockTaskRepository,
        mockQueueProducer,
        mockCacheService
      );
      
      const query = new ListTasksQuery(1, 10, TaskStatus.PENDING);
      const tasks: TaskEntity[] = [
        {
          _id: 'task-1',
          status: TaskStatus.PENDING,
          price: 20,
          originalPath: '/test/1.jpg',
          images: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          _id: 'task-2',
          status: TaskStatus.PENDING,
          price: 25,
          originalPath: '/test/2.jpg',
          images: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      
      mockCacheService.getOrSet
        .mockResolvedValueOnce(tasks)
        .mockResolvedValueOnce(2);
      
      const result = await mediator.query<ListTasksResult>(query);
      
      expect(mockCacheService.getOrSet).toHaveBeenCalledTimes(2);
      expect(mockCacheService.getOrSet).toHaveBeenNthCalledWith(1, 
        expect.stringMatching(/^tasks:list:[a-f0-9]{16}$/),
        expect.any(Function),
        30
      );
      expect(mockCacheService.getOrSet).toHaveBeenNthCalledWith(2,
        expect.stringMatching(/^tasks:count:[a-f0-9]{16}$/), 
        expect.any(Function),
        45
      );
      expect(result.data).toHaveLength(2);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1,
      });
    });
  });

  /**
   * @description Tests de integración completa del sistema CQRS
   */
  describe('Integración completa', () => {
    /**
     * @test Debe manejar flujo completo de creación y consulta de tarea
     * @given Un mediator configurado
     * @when Se crea una tarea y luego se consulta
     * @then Ambas operaciones deben funcionar coordinadamente
     */
    it('debe manejar un flujo completo de creación y consulta', async () => {
      mediator = CQRSModule.configure(
        mockTaskRepository,
        mockQueueProducer,
        mockCacheService
      );
      
      const createCommand = new CreateTaskCommand('/test/flow.jpg', 40);
      const createdTask: TaskEntity = {
        _id: 'flow-task',
        status: TaskStatus.PENDING,
        price: 40,
        originalPath: '/test/flow.jpg',
        images: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockTaskRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockTaskRepository.create.mockResolvedValue(createdTask);
      mockQueueProducer.addTask.mockResolvedValue();
      
      const createResult = await mediator.send<CreateTaskResult>(createCommand);
      
      expect(createResult.taskId).toBe('flow-task');
      
      const getQuery = new GetTaskQuery('flow-task');
      const queryResult: GetTaskResult = {
        taskId: 'flow-task',
        status: 'pending',
        price: 40,
      };
      
      mockTaskRepository.findById.mockResolvedValue(createdTask);
      mockCacheService.getOrSet.mockResolvedValue(queryResult);
      
      const result = await mediator.query<GetTaskResult>(getQuery);
      
      expect(result.taskId).toBe('flow-task');
      expect(result.status).toBe('pending');
      expect(result.price).toBe(40);
    });

    /**
     * @test Debe manejar múltiples comandos concurrentes sin interferencias
     * @given Un mediator configurado
     * @when Se ejecutan múltiples operaciones CreateTask concurrentemente
     * @then Todas deben completarse correctamente e independientemente
     */
    it('debe manejar múltiples comandos y consultas concurrentemente', async () => {
      mediator = CQRSModule.configure(
        mockTaskRepository,
        mockQueueProducer,
        mockCacheService
      );
      
      const commands = [
        new CreateTaskCommand('/test/1.jpg', 10),
        new CreateTaskCommand('/test/2.jpg', 20),
        new CreateTaskCommand('/test/3.jpg', 30),
      ];
      
      const task1: TaskEntity = {
        _id: 'task-1',
        status: TaskStatus.PENDING,
        price: 10,
        originalPath: '/test/1.jpg',
        images: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const task2: TaskEntity = {
        _id: 'task-2',
        status: TaskStatus.PENDING,
        price: 20,
        originalPath: '/test/2.jpg',
        images: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const task3: TaskEntity = {
        _id: 'task-3',
        status: TaskStatus.PENDING,
        price: 30,
        originalPath: '/test/3.jpg',
        images: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockTaskRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockTaskRepository.create
        .mockResolvedValueOnce(task1)
        .mockResolvedValueOnce(task2)
        .mockResolvedValueOnce(task3);
      
      mockQueueProducer.addTask.mockResolvedValue();
      
      const results = await Promise.all(
        commands.map(cmd => mediator.send<CreateTaskResult>(cmd))
      );
      
      expect(results).toHaveLength(3);
      expect(results[0].taskId).toBe('task-1');
      expect(results[1].taskId).toBe('task-2');
      expect(results[2].taskId).toBe('task-3');
      expect(mockTaskRepository.create).toHaveBeenCalledTimes(3);
      expect(mockQueueProducer.addTask).toHaveBeenCalledTimes(3);
    });

    /**
     * @test Debe propagar errores correctamente desde handlers hacia mediator
     * @given Un mediator configurado con repository que falla
     * @when Se ejecuta un comando que produce error en el repository
     * @then El error debe propagarse sin ejecutar operaciones subsecuentes
     */
    it('debe propagar errores correctamente desde los handlers', async () => {
      mediator = CQRSModule.configure(
        mockTaskRepository,
        mockQueueProducer,
        mockCacheService
      );
      
      const command = new CreateTaskCommand('/test/error.jpg', 50);
      
      mockTaskRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockTaskRepository.create.mockRejectedValue(new Error('Database connection failed'));
      
      await expect(mediator.send(command)).rejects.toThrow('Database connection failed');
      expect(mockQueueProducer.addTask).not.toHaveBeenCalled();
    });
  });

  /**
   * @description Tests de validación de dependencias y configuración
   */
  describe('Validación de dependencias', () => {
    /**
     * @test Debe funcionar correctamente con todas las dependencias requeridas
     * @given Todas las dependencias válidas proporcionadas
     * @when Se configura el módulo CQRS
     * @then No debe lanzar errores durante la configuración
     */
    it('debe funcionar con todas las dependencias requeridas', () => {
      expect(() => {
        CQRSModule.configure(
          mockTaskRepository,
          mockQueueProducer,
          mockCacheService
        );
      }).not.toThrow();
    });

    /**
     * @test Debe mantener aislamiento entre diferentes instancias de mediator
     * @given Múltiples configuraciones del módulo con diferentes mocks
     * @when Se crean múltiples mediators independientes
     * @then Cada mediator debe funcionar con sus propias dependencias
     */
    it('debe mantener aislamiento entre diferentes instancias de mediator', async () => {
      const mediator1 = CQRSModule.configure(
        mockTaskRepository,
        mockQueueProducer,
        mockCacheService
      );
      
      const mockTaskRepository2 = MockFactory.createTaskRepository();
      const mockQueueProducer2 = MockFactory.createTaskQueueProducer();
      const mockCacheService2 = MockFactory.createCacheService();
      
      const mediator2 = CQRSModule.configure(
        mockTaskRepository2,
        mockQueueProducer2,
        mockCacheService2
      );
      
      expect(mediator1).not.toBe(mediator2);
      
      const command = new CreateTaskCommand('/test.jpg', 15);
      
      const task1: TaskEntity = {
        _id: 'med1-task',
        status: TaskStatus.PENDING,
        price: 15,
        originalPath: '/test.jpg',
        images: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const task2: TaskEntity = {
        _id: 'med2-task',
        status: TaskStatus.PENDING,
        price: 15,
        originalPath: '/test.jpg',
        images: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockTaskRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockTaskRepository.create.mockResolvedValue(task1);
      mockQueueProducer.addTask.mockResolvedValue();
      
      mockTaskRepository2.findByIdempotencyKey.mockResolvedValue(null);
      mockTaskRepository2.create.mockResolvedValue(task2);
      mockQueueProducer2.addTask.mockResolvedValue();
      
      const result1 = await mediator1.send<CreateTaskResult>(command);
      const result2 = await mediator2.send<CreateTaskResult>(command);
      
      expect(result1.taskId).toBe('med1-task');
      expect(result2.taskId).toBe('med2-task');
      expect(mockTaskRepository.create).toHaveBeenCalledTimes(1);
      expect(mockTaskRepository2.create).toHaveBeenCalledTimes(1);
    });
  });
});