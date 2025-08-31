import { QueueEvents, ConnectionOptions } from 'bullmq';
import Redis from 'ioredis';
import { TaskEvents } from '../../../../../src/infrastructure/queues/events/TaskEvents';
import { TaskEventType } from '../../../../../src/infrastructure/queues/events/EventTypes';
import { RedisConnection } from '../../../../../src/infrastructure/cache/RedisConnection';
import { RedisCache } from '../../../../../src/infrastructure/cache/RedisCache';
import { logger } from '../../../../../src/core/helpers';

jest.mock('bullmq');
jest.mock('../../../../../src/infrastructure/cache/RedisConnection');
jest.mock('../../../../../src/infrastructure/cache/RedisCache');
jest.mock('../../../../../src/core/helpers', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

/**
 * Suite de pruebas para TaskEvents
 * Verifica la gestión de eventos de BullMQ y publicación en Redis Pub/Sub
 */
describe('TaskEvents', () => {
  let mockQueueEvents: {
    on: jest.Mock;
    close: jest.Mock;
  };
  let mockRedisClient: {
    publish: jest.Mock;
  };
  let mockRedisConfig: ConnectionOptions;

  /**
   * Configuración inicial para cada test
   * Inicializa mocks de QueueEvents, Redis client y configuración
   */
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockRedisConfig = {
      host: 'localhost',
      port: 6379,
      password: 'test-password',
      db: 0,
    };
    
    mockRedisClient = {
      publish: jest.fn().mockResolvedValue(1),
    };
    
    mockQueueEvents = {
      on: jest.fn().mockReturnThis(),
      close: jest.fn().mockResolvedValue(void 0),
    };
    
    jest.mocked(RedisConnection.getConfig).mockReturnValue(mockRedisConfig);
    jest.mocked(RedisCache.getClient).mockReturnValue(mockRedisClient as unknown as Redis);
    
    (QueueEvents as unknown as jest.MockedClass<typeof QueueEvents>).mockImplementation(() => mockQueueEvents as unknown as QueueEvents);
  });

  /**
   * Pruebas del método initialize
   * Verifica la correcta inicialización de QueueEvents y setup de listeners
   */
  describe('initialize', () => {
    /**
     * @test Debe crear instancia de QueueEvents con configuración correcta
     */
    it('debe crear instancia de QueueEvents con configuración correcta', async () => {
      await TaskEvents.initialize();

      expect(QueueEvents).toHaveBeenCalledWith('image-processing', {
        connection: mockRedisConfig,
      });
      expect(logger.info).toHaveBeenCalledWith('TaskEvents initialized');
    });

    /**
     * @test Debe configurar listeners de eventos BullMQ
     */
    it('debe configurar listeners de eventos', async () => {
      await TaskEvents.initialize();

      expect(mockQueueEvents.on).toHaveBeenCalledWith('waiting', expect.any(Function));
      expect(mockQueueEvents.on).toHaveBeenCalledWith('active', expect.any(Function));
      expect(mockQueueEvents.on).toHaveBeenCalledWith('completed', expect.any(Function));
      expect(mockQueueEvents.on).toHaveBeenCalledWith('failed', expect.any(Function));
    });
  });

  /**
   * Pruebas de los manejadores de eventos BullMQ
   * Verifica comportamiento de cada tipo de evento (waiting, active, completed, failed)
   */
  describe('Event Handlers', () => {
    beforeEach(async () => {
      await TaskEvents.initialize();
    });

    /**
     * Pruebas del evento 'waiting'
     * Verifica logging cuando un job entra en estado de espera
     */
    describe('waiting event', () => {
      /**
       * @test Debe loggear cuando job está en espera
       */
      it('debe loggear cuando job está en espera', () => {
        const waitingHandler = mockQueueEvents.on.mock.calls.find(
          call => call[0] === 'waiting'
        )?.[1];

        const jobData = { jobId: 'test-job-123' };
        waitingHandler(jobData);

        expect(logger.info).toHaveBeenCalledWith('Job waiting', {
          jobId: 'test-job-123',
          event: 'waiting',
        });
      });
    });

    /**
     * Pruebas del evento 'active'
     * Verifica logging y publicación de eventos cuando job se activa
     */
    describe('active event', () => {
      /**
       * @test Debe loggear y publicar evento cuando job está activo
       */
      it('debe loggear y publicar evento cuando job está activo', () => {
        const activeHandler = mockQueueEvents.on.mock.calls.find(
          call => call[0] === 'active'
        )?.[1];

        const jobData = { jobId: 'test-job-123' };
        activeHandler(jobData);

        expect(logger.info).toHaveBeenCalledWith('Job active', {
          jobId: 'test-job-123',
          event: 'active',
        });

        expect(mockRedisClient.publish).toHaveBeenCalledWith(
          'task-events',
          expect.stringContaining('"eventType":"task.processing"')
        );
      });

      /**
       * @test Debe incluir workerId en evento de processing
       */
      it('debe incluir workerId en evento de processing', () => {
        const activeHandler = mockQueueEvents.on.mock.calls.find(
          call => call[0] === 'active'
        )?.[1];

        const jobData = { jobId: 'test-job-123' };
        activeHandler(jobData);

        const publishCall = mockRedisClient.publish.mock.calls[0];
        const eventPayload = JSON.parse(publishCall[1]);

        expect(eventPayload).toMatchObject({
          taskId: 'test-job-123',
          eventType: TaskEventType.TASK_PROCESSING,
          workerId: expect.any(String),
          timestamp: expect.any(Number),
        });
      });
    });

    /**
     * Pruebas del evento 'completed'
     * Verifica manejo de jobs completados y parsing de resultados
     */
    describe('completed event', () => {
      /**
       * @test Debe loggear y publicar evento cuando job se completa
       */
      it('debe loggear y publicar evento cuando job se completa', () => {
        const completedHandler = mockQueueEvents.on.mock.calls.find(
          call => call[0] === 'completed'
        )?.[1];

        const jobData = {
          jobId: 'test-job-123',
          returnvalue: JSON.stringify({
            images: ['image1.jpg', 'image2.jpg'],
            processingTime: 1500,
          }),
        };

        completedHandler(jobData);

        expect(logger.info).toHaveBeenCalledWith('Job completed', {
          jobId: 'test-job-123',
          returnvalue: jobData.returnvalue,
          event: 'completed',
        });

        expect(mockRedisClient.publish).toHaveBeenCalledWith(
          'task-events',
          expect.stringContaining('"eventType":"task.completed"')
        );
      });

      /**
       * @test Debe parsear correctamente returnvalue como JSON
       */
      it('debe parsear correctamente returnvalue como JSON', () => {
        const completedHandler = mockQueueEvents.on.mock.calls.find(
          call => call[0] === 'completed'
        )?.[1];

        const jobData = {
          jobId: 'test-job-123',
          returnvalue: JSON.stringify({
            images: ['image1.jpg', 'image2.jpg'],
            processingTime: 1500,
          }),
        };

        completedHandler(jobData);

        const publishCall = mockRedisClient.publish.mock.calls[0];
        const eventPayload = JSON.parse(publishCall[1]);

        expect(eventPayload).toMatchObject({
          taskId: 'test-job-123',
          eventType: TaskEventType.TASK_COMPLETED,
          images: ['image1.jpg', 'image2.jpg'],
          processingTime: 1500,
          timestamp: expect.any(Number),
        });
      });

      /**
       * @test Debe manejar returnvalue que ya es objeto
       */
      it('debe manejar returnvalue que ya es objeto', () => {
        const completedHandler = mockQueueEvents.on.mock.calls.find(
          call => call[0] === 'completed'
        )?.[1];

        const jobData = {
          jobId: 'test-job-123',
          returnvalue: {
            images: ['image1.jpg'],
            processingTime: 800,
          },
        };

        completedHandler(jobData);

        const publishCall = mockRedisClient.publish.mock.calls[0];
        const eventPayload = JSON.parse(publishCall[1]);

        expect(eventPayload).toMatchObject({
          taskId: 'test-job-123',
          eventType: TaskEventType.TASK_COMPLETED,
          images: ['image1.jpg'],
          processingTime: 800,
        });
      });

      /**
       * @test Debe manejar returnvalue con JSON inválido
       */
      it('debe manejar returnvalue con JSON inválido', () => {
        const completedHandler = mockQueueEvents.on.mock.calls.find(
          call => call[0] === 'completed'
        )?.[1];

        const jobData = {
          jobId: 'test-job-123',
          returnvalue: 'invalid-json{',
        };

        completedHandler(jobData);

        const publishCall = mockRedisClient.publish.mock.calls[0];
        const eventPayload = JSON.parse(publishCall[1]);

        expect(eventPayload).toMatchObject({
          taskId: 'test-job-123',
          eventType: TaskEventType.TASK_COMPLETED,
          images: [],
          processingTime: 0,
        });
      });

      /**
       * @test Debe usar valores por defecto cuando faltan en returnvalue
       */
      it('debe usar valores por defecto cuando faltan en returnvalue', () => {
        const completedHandler = mockQueueEvents.on.mock.calls.find(
          call => call[0] === 'completed'
        )?.[1];

        const jobData = {
          jobId: 'test-job-123',
          returnvalue: JSON.stringify({}),
        };

        completedHandler(jobData);

        const publishCall = mockRedisClient.publish.mock.calls[0];
        const eventPayload = JSON.parse(publishCall[1]);

        expect(eventPayload).toMatchObject({
          taskId: 'test-job-123',
          eventType: TaskEventType.TASK_COMPLETED,
          images: [],
          processingTime: 0,
        });
      });
    });

    /**
     * Pruebas del evento 'failed'
     * Verifica manejo de jobs fallidos y eventos de error
     */
    describe('failed event', () => {
      /**
       * @test Debe loggear y publicar evento cuando job falla
       */
      it('debe loggear y publicar evento cuando job falla', () => {
        const failedHandler = mockQueueEvents.on.mock.calls.find(
          call => call[0] === 'failed'
        )?.[1];

        const jobData = {
          jobId: 'test-job-123',
          failedReason: 'Network error',
        };

        failedHandler(jobData);

        expect(logger.error).toHaveBeenCalledWith('Job failed', {
          jobId: 'test-job-123',
          failedReason: 'Network error',
          event: 'failed',
        });

        expect(mockRedisClient.publish).toHaveBeenCalledWith(
          'task-events',
          expect.stringContaining('"eventType":"task.failed"')
        );
      });

      /**
       * @test Debe incluir información de error en evento
       */
      it('debe incluir información de error en evento', () => {
        const failedHandler = mockQueueEvents.on.mock.calls.find(
          call => call[0] === 'failed'
        )?.[1];

        const jobData = {
          jobId: 'test-job-123',
          failedReason: 'Processing failed',
        };

        failedHandler(jobData);

        const publishCall = mockRedisClient.publish.mock.calls[0];
        const eventPayload = JSON.parse(publishCall[1]);

        expect(eventPayload).toMatchObject({
          taskId: 'test-job-123',
          eventType: TaskEventType.TASK_FAILED,
          error: 'Processing failed',
          attempts: 1,
          willRetry: true,
          timestamp: expect.any(Number),
        });
      });

      /**
       * @test Debe usar mensaje por defecto cuando no hay failedReason
       */
      it('debe usar mensaje por defecto cuando no hay failedReason', () => {
        const failedHandler = mockQueueEvents.on.mock.calls.find(
          call => call[0] === 'failed'
        )?.[1];

        const jobData = {
          jobId: 'test-job-123',
          failedReason: undefined,
        };

        failedHandler(jobData);

        const publishCall = mockRedisClient.publish.mock.calls[0];
        const eventPayload = JSON.parse(publishCall[1]);

        expect(eventPayload.error).toBe('Unknown error');
      });
    });
  });

  /**
   * Pruebas del método publishTaskEvent
   * Verifica publicación de eventos en Redis y manejo de errores
   */
  describe('publishTaskEvent', () => {
    beforeEach(async () => {
      await TaskEvents.initialize();
    });

    /**
     * @test Debe loggear cuando evento se publica exitosamente
     */
    it('debe loggear cuando evento se publica exitosamente', async () => {
      const activeHandler = mockQueueEvents.on.mock.calls.find(
        call => call[0] === 'active'
      )?.[1];

      await activeHandler({ jobId: 'test-job-123' });

      expect(logger.info).toHaveBeenCalledWith('Task event published', {
        eventType: TaskEventType.TASK_PROCESSING,
        taskId: 'test-job-123',
      });
    });

    /**
     * @test Debe manejar errores al publicar eventos
     */
    it('debe manejar errores al publicar eventos', async () => {
      const publishError = new Error('Redis connection failed');
      mockRedisClient.publish.mockRejectedValue(publishError);

      const activeHandler = mockQueueEvents.on.mock.calls.find(
        call => call[0] === 'active'
      )?.[1];

      await activeHandler({ jobId: 'test-job-123' });

      expect(logger.error).toHaveBeenCalledWith('Error publishing task event', {
        eventType: TaskEventType.TASK_PROCESSING,
        data: expect.objectContaining({
          taskId: 'test-job-123',
        }),
        error: publishError,
      });
    });

    /**
     * @test Debe generar payload de evento con estructura correcta
     */
    it('debe generar payload de evento con estructura correcta', async () => {
      const completedHandler = mockQueueEvents.on.mock.calls.find(
        call => call[0] === 'completed'
      )?.[1];

      const testData = {
        jobId: 'test-job-123',
        returnvalue: JSON.stringify({
          images: ['test.jpg'],
          processingTime: 1000,
        }),
      };

      await completedHandler(testData);

      const publishCall = mockRedisClient.publish.mock.calls[0];
      expect(publishCall[0]).toBe('task-events');

      const eventPayload = JSON.parse(publishCall[1]);
      expect(eventPayload).toHaveProperty('taskId', 'test-job-123');
      expect(eventPayload).toHaveProperty('timestamp');
      expect(eventPayload).toHaveProperty('eventType', TaskEventType.TASK_COMPLETED);
      expect(typeof eventPayload.timestamp).toBe('number');
    });
  });

  /**
   * Pruebas del método close
   * Verifica cierre correcto de QueueEvents y manejo de errores
   */
  describe('close', () => {
    /**
     * @test Debe cerrar QueueEvents correctamente
     */
    it('debe cerrar QueueEvents correctamente', async () => {
      await TaskEvents.initialize();
      await TaskEvents.close();

      expect(mockQueueEvents.close).toHaveBeenCalledTimes(1);
    });

    /**
     * @test Debe manejar errores al cerrar
     */
    it('debe manejar errores al cerrar', async () => {
      const closeError = new Error('Close failed');
      mockQueueEvents.close.mockRejectedValue(closeError);

      await TaskEvents.initialize();

      await expect(TaskEvents.close()).rejects.toThrow('Close failed');
    });

    /**
     * @test Debe permitir llamar close después de inicializar
     */
    it('debe permitir llamar close sin problemas después de inicializar', async () => {
      await TaskEvents.initialize();
      await TaskEvents.close();

      expect(mockQueueEvents.close).toHaveBeenCalledTimes(1);
    });
  });

  /**
   * Pruebas de integración con Redis
   * Verifica uso correcto del cliente Redis y publicación de eventos
   */
  describe('Integración Redis', () => {
    beforeEach(async () => {
      await TaskEvents.initialize();
    });

    /**
     * @test Debe usar cliente Redis del servicio RedisCache
     */
    it('debe usar cliente Redis del servicio RedisCache', async () => {
      const activeHandler = mockQueueEvents.on.mock.calls.find(
        call => call[0] === 'active'
      )?.[1];

      await activeHandler({ jobId: 'test-job-123' });

      expect(RedisCache.getClient).toHaveBeenCalled();
    });

    /**
     * @test Debe publicar en canal task-events
     */
    it('debe publicar en canal task-events', async () => {
      const activeHandler = mockQueueEvents.on.mock.calls.find(
        call => call[0] === 'active'
      )?.[1];

      await activeHandler({ jobId: 'test-job-123' });

      expect(mockRedisClient.publish).toHaveBeenCalledWith(
        'task-events',
        expect.any(String)
      );
    });

    /**
     * @test Debe serializar eventos como JSON válido
     */
    it('debe serializar eventos como JSON válido', async () => {
      const completedHandler = mockQueueEvents.on.mock.calls.find(
        call => call[0] === 'completed'
      )?.[1];

      await completedHandler({
        jobId: 'test-job-123',
        returnvalue: '{"test": true}',
      });

      const publishCall = mockRedisClient.publish.mock.calls[0];
      expect(() => JSON.parse(publishCall[1])).not.toThrow();
    });
  });

  /**
   * Pruebas de configuración BullMQ
   * Verifica uso correcto de configuración Redis y nombres de cola
   */
  describe('Configuración BullMQ', () => {
    /**
     * @test Debe usar configuración Redis correcta
     */
    it('debe usar configuración Redis correcta', async () => {
      await TaskEvents.initialize();

      expect(RedisConnection.getConfig).toHaveBeenCalled();
      expect(QueueEvents).toHaveBeenCalledWith('image-processing', {
        connection: mockRedisConfig,
      });
    });

    /**
     * @test Debe usar nombre de cola desde variables de entorno
     */
    it('debe usar nombre de cola desde variables de entorno', async () => {
      await TaskEvents.initialize();

      const queueEventsCall = (QueueEvents as unknown as jest.Mock).mock.calls[0];
      expect(queueEventsCall[0]).toBe('image-processing');
    });
  });
});