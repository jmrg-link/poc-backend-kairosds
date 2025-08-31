import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { CommandBus } from '../../../../src/application/core/CommandBus';
import { ICommand, ICommandHandler } from '../../../../src/application/core/Command';

/**
 * @description Test implementation of ICommand
 */
class TestCommand implements ICommand {
  constructor(public readonly value: string) {}
}

/**
 * @description Another test command for multiple handler scenarios
 */
class AnotherTestCommand implements ICommand {
  constructor(public readonly number: number) {}
}

/**
 * @description Test implementation of ICommandHandler
 */
class TestCommandHandler implements ICommandHandler<TestCommand, string> {
  async execute(command: TestCommand): Promise<string> {
    return `Executed: ${command.value}`;
  }
}

/**
 * @description Mock handler that throws an error
 */
class ErrorCommandHandler implements ICommandHandler<TestCommand, never> {
  async execute(_command: TestCommand): Promise<never> {
    throw new Error('Handler execution failed');
  }
}

/**
 * @description Suite de pruebas para CommandBus
 * 
 * @description Valida el funcionamiento del bus de comandos del patrón CQRS:
 * - Registro de handlers por nombre de comando
 * - Ejecución de comandos con sus handlers correspondientes
 * - Manejo de errores cuando no existe handler
 * - Verificación de existencia de handlers
 * - Manejo de múltiples comandos y handlers
 */
describe('CommandBus', () => {
  let commandBus: CommandBus;
  let mockHandler: jest.Mocked<ICommandHandler<TestCommand, string>>;

  beforeEach(() => {
    jest.clearAllMocks();
    commandBus = new CommandBus();
    
    mockHandler = {
      execute: jest.fn<() => Promise<string>>().mockResolvedValue('mocked result'),
    };
  });

  /**
   * @description Suite de pruebas para el registro de handlers
   */
  describe('registerByName', () => {
    /**
     * @test Debe registrar un handler para un comando específico
     * @given Un handler y un nombre de comando
     * @when Se registra el handler con el nombre del comando
     * @then El handler debe quedar registrado y ser verificable
     */
    it('debe registrar un handler para un comando específico', () => {
      const handler = new TestCommandHandler();
      
      commandBus.registerByName('TestCommand', handler);
      
      const command = new TestCommand('test');
      expect(commandBus.hasHandler(command)).toBe(true);
    });

    /**
     * @test Debe permitir registrar múltiples handlers para diferentes comandos
     * @given Múltiples handlers y comandos
     * @when Se registran varios handlers
     * @then Todos los handlers deben quedar registrados correctamente
     */
    it('debe permitir registrar múltiples handlers para diferentes comandos', () => {
      const handler1 = new TestCommandHandler();
      const handler2 = {
        execute: jest.fn<() => Promise<number>>().mockResolvedValue(42),
      } as ICommandHandler<AnotherTestCommand, number>;
      
      commandBus.registerByName('TestCommand', handler1);
      commandBus.registerByName('AnotherTestCommand', handler2);
      
      const command1 = new TestCommand('test');
      const command2 = new AnotherTestCommand(123);
      
      expect(commandBus.hasHandler(command1)).toBe(true);
      expect(commandBus.hasHandler(command2)).toBe(true);
    });

    /**
     * @test Debe sobrescribir un handler existente cuando se registra con el mismo nombre
     * @given Un handler ya registrado
     * @when Se registra otro handler con el mismo nombre
     * @then El nuevo handler debe reemplazar al anterior
     */
    it('debe sobrescribir un handler existente cuando se registra con el mismo nombre', async () => {
      const handler1 = new TestCommandHandler();
      const handler2 = {
        execute: jest.fn<() => Promise<string>>().mockResolvedValue('new handler result'),
      } as ICommandHandler<TestCommand, string>;
      
      commandBus.registerByName('TestCommand', handler1);
      commandBus.registerByName('TestCommand', handler2);
      
      const command = new TestCommand('test');
      const result = await commandBus.execute<string>(command);
      
      expect(handler2.execute).toHaveBeenCalledWith(command);
      expect(result).toBe('new handler result');
    });
  });

  /**
   * @description Suite de pruebas para la ejecución de comandos
   */
  describe('execute', () => {
    /**
     * @test Debe ejecutar el handler correcto para un comando
     * @given Un comando con handler registrado
     * @when Se ejecuta el comando
     * @then El handler debe ser invocado y retornar el resultado
     */
    it('debe ejecutar el handler correcto para un comando', async () => {
      commandBus.registerByName('TestCommand', mockHandler);
      
      const command = new TestCommand('test value');
      const result = await commandBus.execute<string>(command);
      
      expect(mockHandler.execute).toHaveBeenCalledWith(command);
      expect(mockHandler.execute).toHaveBeenCalledTimes(1);
      expect(result).toBe('mocked result');
    });

    /**
     * @test Debe lanzar error cuando no existe handler para el comando
     * @given Un comando sin handler registrado
     * @when Se intenta ejecutar el comando
     * @then Debe lanzar un error descriptivo
     */
    it('debe lanzar error cuando no existe handler para el comando', async () => {
      const command = new TestCommand('test');
      
      await expect(commandBus.execute(command)).rejects.toThrow(
        'Handler para comando TestCommand no encontrado'
      );
    });

    /**
     * @test Debe propagar errores del handler
     * @given Un handler que lanza un error
     * @when Se ejecuta el comando
     * @then El error debe propagarse
     */
    it('debe propagar errores del handler', async () => {
      const errorHandler = new ErrorCommandHandler();
      commandBus.registerByName('TestCommand', errorHandler);
      
      const command = new TestCommand('test');
      
      await expect(commandBus.execute(command)).rejects.toThrow(
        'Handler execution failed'
      );
    });

    /**
     * @test Debe mantener el tipo correcto del resultado
     * @given Un handler que retorna un tipo específico
     * @when Se ejecuta el comando
     * @then El resultado debe mantener el tipo correcto
     */
    it('debe mantener el tipo correcto del resultado', async () => {
      const numberHandler = {
        execute: jest.fn<() => Promise<number>>().mockResolvedValue(42),
      } as ICommandHandler<AnotherTestCommand, number>;
      
      commandBus.registerByName('AnotherTestCommand', numberHandler);
      
      const command = new AnotherTestCommand(10);
      const result = await commandBus.execute<number>(command);
      
      expect(typeof result).toBe('number');
      expect(result).toBe(42);
    });

    /**
     * @test Debe manejar handlers asíncronos correctamente
     * @given Un handler que retorna una promesa con delay
     * @when Se ejecuta el comando
     * @then Debe esperar y retornar el resultado correcto
     */
    it('debe manejar handlers asíncronos correctamente', async () => {
      const asyncHandler = {
        execute: jest.fn<(cmd: TestCommand) => Promise<string>>().mockImplementation(async (cmd: TestCommand) => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return `Async: ${cmd.value}`;
        }),
      } as ICommandHandler<TestCommand, string>;
      
      commandBus.registerByName('TestCommand', asyncHandler);
      
      const command = new TestCommand('async test');
      const result = await commandBus.execute<string>(command);
      
      expect(result).toBe('Async: async test');
    });

    /**
     * @test Debe ejecutar diferentes handlers para diferentes comandos
     * @given Múltiples comandos con sus respectivos handlers
     * @when Se ejecutan los comandos
     * @then Cada comando debe ejecutar su handler correspondiente
     */
    it('debe ejecutar diferentes handlers para diferentes comandos', async () => {
      const handler1 = {
        execute: jest.fn<() => Promise<string>>().mockResolvedValue('result1'),
      } as ICommandHandler<TestCommand, string>;
      
      const handler2 = {
        execute: jest.fn<() => Promise<number>>().mockResolvedValue(999),
      } as ICommandHandler<AnotherTestCommand, number>;
      
      commandBus.registerByName('TestCommand', handler1);
      commandBus.registerByName('AnotherTestCommand', handler2);
      
      const command1 = new TestCommand('test1');
      const command2 = new AnotherTestCommand(123);
      
      const result1 = await commandBus.execute<string>(command1);
      const result2 = await commandBus.execute<number>(command2);
      
      expect(handler1.execute).toHaveBeenCalledWith(command1);
      expect(handler2.execute).toHaveBeenCalledWith(command2);
      expect(result1).toBe('result1');
      expect(result2).toBe(999);
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
      const handler = new TestCommandHandler();
      commandBus.registerByName('TestCommand', handler);
      
      const command = new TestCommand('test');
      expect(commandBus.hasHandler(command)).toBe(true);
    });

    /**
     * @test Debe retornar false cuando no existe un handler
     * @given Ningún handler registrado
     * @when Se verifica la existencia del handler
     * @then Debe retornar false
     */
    it('debe retornar false cuando no existe un handler', () => {
      const command = new TestCommand('test');
      expect(commandBus.hasHandler(command)).toBe(false);
    });

    /**
     * @test Debe usar el nombre del constructor del comando para verificación
     * @given Un comando con nombre de clase específico
     * @when Se verifica usando diferentes instancias del mismo comando
     * @then Todas las instancias deben dar el mismo resultado
     */
    it('debe usar el nombre del constructor del comando para verificación', () => {
      const handler = new TestCommandHandler();
      commandBus.registerByName('TestCommand', handler);
      
      const command1 = new TestCommand('value1');
      const command2 = new TestCommand('value2');
      
      expect(commandBus.hasHandler(command1)).toBe(true);
      expect(commandBus.hasHandler(command2)).toBe(true);
    });
  });

  /**
   * @description Suite de pruebas para casos edge y escenarios especiales
   */
  describe('Casos edge', () => {
    /**
     * @test Debe manejar comandos con valores null o undefined
     * @given Un comando con propiedades null/undefined
     * @when Se ejecuta el comando
     * @then Debe ejecutarse sin errores
     */
    it('debe manejar comandos con valores null o undefined', async () => {
      class NullableCommand implements ICommand {
        constructor(public readonly value: string | null) {}
      }
      
      const handler = {
        execute: jest.fn<() => Promise<string>>().mockResolvedValue('handled null'),
      } as ICommandHandler<NullableCommand, string>;
      
      commandBus.registerByName('NullableCommand', handler);
      
      const command = new NullableCommand(null);
      const result = await commandBus.execute<string>(command);
      
      expect(handler.execute).toHaveBeenCalledWith(command);
      expect(result).toBe('handled null');
    });

    /**
     * @test Debe manejar handlers que retornan void
     * @given Un handler que no retorna valor
     * @when Se ejecuta el comando
     * @then Debe ejecutarse sin errores y retornar undefined
     */
    it('debe manejar handlers que retornan void', async () => {
      const voidHandler = {
        execute: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      } as ICommandHandler<TestCommand, void>;
      
      commandBus.registerByName('TestCommand', voidHandler);
      
      const command = new TestCommand('test');
      const result = await commandBus.execute<void>(command);
      
      expect(result).toBeUndefined();
    });

    /**
     * @test Debe preservar el contexto this del handler
     * @given Un handler que usa this
     * @when Se ejecuta el comando
     * @then El contexto this debe preservarse
     */
    it('debe preservar el contexto this del handler', async () => {
      class StatefulHandler implements ICommandHandler<TestCommand, string> {
        private state = 'initial';
        
        async execute(command: TestCommand): Promise<string> {
          return `${this.state}: ${command.value}`;
        }
      }
      
      const handler = new StatefulHandler();
      commandBus.registerByName('TestCommand', handler);
      
      const command = new TestCommand('test');
      const result = await commandBus.execute<string>(command);
      
      expect(result).toBe('initial: test');
    });
  });
});