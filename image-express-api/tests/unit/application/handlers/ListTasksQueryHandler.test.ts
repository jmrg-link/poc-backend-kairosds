import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ListTasksQueryHandler } from '../../../../src/application/handlers/ListTasksQueryHandler';
import { ListTasksQuery } from '../../../../src/application/queries/ListTasksQuery';
import { ITaskRepository } from '../../../../src/application/repositories';
import { CacheService } from '../../../../src/application/services/CacheService';
import { TaskStatus } from '../../../../src/domain/entities/TaskEntity';
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
 * @description Suite de pruebas para ListTasksQueryHandler
 *
 * @description Valida el comportamiento del handler de listado de tareas:
 * - Listado paginado de tareas con cache dual (list/count)
 * - Filtrado por status opcional
 * - Generación de claves de cache únicas
 * - Mapeo correcto de entidades a DTOs
 * - Cálculo de paginación y metadatos
 * - Logging de operaciones de listado
 */
describe('ListTasksQueryHandler', () => {
  let handler: ListTasksQueryHandler;
  let mockRepository: jest.Mocked<ITaskRepository>;
  let mockCacheService: jest.Mocked<CacheService>;
  let mockLogger: jest.Mocked<typeof loggerModule.logger>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepository = MockFactory.createTaskRepository();
    mockCacheService = MockFactory.createCacheService();
    mockLogger = loggerModule.logger as jest.Mocked<typeof loggerModule.logger>;
    handler = new ListTasksQueryHandler(mockRepository, mockCacheService);
  });

  /**
   * @description Suite de pruebas para listado exitoso
   */
  describe('execute - Listado exitoso', () => {
    /**
     * @test Debe listar tareas sin filtro desde base de datos
     * @given Una query de listado sin filtros
     * @when Se ejecuta la query sin cache
     * @then Debe retornar lista paginada y hacer log
     */
    it('debe listar tareas sin filtro desde base de datos', async () => {
      const query = new ListTasksQuery(1, 10);
      const tasks = [
        {
          _id: 'task-1',
          status: TaskStatus.PENDING,
          price: 25,
          originalPath: '/test/1.jpg',
          images: [],
          createdAt: new Date('2024-01-01T10:00:00Z'),
          updatedAt: new Date('2024-01-01T10:05:00Z'),
        },
        {
          _id: 'task-2',
          status: TaskStatus.COMPLETED,
          price: 30,
          originalPath: '/test/2.jpg',
          images: [{ resolution: '1024' as const, path: '/output/1024/2.jpg' }],
          createdAt: new Date('2024-01-01T11:00:00Z'),
          updatedAt: new Date('2024-01-01T11:30:00Z'),
        },
      ];
      const totalCount = 25;

      let callCount = 0;
      mockCacheService.getOrSet.mockImplementation(async (_, fn) => {
        callCount++;
        return await fn();
      });
      mockRepository.find.mockResolvedValue(tasks);
      mockRepository.count.mockResolvedValue(totalCount);

      const result = await handler.execute(query);

      expect(mockCacheService.getOrSet).toHaveBeenCalledTimes(2);
      expect(mockRepository.find).toHaveBeenCalledWith({}, 0, 10);
      expect(mockRepository.count).toHaveBeenCalledWith({});
      expect(mockLogger.info).toHaveBeenCalledWith('Lista de tareas procesada', {
        page: 1,
        limit: 10,
        total: totalCount,
        status: undefined,
      });

      expect(result).toEqual({
        data: [
          {
            taskId: 'task-1',
            status: 'pending',
            price: 25,
            createdAt: tasks[0].createdAt,
            updatedAt: tasks[0].updatedAt,
          },
          {
            taskId: 'task-2',
            status: 'completed',
            price: 30,
            images: [{ resolution: '1024' as const, path: '/output/1024/2.jpg' }],
            createdAt: tasks[1].createdAt,
            updatedAt: tasks[1].updatedAt,
          },
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: totalCount,
          totalPages: 3,
        },
      });
    });

    /**
     * @test Debe listar tareas con filtro por status desde cache
     * @given Una query con filtro por status
     * @when Se ejecuta con datos en cache
     * @then Debe retornar desde cache sin consultar BD
     */
    it('debe listar tareas con filtro por status desde cache', async () => {
      const query = new ListTasksQuery(2, 5, TaskStatus.COMPLETED);
      const cachedTasks = [
        {
          _id: 'task-completed-1',
          status: TaskStatus.COMPLETED,
          price: 40,
          originalPath: '/test/comp1.jpg',
          images: [{ resolution: '800' as const, path: '/output/800/comp1.jpg' }],
          createdAt: new Date('2024-01-02T10:00:00Z'),
          updatedAt: new Date('2024-01-02T10:45:00Z'),
        },
      ];
      const cachedCount = 8;

      mockCacheService.getOrSet
        .mockResolvedValueOnce(cachedTasks)
        .mockResolvedValueOnce(cachedCount);

      const result = await handler.execute(query);

      expect(mockCacheService.getOrSet).toHaveBeenCalledTimes(2);
      expect(mockRepository.find).not.toHaveBeenCalled();
      expect(mockRepository.count).not.toHaveBeenCalled();

      expect(result).toEqual({
        data: [
          {
            taskId: 'task-completed-1',
            status: 'completed',
            price: 40,
            images: [{ resolution: '800' as const, path: '/output/800/comp1.jpg' }],
            createdAt: cachedTasks[0].createdAt,
            updatedAt: cachedTasks[0].updatedAt,
          },
        ],
        pagination: {
          page: 2,
          limit: 5,
          total: cachedCount,
          totalPages: 2,
        },
      });
    });

    /**
     * @test Debe calcular skip correcto para paginación
     * @given Una query de página 3 con límite 8
     * @when Se ejecuta la query
     * @then Debe calcular skip = 16 correctamente
     */
    it('debe calcular skip correcto para paginación', async () => {
      const query = new ListTasksQuery(3, 8);

      mockCacheService.getOrSet.mockImplementation(async (_, fn) => {
        return await fn();
      });
      mockRepository.find.mockResolvedValue([]);
      mockRepository.count.mockResolvedValue(0);

      await handler.execute(query);

      expect(mockRepository.find).toHaveBeenCalledWith({}, 16, 8);
    });

    /**
     * @test Debe usar TTLs correctos para cache
     * @given Una query de listado
     * @when Se ejecuta la query
     * @then Debe usar TTL 30s para list y 45s para count
     */
    it('debe usar TTLs correctos para cache', async () => {
      const query = new ListTasksQuery(1, 10);

      mockCacheService.getOrSet.mockImplementation(async (_, fn) => {
        return await fn();
      });
      mockRepository.find.mockResolvedValue([]);
      mockRepository.count.mockResolvedValue(0);

      await handler.execute(query);


      expect(mockCacheService.getOrSet).toHaveBeenNthCalledWith(
        1,
        expect.stringMatching(/^tasks:list:/),
        expect.any(Function),
        30
      );
      expect(mockCacheService.getOrSet).toHaveBeenNthCalledWith(
        2,
        expect.stringMatching(/^tasks:count:/),
        expect.any(Function),
        45
      );
    });
  });

  /**
   * @description Suite de pruebas para generación de claves de cache
   */
  describe('execute - Claves de cache', () => {
    /**
     * @test Debe generar claves de cache únicas para diferentes filtros
     * @given Queries con diferentes filtros
     * @when Se ejecutan las queries
     * @then Debe generar claves de cache diferentes
     */
    it('debe generar claves de cache únicas para diferentes filtros', async () => {
      const query1 = new ListTasksQuery(1, 10);
      const query2 = new ListTasksQuery(1, 10, TaskStatus.PENDING);

      mockCacheService.getOrSet.mockImplementation(async (_, fn) => {
        return await fn();
      });
      mockRepository.find.mockResolvedValue([]);
      mockRepository.count.mockResolvedValue(0);

      await handler.execute(query1);
      await handler.execute(query2);

      const calls = mockCacheService.getOrSet.mock.calls;

      expect(calls[0][0]).not.toBe(calls[2][0]);
      expect(calls[1][0]).not.toBe(calls[3][0]);
      expect(calls[0][0]).toMatch(/^tasks:list:/);
      expect(calls[1][0]).toMatch(/^tasks:count:/);
      expect(calls[2][0]).toMatch(/^tasks:list:/);
      expect(calls[3][0]).toMatch(/^tasks:count:/);
    });

    /**
     * @test Debe generar claves consistentes para mismos parámetros
     * @given Dos queries idénticas
     * @when Se ejecutan las queries
     * @then Debe generar las mismas claves de cache
     */
    it('debe generar claves consistentes para mismos parámetros', async () => {
      const query1 = new ListTasksQuery(2, 5, TaskStatus.COMPLETED);
      const query2 = new ListTasksQuery(2, 5, TaskStatus.COMPLETED);

      mockCacheService.getOrSet.mockImplementation(async (_, fn) => {
        return await fn();
      });
      mockRepository.find.mockResolvedValue([]);
      mockRepository.count.mockResolvedValue(0);

      await handler.execute(query1);
      await handler.execute(query2);

      const calls = mockCacheService.getOrSet.mock.calls;
      
      expect(calls[0][0]).toBe(calls[2][0]);
      expect(calls[1][0]).toBe(calls[3][0]);
    });
  });

  /**
   * @description Suite de pruebas para manejo de errores
   */
  describe('execute - Manejo de errores', () => {
    /**
     * @test Debe propagar errores del repositorio al buscar
     * @given Un repositorio que falla al buscar
     * @when Se ejecuta la query
     * @then Debe propagar el error del repositorio
     */
    it('debe propagar errores del repositorio al buscar', async () => {
      const query = new ListTasksQuery(1, 10);
      const repositoryError = new Error('Database connection failed');

      mockCacheService.getOrSet.mockImplementation(async (_, fn) => {
        return await fn();
      });
      mockRepository.find.mockRejectedValue(repositoryError);
      mockRepository.count.mockResolvedValue(0);

      await expect(handler.execute(query)).rejects.toThrow('Database connection failed');
    });

    /**
     * @test Debe propagar errores del repositorio al contar
     * @given Un repositorio que falla al contar
     * @when Se ejecuta la query
     * @then Debe propagar el error del repositorio
     */
    it('debe propagar errores del repositorio al contar', async () => {
      const query = new ListTasksQuery(1, 10);
      const countError = new Error('Count operation failed');

      mockCacheService.getOrSet.mockImplementation(async (_, fn) => {
        return await fn();
      });
      mockRepository.find.mockResolvedValue([]);
      mockRepository.count.mockRejectedValue(countError);

      await expect(handler.execute(query)).rejects.toThrow('Count operation failed');
    });

    /**
     * @test Debe propagar errores del servicio de cache
     * @given Un servicio de cache que falla
     * @when Se ejecuta la query
     * @then Debe propagar el error del cache
     */
    it('debe propagar errores del servicio de cache', async () => {
      const query = new ListTasksQuery(1, 10);
      const cacheError = new Error('Cache service unavailable');

      mockCacheService.getOrSet.mockRejectedValue(cacheError);

      await expect(handler.execute(query)).rejects.toThrow('Cache service unavailable');
    });
  });

  /**
   * @description Suite de pruebas para mapeo de DTOs
   */
  describe('execute - Mapeo de DTOs', () => {
    /**
     * @test Debe mapear correctamente tareas con diferentes estados
     * @given Tareas en diferentes estados
     * @when Se mapean a DTOs
     * @then Debe incluir campos apropiados según estado
     */
    it('debe mapear correctamente tareas con diferentes estados', async () => {
      const query = new ListTasksQuery(1, 10);
      const tasks = [
        {
          _id: 'task-pending',
          status: TaskStatus.PENDING,
          price: 20,
          originalPath: '/test/pending.jpg',
          images: [],
          createdAt: new Date('2024-01-01T10:00:00Z'),
          updatedAt: new Date('2024-01-01T10:05:00Z'),
        },
        {
          _id: 'task-completed',
          status: TaskStatus.COMPLETED,
          price: 30,
          originalPath: '/test/completed.jpg',
          images: [{ resolution: '1024' as const, path: '/output/1024/completed.jpg' }],
          createdAt: new Date('2024-01-01T11:00:00Z'),
          updatedAt: new Date('2024-01-01T11:30:00Z'),
        },
        {
          _id: 'task-failed',
          status: TaskStatus.FAILED,
          price: 25,
          originalPath: '/test/failed.jpg',
          images: [],
          error: 'Processing failed',
          createdAt: new Date('2024-01-01T12:00:00Z'),
          updatedAt: new Date('2024-01-01T12:15:00Z'),
        },
      ];

      mockCacheService.getOrSet.mockImplementation(async (_, fn) => {
        return await fn();
      });
      mockRepository.find.mockResolvedValue(tasks);
      mockRepository.count.mockResolvedValue(3);

      const result = await handler.execute(query);

      expect(result.data).toEqual([
        {
          taskId: 'task-pending',
          status: 'pending',
          price: 20,
          createdAt: tasks[0].createdAt,
          updatedAt: tasks[0].updatedAt,
        },
        {
          taskId: 'task-completed',
          status: 'completed',
          price: 30,
          images: [{ resolution: '1024' as const, path: '/output/1024/completed.jpg' }],
          createdAt: tasks[1].createdAt,
          updatedAt: tasks[1].updatedAt,
        },
        {
          taskId: 'task-failed',
          status: 'failed',
          price: 25,
          error: 'Processing failed',
          createdAt: tasks[2].createdAt,
          updatedAt: tasks[2].updatedAt,
        },
      ]);
    });

    /**
     * @test Debe omitir campos opcionales cuando no están presentes
     * @given Tareas sin campos opcionales
     * @when Se mapean a DTOs
     * @then Debe omitir campos undefined o vacíos
     */
    it('debe omitir campos opcionales cuando no están presentes', async () => {
      const query = new ListTasksQuery(1, 10);
      const tasks = [
        {
          _id: 'task-minimal',
          status: TaskStatus.PENDING,
          price: 15,
          originalPath: '/test/minimal.jpg',
          images: [],
        },
        {
          _id: 'task-completed-no-images',
          status: TaskStatus.COMPLETED,
          price: 20,
          originalPath: '/test/completed-empty.jpg',
          images: [],
        },
        {
          _id: 'task-failed-no-error',
          status: TaskStatus.FAILED,
          price: 25,
          originalPath: '/test/failed-empty.jpg',
          images: [],
          error: undefined,
        },
      ];

      mockCacheService.getOrSet.mockImplementation(async (_, fn) => {
        return await fn();
      });
      mockRepository.find.mockResolvedValue(tasks);
      mockRepository.count.mockResolvedValue(3);

      const result = await handler.execute(query);

      expect(result.data).toEqual([
        {
          taskId: 'task-minimal',
          status: 'pending',
          price: 15,
        },
        {
          taskId: 'task-completed-no-images',
          status: 'completed',
          price: 20,
        },
        {
          taskId: 'task-failed-no-error',
          status: 'failed',
          price: 25,
        },
      ]);
    });
  });

  /**
   * @description Suite de pruebas para casos edge
   */
  describe('execute - Casos edge', () => {
    /**
     * @test Debe manejar lista vacía correctamente
     * @given Una query que no retorna resultados
     * @when Se ejecuta la query
     * @then Debe retornar lista vacía con paginación correcta
     */
    it('debe manejar lista vacía correctamente', async () => {
      const query = new ListTasksQuery(1, 10);

      mockCacheService.getOrSet.mockImplementation(async (_, fn) => {
        return await fn();
      });
      mockRepository.find.mockResolvedValue([]);
      mockRepository.count.mockResolvedValue(0);

      const result = await handler.execute(query);

      expect(result).toEqual({
        data: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
        },
      });
    });

    /**
     * @test Debe calcular totalPages correctamente
     * @given Diferentes totales y límites
     * @when Se calcula totalPages
     * @then Debe redondear hacia arriba correctamente
     */
    it('debe calcular totalPages correctamente', async () => {
      const testCases = [
        { total: 25, limit: 10, expectedPages: 3 },
        { total: 30, limit: 10, expectedPages: 3 },
        { total: 31, limit: 10, expectedPages: 4 },
        { total: 1, limit: 10, expectedPages: 1 },
        { total: 0, limit: 10, expectedPages: 0 },
      ];

      for (const testCase of testCases) {
        const query = new ListTasksQuery(1, testCase.limit);

        mockCacheService.getOrSet.mockImplementation(async (_, fn) => {
          return await fn();
        });
        mockRepository.find.mockResolvedValue([]);
        mockRepository.count.mockResolvedValue(testCase.total);

        const result = await handler.execute(query);

        expect(result.pagination.totalPages).toBe(testCase.expectedPages);
      }
    });

    /**
     * @test Debe manejar páginas altas sin errores
     * @given Una query de página muy alta
     * @when Se ejecuta la query
     * @then Debe calcular skip correctamente sin errores
     */
    it('debe manejar páginas altas sin errores', async () => {
      const query = new ListTasksQuery(100, 20);

      mockCacheService.getOrSet.mockImplementation(async (_, fn) => {
        return await fn();
      });
      mockRepository.find.mockResolvedValue([]);
      mockRepository.count.mockResolvedValue(0);

      await handler.execute(query);

      expect(mockRepository.find).toHaveBeenCalledWith({}, 1980, 20);
    });

    /**
     * @test Debe funcionar con límites pequeños
     * @given Una query con límite de 1
     * @when Se ejecuta la query
     * @then Debe manejar correctamente la paginación
     */
    it('debe funcionar con límites pequeños', async () => {
      const query = new ListTasksQuery(1, 1);

      mockCacheService.getOrSet.mockImplementation(async (_, fn) => {
        return await fn();
      });
      mockRepository.find.mockResolvedValue([]);
      mockRepository.count.mockResolvedValue(5);

      const result = await handler.execute(query);

      expect(result.pagination).toEqual({
        page: 1,
        limit: 1,
        total: 5,
        totalPages: 5,
      });
    });
  });
});