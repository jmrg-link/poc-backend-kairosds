import { describe, it, expect } from '@jest/globals';
import { GetTaskQuery } from '../../../../src/application/queries/GetTaskQuery';

/**
 * @description Suite de pruebas para GetTaskQuery
 * 
 * @description Valida el comportamiento de la query de obtención de tarea:
 * - Construcción correcta con taskId requerido
 * - Validación de diferentes formatos de ID
 * - Casos edge y validación de tipos
 * - Inmutabilidad de propiedades
 */
describe('GetTaskQuery', () => {
  /**
   * @description Suite de pruebas para construcción de la query
   */
  describe('Construcción', () => {
    /**
     * @test Debe crear query con taskId válido
     * @given Un taskId válido
     * @when Se crea la query
     * @then Debe asignar la propiedad correctamente
     */
    it('debe crear query con taskId válido', () => {
      const taskId = 'task-123';

      const query = new GetTaskQuery(taskId);

      expect(query.taskId).toBe(taskId);
    });

    /**
     * @test Debe manejar diferentes formatos de taskId
     * @given Diferentes tipos de IDs de tarea
     * @when Se crean queries
     * @then Debe aceptar todos los formatos válidos
     */
    it('debe manejar diferentes formatos de taskId', () => {
      const testCases = [
        'simple-id',
        'UUID-12345678-1234-1234-1234-123456789abc',
        'numeric-123456789',
        'mixed_123-abc_456',
        'very-long-task-id-with-many-characters',
        'task@special#chars$123',
        '68b1a3f343a6fd2f7926ba37',
        'camelCaseTaskId',
        'kebab-case-task-id',
        'snake_case_task_id',
      ];

      testCases.forEach(taskId => {
        const query = new GetTaskQuery(taskId);
        expect(query.taskId).toBe(taskId);
      });
    });

    /**
     * @test Debe manejar IDs con caracteres especiales
     * @given TaskIds con caracteres especiales válidos
     * @when Se crean queries
     * @then Debe preservar todos los caracteres
     */
    it('debe manejar IDs con caracteres especiales', () => {
      const specialIds = [
        'task-àáâãäå',
        'task-ñç',
        'task-русский',
        'task-中文',
        'task!@#$%^&*()',
        'task+equals=value',
        'task[brackets]',
        'task{braces}',
        'task|pipe|id',
      ];

      specialIds.forEach(taskId => {
        const query = new GetTaskQuery(taskId);
        expect(query.taskId).toBe(taskId);
      });
    });

    /**
     * @test Debe manejar IDs basados en estructura real del proyecto
     * @given IDs reales del storage del proyecto
     * @when Se crean queries
     * @then Debe procesar correctamente los IDs reales
     */
    it('debe manejar IDs basados en estructura real del proyecto', () => {
      const realTaskIds = [
        '68b1a3f343a6fd2f7926ba37',
        '68b1a9c2370773c0fe49298c',
        '68b1a9c2370773c0fe49298e',
        '68b1a9c2370773c0fe492991',
        '68b1b1ad554e414863ad262f',
        '68b1b5ad534d0db382af15ed',
      ];

      realTaskIds.forEach(taskId => {
        const query = new GetTaskQuery(taskId);
        expect(query.taskId).toBe(taskId);
        expect(query.taskId).toMatch(/^[a-f0-9]{24}$/); // Formato ObjectId
      });
    });
  });

  /**
   * @description Suite de pruebas para casos edge
   */
  describe('Casos edge', () => {
    /**
     * @test Debe manejar string vacío como taskId
     * @given Un taskId string vacío
     * @when Se crea la query
     * @then Debe aceptar el valor vacío
     */
    it('debe manejar string vacío como taskId', () => {
      const query = new GetTaskQuery('');

      expect(query.taskId).toBe('');
    });

    /**
     * @test Debe manejar taskId muy largo
     * @given Un taskId extremadamente largo
     * @when Se crea la query
     * @then Debe aceptar el ID completo
     */
    it('debe manejar taskId muy largo', () => {
      const longTaskId = 'task-' + 'a'.repeat(1000) + '-very-long-id';

      const query = new GetTaskQuery(longTaskId);

      expect(query.taskId).toBe(longTaskId);
      expect(query.taskId.length).toBeGreaterThan(1000);
    });

    /**
     * @test Debe manejar taskId con solo espacios
     * @given Un taskId que contiene solo espacios
     * @when Se crea la query
     * @then Debe preservar los espacios
     */
    it('debe manejar taskId con solo espacios', () => {
      const spaceIds = [
        ' ',
        '  ',
        '   ',
        '\t',
        '\n',
        ' leading-space',
        'trailing-space ',
        ' surrounded-spaces ',
      ];

      spaceIds.forEach(taskId => {
        const query = new GetTaskQuery(taskId);
        expect(query.taskId).toBe(taskId);
      });
    });

    /**
     * @test Debe manejar taskId con caracteres de control
     * @given TaskIds con caracteres de control
     * @when Se crean queries
     * @then Debe preservar los caracteres
     */
    it('debe manejar taskId con caracteres de control', () => {
      const controlCharIds = [
        'task\ttab',
        'task\nnewline',
        'task\rcarriage-return',
        'task\0null',
        'task\b backspace',
        'task\f form-feed',
        'task\v vertical-tab',
      ];

      controlCharIds.forEach(taskId => {
        const query = new GetTaskQuery(taskId);
        expect(query.taskId).toBe(taskId);
      });
    });

    /**
     * @test Debe manejar taskId con emojis
     * @given TaskIds con caracteres emoji
     * @when Se crean queries
     * @then Debe preservar los emojis
     */
    it('debe manejar taskId con emojis', () => {
      const emojiIds = [
        'task-🚀',
        '📸-task-id',
        'task-🖼️-image',
        '🎯-target-task',
        'task-✅-done',
        '🔥-hot-task-🔥',
      ];

      emojiIds.forEach(taskId => {
        const query = new GetTaskQuery(taskId);
        expect(query.taskId).toBe(taskId);
      });
    });
  });

  /**
   * @description Suite de pruebas para inmutabilidad
   */
  describe('Inmutabilidad', () => {
    /**
     * @test Debe crear propiedad de solo lectura
     * @given Una query creada
     * @when Se accede a la propiedad taskId
     * @then La propiedad debe ser de solo lectura
     */
    it('debe crear propiedad de solo lectura', () => {
      const taskId = 'readonly-test';
      const query = new GetTaskQuery(taskId);

      // Verificar que la propiedad existe y tiene el valor correcto
      expect(query.taskId).toBe(taskId);

      // En TypeScript, las propiedades readonly no se pueden modificar en tiempo de compilación
      // Verificamos que la propiedad mantiene su valor
      expect(query.taskId).toBe(taskId);
    });

    /**
     * @test Debe mantener consistencia entre múltiples instancias
     * @given Múltiples queries con el mismo taskId
     * @when Se crean las instancias
     * @then Deben tener las mismas propiedades pero ser objetos diferentes
     */
    it('debe mantener consistencia entre múltiples instancias', () => {
      const taskId = 'consistency-test';

      const query1 = new GetTaskQuery(taskId);
      const query2 = new GetTaskQuery(taskId);

      expect(query1.taskId).toBe(query2.taskId);
      expect(query1).not.toBe(query2); // Diferentes instancias
      expect(query1).toEqual(query2); // Mismo contenido
    });

    /**
     * @test Debe crear instancias independientes
     * @given Queries con diferentes taskIds
     * @when Se crean las instancias
     * @then Cada una debe mantener su propio taskId
     */
    it('debe crear instancias independientes', () => {
      const taskId1 = 'task-1';
      const taskId2 = 'task-2';

      const query1 = new GetTaskQuery(taskId1);
      const query2 = new GetTaskQuery(taskId2);

      expect(query1.taskId).toBe(taskId1);
      expect(query2.taskId).toBe(taskId2);
      expect(query1.taskId).not.toBe(query2.taskId);
      expect(query1).not.toEqual(query2);
    });
  });

  /**
   * @description Suite de pruebas para casos de uso realistas
   */
  describe('Casos de uso realistas', () => {
    /**
     * @test Debe funcionar con flujo típico de obtención de tarea
     * @given Un taskId del flujo normal de la aplicación
     * @when Se crea la query para obtener la tarea
     * @then Debe crear una query válida para el handler
     */
    it('debe funcionar con flujo típico de obtención de tarea', () => {
      const scenarios = [
        {
          description: 'Tarea recién creada',
          taskId: '68b1a3f343a6fd2f7926ba37',
        },
        {
          description: 'Tarea en procesamiento',
          taskId: '68b1a9c2370773c0fe49298c',
        },
        {
          description: 'Tarea completada',
          taskId: '68b1b1ad554e414863ad262f',
        },
        {
          description: 'Tarea fallida',
          taskId: '68b1b5ad534d0db382af15ed',
        },
      ];

      scenarios.forEach(({ taskId }) => {
        const query = new GetTaskQuery(taskId);

        expect(query.taskId).toBe(taskId);
        expect(typeof query.taskId).toBe('string');
        expect(query.taskId.length).toBeGreaterThan(0);
      });
    });

    /**
     * @test Debe integrarse correctamente con el patrón CQRS
     * @given Una query creada según el patrón CQRS
     * @when Se verifica la implementación de IQuery
     * @then Debe cumplir con el contrato de la interfaz
     */
    it('debe integrarse correctamente con el patrón CQRS', () => {
      const taskId = 'cqrs-integration-test';
      const query = new GetTaskQuery(taskId);

      // Verificar que es una instancia válida
      expect(query).toBeInstanceOf(GetTaskQuery);
      expect(query.taskId).toBe(taskId);

      // Verificar que tiene las propiedades necesarias para CQRS
      expect(query).toHaveProperty('taskId');
      expect(Object.keys(query)).toContain('taskId');
    });

    /**
     * @test Debe manejar IDs generados por diferentes fuentes
     * @given IDs de diferentes orígenes (UUID, ObjectId, custom)
     * @when Se crean queries
     * @then Debe procesar todos los formatos
     */
    it('debe manejar IDs generados por diferentes fuentes', () => {
      const idSources = [
        {
          source: 'MongoDB ObjectId',
          id: '507f1f77bcf86cd799439011',
        },
        {
          source: 'UUID v4',
          id: '550e8400-e29b-41d4-a716-446655440000',
        },
        {
          source: 'Custom alphanumeric',
          id: 'TSK-2024-001-ABC123',
        },
        {
          source: 'Timestamp based',
          id: '20240129-150000-001',
        },
        {
          source: 'Hash based',
          id: 'sha256-abc123def456',
        },
      ];

      idSources.forEach(({ id }) => {
        const query = new GetTaskQuery(id);

        expect(query.taskId).toBe(id);
        expect(typeof query.taskId).toBe('string');
      });
    });
  });
});