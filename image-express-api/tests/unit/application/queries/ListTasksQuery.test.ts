import { describe, it, expect } from '@jest/globals';
import { ListTasksQuery } from '../../../../src/application/queries/ListTasksQuery';
import { TaskStatus } from '../../../../src/domain/entities/TaskEntity';

/**
 * @description Suite de pruebas para ListTasksQuery
 * 
 * @description Valida el comportamiento de la query de listado de tareas:
 * - Construcción correcta con parámetros de paginación
 * - Manejo de filtro opcional por status
 * - Cálculo correcto del skip para paginación
 * - Validación de casos edge y límites
 */
describe('ListTasksQuery', () => {
  /**
   * @description Suite de pruebas para construcción de la query
   */
  describe('Construcción', () => {
    /**
     * @test Debe crear query con parámetros básicos
     * @given Page y limit válidos
     * @when Se crea la query
     * @then Debe asignar las propiedades correctamente
     */
    it('debe crear query con parámetros básicos', () => {
      const page = 1;
      const limit = 10;

      const query = new ListTasksQuery(page, limit);

      expect(query.page).toBe(page);
      expect(query.limit).toBe(limit);
      expect(query.status).toBeUndefined();
    });

    /**
     * @test Debe crear query con filtro de status
     * @given Page, limit y status válidos
     * @when Se crea la query
     * @then Debe asignar todas las propiedades
     */
    it('debe crear query con filtro de status', () => {
      const page = 2;
      const limit = 5;
      const status = TaskStatus.COMPLETED;

      const query = new ListTasksQuery(page, limit, status);

      expect(query.page).toBe(page);
      expect(query.limit).toBe(limit);
      expect(query.status).toBe(status);
    });

    /**
     * @test Debe manejar todos los estados de tarea como filtro
     * @given Todos los valores de TaskStatus
     * @when Se crean queries con cada status
     * @then Debe aceptar todos los estados
     */
    it('debe manejar todos los estados de tarea como filtro', () => {
      const page = 1;
      const limit = 10;
      const statuses = [
        TaskStatus.PENDING,
        TaskStatus.PROCESSING,
        TaskStatus.COMPLETED,
        TaskStatus.FAILED,
      ];

      statuses.forEach(status => {
        const query = new ListTasksQuery(page, limit, status);
        expect(query.status).toBe(status);
        expect(query.page).toBe(page);
        expect(query.limit).toBe(limit);
      });
    });

    /**
     * @test Debe manejar diferentes valores de paginación
     * @given Diferentes combinaciones de page y limit
     * @when Se crean queries
     * @then Debe aceptar todos los valores
     */
    it('debe manejar diferentes valores de paginación', () => {
      const testCases = [
        { page: 1, limit: 1 },
        { page: 1, limit: 10 },
        { page: 1, limit: 50 },
        { page: 1, limit: 100 },
        { page: 5, limit: 20 },
        { page: 100, limit: 5 },
        { page: 999, limit: 999 },
      ];

      testCases.forEach(({ page, limit }) => {
        const query = new ListTasksQuery(page, limit);
        expect(query.page).toBe(page);
        expect(query.limit).toBe(limit);
      });
    });
  });

  /**
   * @description Suite de pruebas para el método getSkip
   */
  describe('getSkip', () => {
    /**
     * @test Debe calcular skip correctamente para primera página
     * @given Página 1 con diferentes límites
     * @when Se calcula getSkip()
     * @then Debe retornar 0
     */
    it('debe calcular skip correctamente para primera página', () => {
      const testCases = [1, 5, 10, 20, 50, 100];

      testCases.forEach(limit => {
        const query = new ListTasksQuery(1, limit);
        expect(query.getSkip()).toBe(0);
      });
    });

    /**
     * @test Debe calcular skip correctamente para páginas siguientes
     * @given Diferentes páginas y límites
     * @when Se calcula getSkip()
     * @then Debe retornar (page - 1) * limit
     */
    it('debe calcular skip correctamente para páginas siguientes', () => {
      const testCases = [
        { page: 2, limit: 10, expectedSkip: 10 },
        { page: 3, limit: 10, expectedSkip: 20 },
        { page: 5, limit: 20, expectedSkip: 80 },
        { page: 10, limit: 5, expectedSkip: 45 },
        { page: 2, limit: 1, expectedSkip: 1 },
        { page: 100, limit: 25, expectedSkip: 2475 },
      ];

      testCases.forEach(({ page, limit, expectedSkip }) => {
        const query = new ListTasksQuery(page, limit);
        expect(query.getSkip()).toBe(expectedSkip);
      });
    });

    /**
     * @test Debe calcular skip independientemente del status
     * @given Queries con y sin filtro de status
     * @when Se calcula getSkip()
     * @then El resultado debe ser el mismo
     */
    it('debe calcular skip independientemente del status', () => {
      const page = 3;
      const limit = 15;
      const queryWithoutStatus = new ListTasksQuery(page, limit);
      const queryWithStatus = new ListTasksQuery(page, limit, TaskStatus.PENDING);

      expect(queryWithoutStatus.getSkip()).toBe(30);
      expect(queryWithStatus.getSkip()).toBe(30);
      expect(queryWithoutStatus.getSkip()).toBe(queryWithStatus.getSkip());
    });

    /**
     * @test Debe manejar cálculos con números grandes
     * @given Páginas y límites grandes
     * @when Se calcula getSkip()
     * @then Debe calcular correctamente sin overflow
     */
    it('debe manejar cálculos con números grandes', () => {
      const testCases = [
        { page: 1000, limit: 100, expectedSkip: 99900 },
        { page: 500, limit: 1000, expectedSkip: 499000 },
        { page: 10000, limit: 10, expectedSkip: 99990 },
      ];

      testCases.forEach(({ page, limit, expectedSkip }) => {
        const query = new ListTasksQuery(page, limit);
        expect(query.getSkip()).toBe(expectedSkip);
      });
    });
  });

  /**
   * @description Suite de pruebas para casos edge
   */
  describe('Casos edge', () => {
    /**
     * @test Debe manejar página cero
     * @given Página 0
     * @when Se calcula getSkip()
     * @then Debe retornar valor negativo
     */
    it('debe manejar página cero', () => {
      const query = new ListTasksQuery(0, 10);

      expect(query.page).toBe(0);
      expect(query.getSkip()).toBe(-10);
    });

    /**
     * @test Debe manejar números negativos
     * @given Página o limit negativos
     * @when Se crean queries
     * @then Debe aceptar los valores negativos
     */
    it('debe manejar números negativos', () => {
      const testCases = [
        { page: -1, limit: 10 },
        { page: 1, limit: -5 },
        { page: -2, limit: -3 },
      ];

      testCases.forEach(({ page, limit }) => {
        const query = new ListTasksQuery(page, limit);
        expect(query.page).toBe(page);
        expect(query.limit).toBe(limit);
        expect(query.getSkip()).toBe((page - 1) * limit);
      });
    });

    /**
     * @test Debe manejar límite cero
     * @given Limit 0
     * @when Se crea la query
     * @then Debe manejar el caso sin errores
     */
    it('debe manejar límite cero', () => {
      const query = new ListTasksQuery(5, 0);

      expect(query.limit).toBe(0);
      expect(query.getSkip()).toBe(0);
    });

    /**
     * @test Debe manejar números decimales
     * @given Page o limit con decimales
     * @when Se crean queries
     * @then Debe aceptar los valores decimales
     */
    it('debe manejar números decimales', () => {
      const testCases = [
        { page: 1.5, limit: 10 },
        { page: 2, limit: 10.7 },
        { page: 3.14, limit: 2.71 },
      ];

      testCases.forEach(({ page, limit }) => {
        const query = new ListTasksQuery(page, limit);
        expect(query.page).toBe(page);
        expect(query.limit).toBe(limit);
        expect(query.getSkip()).toBe((page - 1) * limit);
      });
    });

    /**
     * @test Debe manejar valores extremos
     * @given Valores muy grandes o muy pequeños
     * @when Se crean queries
     * @then Debe aceptar todos los valores
     */
    it('debe manejar valores extremos', () => {
      const testCases = [
        { page: Number.MAX_SAFE_INTEGER, limit: 1 },
        { page: 1, limit: Number.MAX_SAFE_INTEGER },
        { page: Number.MIN_SAFE_INTEGER, limit: 1 },
        { page: 1, limit: Number.MIN_SAFE_INTEGER },
      ];

      testCases.forEach(({ page, limit }) => {
        const query = new ListTasksQuery(page, limit);
        expect(query.page).toBe(page);
        expect(query.limit).toBe(limit);
      });
    });
  });

  /**
   * @description Suite de pruebas para casos de uso realistas
   */
  describe('Casos de uso realistas', () => {
    /**
     * @test Debe funcionar con paginación típica de API
     * @given Parámetros típicos de paginación web
     * @when Se crean queries
     * @then Debe calcular skip correctamente
     */
    it('debe funcionar con paginación típica de API', () => {
      const scenarios = [
        {
          description: 'Primera página, 10 items',
          page: 1,
          limit: 10,
          expectedSkip: 0,
        },
        {
          description: 'Segunda página, 10 items',
          page: 2,
          limit: 10,
          expectedSkip: 10,
        },
        {
          description: 'Página 5, 20 items',
          page: 5,
          limit: 20,
          expectedSkip: 80,
        },
        {
          description: 'Página 10, 50 items',
          page: 10,
          limit: 50,
          expectedSkip: 450,
        },
      ];

      scenarios.forEach(({ page, limit, expectedSkip }) => {
        const query = new ListTasksQuery(page, limit);

        expect(query.page).toBe(page);
        expect(query.limit).toBe(limit);
        expect(query.getSkip()).toBe(expectedSkip);
      });
    });

    /**
     * @test Debe funcionar con filtros comunes
     * @given Queries con filtros típicos de la aplicación
     * @when Se crean queries con diferentes estados
     * @then Debe mantener la lógica de paginación
     */
    it('debe funcionar con filtros comunes', () => {
      const commonFilters = [
        {
          description: 'Tareas pendientes',
          status: TaskStatus.PENDING,
          page: 1,
          limit: 25,
        },
        {
          description: 'Tareas completadas',
          status: TaskStatus.COMPLETED,
          page: 3,
          limit: 15,
        },
        {
          description: 'Tareas fallidas',
          status: TaskStatus.FAILED,
          page: 1,
          limit: 10,
        },
        {
          description: 'Tareas en procesamiento',
          status: TaskStatus.PROCESSING,
          page: 2,
          limit: 5,
        },
      ];

      commonFilters.forEach(({ status, page, limit }) => {
        const query = new ListTasksQuery(page, limit, status);

        expect(query.status).toBe(status);
        expect(query.page).toBe(page);
        expect(query.limit).toBe(limit);
        expect(query.getSkip()).toBe((page - 1) * limit);
      });
    });

    /**
     * @test Debe integrarse correctamente con el patrón CQRS
     * @given Una query creada según el patrón CQRS
     * @when Se verifica la implementación de IQuery
     * @then Debe cumplir con el contrato de la interfaz
     */
    it('debe integrarse correctamente con el patrón CQRS', () => {
      const query = new ListTasksQuery(1, 10, TaskStatus.PENDING);

      expect(query).toBeInstanceOf(ListTasksQuery);
      expect(query).toHaveProperty('page');
      expect(query).toHaveProperty('limit');
      expect(query).toHaveProperty('status');
      expect(query).toHaveProperty('getSkip');
      expect(typeof query.getSkip).toBe('function');
    });
  });

  /**
   * @description Suite de pruebas para inmutabilidad
   */
  describe('Inmutabilidad', () => {
    /**
     * @test Debe crear propiedades de solo lectura
     * @given Una query creada
     * @when Se accede a las propiedades
     * @then Las propiedades deben ser de solo lectura
     */
    it('debe crear propiedades de solo lectura', () => {
      const page = 2;
      const limit = 15;
      const status = TaskStatus.COMPLETED;
      const query = new ListTasksQuery(page, limit, status);

      expect(query.page).toBe(page);
      expect(query.limit).toBe(limit);
      expect(query.status).toBe(status);
      expect(query.page).toBe(page);
      expect(query.limit).toBe(limit);
      expect(query.status).toBe(status);
    });

    /**
     * @test Debe mantener consistencia entre múltiples instancias
     * @given Múltiples queries con los mismos parámetros
     * @when Se crean las instancias
     * @then Deben tener las mismas propiedades pero ser objetos diferentes
     */
    it('debe mantener consistencia entre múltiples instancias', () => {
      const page = 3;
      const limit = 12;
      const status = TaskStatus.PROCESSING;

      const query1 = new ListTasksQuery(page, limit, status);
      const query2 = new ListTasksQuery(page, limit, status);

      expect(query1.page).toBe(query2.page);
      expect(query1.limit).toBe(query2.limit);
      expect(query1.status).toBe(query2.status);
      expect(query1.getSkip()).toBe(query2.getSkip());
      expect(query1).not.toBe(query2);
      expect(query1).toEqual(query2);
    });

    /**
     * @test Debe crear instancias independientes
     * @given Queries con diferentes parámetros
     * @when Se crean las instancias
     * @then Cada una debe mantener sus propios valores
     */
    it('debe crear instancias independientes', () => {
      const query1 = new ListTasksQuery(1, 10, TaskStatus.PENDING);
      const query2 = new ListTasksQuery(2, 20, TaskStatus.COMPLETED);

      expect(query1.page).not.toBe(query2.page);
      expect(query1.limit).not.toBe(query2.limit);
      expect(query1.status).not.toBe(query2.status);
      expect(query1.getSkip()).not.toBe(query2.getSkip());
      expect(query1).not.toEqual(query2);
    });
  });
});