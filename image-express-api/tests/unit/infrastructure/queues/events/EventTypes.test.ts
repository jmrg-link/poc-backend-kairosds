/**
 * Tests unitarios para EventTypes
 * @file EventTypes.test.ts
 */

import {
  TaskEventType,
  BaseTaskEvent,
  TaskCreatedEvent,
  TaskProcessingEvent,
  TaskCompletedEvent,
  TaskFailedEvent,
  TaskEvent,
} from '../../../../../src/infrastructure/queues/events/EventTypes';

describe('EventTypes', () => {
  describe('TaskEventType enum', () => {
    /**
     * Verifica que el enum TaskEventType contenga todos los valores esperados
     */
    it('should contain all expected event types', () => {
      expect(TaskEventType.TASK_CREATED).toBe('task.created');
      expect(TaskEventType.TASK_PROCESSING).toBe('task.processing');
      expect(TaskEventType.TASK_COMPLETED).toBe('task.completed');
      expect(TaskEventType.TASK_FAILED).toBe('task.failed');
      expect(TaskEventType.TASK_RETRY).toBe('task.retry');
    });

    /**
     * Verifica que el enum tenga exactamente 5 valores
     */
    it('should have exactly 5 event types', () => {
      const eventTypes = Object.values(TaskEventType);
      expect(eventTypes).toHaveLength(5);
    });

    /**
     * Verifica que todos los valores del enum sean strings con formato correcto
     */
    it('should have all values in correct format', () => {
      Object.values(TaskEventType).forEach(eventType => {
        expect(typeof eventType).toBe('string');
        expect(eventType).toMatch(/^task\./);
      });
    });

    /**
     * Verifica que se puedan usar los valores del enum como keys
     */
    it('should be usable as object keys', () => {
      const eventMap = {
        [TaskEventType.TASK_CREATED]: 'Tarea creada',
        [TaskEventType.TASK_PROCESSING]: 'Procesando',
        [TaskEventType.TASK_COMPLETED]: 'Completada',
        [TaskEventType.TASK_FAILED]: 'Fallida',
        [TaskEventType.TASK_RETRY]: 'Reintentando',
      };

      expect(eventMap[TaskEventType.TASK_CREATED]).toBe('Tarea creada');
      expect(eventMap[TaskEventType.TASK_PROCESSING]).toBe('Procesando');
      expect(eventMap[TaskEventType.TASK_COMPLETED]).toBe('Completada');
      expect(eventMap[TaskEventType.TASK_FAILED]).toBe('Fallida');
      expect(eventMap[TaskEventType.TASK_RETRY]).toBe('Reintentando');
    });
  });

  describe('BaseTaskEvent interface', () => {
    /**
     * Verifica que se pueda crear un objeto BaseTaskEvent válido
     */
    it('should accept valid BaseTaskEvent object', () => {
      const baseEvent: BaseTaskEvent = {
        taskId: '507f1f77bcf86cd799439011',
        timestamp: Date.now(),
        eventType: TaskEventType.TASK_CREATED,
      };

      expect(baseEvent.taskId).toBe('507f1f77bcf86cd799439011');
      expect(typeof baseEvent.timestamp).toBe('number');
      expect(baseEvent.eventType).toBe(TaskEventType.TASK_CREATED);
    });

    /**
     * Verifica que taskId sea string
     */
    it('should have taskId as string', () => {
      const baseEvent: BaseTaskEvent = {
        taskId: 'test-task-id',
        timestamp: 1693392000000,
        eventType: TaskEventType.TASK_PROCESSING,
      };

      expect(typeof baseEvent.taskId).toBe('string');
    });

    /**
     * Verifica que timestamp sea number
     */
    it('should have timestamp as number', () => {
      const baseEvent: BaseTaskEvent = {
        taskId: '507f1f77bcf86cd799439011',
        timestamp: Date.now(),
        eventType: TaskEventType.TASK_COMPLETED,
      };

      expect(typeof baseEvent.timestamp).toBe('number');
    });

    /**
     * Verifica que eventType sea válido del enum
     */
    it('should have valid eventType from enum', () => {
      const baseEvent: BaseTaskEvent = {
        taskId: '507f1f77bcf86cd799439011',
        timestamp: Date.now(),
        eventType: TaskEventType.TASK_FAILED,
      };

      expect(Object.values(TaskEventType)).toContain(baseEvent.eventType);
    });
  });

  describe('TaskCreatedEvent interface', () => {
    /**
     * Verifica que se pueda crear un TaskCreatedEvent válido con propiedades requeridas
     */
    it('should create valid TaskCreatedEvent with required properties', () => {
      const createdEvent: TaskCreatedEvent = {
        taskId: '507f1f77bcf86cd799439011',
        timestamp: Date.now(),
        eventType: TaskEventType.TASK_CREATED,
        imagePath: '/storage/images/test.jpg',
        price: 15.99,
      };

      expect(createdEvent.taskId).toBe('507f1f77bcf86cd799439011');
      expect(typeof createdEvent.timestamp).toBe('number');
      expect(createdEvent.eventType).toBe(TaskEventType.TASK_CREATED);
      expect(createdEvent.imagePath).toBe('/storage/images/test.jpg');
      expect(createdEvent.price).toBe(15.99);
    });

    /**
     * Verifica que se pueda crear TaskCreatedEvent con idempotencyKey opcional
     */
    it('should create TaskCreatedEvent with optional idempotencyKey', () => {
      const createdEvent: TaskCreatedEvent = {
        taskId: '507f1f77bcf86cd799439011',
        timestamp: Date.now(),
        eventType: TaskEventType.TASK_CREATED,
        imagePath: '/storage/images/test.jpg',
        price: 25.50,
        idempotencyKey: 'unique-key-123',
      };

      expect(createdEvent.idempotencyKey).toBe('unique-key-123');
    });

    /**
     * Verifica que el eventType sea específicamente TASK_CREATED
     */
    it('should have eventType as TASK_CREATED', () => {
      const createdEvent: TaskCreatedEvent = {
        taskId: '507f1f77bcf86cd799439011',
        timestamp: Date.now(),
        eventType: TaskEventType.TASK_CREATED,
        imagePath: '/storage/images/test.jpg',
        price: 10.00,
      };

      expect(createdEvent.eventType).toBe(TaskEventType.TASK_CREATED);
    });

    /**
     * Verifica tipos de propiedades específicas
     */
    it('should have correct property types', () => {
      const createdEvent: TaskCreatedEvent = {
        taskId: '507f1f77bcf86cd799439011',
        timestamp: Date.now(),
        eventType: TaskEventType.TASK_CREATED,
        imagePath: '/storage/images/test.jpg',
        price: 20.99,
        idempotencyKey: 'key-456',
      };

      expect(typeof createdEvent.imagePath).toBe('string');
      expect(typeof createdEvent.price).toBe('number');
      expect(typeof createdEvent.idempotencyKey).toBe('string');
    });
  });

  describe('TaskProcessingEvent interface', () => {
    /**
     * Verifica que se pueda crear un TaskProcessingEvent válido
     */
    it('should create valid TaskProcessingEvent', () => {
      const processingEvent: TaskProcessingEvent = {
        taskId: '507f1f77bcf86cd799439011',
        timestamp: Date.now(),
        eventType: TaskEventType.TASK_PROCESSING,
        workerId: 'worker-123',
      };

      expect(processingEvent.taskId).toBe('507f1f77bcf86cd799439011');
      expect(typeof processingEvent.timestamp).toBe('number');
      expect(processingEvent.eventType).toBe(TaskEventType.TASK_PROCESSING);
      expect(processingEvent.workerId).toBe('worker-123');
    });

    /**
     * Verifica que el eventType sea específicamente TASK_PROCESSING
     */
    it('should have eventType as TASK_PROCESSING', () => {
      const processingEvent: TaskProcessingEvent = {
        taskId: '507f1f77bcf86cd799439011',
        timestamp: Date.now(),
        eventType: TaskEventType.TASK_PROCESSING,
        workerId: 'api-worker',
      };

      expect(processingEvent.eventType).toBe(TaskEventType.TASK_PROCESSING);
    });

    /**
     * Verifica que workerId sea string
     */
    it('should have workerId as string', () => {
      const processingEvent: TaskProcessingEvent = {
        taskId: '507f1f77bcf86cd799439011',
        timestamp: Date.now(),
        eventType: TaskEventType.TASK_PROCESSING,
        workerId: 'background-worker-001',
      };

      expect(typeof processingEvent.workerId).toBe('string');
    });
  });

  describe('TaskCompletedEvent interface', () => {
    /**
     * Verifica que se pueda crear un TaskCompletedEvent válido
     */
    it('should create valid TaskCompletedEvent', () => {
      const completedEvent: TaskCompletedEvent = {
        taskId: '507f1f77bcf86cd799439011',
        timestamp: Date.now(),
        eventType: TaskEventType.TASK_COMPLETED,
        images: [
          {
            resolution: '1024',
            path: '/storage/images/507f1f77bcf86cd799439011/image_1024.webp',
            md5: 'abc123def456',
            size: 150000,
          },
          {
            resolution: '800',
            path: '/storage/images/507f1f77bcf86cd799439011/image_800.webp',
            md5: 'def456ghi789',
            size: 100000,
          },
        ],
        processingTime: 2500,
      };

      expect(completedEvent.taskId).toBe('507f1f77bcf86cd799439011');
      expect(typeof completedEvent.timestamp).toBe('number');
      expect(completedEvent.eventType).toBe(TaskEventType.TASK_COMPLETED);
      expect(completedEvent.images).toHaveLength(2);
      expect(completedEvent.processingTime).toBe(2500);
    });

    /**
     * Verifica que el eventType sea específicamente TASK_COMPLETED
     */
    it('should have eventType as TASK_COMPLETED', () => {
      const completedEvent: TaskCompletedEvent = {
        taskId: '507f1f77bcf86cd799439011',
        timestamp: Date.now(),
        eventType: TaskEventType.TASK_COMPLETED,
        images: [],
        processingTime: 1000,
      };

      expect(completedEvent.eventType).toBe(TaskEventType.TASK_COMPLETED);
    });

    /**
     * Verifica estructura de arrays de imágenes
     */
    it('should have correct image structure', () => {
      const completedEvent: TaskCompletedEvent = {
        taskId: '507f1f77bcf86cd799439011',
        timestamp: Date.now(),
        eventType: TaskEventType.TASK_COMPLETED,
        images: [
          {
            resolution: '1024',
            path: '/storage/images/test/image_1024.webp',
            md5: 'hash123',
            size: 200000,
          },
        ],
        processingTime: 3000,
      };

      const image = completedEvent.images[0];
      expect(image.resolution).toBe('1024');
      expect(typeof image.path).toBe('string');
      expect(typeof image.md5).toBe('string');
      expect(typeof image.size).toBe('number');
    });

    /**
     * Verifica que resolution solo acepte valores válidos
     */
    it('should accept only valid resolution values', () => {
      const completedEvent: TaskCompletedEvent = {
        taskId: '507f1f77bcf86cd799439011',
        timestamp: Date.now(),
        eventType: TaskEventType.TASK_COMPLETED,
        images: [
          {
            resolution: '1024',
            path: '/storage/images/test/image_1024.webp',
            md5: 'hash123',
            size: 200000,
          },
          {
            resolution: '800',
            path: '/storage/images/test/image_800.webp',
            md5: 'hash456',
            size: 150000,
          },
        ],
        processingTime: 2000,
      };

      completedEvent.images.forEach(image => {
        expect(['1024', '800']).toContain(image.resolution);
      });
    });

    /**
     * Verifica que processingTime sea number
     */
    it('should have processingTime as number', () => {
      const completedEvent: TaskCompletedEvent = {
        taskId: '507f1f77bcf86cd799439011',
        timestamp: Date.now(),
        eventType: TaskEventType.TASK_COMPLETED,
        images: [],
        processingTime: 5000,
      };

      expect(typeof completedEvent.processingTime).toBe('number');
    });
  });

  describe('TaskFailedEvent interface', () => {
    /**
     * Verifica que se pueda crear un TaskFailedEvent válido
     */
    it('should create valid TaskFailedEvent', () => {
      const failedEvent: TaskFailedEvent = {
        taskId: '507f1f77bcf86cd799439011',
        timestamp: Date.now(),
        eventType: TaskEventType.TASK_FAILED,
        error: 'Image processing failed: Invalid file format',
        attempts: 3,
        willRetry: false,
      };

      expect(failedEvent.taskId).toBe('507f1f77bcf86cd799439011');
      expect(typeof failedEvent.timestamp).toBe('number');
      expect(failedEvent.eventType).toBe(TaskEventType.TASK_FAILED);
      expect(failedEvent.error).toBe('Image processing failed: Invalid file format');
      expect(failedEvent.attempts).toBe(3);
      expect(failedEvent.willRetry).toBe(false);
    });

    /**
     * Verifica que el eventType sea específicamente TASK_FAILED
     */
    it('should have eventType as TASK_FAILED', () => {
      const failedEvent: TaskFailedEvent = {
        taskId: '507f1f77bcf86cd799439011',
        timestamp: Date.now(),
        eventType: TaskEventType.TASK_FAILED,
        error: 'Unknown error',
        attempts: 1,
        willRetry: true,
      };

      expect(failedEvent.eventType).toBe(TaskEventType.TASK_FAILED);
    });

    /**
     * Verifica tipos de propiedades específicas
     */
    it('should have correct property types', () => {
      const failedEvent: TaskFailedEvent = {
        taskId: '507f1f77bcf86cd799439011',
        timestamp: Date.now(),
        eventType: TaskEventType.TASK_FAILED,
        error: 'File not found',
        attempts: 2,
        willRetry: true,
      };

      expect(typeof failedEvent.error).toBe('string');
      expect(typeof failedEvent.attempts).toBe('number');
      expect(typeof failedEvent.willRetry).toBe('boolean');
    });

    /**
     * Verifica que willRetry sea boolean
     */
    it('should have willRetry as boolean', () => {
      const failedEventRetry: TaskFailedEvent = {
        taskId: '507f1f77bcf86cd799439011',
        timestamp: Date.now(),
        eventType: TaskEventType.TASK_FAILED,
        error: 'Temporary failure',
        attempts: 1,
        willRetry: true,
      };

      const failedEventNoRetry: TaskFailedEvent = {
        taskId: '507f1f77bcf86cd799439012',
        timestamp: Date.now(),
        eventType: TaskEventType.TASK_FAILED,
        error: 'Permanent failure',
        attempts: 5,
        willRetry: false,
      };

      expect(typeof failedEventRetry.willRetry).toBe('boolean');
      expect(typeof failedEventNoRetry.willRetry).toBe('boolean');
      expect(failedEventRetry.willRetry).toBe(true);
      expect(failedEventNoRetry.willRetry).toBe(false);
    });
  });

  describe('TaskEvent union type', () => {
    /**
     * Verifica que TaskEvent acepte todos los tipos de eventos
     */
    it('should accept all event types', () => {
      const createdEvent: TaskEvent = {
        taskId: '507f1f77bcf86cd799439011',
        timestamp: Date.now(),
        eventType: TaskEventType.TASK_CREATED,
        imagePath: '/storage/test.jpg',
        price: 15.99,
      };

      const processingEvent: TaskEvent = {
        taskId: '507f1f77bcf86cd799439011',
        timestamp: Date.now(),
        eventType: TaskEventType.TASK_PROCESSING,
        workerId: 'worker-001',
      };

      const completedEvent: TaskEvent = {
        taskId: '507f1f77bcf86cd799439011',
        timestamp: Date.now(),
        eventType: TaskEventType.TASK_COMPLETED,
        images: [],
        processingTime: 2000,
      };

      const failedEvent: TaskEvent = {
        taskId: '507f1f77bcf86cd799439011',
        timestamp: Date.now(),
        eventType: TaskEventType.TASK_FAILED,
        error: 'Test error',
        attempts: 1,
        willRetry: false,
      };

      expect(createdEvent.eventType).toBe(TaskEventType.TASK_CREATED);
      expect(processingEvent.eventType).toBe(TaskEventType.TASK_PROCESSING);
      expect(completedEvent.eventType).toBe(TaskEventType.TASK_COMPLETED);
      expect(failedEvent.eventType).toBe(TaskEventType.TASK_FAILED);
    });

    /**
     * Verifica discriminación de tipos usando eventType
     */
    it('should discriminate types using eventType', () => {
      const events: TaskEvent[] = [
        {
          taskId: '507f1f77bcf86cd799439011',
          timestamp: Date.now(),
          eventType: TaskEventType.TASK_CREATED,
          imagePath: '/storage/test.jpg',
          price: 15.99,
        },
        {
          taskId: '507f1f77bcf86cd799439011',
          timestamp: Date.now(),
          eventType: TaskEventType.TASK_PROCESSING,
          workerId: 'worker-001',
        },
      ];

      events.forEach(event => {
        switch (event.eventType) {
          case TaskEventType.TASK_CREATED:
            expect('imagePath' in event).toBe(true);
            expect('price' in event).toBe(true);
            break;
          case TaskEventType.TASK_PROCESSING:
            expect('workerId' in event).toBe(true);
            break;
          default:
            break;
        }
      });
    });

    /**
     * Verifica que todos los eventos compartan propiedades base
     */
    it('should have base properties in all event types', () => {
      const events: TaskEvent[] = [
        {
          taskId: '507f1f77bcf86cd799439011',
          timestamp: Date.now(),
          eventType: TaskEventType.TASK_CREATED,
          imagePath: '/storage/test.jpg',
          price: 15.99,
        },
        {
          taskId: '507f1f77bcf86cd799439011',
          timestamp: Date.now(),
          eventType: TaskEventType.TASK_COMPLETED,
          images: [],
          processingTime: 1500,
        },
        {
          taskId: '507f1f77bcf86cd799439011',
          timestamp: Date.now(),
          eventType: TaskEventType.TASK_FAILED,
          error: 'Test error',
          attempts: 1,
          willRetry: false,
        },
      ];

      events.forEach(event => {
        expect(typeof event.taskId).toBe('string');
        expect(typeof event.timestamp).toBe('number');
        expect(Object.values(TaskEventType)).toContain(event.eventType);
      });
    });
  });
});