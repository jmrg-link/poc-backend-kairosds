import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Mediator } from '../../../../src/application/core/Mediator';
import { CommandBus } from '../../../../src/application/core/CommandBus';
import { QueryBus } from '../../../../src/application/core/QueryBus';
import { ICommand } from '../../../../src/application/core/Command';
import { IQuery } from '../../../../src/application/core/Query';

/**
 * @description Test command implementation
 */
class TestCommand implements ICommand {
  constructor(public readonly data: string) {}
}

/**
 * @description Test query implementation
 */
class TestQuery implements IQuery<string> {
  constructor(public readonly id: string) {}
}

/**
 * @description Suite de pruebas para Mediator
 * 
 * @description Valida el funcionamiento del mediador del patrón CQRS:
 * - Coordinación entre CommandBus y QueryBus
 * - Delegación correcta de comandos y consultas
 * - Propagación de errores desde los buses
 * - Manejo de tipos genéricos
 * - Separación de responsabilidades entre lectura y escritura
 */
describe('Mediator', () => {
  let mediator: Mediator;
  let mockCommandBus: jest.Mocked<CommandBus>;
  let mockQueryBus: jest.Mocked<QueryBus>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockCommandBus = {
      execute: jest.fn(),
      registerByName: jest.fn(),
      hasHandler: jest.fn(),
    } as unknown as jest.Mocked<CommandBus>;
    
    mockQueryBus = {
      execute: jest.fn(),
      registerByName: jest.fn(),
      hasHandler: jest.fn(),
    } as unknown as jest.Mocked<QueryBus>;
    
    mediator = new Mediator(mockCommandBus, mockQueryBus);
  });

  /**
   * @description Suite de pruebas para el método send (comandos)
   */
  describe('send', () => {
    /**
     * @test Debe delegar comandos al CommandBus
     * @given Un comando válido
     * @when Se envía el comando a través del mediator
     * @then El comando debe ser delegado al CommandBus
     */
    it('debe delegar comandos al CommandBus', async () => {
      const command = new TestCommand('test data');
      const expectedResult = 'command result';
      
      mockCommandBus.execute.mockResolvedValue(expectedResult);
      
      const result = await mediator.send<string>(command);
      
      expect(mockCommandBus.execute).toHaveBeenCalledWith(command);
      expect(mockCommandBus.execute).toHaveBeenCalledTimes(1);
      expect(result).toBe(expectedResult);
    });

    /**
     * @test Debe propagar errores del CommandBus
     * @given Un comando que causa un error
     * @when Se envía el comando
     * @then El error debe propagarse desde el CommandBus
     */
    it('debe propagar errores del CommandBus', async () => {
      const command = new TestCommand('error data');
      const error = new Error('Command execution failed');
      
      mockCommandBus.execute.mockRejectedValue(error);
      
      await expect(mediator.send(command)).rejects.toThrow('Command execution failed');
      expect(mockCommandBus.execute).toHaveBeenCalledWith(command);
    });

    /**
     * @test Debe manejar comandos con resultado void
     * @given Un comando que no retorna valor
     * @when Se envía el comando
     * @then Debe ejecutarse sin errores y retornar undefined
     */
    it('debe manejar comandos con resultado void', async () => {
      const command = new TestCommand('void command');
      
      mockCommandBus.execute.mockResolvedValue(undefined);
      
      const result = await mediator.send<void>(command);
      
      expect(mockCommandBus.execute).toHaveBeenCalledWith(command);
      expect(result).toBeUndefined();
    });

    /**
     * @test Debe manejar comandos con resultados complejos
     * @given Un comando que retorna un objeto complejo
     * @when Se envía el comando
     * @then Debe retornar el objeto correctamente
     */
    it('debe manejar comandos con resultados complejos', async () => {
      interface ComplexResult {
        id: string;
        status: string;
        data: {
          nested: {
            value: number;
          };
        };
      }
      
      const command = new TestCommand('complex');
      const complexResult: ComplexResult = {
        id: '123',
        status: 'success',
        data: {
          nested: {
            value: 42,
          },
        },
      };
      
      mockCommandBus.execute.mockResolvedValue(complexResult);
      
      const result = await mediator.send<ComplexResult>(command);
      
      expect(result).toEqual(complexResult);
      expect(result.data.nested.value).toBe(42);
    });

    /**
     * @test No debe llamar al QueryBus cuando se envía un comando
     * @given Un comando
     * @when Se envía el comando
     * @then Solo debe llamar al CommandBus, no al QueryBus
     */
    it('no debe llamar al QueryBus cuando se envía un comando', async () => {
      const command = new TestCommand('test');
      
      mockCommandBus.execute.mockResolvedValue('result');
      
      await mediator.send(command);
      
      expect(mockCommandBus.execute).toHaveBeenCalled();
      expect(mockQueryBus.execute).not.toHaveBeenCalled();
    });

    /**
     * @test Debe manejar múltiples comandos secuencialmente
     * @given Múltiples comandos
     * @when Se envían secuencialmente
     * @then Cada comando debe procesarse en orden
     */
    it('debe manejar múltiples comandos secuencialmente', async () => {
      const command1 = new TestCommand('first');
      const command2 = new TestCommand('second');
      const command3 = new TestCommand('third');
      
      mockCommandBus.execute
        .mockResolvedValueOnce('result1')
        .mockResolvedValueOnce('result2')
        .mockResolvedValueOnce('result3');
      
      const result1 = await mediator.send<string>(command1);
      const result2 = await mediator.send<string>(command2);
      const result3 = await mediator.send<string>(command3);
      
      expect(mockCommandBus.execute).toHaveBeenCalledTimes(3);
      expect(mockCommandBus.execute).toHaveBeenNthCalledWith(1, command1);
      expect(mockCommandBus.execute).toHaveBeenNthCalledWith(2, command2);
      expect(mockCommandBus.execute).toHaveBeenNthCalledWith(3, command3);
      expect(result1).toBe('result1');
      expect(result2).toBe('result2');
      expect(result3).toBe('result3');
    });
  });

  /**
   * @description Suite de pruebas para el método query (consultas)
   */
  describe('query', () => {
    /**
     * @test Debe delegar consultas al QueryBus
     * @given Una consulta válida
     * @when Se ejecuta la consulta a través del mediator
     * @then La consulta debe ser delegada al QueryBus
     */
    it('debe delegar consultas al QueryBus', async () => {
      const query = new TestQuery('query-id');
      const expectedResult = 'query result';
      
      mockQueryBus.execute.mockResolvedValue(expectedResult);
      
      const result = await mediator.query<string>(query);
      
      expect(mockQueryBus.execute).toHaveBeenCalledWith(query);
      expect(mockQueryBus.execute).toHaveBeenCalledTimes(1);
      expect(result).toBe(expectedResult);
    });

    /**
     * @test Debe propagar errores del QueryBus
     * @given Una consulta que causa un error
     * @when Se ejecuta la consulta
     * @then El error debe propagarse desde el QueryBus
     */
    it('debe propagar errores del QueryBus', async () => {
      const query = new TestQuery('error-query');
      const error = new Error('Query execution failed');
      
      mockQueryBus.execute.mockRejectedValue(error);
      
      await expect(mediator.query(query)).rejects.toThrow('Query execution failed');
      expect(mockQueryBus.execute).toHaveBeenCalledWith(query);
    });

    /**
     * @test Debe manejar consultas que retornan arrays
     * @given Una consulta que retorna un array
     * @when Se ejecuta la consulta
     * @then Debe retornar el array correctamente
     */
    it('debe manejar consultas que retornan arrays', async () => {
      const query = new TestQuery('array-query');
      const arrayResult = ['item1', 'item2', 'item3'];
      
      mockQueryBus.execute.mockResolvedValue(arrayResult);
      
      const result = await mediator.query<string[]>(query);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual(arrayResult);
      expect(result.length).toBe(3);
    });

    /**
     * @test No debe llamar al CommandBus cuando se ejecuta una consulta
     * @given Una consulta
     * @when Se ejecuta la consulta
     * @then Solo debe llamar al QueryBus, no al CommandBus
     */
    it('no debe llamar al CommandBus cuando se ejecuta una consulta', async () => {
      const query = new TestQuery('test');
      
      mockQueryBus.execute.mockResolvedValue('result');
      
      await mediator.query(query);
      
      expect(mockQueryBus.execute).toHaveBeenCalled();
      expect(mockCommandBus.execute).not.toHaveBeenCalled();
    });

    /**
     * @test Debe manejar consultas con resultados null
     * @given Una consulta que retorna null
     * @when Se ejecuta la consulta
     * @then Debe retornar null correctamente
     */
    it('debe manejar consultas con resultados null', async () => {
      const query = new TestQuery('null-query');
      
      mockQueryBus.execute.mockResolvedValue(null);
      
      const result = await mediator.query<string | null>(query);
      
      expect(result).toBeNull();
    });

    /**
     * @test Debe manejar múltiples consultas concurrentemente
     * @given Múltiples consultas
     * @when Se ejecutan concurrentemente
     * @then Todas las consultas deben procesarse correctamente
     */
    it('debe manejar múltiples consultas concurrentemente', async () => {
      const query1 = new TestQuery('q1');
      const query2 = new TestQuery('q2');
      const query3 = new TestQuery('q3');
      
      mockQueryBus.execute
        .mockImplementation(<T>(q: IQuery<T>) => {
          const testQuery = q as TestQuery;
          return Promise.resolve(`result-${testQuery.id}` as T);
        });
      
      const [result1, result2, result3] = await Promise.all([
        mediator.query<string>(query1),
        mediator.query<string>(query2),
        mediator.query<string>(query3),
      ]);
      
      expect(mockQueryBus.execute).toHaveBeenCalledTimes(3);
      expect(result1).toBe('result-q1');
      expect(result2).toBe('result-q2');
      expect(result3).toBe('result-q3');
    });
  });

  /**
   * @description Suite de pruebas para uso combinado de comandos y consultas
   */
  describe('Uso combinado', () => {
    /**
     * @test Debe manejar comandos y consultas intercalados
     * @given Comandos y consultas intercalados
     * @when Se ejecutan en secuencia
     * @then Cada uno debe delegarse al bus correcto
     */
    it('debe manejar comandos y consultas intercalados', async () => {
      const command = new TestCommand('cmd');
      const query = new TestQuery('qry');
      
      mockCommandBus.execute.mockResolvedValue('command-result');
      mockQueryBus.execute.mockResolvedValue('query-result');
      
      const cmdResult = await mediator.send<string>(command);
      const qryResult = await mediator.query<string>(query);
      const cmdResult2 = await mediator.send<string>(command);
      
      expect(mockCommandBus.execute).toHaveBeenCalledTimes(2);
      expect(mockQueryBus.execute).toHaveBeenCalledTimes(1);
      expect(cmdResult).toBe('command-result');
      expect(qryResult).toBe('query-result');
      expect(cmdResult2).toBe('command-result');
    });

    /**
     * @test Debe mantener la separación entre comandos y consultas
     * @given Un comando y una consulta
     * @when Se ejecutan
     * @then Deben usar buses independientes sin interferencia
     */
    it('debe mantener la separación entre comandos y consultas', async () => {
      const command = new TestCommand('write-operation');
      const query = new TestQuery('read-operation');
      
      let commandExecuted = false;
      let queryExecuted = false;
      
      mockCommandBus.execute.mockImplementation(async <T>(_command: ICommand) => {
        commandExecuted = true;
        expect(queryExecuted).toBe(false);
        return 'command-done' as T;
      });
      
      mockQueryBus.execute.mockImplementation(async <T>(_query: IQuery<T>) => {
        queryExecuted = true;
        expect(commandExecuted).toBe(true);
        return 'query-done' as T;
      });
      
      await mediator.send(command);
      await mediator.query(query);
      
      expect(commandExecuted).toBe(true);
      expect(queryExecuted).toBe(true);
    });

    /**
     * @test Debe manejar errores independientemente en cada bus
     * @given Un comando que falla y una consulta exitosa
     * @when Se ejecutan
     * @then El error del comando no debe afectar la consulta
     */
    it('debe manejar errores independientemente en cada bus', async () => {
      const command = new TestCommand('failing-cmd');
      const query = new TestQuery('successful-qry');
      
      mockCommandBus.execute.mockRejectedValue(new Error('Command failed'));
      mockQueryBus.execute.mockResolvedValue('Query succeeded');
      
      await expect(mediator.send(command)).rejects.toThrow('Command failed');
      
      const queryResult = await mediator.query<string>(query);
      expect(queryResult).toBe('Query succeeded');
    });
  });

  /**
   * @description Suite de pruebas para casos edge
   */
  describe('Casos edge', () => {
    /**
     * @test Debe manejar timeouts en comandos
     * @given Un comando con timeout simulado
     * @when Se envía el comando
     * @then Debe manejar el timeout apropiadamente
     */
    it('debe manejar timeouts en comandos', async () => {
      const command = new TestCommand('timeout');
      
      mockCommandBus.execute.mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 10)
        )
      );
      
      await expect(mediator.send(command)).rejects.toThrow('Timeout');
    });

    /**
     * @test Debe preservar el tipo de resultado genérico
     * @given Comandos y consultas con diferentes tipos de resultado
     * @when Se ejecutan
     * @then Los tipos deben preservarse correctamente
     */
    it('debe preservar el tipo de resultado genérico', async () => {
      interface CustomType {
        id: number;
        name: string;
        active: boolean;
      }
      
      const command = new TestCommand('typed');
      const query = new TestQuery('typed');
      
      const customResult: CustomType = { id: 1, name: 'test', active: true };
      
      mockCommandBus.execute.mockResolvedValue(customResult);
      mockQueryBus.execute.mockResolvedValue([customResult]);
      
      const cmdResult = await mediator.send<CustomType>(command);
      const qryResult = await mediator.query<CustomType[]>(query);
      
      expect(cmdResult.id).toBe(1);
      expect(cmdResult.name).toBe('test');
      expect(cmdResult.active).toBe(true);
      expect(Array.isArray(qryResult)).toBe(true);
      expect(qryResult[0]).toEqual(customResult);
    });
  });
});