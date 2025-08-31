/**
 * @file TaskQueueProducer.test.ts
 * @description Tests unitarios para TaskQueueProducer - BullMQ producer
 * @author jmrg
 * @version 1.0.0
 */

import { TaskQueueProducer } from '../../../../src/infrastructure/queues/TaskQueueProducer';
import { RedisConnection } from '../../../../src/infrastructure/cache/RedisConnection';
import { envs } from '../../../../src/config/envs';
import { Queue, Job } from 'bullmq';

jest.mock('bullmq');
jest.mock('../../../../src/infrastructure/cache/RedisConnection');
jest.mock('../../../../src/config/envs');

const MockedQueue = Queue as jest.MockedClass<typeof Queue>;
const mockedRedisConnection = RedisConnection as jest.Mocked<typeof RedisConnection>;
const mockedEnvs = envs as jest.Mocked<typeof envs>;

describe('TaskQueueProducer', () => {
  let mockQueueInstance: jest.Mocked<Queue>;
  let originalConsoleError: jest.SpyInstance;
  let originalConsoleWarn: jest.SpyInstance;
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    
    TaskQueueProducer['queue'] = undefined as unknown as Queue;
    TaskQueueProducer['initialized'] = false;
    
    mockQueueInstance = {
      add: jest.fn(),
      close: jest.fn(),
    } as unknown as jest.Mocked<Queue>;
    
    MockedQueue.mockImplementation(() => mockQueueInstance);
    
    mockedRedisConnection.getConfig.mockReturnValue({
      host: 'localhost',
      port: 6379,
    });
    
    mockedEnvs.QUEUE = {
      NAME: 'task-queue',
      CONCURRENCY: 5,
      MAX_RETRIES: 3,
    };
    
    originalConsoleError = jest.spyOn(console, 'error').mockImplementation();
    originalConsoleWarn = jest.spyOn(console, 'warn').mockImplementation();
    
    originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
  });

  afterEach(() => {
    originalConsoleError.mockRestore();
    originalConsoleWarn.mockRestore();
    
    if (originalNodeEnv !== undefined) {
      process.env.NODE_ENV = originalNodeEnv;
    } else {
      delete process.env.NODE_ENV;
    }
  });

  describe('constructor y inicialización', () => {
    /**
     * @test Debe crear instancia de Queue cuando todo funciona correctamente
     */
    it('debe crear instancia de Queue cuando todo funciona correctamente', () => {
      new TaskQueueProducer();
      
      expect(MockedQueue).toHaveBeenCalledWith(
        mockedEnvs.QUEUE.NAME,
        {
          connection: {
            host: 'localhost',
            port: 6379,
          },
        }
      );
      expect(TaskQueueProducer['initialized']).toBe(true);
    });

    /**
     * @test No debe reinicializar cuando ya está inicializada
     */
    it('no debe reinicializar cuando ya está inicializada', () => {
      new TaskQueueProducer();
      MockedQueue.mockClear();
      
      new TaskQueueProducer();
      
      expect(MockedQueue).not.toHaveBeenCalled();
    });

    /**
     * @test Debe usar configuración de Redis desde RedisConnection
     */
    it('debe usar configuración de Redis desde RedisConnection', () => {
      mockedRedisConnection.getConfig.mockReturnValue({
        host: 'redis-server',
        port: 6380,
        password: 'secret',
      });
      
      new TaskQueueProducer();
      
      expect(MockedQueue).toHaveBeenCalledWith(
        mockedEnvs.QUEUE.NAME,
        {
          connection: {
            host: 'redis-server',
            port: 6380,
            password: 'secret',
          },
        }
      );
    });
  });

  describe('initialize método estático', () => {
    /**
     * @test Debe completar inicialización sin errores
     */
    it('debe completar inicialización sin errores', () => {
      expect(() => TaskQueueProducer.initialize()).not.toThrow();
      expect(MockedQueue).toHaveBeenCalled();
    });

    /**
     * @test Debe permitir múltiples llamadas
     */
    it('debe permitir múltiples llamadas', () => {
      TaskQueueProducer.initialize();
      MockedQueue.mockClear();
      
      TaskQueueProducer.initialize();
      
      expect(MockedQueue).not.toHaveBeenCalled();
    });
  });

  describe('getQueue método estático', () => {
    /**
     * @test Debe retornar instancia de Queue
     */
    it('debe retornar instancia de Queue', () => {
      const queue = TaskQueueProducer.getQueue();
      
      expect(queue).toBe(mockQueueInstance);
      expect(MockedQueue).toHaveBeenCalled();
    });

    /**
     * @test Debe inicializar automáticamente si no está inicializada
     */
    it('debe inicializar automáticamente si no está inicializada', () => {
      expect(TaskQueueProducer['queue']).toBeUndefined();
      
      const queue = TaskQueueProducer.getQueue();
      
      expect(queue).toBe(mockQueueInstance);
      expect(MockedQueue).toHaveBeenCalledWith(
        mockedEnvs.QUEUE.NAME,
        expect.objectContaining({
          connection: expect.any(Object),
        })
      );
    });

    /**
     * @test Debe retornar la misma instancia en llamadas múltiples
     */
    it('debe retornar la misma instancia en llamadas múltiples', () => {
      const queue1 = TaskQueueProducer.getQueue();
      const queue2 = TaskQueueProducer.getQueue();
      
      expect(queue1).toBe(queue2);
      expect(queue1).toBe(mockQueueInstance);
    });
  });

  describe('addTask', () => {
    let producer: TaskQueueProducer;
    const mockTaskId = 'task-123';
    const mockImagePath = '/uploads/image.jpg';

    beforeEach(() => {
      producer = new TaskQueueProducer();
      mockQueueInstance.add.mockResolvedValue({ id: 'job-123' } as Job);
    });

    /**
     * @test Debe añadir tarea con configuración correcta
     */
    it('debe añadir tarea con configuración correcta', async () => {
      await producer.addTask(mockTaskId, mockImagePath);
      
      expect(mockQueueInstance.add).toHaveBeenCalledWith(
        'process-image',
        {
          taskId: mockTaskId,
          imagePath: mockImagePath,
          timestamp: expect.any(Number),
        },
        {
          attempts: mockedEnvs.QUEUE.MAX_RETRIES,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: true,
          removeOnFail: false,
        }
      );
    });

    /**
     * @test Debe incluir timestamp actual
     */
    it('debe incluir timestamp actual', async () => {
      const beforeTime = Date.now();
      await producer.addTask(mockTaskId, mockImagePath);
      const afterTime = Date.now();
      
      const callArgs = mockQueueInstance.add.mock.calls[0];
      const payload = callArgs[1] as { timestamp: number };
      
      expect(payload.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(payload.timestamp).toBeLessThanOrEqual(afterTime);
    });

    /**
     * @test Debe usar configuración MAX_RETRIES desde envs
     */
    it('debe usar configuración MAX_RETRIES desde envs', async () => {
      mockedEnvs.QUEUE.MAX_RETRIES = 7;
      
      await producer.addTask(mockTaskId, mockImagePath);
      
      const callArgs = mockQueueInstance.add.mock.calls[0];
      const options = callArgs[2] as { attempts: number };
      
      expect(options.attempts).toBe(7);
    });

    /**
     * @test Debe propagar errores de la cola
     */
    it('debe propagar errores de la cola', async () => {
      const error = new Error('Queue add failed');
      mockQueueInstance.add.mockRejectedValue(error);
      
      await expect(producer.addTask(mockTaskId, mockImagePath))
        .rejects.toThrow('Queue add failed');
    });

    /**
     * @test Debe manejar cuando queue es null
     */
    it('debe manejar cuando queue es null', async () => {
      TaskQueueProducer['queue'] = null as unknown as Queue;
      
      await producer.addTask(mockTaskId, mockImagePath);
      
      expect(originalConsoleWarn).toHaveBeenCalledWith(
        'Cola no inicializada, saltando encolado de tarea:',
        mockTaskId
      );
      expect(mockQueueInstance.add).not.toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    /**
     * @test Debe propagar error en entorno de producción
     */
    it('debe propagar error en entorno de producción', () => {
      process.env.NODE_ENV = 'production';
      const error = new Error('Redis connection failed');
      MockedQueue.mockImplementation(() => {
        throw error;
      });
      
      expect(() => new TaskQueueProducer()).toThrow('Redis connection failed');
      expect(originalConsoleError).toHaveBeenCalledWith(
        'Error inicializando cola:',
        error
      );
    });

    /**
     * @test Debe crear mock queue en entorno de test
     */
    it('debe crear mock queue en entorno de test', () => {
      process.env.NODE_ENV = 'test';
      MockedQueue.mockImplementation(() => {
        throw new Error('Redis not available');
      });
      
      expect(() => new TaskQueueProducer()).not.toThrow();
      expect(originalConsoleError).toHaveBeenCalledWith(
        'Error inicializando cola:',
        expect.any(Error)
      );
      expect(TaskQueueProducer['initialized']).toBe(true);
    });

    /**
     * @test Mock queue debe funcionar correctamente en entorno de test
     */
    it('mock queue debe funcionar correctamente en entorno de test', async () => {
      process.env.NODE_ENV = 'test';
      MockedQueue.mockImplementation(() => {
        throw new Error('Redis not available');
      });
      
      new TaskQueueProducer();
      const queue = TaskQueueProducer.getQueue();
      
      expect(queue.add).toBeDefined();
      const result = await queue.add('test', {});
      expect(result).toEqual({ id: 'test-job-id' });
    });
  });

  describe('Integración completa', () => {
    /**
     * @test Debe funcionar flujo completo de creación y uso
     */
    it('debe funcionar flujo completo de creación y uso', async () => {
      const testProducer = new TaskQueueProducer();
      const queue = TaskQueueProducer.getQueue();
      
      expect(queue).toBe(mockQueueInstance);
      
      await testProducer.addTask('task-456', '/path/to/image.png');
      
      expect(mockQueueInstance.add).toHaveBeenCalledWith(
        'process-image',
        expect.objectContaining({
          taskId: 'task-456',
          imagePath: '/path/to/image.png',
        }),
        expect.objectContaining({
          attempts: mockedEnvs.QUEUE.MAX_RETRIES,
          backoff: expect.objectContaining({
            type: 'exponential',
            delay: 2000,
          }),
        })
      );
    });

    /**
     * @test Debe manejar múltiples productores con singleton
     */
    it('debe manejar múltiples productores con singleton', async () => {
      const producer1 = new TaskQueueProducer();
      const producer2 = new TaskQueueProducer();
      
      await producer1.addTask('task-1', '/path1');
      await producer2.addTask('task-2', '/path2');
      
      expect(mockQueueInstance.add).toHaveBeenCalledTimes(2);
      expect(MockedQueue).toHaveBeenCalledTimes(1);
    });

    /**
     * @test Debe usar configuración completa de envs
     */
    it('debe usar configuración completa de envs', () => {
      mockedEnvs.QUEUE = {
        NAME: 'custom-queue',
        CONCURRENCY: 10,
        MAX_RETRIES: 5,
      };
      
      TaskQueueProducer['queue'] = undefined as unknown as Queue;
      TaskQueueProducer['initialized'] = false;
      
      new TaskQueueProducer();
      
      expect(MockedQueue).toHaveBeenCalledWith(
        'custom-queue',
        expect.objectContaining({
          connection: expect.any(Object),
        })
      );
    });
  });
});