import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { GetTaskQueryHandler } from '../../../../src/application/handlers/GetTaskQueryHandler';
import { GetTaskQuery } from '../../../../src/application/queries/GetTaskQuery';
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
    return {
      getOrSet: jest.fn(),
      invalidatePattern: jest.fn(),
    } as any;
  }
}

/**
 * @description Suite de pruebas para GetTaskQueryHandler
 * 
 * @description Valida el comportamiento del handler de consulta de tarea:
 * - Recuperación exitosa de tareas con cache
 * - Manejo de tarea no encontrada
 * - Mapeo correcto de entidades a DTOs según estado
 * - Integración con sistema de cache con TTL
 * - Logging apropiado de operaciones
 */
describe('GetTaskQueryHandler', () => {
  let handler: GetTaskQueryHandler;
  let mockRepository: jest.Mocked<ITaskRepository>;
  let mockCacheService: jest.Mocked<CacheService>;
  let mockLogger: jest.Mocked<typeof loggerModule.logger>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepository = MockFactory.createTaskRepository();
    mockCacheService = MockFactory.createCacheService();
    mockLogger = loggerModule.logger as jest.Mocked<typeof loggerModule.logger>;
    handler = new GetTaskQueryHandler(mockRepository, mockCacheService);
  });

  /**
   * @description Suite de pruebas para recuperación exitosa
   */
  describe('execute - Recuperación exitosa', () => {
    /**
     * @test Debe obtener tarea pending desde base de datos
     * @given Una tarea en estado pending sin cache
     * @when Se ejecuta la query
     * @then Debe retornar DTO básico y hacer log
     */
    it('debe obtener tarea pending desde base de datos', async () => {
      const taskId = 'task-pending-123';
      const query = new GetTaskQuery(taskId);
      const task = {
        _id: taskId,
        status: TaskStatus.PENDING,
        price: 25,
        originalPath: '/test/image.jpg',
        images: [],
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-01T10:05:00Z'),
      };

      const expectedDto = {
        taskId,
        status: 'pending',
        price: 25,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      };

      mockCacheService.getOrSet.mockImplementation(async (_, fn) => {
        return await fn();
      });
      mockRepository.findById.mockResolvedValue(task);

      const result = await handler.execute(query);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        `task:${taskId}`,
        expect.any(Function),
        60
      );
      expect(mockRepository.findById).toHaveBeenCalledWith(taskId);
      expect(mockLogger.info).toHaveBeenCalledWith('Tarea obtenida desde base de datos', {
        taskId,
        status: TaskStatus.PENDING,
      });
      expect(result).toEqual(expectedDto);
    });

    /**
     * @test Debe obtener tarea completed con imágenes desde cache
     * @given Una tarea completed con imágenes en cache
     * @when Se ejecuta la query
     * @then Debe retornar DTO con imágenes sin consultar BD
     */
    it('debe obtener tarea completed con imágenes desde cache', async () => {
      const taskId = 'task-completed-456';
      const query = new GetTaskQuery(taskId);
      const cachedDto = {
        taskId,
        status: 'completed',
        price: 30,
        images: [
          { resolution: '1024' as const, path: '/output/1024/image.jpg' },
          { resolution: '800' as const, path: '/output/800/image.jpg' },
        ],
        createdAt: new Date('2024-01-01T11:00:00Z'),
        updatedAt: new Date('2024-01-01T11:30:00Z'),
      };

      mockCacheService.getOrSet.mockResolvedValue(cachedDto);

      const result = await handler.execute(query);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        `task:${taskId}`,
        expect.any(Function),
        60
      );
      expect(mockRepository.findById).not.toHaveBeenCalled();
      expect(mockLogger.info).not.toHaveBeenCalled();
      expect(result).toEqual(cachedDto);
    });

    /**
     * @test Debe obtener tarea failed con error desde base de datos
     * @given Una tarea en estado failed con error
     * @when Se ejecuta la query
     * @then Debe retornar DTO con campo error
     */
    it('debe obtener tarea failed con error desde base de datos', async () => {
      const taskId = 'task-failed-789';
      const query = new GetTaskQuery(taskId);
      const task = {
        _id: taskId,
        status: TaskStatus.FAILED,
        price: 35,
        originalPath: '/test/error.jpg',
        images: [],
        error: 'Processing failed: Invalid image format',
        createdAt: new Date('2024-01-01T12:00:00Z'),
        updatedAt: new Date('2024-01-01T12:15:00Z'),
      };

      const expectedDto = {
        taskId,
        status: 'failed',
        price: 35,
        error: 'Processing failed: Invalid image format',
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      };

      mockCacheService.getOrSet.mockImplementation(async (_, fn) => {
        return await fn();
      });
      mockRepository.findById.mockResolvedValue(task);

      const result = await handler.execute(query);

      expect(result).toEqual(expectedDto);
      expect(mockLogger.info).toHaveBeenCalledWith('Tarea obtenida desde base de datos', {
        taskId,
        status: TaskStatus.FAILED,
      });
    });

    /**
     * @test Debe obtener tarea processing sin campos opcionales
     * @given Una tarea en estado processing
     * @when Se ejecuta la query
     * @then Debe retornar DTO básico sin imágenes ni errores
     */
    it('debe obtener tarea processing sin campos opcionales', async () => {
      const taskId = 'task-processing-111';
      const query = new GetTaskQuery(taskId);
      const task = {
        _id: taskId,
        status: TaskStatus.PROCESSING,
        price: 40,
        originalPath: '/test/processing.jpg',
        images: [],
        createdAt: new Date('2024-01-01T13:00:00Z'),
        updatedAt: new Date('2024-01-01T13:10:00Z'),
      };

      const expectedDto = {
        taskId,
        status: 'processing',
        price: 40,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      };

      mockCacheService.getOrSet.mockImplementation(async (_, fn) => {
        return await fn();
      });
      mockRepository.findById.mockResolvedValue(task);

      const result = await handler.execute(query);

      expect(result).toEqual(expectedDto);
    });
  });

  /**
   * @description Suite de pruebas para manejo de errores
   */
  describe('execute - Manejo de errores', () => {
    /**
     * @test Debe lanzar NotFoundError cuando la tarea no existe
     * @given Un ID de tarea que no existe
     * @when Se ejecuta la query
     * @then Debe lanzar NotFoundError con mensaje específico
     */
    it('debe lanzar NotFoundError cuando la tarea no existe', async () => {
      const taskId = 'non-existent-task';
      const query = new GetTaskQuery(taskId);

      mockCacheService.getOrSet.mockImplementation(async (_, fn) => {
        return await fn();
      });
      mockRepository.findById.mockResolvedValue(null);

      await expect(handler.execute(query)).rejects.toThrow(NotFoundError);
      await expect(handler.execute(query)).rejects.toThrow(
        `Tarea ${taskId} no encontrada`
      );

      expect(mockRepository.findById).toHaveBeenCalledWith(taskId);
      expect(mockLogger.info).not.toHaveBeenCalled();
    });

    /**
     * @test Debe propagar errores del repositorio
     * @given Un repositorio que falla al buscar
     * @when Se ejecuta la query
     * @then Debe propagar el error del repositorio
     */
    it('debe propagar errores del repositorio', async () => {
      const taskId = 'error-task';
      const query = new GetTaskQuery(taskId);
      const repositoryError = new Error('Database connection failed');

      mockCacheService.getOrSet.mockImplementation(async (_, fn) => {
        return await fn();
      });
      mockRepository.findById.mockRejectedValue(repositoryError);

      await expect(handler.execute(query)).rejects.toThrow('Database connection failed');
      expect(mockRepository.findById).toHaveBeenCalledWith(taskId);
    });

    /**
     * @test Debe propagar errores del servicio de cache
     * @given Un servicio de cache que falla
     * @when Se ejecuta la query
     * @then Debe propagar el error del cache
     */
    it('debe propagar errores del servicio de cache', async () => {
      const taskId = 'cache-error-task';
      const query = new GetTaskQuery(taskId);
      const cacheError = new Error('Cache service unavailable');

      mockCacheService.getOrSet.mockRejectedValue(cacheError);

      await expect(handler.execute(query)).rejects.toThrow('Cache service unavailable');
      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        `task:${taskId}`,
        expect.any(Function),
        60
      );
    });
  });

  /**
   * @description Suite de pruebas para mapeo de DTOs
   */
  describe('execute - Mapeo de DTOs', () => {
    /**
     * @test Debe mapear tarea completed con imágenes correctamente
     * @given Una tarea completed con múltiples imágenes
     * @when Se mapea a DTO
     * @then Debe incluir todas las imágenes
     */
    it('debe mapear tarea completed con imágenes correctamente', async () => {
      const taskId = 'task-mapping-completed';
      const query = new GetTaskQuery(taskId);
      const task = {
        _id: taskId,
        status: TaskStatus.COMPLETED,
        price: 50,
        originalPath: '/test/mapping.jpg',
        images: [
          { resolution: '1024' as const, path: '/output/1024/mapping.jpg' },
          { resolution: '1024' as const, path: '/output/1024/mapping.jpg' },
          { resolution: '800' as const, path: '/output/800/mapping.jpg' },
        ],
        createdAt: new Date('2024-01-01T14:00:00Z'),
        updatedAt: new Date('2024-01-01T14:45:00Z'),
      };

      mockCacheService.getOrSet.mockImplementation(async (_, fn) => {
        return await fn();
      });
      mockRepository.findById.mockResolvedValue(task);

      const result = await handler.execute(query);

      expect(result.images).toEqual(task.images);
      expect(result.status).toBe('completed');
    });

    /**
     * @test Debe manejar tareas sin campos de fecha
     * @given Una tarea sin createdAt ni updatedAt
     * @when Se mapea a DTO
     * @then Debe retornar DTO sin estos campos
     */
    it('debe manejar tareas sin campos de fecha', async () => {
      const taskId = 'task-no-dates';
      const query = new GetTaskQuery(taskId);
      const task = {
        _id: taskId,
        status: TaskStatus.PENDING,
        price: 20,
        originalPath: '/test/no-dates.jpg',
        images: [],
      };

      const expectedDto = {
        taskId,
        status: 'pending',
        price: 20,
      };

      mockCacheService.getOrSet.mockImplementation(async (_, fn) => {
        return await fn();
      });
      mockRepository.findById.mockResolvedValue(task);

      const result = await handler.execute(query);

      expect(result).toEqual(expectedDto);
      expect(result.createdAt).toBeUndefined();
      expect(result.updatedAt).toBeUndefined();
    });

    /**
     * @test Debe manejar tarea completed sin imágenes
     * @given Una tarea completed pero sin imágenes procesadas
     * @when Se mapea a DTO
     * @then Debe retornar DTO sin campo images
     */
    it('debe manejar tarea completed sin imágenes', async () => {
      const taskId = 'task-completed-no-images';
      const query = new GetTaskQuery(taskId);
      const task = {
        _id: taskId,
        status: TaskStatus.COMPLETED,
        price: 25,
        originalPath: '/test/completed-no-images.jpg',
        images: [],
        createdAt: new Date('2024-01-01T15:00:00Z'),
        updatedAt: new Date('2024-01-01T15:30:00Z'),
      };

      mockCacheService.getOrSet.mockImplementation(async (_, fn) => {
        return await fn();
      });
      mockRepository.findById.mockResolvedValue(task);

      const result = await handler.execute(query);

      expect(result.images).toBeUndefined();
      expect(result.status).toBe('completed');
    });

    /**
     * @test Debe manejar tarea failed sin error
     * @given Una tarea failed pero sin mensaje de error
     * @when Se mapea a DTO
     * @then Debe retornar DTO sin campo error
     */
    it('debe manejar tarea failed sin error', async () => {
      const taskId = 'task-failed-no-error';
      const query = new GetTaskQuery(taskId);
      const task = {
        _id: taskId,
        status: TaskStatus.FAILED,
        price: 30,
        originalPath: '/test/failed-no-error.jpg',
        images: [],
        error: undefined,
        createdAt: new Date('2024-01-01T16:00:00Z'),
        updatedAt: new Date('2024-01-01T16:15:00Z'),
      };

      mockCacheService.getOrSet.mockImplementation(async (_, fn) => {
        return await fn();
      });
      mockRepository.findById.mockResolvedValue(task);

      const result = await handler.execute(query);

      expect(result.error).toBeUndefined();
      expect(result.status).toBe('failed');
    });
  });

  /**
   * @description Suite de pruebas para casos edge
   */
  describe('execute - Casos edge', () => {
    /**
     * @test Debe usar clave de cache correcta
     * @given Un taskId específico
     * @when Se ejecuta la query
     * @then Debe usar la clave de cache correcta con prefijo
     */
    it('debe usar clave de cache correcta', async () => {
      const taskId = 'special-task-id-123';
      const query = new GetTaskQuery(taskId);

      mockCacheService.getOrSet.mockResolvedValue({
        taskId,
        status: 'pending',
        price: 25,
      });

      await handler.execute(query);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        `task:${taskId}`,
        expect.any(Function),
        60
      );
    });

    /**
     * @test Debe usar TTL correcto para cache
     * @given Una query válida
     * @when Se ejecuta la query
     * @then Debe usar TTL de 60 segundos
     */
    it('debe usar TTL correcto para cache', async () => {
      const taskId = 'ttl-test-task';
      const query = new GetTaskQuery(taskId);

      mockCacheService.getOrSet.mockResolvedValue({
        taskId,
        status: 'pending',
        price: 25,
      });

      await handler.execute(query);

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        `task:${taskId}`,
        expect.any(Function),
        60
      );
    });

    /**
     * @test Debe manejar IDs de tarea con caracteres especiales
     * @given Un taskId con caracteres especiales
     * @when Se ejecuta la query
     * @then Debe procesarlo correctamente
     */
    it('debe manejar IDs de tarea con caracteres especiales', async () => {
      const taskId = 'task-123_special@id';
      const query = new GetTaskQuery(taskId);
      const task = {
        _id: taskId,
        status: TaskStatus.PENDING,
        price: 25,
        originalPath: '/test/special.jpg',
        images: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCacheService.getOrSet.mockImplementation(async (_, fn) => {
        return await fn();
      });
      mockRepository.findById.mockResolvedValue(task);

      const result = await handler.execute(query);

      expect(result.taskId).toBe(taskId);
      expect(mockRepository.findById).toHaveBeenCalledWith(taskId);
    });
  });
});