import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { UpdateTaskStatusCommandHandler } from '../../../../src/application/handlers/UpdateTaskStatusCommandHandler';
import { UpdateTaskStatusCommand } from '../../../../src/application/commands/UpdateTaskStatusCommand';
import { ITaskRepository } from '../../../../src/application/repositories';
import { CacheService } from '../../../../src/application/services/CacheService';
import { TaskStatus } from '../../../../src/domain/entities/TaskEntity';
import { NotFoundError } from '../../../../src/core/errors';
import * as loggerModule from '../../../../src/core/helpers/logger';

jest.mock('../../../../src/core/helpers/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

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

  static createCacheService(): jest.Mocked<CacheService> {
    const mock = {
      getOrSet: jest.fn(),
      invalidatePattern: jest.fn(),
    } as unknown as jest.Mocked<CacheService>;


    Object.defineProperty(mock, 'cache', {
      value: {
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn(),
        keys: jest.fn(),
      },
      writable: true,
    });

    return mock;
  }
}

/**
 * @description Suite de pruebas para UpdateTaskStatusCommandHandler
 *
 * @description Valida el comportamiento del handler de actualización de estado:
 * - Actualización exitosa de estado con validación de transiciones
 * - Invalidación correcta de cache relacionado
 * - Manejo de errores para tareas no encontradas
 * - Validación de transiciones de estado permitidas
 * - Logging apropiado de cambios de estado
 */
describe('UpdateTaskStatusCommandHandler', () => {
  let handler: UpdateTaskStatusCommandHandler;
  let mockRepository: jest.Mocked<ITaskRepository>;
  let mockCacheService: jest.Mocked<CacheService>;
  let mockLogger: jest.Mocked<typeof loggerModule.logger>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepository = MockFactory.createTaskRepository();
    mockCacheService = MockFactory.createCacheService();
    mockLogger = loggerModule.logger as jest.Mocked<typeof loggerModule.logger>;
    handler = new UpdateTaskStatusCommandHandler(mockRepository, mockCacheService);
  });

  /**
   * @description Suite de pruebas para actualización exitosa
   */
  describe('execute - Actualización exitosa', () => {
    /**
     * @test Debe actualizar estado de pending a processing
     * @given Una tarea existente en estado pending
     * @when Se ejecuta comando para cambiar a processing
     * @then Debe actualizar el estado e invalidar cache
     */
    it('debe actualizar estado de pending a processing', async () => {
      const taskId = 'task-123';
      const command = new UpdateTaskStatusCommand(taskId, TaskStatus.PROCESSING);
      const existingTask = {
        _id: taskId,
        status: TaskStatus.PENDING,
        price: 25,
        originalPath: '/test/image.jpg',
        images: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.findById.mockResolvedValue(existingTask);
      mockRepository.updateStatus.mockResolvedValue();
      mockCacheService.invalidatePattern.mockResolvedValue();

      await handler.execute(command);

      expect(mockRepository.findById).toHaveBeenCalledWith(taskId);
      expect(mockRepository.updateStatus).toHaveBeenCalledWith(
        taskId,
        TaskStatus.PROCESSING,
        undefined
      );
      expect(mockCacheService.invalidatePattern).toHaveBeenCalledTimes(3);
      expect(mockCacheService.invalidatePattern).toHaveBeenCalledWith(`task:${taskId}`);
      expect(mockCacheService.invalidatePattern).toHaveBeenCalledWith('tasks:list:*');
      expect(mockCacheService.invalidatePattern).toHaveBeenCalledWith('tasks:count:*');
    });

    /**
     * @test Debe actualizar estado de processing a completed con datos
     * @given Una tarea en estado processing
     * @when Se ejecuta comando para cambiar a completed con datos de imágenes
     * @then Debe actualizar con los datos e invalidar cache
     */
    it('debe actualizar estado de processing a completed con datos', async () => {
      const taskId = 'task-456';
      const imageData = {
        images: [
          { resolution: '1024' as const, path: '/output/1024/image.jpg' },
          { resolution: '800' as const, path: '/output/800/image.jpg' },
        ],
      };
      const command = new UpdateTaskStatusCommand(taskId, TaskStatus.COMPLETED, imageData);
      const existingTask = {
        _id: taskId,
        status: TaskStatus.PROCESSING,
        price: 30,
        originalPath: '/test/image2.jpg',
        images: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.findById.mockResolvedValue(existingTask);
      mockRepository.updateStatus.mockResolvedValue();
      mockCacheService.invalidatePattern.mockResolvedValue();

      await handler.execute(command);

      expect(mockRepository.updateStatus).toHaveBeenCalledWith(
        taskId,
        TaskStatus.COMPLETED,
        imageData
      );
      expect(mockLogger.info).toHaveBeenCalledWith('Estado de tarea actualizado', {
        taskId,
        previousStatus: TaskStatus.PROCESSING,
        newStatus: TaskStatus.COMPLETED,
      });
    });

    /**
     * @test Debe actualizar estado de pending a failed
     * @given Una tarea en estado pending
     * @when Se ejecuta comando para cambiar a failed
     * @then Debe permitir la transición e invalidar cache
     */
    it('debe actualizar estado de pending a failed', async () => {
      const taskId = 'task-retry';
      const command = new UpdateTaskStatusCommand(taskId, TaskStatus.FAILED);
      const existingTask = {
        _id: taskId,
        status: TaskStatus.PENDING,
        price: 35,
        originalPath: '/test/retry.jpg',
        images: [],
        error: 'Previous error',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.findById.mockResolvedValue(existingTask);
      mockRepository.updateStatus.mockResolvedValue();
      mockCacheService.invalidatePattern.mockResolvedValue();

      await handler.execute(command);

      expect(mockRepository.updateStatus).toHaveBeenCalledWith(
        taskId,
        TaskStatus.FAILED,
        undefined
      );
      expect(mockLogger.info).toHaveBeenCalledWith('Estado de tarea actualizado', {
        taskId,
        previousStatus: TaskStatus.PENDING,
        newStatus: TaskStatus.FAILED,
      });
    });
  });

  /**
   * @description Suite de pruebas para manejo de errores
   */
  describe('execute - Manejo de errores', () => {
    /**
     * @test Debe lanzar NotFoundError cuando la tarea no existe
     * @given Un ID de tarea que no existe
     * @when Se ejecuta el comando
     * @then Debe lanzar NotFoundError sin actualizar
     */
    it('debe lanzar NotFoundError cuando la tarea no existe', async () => {
      const taskId = 'non-existent-task';
      const command = new UpdateTaskStatusCommand(taskId, TaskStatus.PROCESSING);

      mockRepository.findById.mockResolvedValue(null);

      await expect(handler.execute(command)).rejects.toThrow(NotFoundError);
      await expect(handler.execute(command)).rejects.toThrow(
        `Tarea ${taskId} no encontrada`
      );

      expect(mockRepository.updateStatus).not.toHaveBeenCalled();
      expect(mockCacheService.invalidatePattern).not.toHaveBeenCalled();
    });

    /**
     * @test Debe propagar errores del repositorio al buscar
     * @given Un repositorio que falla al buscar
     * @when Se ejecuta el comando
     * @then Debe propagar el error sin actualizar
     */
    it('debe propagar errores del repositorio al buscar', async () => {
      const taskId = 'error-task';
      const command = new UpdateTaskStatusCommand(taskId, TaskStatus.PROCESSING);
      const repositoryError = new Error('Database connection failed');

      mockRepository.findById.mockRejectedValue(repositoryError);

      await expect(handler.execute(command)).rejects.toThrow('Database connection failed');
      expect(mockRepository.updateStatus).not.toHaveBeenCalled();
    });

    /**
     * @test Debe propagar errores del repositorio al actualizar
     * @given Un repositorio que falla al actualizar estado
     * @when Se ejecuta el comando después de encontrar la tarea
     * @then Debe propagar el error de actualización
     */
    it('debe propagar errores del repositorio al actualizar', async () => {
      const taskId = 'update-error-task';
      const command = new UpdateTaskStatusCommand(taskId, TaskStatus.PROCESSING);
      const existingTask = {
        _id: taskId,
        status: TaskStatus.PENDING,
        price: 25,
        originalPath: '/test/image.jpg',
        images: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const updateError = new Error('Update operation failed');

      mockRepository.findById.mockResolvedValue(existingTask);
      mockRepository.updateStatus.mockRejectedValue(updateError);

      await expect(handler.execute(command)).rejects.toThrow('Update operation failed');
      expect(mockCacheService.invalidatePattern).not.toHaveBeenCalled();
    });
  });

  /**
   * @description Suite de pruebas para invalidación de cache
   */
  describe('execute - Invalidación de cache', () => {
    /**
     * @test Debe invalidar todos los patrones de cache relacionados
     * @given Una actualización exitosa
     * @when Se completa la actualización
     * @then Debe invalidar cache de tarea específica y listados
     */
    it('debe invalidar todos los patrones de cache relacionados', async () => {
      const taskId = 'cache-test-task';
      const command = new UpdateTaskStatusCommand(taskId, TaskStatus.PROCESSING);
      const existingTask = {
        _id: taskId,
        status: TaskStatus.PENDING,
        price: 30,
        originalPath: '/test/image.jpg',
        images: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.findById.mockResolvedValue(existingTask);
      mockRepository.updateStatus.mockResolvedValue();
      mockCacheService.invalidatePattern.mockResolvedValue();

      await handler.execute(command);

      expect(mockCacheService.invalidatePattern).toHaveBeenCalledWith(`task:${taskId}`);
      expect(mockCacheService.invalidatePattern).toHaveBeenCalledWith('tasks:list:*');
      expect(mockCacheService.invalidatePattern).toHaveBeenCalledWith('tasks:count:*');
    });

    /**
     * @test Debe continuar aunque la invalidación de cache falle
     * @given Un servicio de cache que falla
     * @when Se actualiza el estado exitosamente
     * @then Debe fallar porque no puede invalidar cache
     */
    it('debe fallar si no puede invalidar cache', async () => {
      const taskId = 'cache-fail-task';
      const command = new UpdateTaskStatusCommand(taskId, TaskStatus.PROCESSING);
      const existingTask = {
        _id: taskId,
        status: TaskStatus.PENDING,
        price: 30,
        originalPath: '/test/image.jpg',
        images: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.findById.mockResolvedValue(existingTask);
      mockRepository.updateStatus.mockResolvedValue();
      mockCacheService.invalidatePattern.mockRejectedValue(new Error('Cache service down'));

      await expect(handler.execute(command)).rejects.toThrow('Cache service down');
      expect(mockRepository.updateStatus).toHaveBeenCalled();
    });
  });

  /**
   * @description Suite de pruebas para casos edge
   */
  describe('execute - Casos edge', () => {
    /**
     * @test Debe manejar actualizaciones sin datos adicionales
     * @given Un comando sin datos adicionales
     * @when Se actualiza solo el estado
     * @then Debe pasar undefined como datos
     */
    it('debe manejar actualizaciones sin datos adicionales', async () => {
      const taskId = 'simple-update';
      const command = new UpdateTaskStatusCommand(taskId, TaskStatus.PROCESSING);
      const existingTask = {
        _id: taskId,
        status: TaskStatus.PENDING,
        price: 20,
        originalPath: '/test/simple.jpg',
        images: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.findById.mockResolvedValue(existingTask);
      mockRepository.updateStatus.mockResolvedValue();
      mockCacheService.invalidatePattern.mockResolvedValue();

      await handler.execute(command);

      expect(mockRepository.updateStatus).toHaveBeenCalledWith(
        taskId,
        TaskStatus.PROCESSING,
        undefined
      );
    });

    /**
     * @test Debe registrar información completa en el log
     * @given Una actualización exitosa
     * @when Se completa la operación
     * @then Debe hacer log con estados anterior y nuevo
     */
    it('debe registrar información completa en el log', async () => {
      const taskId = 'log-test-task';
      const command = new UpdateTaskStatusCommand(taskId, TaskStatus.PROCESSING);
      const existingTask = {
        _id: taskId,
        status: TaskStatus.PENDING,
        price: 25,
        originalPath: '/test/log.jpg',
        images: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.findById.mockResolvedValue(existingTask);
      mockRepository.updateStatus.mockResolvedValue();
      mockCacheService.invalidatePattern.mockResolvedValue();

      await handler.execute(command);

      expect(mockLogger.info).toHaveBeenCalledWith('Estado de tarea actualizado', {
        taskId,
        previousStatus: TaskStatus.PENDING,
        newStatus: TaskStatus.PROCESSING,
      });
    });

    /**
     * @test Debe manejar tareas con todos los campos posibles
     * @given Una tarea con todos los campos opcionales
     * @when Se actualiza el estado
     * @then Debe procesar correctamente sin errores
     */
    it('debe manejar tareas con todos los campos posibles', async () => {
      const taskId = 'complete-task';
      const command = new UpdateTaskStatusCommand(taskId, TaskStatus.FAILED);
      const completeTask = {
        _id: taskId,
        status: TaskStatus.PENDING,
        price: 45,
        originalPath: '/test/complete.jpg',
        images: [
          { resolution: '1024' as const, path: '/output/1024/complete.jpg' },
        ],
        error: undefined,
        idempotencyKey: 'complete-key',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.findById.mockResolvedValue(completeTask);
      mockRepository.updateStatus.mockResolvedValue();
      mockCacheService.invalidatePattern.mockResolvedValue();

      await handler.execute(command);

      expect(mockRepository.findById).toHaveBeenCalledWith(taskId);
      expect(mockRepository.updateStatus).toHaveBeenCalledWith(
        taskId,
        TaskStatus.FAILED,
        undefined
      );
    });
  });
});