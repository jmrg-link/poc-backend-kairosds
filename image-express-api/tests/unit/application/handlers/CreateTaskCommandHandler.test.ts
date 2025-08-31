import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { CreateTaskCommandHandler } from '../../../../src/application/handlers/CreateTaskCommandHandler';
import { CreateTaskCommand } from '../../../../src/application/commands/CreateTaskCommand';
import { ITaskRepository } from '../../../../src/application/repositories';
import { TaskQueueProducer } from '../../../../src/infrastructure/queues';
import { TaskStatus } from '../../../../src/domain/entities/TaskEntity';
import * as cryptoHelpers from '../../../../src/core/helpers/crypto';

/**
 * Mock factory para crear dependencias de prueba
 */
class MockFactory {
  static createTaskRepository(): jest.Mocked<ITaskRepository> {
    return {
      create: jest.fn(),
      findById: jest.fn(),
      findByIdempotencyKey: jest.fn(),
      updateStatus: jest.fn(),
      updateOriginalPath: jest.fn(),
      update: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
    } as jest.Mocked<ITaskRepository>;
  }

  static createTaskQueueProducer(): jest.Mocked<TaskQueueProducer> {
    return {
      addTask: jest.fn(),
      removeTask: jest.fn(),
      getQueueStats: jest.fn(),
      getJobs: jest.fn(),
      clearQueue: jest.fn(),
      close: jest.fn(),
    } as unknown as jest.Mocked<TaskQueueProducer>;
  }
}

/**
 * @description Suite de pruebas para CreateTaskCommandHandler
 * 
 * @description Valida el comportamiento del handler de creación de tareas:
 * - Creación exitosa de tareas nuevas
 * - Manejo de idempotencia con claves duplicadas
 * - Integración con repositorio y cola de tareas
 * - Mapeo correcto de entidades a DTOs de respuesta
 * - Manejo de errores en dependencias externas
 */
describe('CreateTaskCommandHandler', () => {
  let handler: CreateTaskCommandHandler;
  let mockRepository: jest.Mocked<ITaskRepository>;
  let mockQueue: jest.Mocked<TaskQueueProducer>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepository = MockFactory.createTaskRepository();
    mockQueue = MockFactory.createTaskQueueProducer();
    handler = new CreateTaskCommandHandler(mockRepository, mockQueue);
  });

  /**
   * @description Suite de pruebas para creación exitosa de tareas
   */
  describe('execute - Creación exitosa', () => {
    /**
     * @test Debe crear una nueva tarea exitosamente
     * @given Un comando válido sin clave de idempotencia duplicada
     * @when Se ejecuta el comando
     * @then Debe crear la tarea en el repositorio y encolar el trabajo
     */
    it('debe crear una nueva tarea exitosamente', async () => {
      const command = new CreateTaskCommand('/test/image.jpg', 25, 'unique-key');
      const createdTask = {
        _id: 'task-123',
        status: TaskStatus.PENDING,
        price: 25,
        originalPath: '/test/image.jpg',
        idempotencyKey: 'unique-key',
        images: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(createdTask);
      mockQueue.addTask.mockResolvedValue();

      const result = await handler.execute(command);

      expect(mockRepository.findByIdempotencyKey).toHaveBeenCalledWith('unique-key');
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: TaskStatus.PENDING,
          price: 25,
          originalPath: '/test/image.jpg',
          idempotencyKey: 'unique-key',
        })
      );
      expect(mockQueue.addTask).toHaveBeenCalledWith('task-123', '/test/image.jpg');
      expect(result).toEqual({
        taskId: 'task-123',
        status: TaskStatus.PENDING,
        price: 25,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    /**
     * @test Debe generar UUID automáticamente si no hay clave de idempotencia
     * @given Un comando sin clave de idempotencia
     * @when Se ejecuta el comando
     * @then Debe generar un UUID automáticamente
     */
    it('debe generar UUID automáticamente si no hay clave de idempotencia', async () => {
      const command = new CreateTaskCommand('/test/image.jpg', 30);
      const mockUUID = 'generated-uuid-123';
      
      jest.spyOn(cryptoHelpers, 'generateUUID').mockReturnValue(mockUUID);

      const createdTask = {
        _id: 'task-456',
        status: TaskStatus.PENDING,
        price: 30,
        originalPath: '/test/image.jpg',
        idempotencyKey: mockUUID,
        images: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(createdTask);
      mockQueue.addTask.mockResolvedValue();

      const result = await handler.execute(command);

      expect(cryptoHelpers.generateUUID).toHaveBeenCalled();
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          idempotencyKey: mockUUID,
        })
      );
      expect(result.taskId).toBe('task-456');
    });

    /**
     * @test Debe manejar tareas con imágenes ya procesadas
     * @given Una tarea que tiene imágenes procesadas
     * @when Se mapea la respuesta
     * @then Debe incluir las imágenes en la respuesta
     */
    it('debe manejar tareas con imágenes ya procesadas', async () => {
      const command = new CreateTaskCommand('/test/image.jpg', 40, 'with-images');
      const taskWithImages = {
        _id: 'task-with-images',
        status: TaskStatus.COMPLETED,
        price: 40,
        originalPath: '/test/image.jpg',
        idempotencyKey: 'with-images',
        images: [
          { resolution: '1024' as const, path: '/output/1024/image.jpg' },
          { resolution: '800' as const, path: '/output/800/image.jpg' },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(taskWithImages);
      mockQueue.addTask.mockResolvedValue();

      const result = await handler.execute(command);

      expect(result.images).toEqual([
        { resolution: '1024' as const, path: '/output/1024/image.jpg' },
        { resolution: '800' as const, path: '/output/800/image.jpg' },
      ]);
    });

    /**
     * @test Debe manejar tareas con errores
     * @given Una tarea que tiene error
     * @when Se mapea la respuesta
     * @then Debe incluir el error en la respuesta
     */
    it('debe manejar tareas con errores', async () => {
      const command = new CreateTaskCommand('/test/image.jpg', 35, 'with-error');
      const taskWithError = {
        _id: 'task-with-error',
        status: TaskStatus.FAILED,
        price: 35,
        originalPath: '/test/image.jpg',
        idempotencyKey: 'with-error',
        images: [],
        error: 'Processing failed: Invalid image format',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(taskWithError);
      mockQueue.addTask.mockResolvedValue();

      const result = await handler.execute(command);

      expect(result.error).toBe('Processing failed: Invalid image format');
    });
  });

  /**
   * @description Suite de pruebas para manejo de idempotencia
   */
  describe('execute - Idempotencia', () => {
    /**
     * @test Debe retornar tarea existente cuando hay clave duplicada
     * @given Una clave de idempotencia que ya existe
     * @when Se ejecuta el comando
     * @then Debe retornar la tarea existente sin crear nueva
     */
    it('debe retornar tarea existente cuando hay clave duplicada', async () => {
      const command = new CreateTaskCommand('/test/image.jpg', 25, 'duplicate-key');
      const existingTask = {
        _id: 'existing-task',
        status: TaskStatus.COMPLETED,
        price: 25,
        originalPath: '/test/image.jpg',
        idempotencyKey: 'duplicate-key',
        images: [{ resolution: '1024' as const, path: '/output/image.jpg' }],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.findByIdempotencyKey.mockResolvedValue(existingTask);

      const result = await handler.execute(command);

      expect(mockRepository.findByIdempotencyKey).toHaveBeenCalledWith('duplicate-key');
      expect(mockRepository.create).not.toHaveBeenCalled();
      expect(mockQueue.addTask).not.toHaveBeenCalled();
      expect(result).toEqual({
        taskId: 'existing-task',
        status: TaskStatus.COMPLETED,
        price: 25,
        images: [{ resolution: '1024' as const, path: '/output/image.jpg' }],
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    /**
     * @test Debe proceder con creación si no existe clave duplicada
     * @given Una clave de idempotencia única
     * @when Se verifica idempotencia
     * @then Debe proceder con la creación normal
     */
    it('debe proceder con creación si no existe clave duplicada', async () => {
      const command = new CreateTaskCommand('/test/image.jpg', 45, 'unique-key');

      mockRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue({
        _id: 'new-task',
        status: TaskStatus.PENDING,
        price: 45,
        originalPath: '/test/image.jpg',
        idempotencyKey: 'unique-key',
        images: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockQueue.addTask.mockResolvedValue();

      await handler.execute(command);

      expect(mockRepository.findByIdempotencyKey).toHaveBeenCalledWith('unique-key');
      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockQueue.addTask).toHaveBeenCalled();
    });
  });

  /**
   * @description Suite de pruebas para manejo de errores
   */
  describe('execute - Manejo de errores', () => {
    /**
     * @test Debe propagar errores del repositorio
     * @given Un repositorio que falla al crear
     * @when Se ejecuta el comando
     * @then Debe propagar el error sin encolar trabajo
     */
    it('debe propagar errores del repositorio', async () => {
      const command = new CreateTaskCommand('/test/image.jpg', 25, 'error-key');
      const repositoryError = new Error('Database connection failed');

      mockRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockRepository.create.mockRejectedValue(repositoryError);

      await expect(handler.execute(command)).rejects.toThrow('Database connection failed');
      expect(mockQueue.addTask).not.toHaveBeenCalled();
    });

    /**
     * @test Debe propagar errores de la cola
     * @given Una cola que falla al encolar
     * @when Se ejecuta el comando después de crear la tarea
     * @then Debe propagar el error de la cola
     */
    it('debe propagar errores de la cola', async () => {
      const command = new CreateTaskCommand('/test/image.jpg', 25, 'queue-error');
      const queueError = new Error('Queue service unavailable');

      const createdTask = {
        _id: 'task-queue-error',
        status: TaskStatus.PENDING,
        price: 25,
        originalPath: '/test/image.jpg',
        idempotencyKey: 'queue-error',
        images: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(createdTask);
      mockQueue.addTask.mockRejectedValue(queueError);

      await expect(handler.execute(command)).rejects.toThrow('Queue service unavailable');
      expect(mockRepository.create).toHaveBeenCalled();
    });

    /**
     * @test Debe manejar errores en verificación de idempotencia
     * @given Un repositorio que falla en la búsqueda por clave
     * @when Se verifica idempotencia
     * @then Debe propagar el error
     */
    it('debe manejar errores en verificación de idempotencia', async () => {
      const command = new CreateTaskCommand('/test/image.jpg', 25, 'lookup-error');
      const lookupError = new Error('Database lookup failed');

      mockRepository.findByIdempotencyKey.mockRejectedValue(lookupError);

      await expect(handler.execute(command)).rejects.toThrow('Database lookup failed');
      expect(mockRepository.create).not.toHaveBeenCalled();
      expect(mockQueue.addTask).not.toHaveBeenCalled();
    });
  });

  /**
   * @description Suite de pruebas para casos edge
   */
  describe('execute - Casos edge', () => {
    /**
     * @test Debe manejar tareas sin ID (_id undefined)
     * @given Una tarea creada sin ID definido
     * @when Se convierte el ID a string
     * @then Debe manejar gracefully el caso
     */
    it('debe manejar tareas sin ID definido', async () => {
      const command = new CreateTaskCommand('/test/image.jpg', 25);

      const taskWithoutId = {
        _id: 'task-no-id',
        status: TaskStatus.PENDING,
        price: 25,
        originalPath: '/test/image.jpg',
        images: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(taskWithoutId);
      mockQueue.addTask.mockResolvedValue();

      const result = await handler.execute(command);

      expect(result.taskId).toBe('task-no-id');
      expect(mockQueue.addTask).toHaveBeenCalledWith('task-no-id', '/test/image.jpg');
    });

    /**
     * @test Debe manejar comandos con precios en el límite
     * @given Comandos con precios mínimos y máximos
     * @when Se ejecutan los comandos
     * @then Debe procesar correctamente los valores límite
     */
    it('debe manejar comandos con precios en el límite', async () => {
      const commandMin = new CreateTaskCommand('/test/min.jpg', 5);
      const commandMax = new CreateTaskCommand('/test/max.jpg', 50);

      const taskMin = {
        _id: 'task-min',
        status: TaskStatus.PENDING,
        price: 5,
        originalPath: '/test/min.jpg',
        images: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const taskMax = {
        _id: 'task-max',
        status: TaskStatus.PENDING,
        price: 50,
        originalPath: '/test/max.jpg',
        images: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockRepository.create
        .mockResolvedValueOnce(taskMin)
        .mockResolvedValueOnce(taskMax);
      mockQueue.addTask.mockResolvedValue();

      const resultMin = await handler.execute(commandMin);
      const resultMax = await handler.execute(commandMax);

      expect(resultMin.price).toBe(5);
      expect(resultMax.price).toBe(50);
    });
  });
});