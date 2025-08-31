import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { QueryBus } from '../../../../src/application/core/QueryBus';
import { IQuery, IQueryHandler } from '../../../../src/application/core/Query';

/**
 * @description Test implementation of IQuery
 */
class TestQuery implements IQuery<string> {
  constructor(public readonly id: string) {}
}

/**
 * @description Another test query for multiple handler scenarios
 */
class AnotherTestQuery implements IQuery<number[]> {
  constructor(public readonly limit: number) {}
}

/**
 * @description Complex query returning an object
 */
class ComplexQuery implements IQuery<{ id: string; data: unknown }> {
  constructor(
    public readonly id: string,
    public readonly includeDetails: boolean
  ) {}
}

/**
 * @description Test implementation of IQueryHandler
 */
class TestQueryHandler implements IQueryHandler<TestQuery, string> {
  async execute(query: TestQuery): Promise<string> {
    return `Result for: ${query.id}`;
  }
}

/**
 * @description Mock handler that throws an error
 */
class ErrorQueryHandler implements IQueryHandler<TestQuery, never> {
  async execute(_query: TestQuery): Promise<never> {
    throw new Error('Query execution failed');
  }
}

/**
 * @description Suite de pruebas para QueryBus
 * 
 * @description Valida el funcionamiento del bus de consultas del patrón CQRS:
 * - Registro de handlers por nombre de consulta
 * - Ejecución de consultas con sus handlers correspondientes
 * - Manejo de errores cuando no existe handler
 * - Verificación de existencia de handlers
 * - Manejo de múltiples consultas y handlers
 * - Tipos de retorno complejos
 */
describe('QueryBus', () => {
  let queryBus: QueryBus;
  let mockHandler: jest.Mocked<IQueryHandler<TestQuery, string>>;

  beforeEach(() => {
    jest.clearAllMocks();
    queryBus = new QueryBus();
    
    mockHandler = {
      execute: jest.fn<() => Promise<string>>().mockResolvedValue('mocked query result'),
    } as jest.Mocked<IQueryHandler<TestQuery, string>>;
  });

  /**
   * @description Suite de pruebas para el registro de handlers
   */
  describe('registerByName', () => {
    /**
     * @test Debe registrar un handler para una consulta específica
     * @given Un handler y un nombre de consulta
     * @when Se registra el handler con el nombre de la consulta
     * @then El handler debe quedar registrado y ser verificable
     */
    it('debe registrar un handler para una consulta específica', () => {
      const handler = new TestQueryHandler();
      
      queryBus.registerByName('TestQuery', handler);
      
      const query = new TestQuery('test-id');
      expect(queryBus.hasHandler(query)).toBe(true);
    });

    /**
     * @test Debe permitir registrar múltiples handlers para diferentes consultas
     * @given Múltiples handlers y consultas
     * @when Se registran varios handlers
     * @then Todos los handlers deben quedar registrados correctamente
     */
    it('debe permitir registrar múltiples handlers para diferentes consultas', () => {
      const handler1 = new TestQueryHandler();
      const handler2 = {
        execute: jest.fn<() => Promise<number[]>>().mockResolvedValue([1, 2, 3]),
      } as IQueryHandler<AnotherTestQuery, number[]>;
      
      queryBus.registerByName('TestQuery', handler1);
      queryBus.registerByName('AnotherTestQuery', handler2);
      
      const query1 = new TestQuery('id1');
      const query2 = new AnotherTestQuery(10);
      
      expect(queryBus.hasHandler(query1)).toBe(true);
      expect(queryBus.hasHandler(query2)).toBe(true);
    });

    /**
     * @test Debe sobrescribir un handler existente cuando se registra con el mismo nombre
     * @given Un handler ya registrado
     * @when Se registra otro handler con el mismo nombre
     * @then El nuevo handler debe reemplazar al anterior
     */
    it('debe sobrescribir un handler existente cuando se registra con el mismo nombre', async () => {
      const handler1 = new TestQueryHandler();
      const handler2 = {
        execute: jest.fn<() => Promise<string>>().mockResolvedValue('new handler result'),
      } as IQueryHandler<TestQuery, string>;
      
      queryBus.registerByName('TestQuery', handler1);
      queryBus.registerByName('TestQuery', handler2);
      
      const query = new TestQuery('test-id');
      const result = await queryBus.execute<string>(query);
      
      expect(handler2.execute).toHaveBeenCalledWith(query);
      expect(result).toBe('new handler result');
    });
  });

  /**
   * @description Suite de pruebas para la ejecución de consultas
   */
  describe('execute', () => {
    /**
     * @test Debe ejecutar el handler correcto para una consulta
     * @given Una consulta con handler registrado
     * @when Se ejecuta la consulta
     * @then El handler debe ser invocado y retornar el resultado
     */
    it('debe ejecutar el handler correcto para una consulta', async () => {
      queryBus.registerByName('TestQuery', mockHandler);
      
      const query = new TestQuery('query-id');
      const result = await queryBus.execute<string>(query);
      
      expect(mockHandler.execute).toHaveBeenCalledWith(query);
      expect(mockHandler.execute).toHaveBeenCalledTimes(1);
      expect(result).toBe('mocked query result');
    });

    /**
     * @test Debe lanzar error cuando no existe handler para la consulta
     * @given Una consulta sin handler registrado
     * @when Se intenta ejecutar la consulta
     * @then Debe lanzar un error descriptivo
     */
    it('debe lanzar error cuando no existe handler para la consulta', async () => {
      const query = new TestQuery('test');
      
      await expect(queryBus.execute(query)).rejects.toThrow(
        'Handler para consulta TestQuery no encontrado'
      );
    });

    /**
     * @test Debe propagar errores del handler
     * @given Un handler que lanza un error
     * @when Se ejecuta la consulta
     * @then El error debe propagarse
     */
    it('debe propagar errores del handler', async () => {
      const errorHandler = new ErrorQueryHandler();
      queryBus.registerByName('TestQuery', errorHandler);
      
      const query = new TestQuery('error-test');
      
      await expect(queryBus.execute(query)).rejects.toThrow(
        'Query execution failed'
      );
    });

    /**
     * @test Debe manejar consultas que retornan arrays
     * @given Un handler que retorna un array
     * @when Se ejecuta la consulta
     * @then Debe retornar el array correctamente
     */
    it('debe manejar consultas que retornan arrays', async () => {
      const arrayHandler = {
        execute: jest.fn<() => Promise<number[]>>().mockResolvedValue([1, 2, 3, 4, 5]),
      } as IQueryHandler<AnotherTestQuery, number[]>;
      
      queryBus.registerByName('AnotherTestQuery', arrayHandler);
      
      const query = new AnotherTestQuery(5);
      const result = await queryBus.execute<number[]>(query);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual([1, 2, 3, 4, 5]);
      expect(result.length).toBe(5);
    });

    /**
     * @test Debe manejar consultas que retornan objetos complejos
     * @given Un handler que retorna un objeto complejo
     * @when Se ejecuta la consulta
     * @then Debe retornar el objeto con su estructura correcta
     */
    it('debe manejar consultas que retornan objetos complejos', async () => {
      const complexHandler = {
        execute: jest.fn<() => Promise<{ id: string; data: unknown }>>().mockResolvedValue({
          id: 'complex-id',
          data: {
            nested: {
              value: 42,
              array: [1, 2, 3],
            },
          },
        }),
      } as IQueryHandler<ComplexQuery, { id: string; data: unknown }>;
      
      queryBus.registerByName('ComplexQuery', complexHandler);
      
      const query = new ComplexQuery('complex-id', true);
      const result = await queryBus.execute<{ id: string; data: unknown }>(query);
      
      expect(result).toEqual({
        id: 'complex-id',
        data: {
          nested: {
            value: 42,
            array: [1, 2, 3],
          },
        },
      });
    });

    /**
     * @test Debe manejar handlers asíncronos con delay
     * @given Un handler que simula una operación asíncrona
     * @when Se ejecuta la consulta
     * @then Debe esperar y retornar el resultado correcto
     */
    it('debe manejar handlers asíncronos con delay', async () => {
      const asyncHandler = {
        execute: jest.fn<(query: TestQuery) => Promise<string>>().mockImplementation(async (query: TestQuery) => {
          await new Promise(resolve => setTimeout(resolve, 50));
          return `Async result: ${query.id}`;
        }),
      } as IQueryHandler<TestQuery, string>;
      
      queryBus.registerByName('TestQuery', asyncHandler);
      
      const query = new TestQuery('async-id');
      const startTime = Date.now();
      const result = await queryBus.execute<string>(query);
      const endTime = Date.now();
      
      expect(result).toBe('Async result: async-id');
      expect(endTime - startTime).toBeGreaterThanOrEqual(50);
    });

    /**
     * @test Debe ejecutar diferentes handlers para diferentes consultas
     * @given Múltiples consultas con sus respectivos handlers
     * @when Se ejecutan las consultas
     * @then Cada consulta debe ejecutar su handler correspondiente
     */
    it('debe ejecutar diferentes handlers para diferentes consultas', async () => {
      const handler1 = {
        execute: jest.fn<() => Promise<string>>().mockResolvedValue('result1'),
      } as IQueryHandler<TestQuery, string>;
      
      const handler2 = {
        execute: jest.fn<() => Promise<number[]>>().mockResolvedValue([10, 20, 30]),
      } as IQueryHandler<AnotherTestQuery, number[]>;
      
      queryBus.registerByName('TestQuery', handler1);
      queryBus.registerByName('AnotherTestQuery', handler2);
      
      const query1 = new TestQuery('q1');
      const query2 = new AnotherTestQuery(3);
      
      const result1 = await queryBus.execute<string>(query1);
      const result2 = await queryBus.execute<number[]>(query2);
      
      expect(handler1.execute).toHaveBeenCalledWith(query1);
      expect(handler2.execute).toHaveBeenCalledWith(query2);
      expect(result1).toBe('result1');
      expect(result2).toEqual([10, 20, 30]);
    });
  });

  /**
   * @description Suite de pruebas para verificación de handlers
   */
  describe('hasHandler', () => {
    /**
     * @test Debe retornar true cuando existe un handler
     * @given Un handler registrado
     * @when Se verifica la existencia del handler
     * @then Debe retornar true
     */
    it('debe retornar true cuando existe un handler', () => {
      const handler = new TestQueryHandler();
      queryBus.registerByName('TestQuery', handler);
      
      const query = new TestQuery('test');
      expect(queryBus.hasHandler(query)).toBe(true);
    });

    /**
     * @test Debe retornar false cuando no existe un handler
     * @given Ningún handler registrado
     * @when Se verifica la existencia del handler
     * @then Debe retornar false
     */
    it('debe retornar false cuando no existe un handler', () => {
      const query = new TestQuery('test');
      expect(queryBus.hasHandler(query)).toBe(false);
    });

    /**
     * @test Debe usar el nombre del constructor de la consulta para verificación
     * @given Una consulta con nombre de clase específico
     * @when Se verifica usando diferentes instancias de la misma consulta
     * @then Todas las instancias deben dar el mismo resultado
     */
    it('debe usar el nombre del constructor de la consulta para verificación', () => {
      const handler = new TestQueryHandler();
      queryBus.registerByName('TestQuery', handler);
      
      const query1 = new TestQuery('id1');
      const query2 = new TestQuery('id2');
      const query3 = new TestQuery('id3');
      
      expect(queryBus.hasHandler(query1)).toBe(true);
      expect(queryBus.hasHandler(query2)).toBe(true);
      expect(queryBus.hasHandler(query3)).toBe(true);
    });
  });

  /**
   * @description Suite de pruebas para casos edge y escenarios especiales
   */
  describe('Casos edge', () => {
    /**
     * @test Debe manejar consultas con valores null o undefined
     * @given Una consulta con propiedades null/undefined
     * @when Se ejecuta la consulta
     * @then Debe ejecutarse sin errores
     */
    it('debe manejar consultas con valores null o undefined', async () => {
      class NullableQuery implements IQuery<string | null> {
        constructor(public readonly value: string | null | undefined) {}
      }
      
      const handler = {
        execute: jest.fn<() => Promise<string | null>>().mockResolvedValue(null),
      } as IQueryHandler<NullableQuery, string | null>;
      
      queryBus.registerByName('NullableQuery', handler);
      
      const query = new NullableQuery(undefined);
      const result = await queryBus.execute<string | null>(query);
      
      expect(handler.execute).toHaveBeenCalledWith(query);
      expect(result).toBeNull();
    });

    /**
     * @test Debe manejar consultas que retornan arrays vacíos
     * @given Un handler que retorna un array vacío
     * @when Se ejecuta la consulta
     * @then Debe retornar el array vacío correctamente
     */
    it('debe manejar consultas que retornan arrays vacíos', async () => {
      const emptyArrayHandler = {
        execute: jest.fn<() => Promise<number[]>>().mockResolvedValue([]),
      } as IQueryHandler<AnotherTestQuery, number[]>;
      
      queryBus.registerByName('AnotherTestQuery', emptyArrayHandler);
      
      const query = new AnotherTestQuery(0);
      const result = await queryBus.execute<number[]>(query);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual([]);
      expect(result.length).toBe(0);
    });

    /**
     * @test Debe preservar el contexto this del handler
     * @given Un handler que usa this
     * @when Se ejecuta la consulta
     * @then El contexto this debe preservarse
     */
    it('debe preservar el contexto this del handler', async () => {
      class StatefulQueryHandler implements IQueryHandler<TestQuery, string> {
        private cache = new Map<string, string>();
        
        constructor() {
          this.cache.set('cached', 'cached-value');
        }
        
        async execute(query: TestQuery): Promise<string> {
          return this.cache.get('cached') || `No cache for: ${query.id}`;
        }
      }
      
      const handler = new StatefulQueryHandler();
      queryBus.registerByName('TestQuery', handler);
      
      const query = new TestQuery('test');
      const result = await queryBus.execute<string>(query);
      
      expect(result).toBe('cached-value');
    });

    /**
     * @test Debe manejar consultas paginadas
     * @given Una consulta con parámetros de paginación
     * @when Se ejecuta la consulta
     * @then Debe retornar resultados paginados correctamente
     */
    it('debe manejar consultas paginadas', async () => {
      interface PaginatedResult<T> {
        items: T[];
        total: number;
        page: number;
        pageSize: number;
      }
      
      class PaginatedQuery implements IQuery<PaginatedResult<string>> {
        constructor(
          public readonly page: number,
          public readonly pageSize: number
        ) {}
      }
      
      const paginatedHandler = {
        execute: jest.fn<() => Promise<PaginatedResult<string>>>().mockResolvedValue({
          items: ['item1', 'item2', 'item3'],
          total: 100,
          page: 1,
          pageSize: 3,
        }),
      } as unknown as IQueryHandler<PaginatedQuery, PaginatedResult<string>>;
      
      queryBus.registerByName('PaginatedQuery', paginatedHandler);
      
      const query = new PaginatedQuery(1, 3);
      const result = await queryBus.execute<PaginatedResult<string>>(query);
      
      expect(result.items).toEqual(['item1', 'item2', 'item3']);
      expect(result.total).toBe(100);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(3);
    });

    /**
     * @test Debe manejar respuestas con promesas rechazadas
     * @given Un handler que rechaza la promesa
     * @when Se ejecuta la consulta
     * @then Debe propagar el rechazo correctamente
     */
    it('debe manejar respuestas con promesas rechazadas', async () => {
      const rejectHandler = {
        execute: jest.fn<() => Promise<string>>().mockRejectedValue(new Error('Database connection failed')),
      } as IQueryHandler<TestQuery, string>;
      
      queryBus.registerByName('TestQuery', rejectHandler);
      
      const query = new TestQuery('fail');
      
      await expect(queryBus.execute(query)).rejects.toThrow('Database connection failed');
    });
  });
});