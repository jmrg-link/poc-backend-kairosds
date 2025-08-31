import { describe, it, expect } from '@jest/globals';
import { UpdateTaskStatusCommand } from '../../../../src/application/commands/UpdateTaskStatusCommand';
import { TaskStatus } from '../../../../src/domain/entities/TaskEntity';

/**
 * @description Suite de pruebas para UpdateTaskStatusCommand
 *
 * @description Valida el comportamiento del comando de actualización de estado:
 * - Construcción correcta con parámetros requeridos y opcionales
 * - Manejo de diferentes estados de tarea
 * - Gestión de datos adicionales opcionales según estructura real
 * - Validación de tipos y propiedades
 */
describe('UpdateTaskStatusCommand', () => {
  /**
   * @description Suite de pruebas para construcción del comando
   */
  describe('Construcción', () => {
    /**
     * @test Debe crear comando con parámetros requeridos
     * @given TaskId y status mínimos requeridos
     * @when Se crea el comando
     * @then Debe asignar propiedades correctamente
     */
    it('debe crear comando con parámetros requeridos', () => {
      const taskId = 'task-123';
      const status = TaskStatus.PROCESSING;

      const command = new UpdateTaskStatusCommand(taskId, status);

      expect(command.taskId).toBe(taskId);
      expect(command.status).toBe(status);
      expect(command.data).toBeUndefined();
    });

    /**
     * @test Debe crear comando con datos de imágenes procesadas
     * @given Parámetros completos con estructura real de imagen
     * @when Se crea el comando
     * @then Debe asignar todas las propiedades
     */
    it('debe crear comando con datos de imágenes procesadas', () => {
      const taskId = 'task-456';
      const status = TaskStatus.COMPLETED;
      const data = {
        images: [
          { resolution: '1024', path: '/output/image_1024px.jpg' },
          { resolution: '800', path: '/output/image_800px.jpg' },
        ],
      };

      const command = new UpdateTaskStatusCommand(taskId, status, data);

      expect(command.taskId).toBe(taskId);
      expect(command.status).toBe(status);
      expect(command.data).toEqual(data);
    });

    /**
     * @test Debe manejar diferentes tipos de taskId
     * @given Diferentes formatos de ID de tarea
     * @when Se crean comandos
     * @then Debe aceptar todos los formatos válidos
     */
    it('debe manejar diferentes tipos de taskId', () => {
      const testCases = [
        'simple-id',
        'UUID-12345678-1234-1234-1234-123456789abc',
        'numeric-123456789',
        'mixed_123-abc_456',
        'very-long-task-id-with-many-characters',
        'task@special#chars$123',
      ];

      testCases.forEach(taskId => {
        const command = new UpdateTaskStatusCommand(taskId, TaskStatus.PENDING);
        expect(command.taskId).toBe(taskId);
      });
    });

    /**
     * @test Debe manejar todos los estados de tarea
     * @given Todos los valores de TaskStatus
     * @when Se crean comandos
     * @then Debe aceptar todos los estados
     */
    it('debe manejar todos los estados de tarea', () => {
      const taskId = 'test-task';
      const statuses = [
        TaskStatus.PENDING,
        TaskStatus.PROCESSING,
        TaskStatus.COMPLETED,
        TaskStatus.FAILED,
      ];

      statuses.forEach(status => {
        const command = new UpdateTaskStatusCommand(taskId, status);
        expect(command.status).toBe(status);
      });
    });
  });

  /**
   * @description Suite de pruebas para datos adicionales reales
   */
  describe('Datos adicionales según estructura real', () => {
    /**
     * @test Debe manejar datos de imágenes procesadas con Sharp
     * @given Un comando con estructura real de Sharp processor
     * @when Se crea el comando
     * @then Debe almacenar correctamente los datos de imágenes
     */
    it('debe manejar datos de imágenes procesadas con Sharp', () => {
      const taskId = 'task-sharp-images';
      const status = TaskStatus.COMPLETED;
      const imageData = {
        images: [
          { resolution: '1024', path: '/storage/images/task-id/image_1024px.jpg' },
          { resolution: '800', path: '/storage/images/task-id/image_800px.jpg' },
        ],
      };

      const command = new UpdateTaskStatusCommand(taskId, status, imageData);

      expect(command.data).toEqual(imageData);
      expect(command.data).toHaveProperty('images');
      if (command.data && 'images' in command.data && Array.isArray(command.data.images)) {
        expect(command.data.images).toHaveLength(2);
        expect(command.data.images[0]).toHaveProperty('resolution', '1024');
        expect(command.data.images[0]).toHaveProperty('path');
      }
    });

    /**
     * @test Debe manejar datos de error para estado failed
     * @given Un comando con datos de error estructurados
     * @when Se crea el comando con status FAILED
     * @then Debe almacenar correctamente los datos de error
     */
    it('debe manejar datos de error para estado failed', () => {
      const taskId = 'task-error';
      const status = TaskStatus.FAILED;
      const errorData = {
        error: 'Processing failed: Invalid image format',
        errorCode: 'INVALID_FORMAT',
        timestamp: new Date().toISOString(),
      };

      const command = new UpdateTaskStatusCommand(taskId, status, errorData);

      expect(command.data).toEqual(errorData);
      expect(command.data).toHaveProperty('error');
      expect(command.data).toHaveProperty('errorCode');
    });

    /**
     * @test Debe manejar datos de progreso para estado processing
     * @given Un comando con datos de progreso realistas
     * @when Se crea el comando con status PROCESSING
     * @then Debe almacenar correctamente los datos de progreso
     */
    it('debe manejar datos de progreso para estado processing', () => {
      const taskId = 'task-progress';
      const status = TaskStatus.PROCESSING;
      const progressData = {
        currentStep: 'resizing',
        completedResolutions: ['1024'],
        totalResolutions: 2,
      };

      const command = new UpdateTaskStatusCommand(taskId, status, progressData);

      expect(command.data).toEqual(progressData);
      expect(command.data).toHaveProperty('currentStep');
      expect(command.data).toHaveProperty('completedResolutions');
    });

    /**
     * @test Debe manejar datos nulos o vacíos
     * @given Diferentes tipos de datos vacíos
     * @when Se crean comandos
     * @then Debe aceptar todos los valores
     */
    it('debe manejar datos nulos o vacíos', () => {
      const taskId = 'task-empty';
      const status = TaskStatus.PENDING;

      const testCases = [
        null,
        {},
        { images: [] },
        { error: null },
      ];

      testCases.forEach(data => {
        const command = new UpdateTaskStatusCommand(taskId, status, data as any);
        expect(command.data).toEqual(data);
      });
    });

    /**
     * @test Debe manejar estructura completa de imagen procesada
     * @given Datos con estructura completa de ImageEntity
     * @when Se crea el comando
     * @then Debe preservar la estructura completa
     */
    it('debe manejar estructura completa de imagen procesada', () => {
      const taskId = 'task-complete-image';
      const status = TaskStatus.COMPLETED;
      const completeImageData = {
        images: [
          {
            resolution: '1024',
            path: '/storage/images/task-complete-image/image_1024px.jpg',
            md5: 'abc123def456',
            size: 204800,
            format: 'JPEG',
          },
          {
            resolution: '800',
            path: '/storage/images/task-complete-image/image_800px.jpg',
            md5: 'def456ghi789',
            size: 102400,
            format: 'JPEG',
          },
        ],
        totalProcessingTime: 1500,
      };

      const command = new UpdateTaskStatusCommand(taskId, status, completeImageData);

      expect(command.data).toEqual(completeImageData);
      expect(command.data).toHaveProperty('images');
      expect(command.data).toHaveProperty('totalProcessingTime');
    });
  });

  /**
   * @description Suite de pruebas para casos edge
   */
  describe('Casos edge', () => {
    /**
     * @test Debe manejar string vacío como taskId
     * @given Un taskId string vacío
     * @when Se crea el comando
     * @then Debe aceptar el valor
     */
    it('debe manejar string vacío como taskId', () => {
      const command = new UpdateTaskStatusCommand('', TaskStatus.PENDING);

      expect(command.taskId).toBe('');
      expect(command.status).toBe(TaskStatus.PENDING);
    });

    /**
     * @test Debe manejar taskIds muy largos
     * @given Un taskId extremadamente largo
     * @when Se crea el comando
     * @then Debe aceptar el ID completo
     */
    it('debe manejar taskIds muy largos', () => {
      const longTaskId = 'task-' + 'a'.repeat(1000) + '-very-long-id';
      
      const command = new UpdateTaskStatusCommand(longTaskId, TaskStatus.PROCESSING);

      expect(command.taskId).toBe(longTaskId);
      expect(command.taskId.length).toBeGreaterThan(1000);
    });

    /**
     * @test Debe preservar referencia de datos
     * @given Un comando con datos de referencia
     * @when Se modifica el objeto original
     * @then El comando mantiene la referencia (comportamiento esperado)
     */
    it('debe preservar referencia de datos', () => {
      const taskId = 'task-reference';
      const status = TaskStatus.COMPLETED;
      const originalData = {
        images: [{ resolution: '1024', path: '/test.jpg' }],
        count: 1,
      };

      const command = new UpdateTaskStatusCommand(taskId, status, originalData);

      // Modificar el objeto original
      originalData.count = 999;
      originalData.images.push({ resolution: '800', path: '/test2.jpg' });

      // El comando mantiene la referencia (comportamiento esperado)
      expect(command.data).toBe(originalData);
      if (command.data && 'count' in command.data) {
        expect(command.data.count).toBe(999);
      }
    });

    /**
     * @test Debe manejar datos con propiedades undefined
     * @given Datos con propiedades undefined
     * @when Se crea el comando
     * @then Debe preservar las propiedades undefined
     */
    it('debe manejar datos con propiedades undefined', () => {
      const taskId = 'task-undefined';
      const status = TaskStatus.FAILED;
      const dataWithUndefined = {
        error: 'Some error',
        details: undefined,
        code: 500,
        metadata: undefined,
      };

      const command = new UpdateTaskStatusCommand(taskId, status, dataWithUndefined);

      expect(command.data).toEqual(dataWithUndefined);
      expect(command.data).toHaveProperty('error');
      expect(command.data).toHaveProperty('code');
    });

    /**
     * @test Debe manejar transiciones de estado comunes
     * @given Diferentes combinaciones de estado y datos realistas
     * @when Se crean comandos para transiciones típicas
     * @then Debe aceptar todas las combinaciones válidas
     */
    it('debe manejar transiciones de estado comunes', () => {
      const taskId = 'task-transitions';

      const transitions = [
        { status: TaskStatus.PENDING, data: undefined },
        { 
          status: TaskStatus.PROCESSING, 
          data: { currentStep: 'downloading' } 
        },
        { 
          status: TaskStatus.PROCESSING, 
          data: { currentStep: 'resizing', completedResolutions: ['1024'] } 
        },
        { 
          status: TaskStatus.COMPLETED, 
          data: { 
            images: [
              { resolution: '1024', path: '/output/1024.jpg' },
              { resolution: '800', path: '/output/800.jpg' }
            ] 
          } 
        },
        { 
          status: TaskStatus.FAILED, 
          data: { error: 'Processing failed', errorCode: 'SHARP_ERROR' } 
        },
        { 
          status: TaskStatus.PENDING, 
          data: { retry: true, attempt: 2 } 
        },
      ];

      transitions.forEach(({ status, data }) => {
        const command = new UpdateTaskStatusCommand(taskId, status, data);
        expect(command.status).toBe(status);
        expect(command.data).toEqual(data);
      });
    });

    /**
     * @test Debe manejar resoluciones válidas según esquema
     * @given Datos con resoluciones del esquema real
     * @when Se crea el comando
     * @then Debe aceptar resoluciones ['original', '1024', '800']
     */
    it('debe manejar resoluciones válidas según esquema', () => {
      const taskId = 'task-valid-resolutions';
      const status = TaskStatus.COMPLETED;
      const validResolutions = ['original', '1024', '800'];

      validResolutions.forEach(resolution => {
        const data = {
          images: [{ resolution, path: `/output/image_${resolution}.jpg` }],
        };
        
        const command = new UpdateTaskStatusCommand(taskId, status, data);
        
        expect(command.data).toEqual(data);
        if (command.data && 'images' in command.data && Array.isArray(command.data.images)) {
          expect(command.data.images[0]).toHaveProperty('resolution', resolution);
        }
      });
    });
  });
});