import { CacheService } from '../../../src/application/services/CacheService';
import { RedisCache } from '../../../src/infrastructure/cache/RedisCache';
import Redis from 'ioredis';

jest.mock('../../../src/infrastructure/cache/RedisCache');

/**
 * Suite de pruebas para CacheService
 * Verifica operaciones de caché cache-aside e invalidación por patrón
 */
describe('CacheService', () => {
  let cacheService: CacheService;
  let mockRedisCache: jest.Mocked<RedisCache>;
  let mockRedisClient: jest.Mocked<Pick<Redis, 'keys' | 'del'>>;

  /**
   * Configuración inicial para cada test
   * Inicializa mocks de RedisCache y cliente Redis
   */
  beforeEach(() => {
    mockRedisCache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    } as unknown as jest.Mocked<RedisCache>;

    mockRedisClient = {
      keys: jest.fn(),
      del: jest.fn(),
    };

    jest.mocked(RedisCache.getClient).mockReturnValue(mockRedisClient as unknown as Redis);

    cacheService = new CacheService(mockRedisCache);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Pruebas del constructor
   * Verifica correcta inyección de dependencias
   */
  describe('constructor', () => {
    /**
     * @test Debe crear instancia con RedisCache inyectado
     */
    it('debe crear instancia con RedisCache inyectado', () => {
      const service = new CacheService(mockRedisCache);
      expect(service).toBeInstanceOf(CacheService);
    });
  });

  /**
   * Pruebas del método getOrSet
   * Verifica implementación del patrón cache-aside
   */
  describe('getOrSet', () => {
    const testKey = 'test:key';
    const testValue = { id: 1, name: 'Test Object' };
    const testFn = jest.fn().mockResolvedValue(testValue);

    beforeEach(() => {
      testFn.mockClear();
    });

    /**
     * @test Debe retornar valor del caché cuando existe (cache hit)
     */
    it('debe retornar valor del caché cuando existe', async () => {
      const cachedValue = JSON.stringify(testValue);
      mockRedisCache.get.mockResolvedValue(cachedValue);

      const result = await cacheService.getOrSet(testKey, testFn);

      expect(result).toEqual(testValue);
      expect(mockRedisCache.get).toHaveBeenCalledWith(testKey);
      expect(testFn).not.toHaveBeenCalled();
      expect(mockRedisCache.set).not.toHaveBeenCalled();
    });

    /**
     * @test Debe calcular y guardar valor cuando no existe en caché (cache miss)
     */
    it('debe calcular y guardar valor cuando no existe en caché', async () => {
      mockRedisCache.get.mockResolvedValue(null);

      const result = await cacheService.getOrSet(testKey, testFn);

      expect(result).toEqual(testValue);
      expect(mockRedisCache.get).toHaveBeenCalledWith(testKey);
      expect(testFn).toHaveBeenCalledTimes(1);
      expect(mockRedisCache.set).toHaveBeenCalledWith(
        testKey,
        JSON.stringify(testValue),
        60
      );
    });

    /**
     * @test Debe usar TTL personalizado cuando se especifica
     */
    it('debe usar TTL personalizado cuando se especifica', async () => {
      const customTTL = 300;
      mockRedisCache.get.mockResolvedValue(null);

      await cacheService.getOrSet(testKey, testFn, customTTL);

      expect(mockRedisCache.set).toHaveBeenCalledWith(
        testKey,
        JSON.stringify(testValue),
        customTTL
      );
    });

    /**
     * @test Debe usar TTL por defecto de 60 segundos
     */
    it('debe usar TTL por defecto de 60 segundos', async () => {
      mockRedisCache.get.mockResolvedValue(null);

      await cacheService.getOrSet(testKey, testFn);

      expect(mockRedisCache.set).toHaveBeenCalledWith(
        testKey,
        JSON.stringify(testValue),
        60
      );
    });

    /**
     * @test Debe manejar diferentes tipos de datos
     */
    it('debe manejar diferentes tipos de datos', async () => {
      const stringValue = 'test string';
      const numberValue = 42;
      const arrayValue = [1, 2, 3];
      const booleanValue = true;

      mockRedisCache.get.mockResolvedValue(null);

      const stringFn = jest.fn().mockResolvedValue(stringValue);
      const numberFn = jest.fn().mockResolvedValue(numberValue);
      const arrayFn = jest.fn().mockResolvedValue(arrayValue);
      const booleanFn = jest.fn().mockResolvedValue(booleanValue);

      const stringResult = await cacheService.getOrSet('string:key', stringFn);
      const numberResult = await cacheService.getOrSet('number:key', numberFn);
      const arrayResult = await cacheService.getOrSet('array:key', arrayFn);
      const booleanResult = await cacheService.getOrSet('boolean:key', booleanFn);

      expect(stringResult).toBe(stringValue);
      expect(numberResult).toBe(numberValue);
      expect(arrayResult).toEqual(arrayValue);
      expect(booleanResult).toBe(booleanValue);
    });

    /**
     * @test Debe manejar objetos complejos
     */
    it('debe manejar objetos complejos', async () => {
      const complexObject = {
        id: 1,
        metadata: {
          created: '2023-01-01',
          tags: ['test', 'cache'],
        },
        values: [1, 2, 3],
        active: true,
      };

      mockRedisCache.get.mockResolvedValue(null);
      const complexFn = jest.fn().mockResolvedValue(complexObject);

      const result = await cacheService.getOrSet('complex:key', complexFn);

      expect(result).toEqual(complexObject);
      expect(mockRedisCache.set).toHaveBeenCalledWith(
        'complex:key',
        JSON.stringify(complexObject),
        60
      );
    });

    /**
     * @test Debe propagar errores de la función calculadora
     */
    it('debe propagar errores de la función calculadora', async () => {
      const error = new Error('Calculation failed');
      mockRedisCache.get.mockResolvedValue(null);
      const failingFn = jest.fn().mockRejectedValue(error);

      await expect(cacheService.getOrSet(testKey, failingFn)).rejects.toThrow(
        'Calculation failed'
      );

      expect(mockRedisCache.get).toHaveBeenCalledWith(testKey);
      expect(failingFn).toHaveBeenCalledTimes(1);
      expect(mockRedisCache.set).not.toHaveBeenCalled();
    });

    /**
     * @test Debe manejar errores de lectura del caché
     */
    it('debe manejar errores de lectura del caché', async () => {
      const cacheError = new Error('Redis connection failed');
      mockRedisCache.get.mockRejectedValue(cacheError);

      await expect(cacheService.getOrSet(testKey, testFn)).rejects.toThrow(
        'Redis connection failed'
      );

      expect(mockRedisCache.get).toHaveBeenCalledWith(testKey);
      expect(testFn).not.toHaveBeenCalled();
      expect(mockRedisCache.set).not.toHaveBeenCalled();
    });

    /**
     * @test Debe continuar cuando falla escritura al caché
     */
    it('debe continuar cuando falla escritura al caché', async () => {
      const cacheError = new Error('Cache write failed');
      mockRedisCache.get.mockResolvedValue(null);
      mockRedisCache.set.mockRejectedValue(cacheError);

      await expect(cacheService.getOrSet(testKey, testFn)).rejects.toThrow(
        'Cache write failed'
      );

      expect(mockRedisCache.get).toHaveBeenCalledWith(testKey);
      expect(testFn).toHaveBeenCalledTimes(1);
      expect(mockRedisCache.set).toHaveBeenCalledWith(
        testKey,
        JSON.stringify(testValue),
        60
      );
    });

    /**
     * @test Debe parsear correctamente JSON válido del caché
     */
    it('debe parsear correctamente JSON válido del caché', async () => {
      const cachedData = { cached: true, timestamp: Date.now() };
      mockRedisCache.get.mockResolvedValue(JSON.stringify(cachedData));

      const result = await cacheService.getOrSet(testKey, testFn);

      expect(result).toEqual(cachedData);
      expect(testFn).not.toHaveBeenCalled();
    });
  });

  /**
   * Pruebas del método invalidatePattern
   * Verifica invalidación de claves por patrón
   */
  describe('invalidatePattern', () => {
    const testPattern = 'test:*';

    /**
     * @test Debe eliminar claves que coinciden con el patrón
     */
    it('debe eliminar claves que coinciden con el patrón', async () => {
      const matchingKeys = ['test:key1', 'test:key2', 'test:key3'];
      mockRedisClient.keys.mockResolvedValue(matchingKeys);
      mockRedisClient.del.mockResolvedValue(3);

      await cacheService.invalidatePattern(testPattern);

      expect(RedisCache.getClient).toHaveBeenCalled();
      expect(mockRedisClient.keys).toHaveBeenCalledWith(testPattern);
      expect(mockRedisClient.del).toHaveBeenCalledWith(...matchingKeys);
    });

    /**
     * @test No debe hacer nada cuando no hay claves que coincidan
     */
    it('no debe hacer nada cuando no hay claves que coincidan', async () => {
      mockRedisClient.keys.mockResolvedValue([]);

      await cacheService.invalidatePattern(testPattern);

      expect(RedisCache.getClient).toHaveBeenCalled();
      expect(mockRedisClient.keys).toHaveBeenCalledWith(testPattern);
      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });

    /**
     * @test Debe manejar múltiples claves correctamente
     */
    it('debe manejar múltiples claves correctamente', async () => {
      const manyKeys = Array.from({ length: 10 }, (_, i) => `test:key${i}`);
      mockRedisClient.keys.mockResolvedValue(manyKeys);
      mockRedisClient.del.mockResolvedValue(10);

      await cacheService.invalidatePattern(testPattern);

      expect(mockRedisClient.keys).toHaveBeenCalledWith(testPattern);
      expect(mockRedisClient.del).toHaveBeenCalledWith(...manyKeys);
    });

    /**
     * @test Debe manejar diferentes patrones
     */
    it('debe manejar diferentes patrones', async () => {
      const patterns = ['user:*', 'session:*', 'task:*:images'];
      
      for (const pattern of patterns) {
        mockRedisClient.keys.mockResolvedValue([`${pattern.replace('*', '1')}`]);
        
        await cacheService.invalidatePattern(pattern);
        
        expect(mockRedisClient.keys).toHaveBeenCalledWith(pattern);
      }
    });

    /**
     * @test Debe propagar errores del comando keys
     */
    it('debe propagar errores del comando keys', async () => {
      const keysError = new Error('Keys command failed');
      mockRedisClient.keys.mockRejectedValue(keysError);

      await expect(cacheService.invalidatePattern(testPattern)).rejects.toThrow(
        'Keys command failed'
      );

      expect(mockRedisClient.keys).toHaveBeenCalledWith(testPattern);
      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });

    /**
     * @test Debe propagar errores del comando del
     */
    it('debe propagar errores del comando del', async () => {
      const deleteError = new Error('Delete command failed');
      const matchingKeys = ['test:key1', 'test:key2'];
      
      mockRedisClient.keys.mockResolvedValue(matchingKeys);
      mockRedisClient.del.mockRejectedValue(deleteError);

      await expect(cacheService.invalidatePattern(testPattern)).rejects.toThrow(
        'Delete command failed'
      );

      expect(mockRedisClient.keys).toHaveBeenCalledWith(testPattern);
      expect(mockRedisClient.del).toHaveBeenCalledWith(...matchingKeys);
    });

    /**
     * @test Debe manejar una sola clave correctamente
     */
    it('debe manejar una sola clave correctamente', async () => {
      const singleKey = ['test:single'];
      mockRedisClient.keys.mockResolvedValue(singleKey);
      mockRedisClient.del.mockResolvedValue(1);

      await cacheService.invalidatePattern(testPattern);

      expect(mockRedisClient.keys).toHaveBeenCalledWith(testPattern);
      expect(mockRedisClient.del).toHaveBeenCalledWith('test:single');
    });
  });

  /**
   * Pruebas de integración entre métodos
   * Verifica comportamiento conjunto de caché e invalidación
   */
  describe('Integración', () => {
    /**
     * @test Debe funcionar el flujo completo de caché e invalidación
     */
    it('debe funcionar el flujo completo de caché e invalidación', async () => {
      const key = 'integration:test';
      const pattern = 'integration:*';
      const value = { test: 'integration' };
      const computeFn = jest.fn().mockResolvedValue(value);

      mockRedisCache.get.mockResolvedValue(null);
      mockRedisClient.keys.mockResolvedValue([key]);
      mockRedisClient.del.mockResolvedValue(1);

      await cacheService.getOrSet(key, computeFn);
      await cacheService.invalidatePattern(pattern);

      expect(mockRedisCache.get).toHaveBeenCalledWith(key);
      expect(computeFn).toHaveBeenCalledTimes(1);
      expect(mockRedisCache.set).toHaveBeenCalledWith(
        key,
        JSON.stringify(value),
        60
      );
      expect(mockRedisClient.keys).toHaveBeenCalledWith(pattern);
      expect(mockRedisClient.del).toHaveBeenCalledWith(key);
    });

    /**
     * @test Debe manejar tipos genéricos correctamente
     */
    it('debe manejar tipos genéricos correctamente', async () => {
      interface TestInterface {
        id: number;
        name: string;
      }

      const testData: TestInterface = { id: 1, name: 'Generic Test' };
      const genericFn = jest.fn().mockResolvedValue(testData);
      
      mockRedisCache.get.mockResolvedValue(null);

      const result = await cacheService.getOrSet<TestInterface>('generic:key', genericFn);

      expect(result).toEqual(testData);
      expect(typeof result.id).toBe('number');
      expect(typeof result.name).toBe('string');
    });
  });
});