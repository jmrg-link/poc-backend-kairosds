import { TaskService } from '../../../src/application/services/TaskService';
import { TaskRepository } from '../../../src/presentation/Task/repositories/TaskRepository';
import { TaskQueueProducer } from '../../../src/infrastructure/queues/TaskQueueProducer';
import { ImageDownloadService } from '../../../src/application/services/ImageDownloadService';
import { TaskStatus, TaskStatusTransition, TaskEntity } from '../../../src/domain/entities';
import { ProcessedImage } from '../../../src/domain/entities/TaskEntity';
import { CreateTaskRequest } from '../../../src/domain/dtos';
import { BusinessError, NotFoundError } from '../../../src/core/errors';
import { generateUUID } from '../../../src/core/helpers/crypto';
import { logger } from '../../../src/core/helpers/logger';
import fs from 'fs/promises';

jest.mock('../../../src/presentation/Task/repositories/TaskRepository');
jest.mock('../../../src/infrastructure/queues/TaskQueueProducer');
jest.mock('../../../src/application/services/ImageDownloadService');
jest.mock('../../../src/core/helpers/crypto');
jest.mock('../../../src/core/helpers/logger');
jest.mock('fs/promises');
jest.mock('../../../src/domain/entities/TaskEntity', () => ({
  ...jest.requireActual('../../../src/domain/entities/TaskEntity'),
  TaskStatusTransition: {
    validateTransition: jest.fn(),
  },
}));

/**
 * Suite de pruebas para TaskService
 * Verifica la orquestación de lógica de negocio para tareas de procesamiento de imágenes
 */
describe('TaskService', () => {
  let taskService: TaskService;
  let mockRepository: jest.Mocked<TaskRepository>;
  let mockQueue: jest.Mocked<TaskQueueProducer>;
  let mockImageDownloadService: jest.Mocked<ImageDownloadService>;

  const mockTaskEntity: TaskEntity = {
    _id: '507f1f77bcf86cd799439011',
    status: TaskStatus.PENDING,
    price: 25,
    originalPath: '/tmp/test-image.jpg',
    images: [],
    idempotencyKey: 'test-idempotency-key',
    createdAt: new Date('2023-01-01T00:00:00.000Z'),
    updatedAt: new Date('2023-01-01T00:00:00.000Z'),
  };

  const mockFile: Express.Multer.File = {
    fieldname: 'image',
    originalname: 'test-image.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    filename: 'test-image.jpg',
    path: '/tmp/uploaded-image.jpg',
    size: 1024,
    stream: {} as any,
    destination: '/tmp',
    buffer: Buffer.alloc(0),
  };

  /**
   * Helper para crear mock de CreateTaskRequest
   */
  const createMockRequest = (overrides: Partial<CreateTaskRequest & { idempotencyKey?: string }> = {}): CreateTaskRequest & { idempotencyKey?: string } => {
    const baseRequest = {
      body: {},
      headers: {},
      query: {},
      params: {},
      get: jest.fn(),
      header: jest.fn(),
      accepts: jest.fn(),
      acceptsCharsets: jest.fn(),
      acceptsEncodings: jest.fn(),
      acceptsLanguages: jest.fn(),
      range: jest.fn(),
      param: jest.fn(),
      is: jest.fn(),
      ...overrides,
    } as unknown as CreateTaskRequest & { idempotencyKey?: string };
    
    return baseRequest;
  };

  /**
   * Configuración inicial para cada test
   */
  beforeEach(() => {
    jest.clearAllMocks();

    mockRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByIdempotencyKey: jest.fn(),
      updateStatus: jest.fn(),
      updateOriginalPath: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
    } as unknown as jest.Mocked<TaskRepository>;

    mockQueue = {
      addTask: jest.fn(),
    } as unknown as jest.Mocked<TaskQueueProducer>;

    mockImageDownloadService = {
      download: jest.fn(),
    } as unknown as jest.Mocked<ImageDownloadService>;

    jest.mocked(generateUUID).mockReturnValue('generated-uuid');
    jest.mocked(fs.mkdir).mockResolvedValue(undefined);
    jest.mocked(fs.access).mockResolvedValue(undefined);
    jest.mocked(fs.rename).mockResolvedValue(undefined);

    taskService = new TaskService(mockRepository, mockQueue, mockImageDownloadService);
  });

  /**
   * Pruebas del constructor
   */
  describe('constructor', () => {
    /**
     * @test Debe crear instancia con dependencias inyectadas
     */
    it('debe crear instancia con dependencias inyectadas', () => {
      const service = new TaskService(mockRepository, mockQueue, mockImageDownloadService);
      expect(service).toBeInstanceOf(TaskService);
    });
  });

  /**
   * Pruebas del método createTaskFromRequest
   */
  describe('createTaskFromRequest', () => {
    /**
     * @test Debe crear tarea desde archivo upload
     */
    it('debe crear tarea desde archivo upload', async () => {
      const req = createMockRequest({
        file: mockFile,
        body: {},
        idempotencyKey: 'test-key',
      });

      mockRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(mockTaskEntity);

      const result = await taskService.createTaskFromRequest(req);

      expect(mockRepository.findByIdempotencyKey).toHaveBeenCalledWith('test-key');
      expect(mockRepository.create).toHaveBeenCalledWith({
        status: TaskStatus.PENDING,
        price: expect.any(Number),
        originalPath: '/tmp/uploaded-image.jpg',
        images: [],
        idempotencyKey: 'test-key',
      });
      expect(mockQueue.addTask).toHaveBeenCalled();
      expect(result.taskId).toBe('507f1f77bcf86cd799439011');
    });

    /**
     * @test Debe crear tarea desde URL de imagen
     */
    it('debe crear tarea desde URL de imagen', async () => {
      const req = createMockRequest({
        body: { imageUrl: 'https://example.com/image.jpg' },
        idempotencyKey: 'test-key',
      });

      const downloadedPath = '/tmp/downloaded-image.jpg';
      mockImageDownloadService.download.mockResolvedValue(downloadedPath);
      mockRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(mockTaskEntity);

      const result = await taskService.createTaskFromRequest(req);

      expect(mockImageDownloadService.download).toHaveBeenCalledWith('https://example.com/image.jpg');
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          originalPath: downloadedPath,
        })
      );
      expect(result.taskId).toBe('507f1f77bcf86cd799439011');
    });

    /**
     * @test Debe crear tarea desde path local
     */
    it('debe crear tarea desde path local', async () => {
      const req = createMockRequest({
        body: { imagePath: '/local/path/image.jpg' },
        idempotencyKey: 'test-key',
      });

      mockRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(mockTaskEntity);

      const result = await taskService.createTaskFromRequest(req);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          originalPath: '/local/path/image.jpg',
        })
      );
      expect(result.taskId).toBe('507f1f77bcf86cd799439011');
    });

    /**
     * @test Debe fallar cuando no se proporciona fuente de imagen
     */
    it('debe fallar cuando no se proporciona fuente de imagen', async () => {
      const req = createMockRequest({
        body: {},
        idempotencyKey: 'test-key',
      });

      await expect(taskService.createTaskFromRequest(req)).rejects.toThrow(BusinessError);
      await expect(taskService.createTaskFromRequest(req)).rejects.toThrow('Se requiere imagePath, imageUrl o archivo');
    });

    /**
     * @test Debe retornar tarea existente cuando hay idempotencyKey duplicado
     */
    it('debe retornar tarea existente cuando hay idempotencyKey duplicado', async () => {
      const req = createMockRequest({
        file: mockFile,
        body: {},
        idempotencyKey: 'existing-key',
      });

      mockRepository.findByIdempotencyKey.mockResolvedValue(mockTaskEntity);

      const result = await taskService.createTaskFromRequest(req);

      expect(mockRepository.findByIdempotencyKey).toHaveBeenCalledWith('existing-key');
      expect(mockRepository.create).not.toHaveBeenCalled();
      expect(result.taskId).toBe('507f1f77bcf86cd799439011');
    });

    /**
     * @test Debe manejar errores y logear apropiadamente
     */
    it('debe manejar errores y logear apropiadamente', async () => {
      const req = createMockRequest({
        file: mockFile,
        body: {},
        idempotencyKey: 'test-key',
      });

      const error = new Error('Database error');
      mockRepository.findByIdempotencyKey.mockRejectedValue(error);

      await expect(taskService.createTaskFromRequest(req)).rejects.toThrow('Database error');
      expect(logger.error).toHaveBeenCalledWith(
        'Error creando tarea desde request',
        expect.objectContaining({
          error: 'Database error',
          idempotencyKey: 'test-key',
        })
      );
    });
  });

  /**
   * Pruebas del método createTask
   */
  describe('createTask', () => {
    /**
     * @test Debe crear nueva tarea con idempotencyKey
     */
    it('debe crear nueva tarea con idempotencyKey', async () => {
      mockRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(mockTaskEntity);

      const result = await taskService.createTask('/path/to/image.jpg', 'unique-key');

      expect(mockRepository.findByIdempotencyKey).toHaveBeenCalledWith('unique-key');
      expect(mockRepository.create).toHaveBeenCalledWith({
        status: TaskStatus.PENDING,
        price: expect.any(Number),
        originalPath: '/path/to/image.jpg',
        images: [],
        idempotencyKey: 'unique-key',
      });
      expect(result.taskId).toBe('507f1f77bcf86cd799439011');
    });

    /**
     * @test Debe generar UUID cuando no se proporciona idempotencyKey
     */
    it('debe generar UUID cuando no se proporciona idempotencyKey', async () => {
      mockRepository.create.mockResolvedValue(mockTaskEntity);

      await taskService.createTask('/path/to/image.jpg');

      expect(mockRepository.create).toHaveBeenCalledWith({
        status: TaskStatus.PENDING,
        price: expect.any(Number),
        originalPath: '/path/to/image.jpg',
        images: [],
        idempotencyKey: 'generated-uuid',
      });
    });

    /**
     * @test Debe generar precio en rango válido
     */
    it('debe generar precio en rango válido', async () => {
      mockRepository.create.mockResolvedValue(mockTaskEntity);

      await taskService.createTask('/path/to/image.jpg');

      const createCall = mockRepository.create.mock.calls[0][0];
      expect(createCall.price).toBeGreaterThanOrEqual(5);
      expect(createCall.price).toBeLessThanOrEqual(50);
    });
  });

  /**
   * Pruebas del método getTaskById
   */
  describe('getTaskById', () => {
    /**
     * @test Debe retornar tarea existente
     */
    it('debe retornar tarea existente', async () => {
      mockRepository.findById.mockResolvedValue(mockTaskEntity);

      const result = await taskService.getTaskById('507f1f77bcf86cd799439011');

      expect(mockRepository.findById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(result.taskId).toBe('507f1f77bcf86cd799439011');
      expect(result.status).toBe('pending');
    });

    /**
     * @test Debe fallar cuando tarea no existe
     */
    it('debe fallar cuando tarea no existe', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(taskService.getTaskById('nonexistent')).rejects.toThrow(NotFoundError);
      await expect(taskService.getTaskById('nonexistent')).rejects.toThrow('La tarea con ID nonexistent no existe');
    });
  });

  /**
   * Pruebas del método listTasks
   */
  describe('listTasks', () => {
    const mockTasks = [mockTaskEntity, { ...mockTaskEntity, _id: 'task2' }];

    /**
     * @test Debe listar tareas con paginación
     */
    it('debe listar tareas con paginación', async () => {
      mockRepository.find.mockResolvedValue(mockTasks);
      mockRepository.count.mockResolvedValue(10);

      const result = await taskService.listTasks({ page: 1, limit: 5 });

      expect(mockRepository.find).toHaveBeenCalledWith({}, 0, 5);
      expect(mockRepository.count).toHaveBeenCalledWith({});
      expect(result.data).toHaveLength(2);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 5,
        total: 10,
        totalPages: 2,
      });
    });

    /**
     * @test Debe filtrar por estado
     */
    it('debe filtrar por estado', async () => {
      mockRepository.find.mockResolvedValue([mockTaskEntity]);
      mockRepository.count.mockResolvedValue(1);

      const result = await taskService.listTasks({ page: 1, limit: 5, status: TaskStatus.PENDING });

      expect(mockRepository.find).toHaveBeenCalledWith({ status: TaskStatus.PENDING }, 0, 5);
      expect(mockRepository.count).toHaveBeenCalledWith({ status: TaskStatus.PENDING });
      expect(result.data).toHaveLength(1);
    });

    /**
     * @test Debe calcular skip correctamente para páginas
     */
    it('debe calcular skip correctamente para páginas', async () => {
      mockRepository.find.mockResolvedValue([]);
      mockRepository.count.mockResolvedValue(0);

      await taskService.listTasks({ page: 3, limit: 10 });

      expect(mockRepository.find).toHaveBeenCalledWith({}, 20, 10);
    });
  });

  /**
   * Pruebas del método retryTask
   */
  describe('retryTask', () => {
    const failedTask = { ...mockTaskEntity, status: TaskStatus.FAILED };

    /**
     * @test Debe reintentar tarea fallida
     */
    it('debe reintentar tarea fallida', async () => {
      mockRepository.findById.mockResolvedValue(failedTask);
      mockRepository.updateStatus.mockResolvedValue();
      mockQueue.addTask.mockResolvedValue();

      const result = await taskService.retryTask('507f1f77bcf86cd799439011');

      expect(mockRepository.findById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(mockRepository.updateStatus).toHaveBeenCalledWith('507f1f77bcf86cd799439011', TaskStatus.PENDING);
      expect(mockQueue.addTask).toHaveBeenCalledWith('507f1f77bcf86cd799439011', failedTask.originalPath);
      expect(result.status).toBe('pending');
    });

    /**
     * @test Debe fallar cuando tarea no existe
     */
    it('debe fallar cuando tarea no existe', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(taskService.retryTask('nonexistent')).rejects.toThrow(NotFoundError);
    });

    /**
     * @test Debe fallar cuando tarea no está en estado FAILED
     */
    it('debe fallar cuando tarea no está en estado FAILED', async () => {
      mockRepository.findById.mockResolvedValue(mockTaskEntity);

      await expect(taskService.retryTask('507f1f77bcf86cd799439011')).rejects.toThrow(BusinessError);
      await expect(taskService.retryTask('507f1f77bcf86cd799439011')).rejects.toThrow('Solo se pueden reintentar tareas fallidas');
    });
  });

  /**
   * Pruebas del método updateTaskStatus
   */
  describe('updateTaskStatus', () => {
    /**
     * @test Debe actualizar estado válido
     */
    it('debe actualizar estado válido', async () => {
      mockRepository.findById.mockResolvedValue(mockTaskEntity);
      jest.mocked(TaskStatusTransition.validateTransition).mockReturnValue(undefined);
      mockRepository.updateStatus.mockResolvedValue();

      await taskService.updateTaskStatus('507f1f77bcf86cd799439011', TaskStatus.PROCESSING);

      expect(mockRepository.findById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(TaskStatusTransition.validateTransition).toHaveBeenCalledWith(TaskStatus.PENDING, TaskStatus.PROCESSING);
      expect(mockRepository.updateStatus).toHaveBeenCalledWith('507f1f77bcf86cd799439011', TaskStatus.PROCESSING, undefined);
    });

    /**
     * @test Debe actualizar con datos adicionales
     */
    it('debe actualizar con datos adicionales', async () => {
      const additionalData = { images: ['image1.jpg', 'image2.jpg'] };
      mockRepository.findById.mockResolvedValue(mockTaskEntity);
      jest.mocked(TaskStatusTransition.validateTransition).mockReturnValue(undefined);
      mockRepository.updateStatus.mockResolvedValue();

      await taskService.updateTaskStatus('507f1f77bcf86cd799439011', TaskStatus.COMPLETED, additionalData);

      expect(mockRepository.updateStatus).toHaveBeenCalledWith('507f1f77bcf86cd799439011', TaskStatus.COMPLETED, additionalData);
    });

    /**
     * @test Debe fallar cuando tarea no existe
     */
    it('debe fallar cuando tarea no existe', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(taskService.updateTaskStatus('nonexistent', TaskStatus.PROCESSING)).rejects.toThrow(NotFoundError);
    });

    /**
     * @test Debe fallar cuando transición es inválida
     */
    it('debe fallar cuando transición es inválida', async () => {
      mockRepository.findById.mockResolvedValue(mockTaskEntity);
      jest.mocked(TaskStatusTransition.validateTransition).mockImplementation(() => {
        throw new Error('Invalid transition');
      });

      await expect(taskService.updateTaskStatus('507f1f77bcf86cd799439011', TaskStatus.COMPLETED)).rejects.toThrow('Invalid transition');
    });
  });

  /**
   * Pruebas de métodos privados a través de métodos públicos
   */
  describe('Métodos privados', () => {
    /**
     * @test moveImageToTaskDirectory - debe mover archivo exitosamente
     */
    it('debe mover imagen a directorio de tarea exitosamente', async () => {
      const req = createMockRequest({
        file: mockFile,
        body: {},
        idempotencyKey: 'test-key',
      });

      mockRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(mockTaskEntity);
      mockRepository.updateOriginalPath.mockResolvedValue();

      await taskService.createTaskFromRequest(req);

      expect(fs.mkdir).toHaveBeenCalled();
      expect(fs.access).toHaveBeenCalledWith('/tmp/uploaded-image.jpg');
      expect(fs.rename).toHaveBeenCalled();
      expect(mockRepository.updateOriginalPath).toHaveBeenCalled();
    });

    /**
     * @test moveImageToTaskDirectory - debe manejar archivo no accesible
     */
    it('debe manejar archivo no accesible al mover', async () => {
      const req = createMockRequest({
        file: mockFile,
        body: {},
        idempotencyKey: 'test-key',
      });

      mockRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(mockTaskEntity);
      jest.mocked(fs.access).mockRejectedValue(new Error('File not found'));

      await taskService.createTaskFromRequest(req);

      expect(logger.warn).toHaveBeenCalledWith(
        'Archivo origen no accesible, usando ruta original',
        expect.objectContaining({
          originalPath: '/tmp/uploaded-image.jpg',
        })
      );
    });

    /**
     * @test generateRandomPrice - debe generar precio en rango correcto múltiples veces
     */
    it('debe generar precios en rango correcto múltiples veces', async () => {
      mockRepository.create.mockResolvedValue(mockTaskEntity);

      for (let i = 0; i < 10; i++) {
        await taskService.createTask('/path/to/image.jpg');
        const createCall = mockRepository.create.mock.calls[i][0];
        expect(createCall.price).toBeGreaterThanOrEqual(5);
        expect(createCall.price).toBeLessThanOrEqual(50);
        expect(Number.isInteger(createCall.price)).toBe(true);
      }
    });
  });

  /**
   * Pruebas del mapeo de DTO
   */
  describe('mapEntityToDto', () => {
    /**
     * @test Debe mapear tarea PENDING correctamente
     */
    it('debe mapear tarea PENDING correctamente', async () => {
      mockRepository.findById.mockResolvedValue(mockTaskEntity);

      const result = await taskService.getTaskById('507f1f77bcf86cd799439011');

      expect(result).toEqual({
        taskId: '507f1f77bcf86cd799439011',
        status: 'pending',
        price: 25,
        createdAt: new Date('2023-01-01T00:00:00.000Z'),
        updatedAt: new Date('2023-01-01T00:00:00.000Z'),
      });
    });

    /**
     * @test Debe mapear tarea COMPLETED con imágenes
     */
    it('debe mapear tarea COMPLETED con imágenes', async () => {
      const processedImages: ProcessedImage[] = [
        { resolution: '1024', path: '/path/to/image1-1024.jpg' },
        { resolution: '800', path: '/path/to/image1-800.jpg' },
      ];
      
      const completedTask: TaskEntity = {
        ...mockTaskEntity,
        status: TaskStatus.COMPLETED,
        images: processedImages,
      };
      
      mockRepository.findById.mockResolvedValue(completedTask);

      const result = await taskService.getTaskById('507f1f77bcf86cd799439011');

      expect(result).toEqual(
        expect.objectContaining({
          status: 'completed',
          images: processedImages,
        })
      );
    });

    /**
     * @test Debe mapear tarea FAILED con error
     */
    it('debe mapear tarea FAILED con error', async () => {
      const failedTask = {
        ...mockTaskEntity,
        status: TaskStatus.FAILED,
        error: 'Processing failed due to invalid image format',
      };
      mockRepository.findById.mockResolvedValue(failedTask);

      const result = await taskService.getTaskById('507f1f77bcf86cd799439011');

      expect(result).toEqual(
        expect.objectContaining({
          status: 'failed',
          error: 'Processing failed due to invalid image format',
        })
      );
    });

    /**
     * @test Debe omitir campos opcionales cuando no están presentes
     */
    it('debe omitir campos opcionales cuando no están presentes', async () => {
      const minimalTask = {
        _id: '507f1f77bcf86cd799439011',
        status: TaskStatus.PENDING,
        price: 25,
        originalPath: '/tmp/test.jpg',
        images: [],
        idempotencyKey: 'test-key',
      };
      mockRepository.findById.mockResolvedValue(minimalTask);

      const result = await taskService.getTaskById('507f1f77bcf86cd799439011');

      expect(result).toEqual({
        taskId: '507f1f77bcf86cd799439011',
        status: 'pending',
        price: 25,
      });
      expect(result).not.toHaveProperty('createdAt');
      expect(result).not.toHaveProperty('updatedAt');
      expect(result).not.toHaveProperty('images');
      expect(result).not.toHaveProperty('error');
    });
  });

  /**
   * Pruebas de integración y flujos completos
   */
  describe('Integración', () => {
    /**
     * @test Debe ejecutar flujo completo de creación desde upload
     */
    it('debe ejecutar flujo completo de creación desde upload', async () => {
      const req = createMockRequest({
        file: mockFile,
        body: {},
        idempotencyKey: 'integration-test',
      });

      mockRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(mockTaskEntity);
      mockRepository.updateOriginalPath.mockResolvedValue();

      const result = await taskService.createTaskFromRequest(req);

      expect(mockRepository.findByIdempotencyKey).toHaveBeenCalledWith('integration-test');
      expect(mockRepository.create).toHaveBeenCalled();
      expect(fs.mkdir).toHaveBeenCalled();
      expect(mockRepository.updateOriginalPath).toHaveBeenCalled();
      expect(mockQueue.addTask).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        'Tarea creada exitosamente',
        expect.objectContaining({
          taskId: '507f1f77bcf86cd799439011',
          source: 'upload',
        })
      );
      expect(result.taskId).toBe('507f1f77bcf86cd799439011');
    });

    /**
     * @test Debe manejar constantes de clase correctamente
     */
    it('debe usar constantes de clase para validaciones', async () => {
      mockRepository.create.mockResolvedValue(mockTaskEntity);

      for (let i = 0; i < 20; i++) {
        await taskService.createTask('/path/to/image.jpg');
        const createCall = mockRepository.create.mock.calls[i][0];
        expect(createCall.price).toBeGreaterThanOrEqual(5);
        expect(createCall.price).toBeLessThanOrEqual(50);
      }
    });
  });
});