import { describe, it, expect } from '@jest/globals';
import { CreateTaskCommand } from '../../../../src/application/commands/CreateTaskCommand';
import { TaskStatus } from '../../../../src/domain/entities/TaskEntity';

/**
 * @description Suite de pruebas para CreateTaskCommand
 * 
 * @description Valida el comportamiento del comando de creación de tareas:
 * - Construcción correcta con parámetros requeridos y opcionales
 * - Conversión correcta a entidad TaskEntity
 * - Manejo de clave de idempotencia opcional
 * - Validación de tipos y propiedades
 */
describe('CreateTaskCommand', () => {
  /**
   * @description Suite de pruebas para construcción del comando
   */
  describe('Construcción', () => {
    /**
     * @test Debe crear comando con parámetros requeridos
     * @given Parámetros mínimos requeridos
     * @when Se crea el comando
     * @then Debe asignar propiedades correctamente
     */
    it('debe crear comando con parámetros requeridos', () => {
      const imagePath = '/test/image.jpg';
      const price = 25;

      const command = new CreateTaskCommand(imagePath, price);

      expect(command.imagePath).toBe(imagePath);
      expect(command.price).toBe(price);
      expect(command.idempotencyKey).toBeUndefined();
    });

    /**
     * @test Debe crear comando con clave de idempotencia
     * @given Parámetros completos incluyendo idempotencyKey
     * @when Se crea el comando
     * @then Debe asignar todas las propiedades
     */
    it('debe crear comando con clave de idempotencia', () => {
      const imagePath = '/test/image-with-key.jpg';
      const price = 30;
      const idempotencyKey = 'unique-key-123';

      const command = new CreateTaskCommand(imagePath, price, idempotencyKey);

      expect(command.imagePath).toBe(imagePath);
      expect(command.price).toBe(price);
      expect(command.idempotencyKey).toBe(idempotencyKey);
    });

    /**
     * @test Debe manejar diferentes tipos de rutas
     * @given Diferentes formatos de rutas de imagen
     * @when Se crean comandos
     * @then Debe aceptar todos los formatos válidos
     */
    it('debe manejar diferentes tipos de rutas', () => {
      const testCases = [
        '/absolute/path/image.jpg',
        'relative/path/image.png',
        './current/dir/image.gif',
        '../parent/dir/image.webp',
        'C:\\Windows\\path\\image.bmp',
        '/very/long/path/with/multiple/directories/and/subdirectories/image.jpeg',
      ];

      testCases.forEach(imagePath => {
        const command = new CreateTaskCommand(imagePath, 25);
        expect(command.imagePath).toBe(imagePath);
      });
    });

    /**
     * @test Debe manejar diferentes rangos de precios
     * @given Diferentes valores de precio
     * @when Se crean comandos
     * @then Debe aceptar todos los valores numéricos
     */
    it('debe manejar diferentes rangos de precios', () => {
      const testCases = [
        1,     // mínimo
        25,    // típico
        50,    // máximo típico
        100,   // alto
        0.5,   // decimal
        999.99 // decimal alto
      ];

      testCases.forEach(price => {
        const command = new CreateTaskCommand('/test/image.jpg', price);
        expect(command.price).toBe(price);
      });
    });

    /**
     * @test Debe manejar diferentes tipos de claves de idempotencia
     * @given Diferentes formatos de claves
     * @when Se crean comandos
     * @then Debe aceptar todos los formatos
     */
    it('debe manejar diferentes tipos de claves de idempotencia', () => {
      const testCases = [
        'simple-key',
        'UUID-like-12345678-1234-1234-1234-123456789abc',
        'user123_task456',
        'very-long-idempotency-key-with-many-characters-and-dashes',
        '123456789',
        'special@key#with$symbols',
      ];

      testCases.forEach(idempotencyKey => {
        const command = new CreateTaskCommand('/test/image.jpg', 25, idempotencyKey);
        expect(command.idempotencyKey).toBe(idempotencyKey);
      });
    });
  });

  /**
   * @description Suite de pruebas para conversión a entidad
   */
  describe('toEntity', () => {
    /**
     * @test Debe convertir a entidad con status PENDING
     * @given Un comando válido
     * @when Se convierte a entidad
     * @then Debe crear entidad con status PENDING
     */
    it('debe convertir a entidad con status PENDING', () => {
      const command = new CreateTaskCommand('/test/convert.jpg', 35, 'convert-key');

      const entity = command.toEntity();

      expect(entity.status).toBe(TaskStatus.PENDING);
      expect(entity.price).toBe(35);
      expect(entity.originalPath).toBe('/test/convert.jpg');
      expect(entity.idempotencyKey).toBe('convert-key');
      expect(entity.images).toEqual([]);
    });

    /**
     * @test Debe convertir a entidad sin clave de idempotencia
     * @given Un comando sin idempotencyKey
     * @when Se convierte a entidad
     * @then Debe crear entidad con idempotencyKey undefined
     */
    it('debe convertir a entidad sin clave de idempotencia', () => {
      const command = new CreateTaskCommand('/test/no-key.jpg', 20);

      const entity = command.toEntity();

      expect(entity.status).toBe(TaskStatus.PENDING);
      expect(entity.price).toBe(20);
      expect(entity.originalPath).toBe('/test/no-key.jpg');
      expect(entity.idempotencyKey).toBeUndefined();
      expect(entity.images).toEqual([]);
    });

    /**
     * @test Debe inicializar array de imágenes vacío
     * @given Cualquier comando válido
     * @when Se convierte a entidad
     * @then Debe inicializar images como array vacío
     */
    it('debe inicializar array de imágenes vacío', () => {
      const command = new CreateTaskCommand('/test/images-empty.jpg', 40);

      const entity = command.toEntity();

      expect(entity.images).toEqual([]);
      expect(Array.isArray(entity.images)).toBe(true);
      expect(entity.images?.length).toBe(0);
    });

    /**
     * @test Debe mantener coherencia en conversiones múltiples
     * @given Un comando específico
     * @when Se convierte a entidad múltiples veces
     * @then Debe producir el mismo resultado cada vez
     */
    it('debe mantener coherencia en conversiones múltiples', () => {
      const command = new CreateTaskCommand('/test/consistency.jpg', 15, 'consistent-key');

      const entity1 = command.toEntity();
      const entity2 = command.toEntity();
      const entity3 = command.toEntity();

      expect(entity1).toEqual(entity2);
      expect(entity2).toEqual(entity3);
      expect(entity1).toEqual(entity3);
    });

    /**
     * @test Debe crear entidad con propiedades inmutables
     * @given Un comando convertido a entidad
     * @when Se modifica la entidad resultante
     * @then No debe afectar conversiones posteriores
     */
    it('debe crear entidad con propiedades inmutables', () => {
      const command = new CreateTaskCommand('/test/immutable.jpg', 45, 'immutable-key');

      const entity1 = command.toEntity();
      entity1.price = 999; // Modificar entidad
      entity1.images?.push({ resolution: '1024', path: '/fake/path.jpg' });

      const entity2 = command.toEntity();

      expect(entity2.price).toBe(45); // Debe mantener valor original
      expect(entity2.images).toEqual([]); // Debe mantener array vacío
    });
  });

  /**
   * @description Suite de pruebas para casos edge
   */
  describe('Casos edge', () => {
    /**
     * @test Debe manejar string vacío como imagePath
     * @given Un imagePath string vacío
     * @when Se crea el comando
     * @then Debe aceptar el valor
     */
    it('debe manejar string vacío como imagePath', () => {
      const command = new CreateTaskCommand('', 25);

      expect(command.imagePath).toBe('');
      
      const entity = command.toEntity();
      expect(entity.originalPath).toBe('');
    });

    /**
     * @test Debe manejar precio cero
     * @given Un precio de 0
     * @when Se crea el comando
     * @then Debe aceptar el valor
     */
    it('debe manejar precio cero', () => {
      const command = new CreateTaskCommand('/test/zero-price.jpg', 0);

      expect(command.price).toBe(0);
      
      const entity = command.toEntity();
      expect(entity.price).toBe(0);
    });

    /**
     * @test Debe manejar string vacío como idempotencyKey
     * @given Un idempotencyKey string vacío
     * @when Se crea el comando
     * @then Debe aceptar el valor
     */
    it('debe manejar string vacío como idempotencyKey', () => {
      const command = new CreateTaskCommand('/test/empty-key.jpg', 30, '');

      expect(command.idempotencyKey).toBe('');
      
      const entity = command.toEntity();
      expect(entity.idempotencyKey).toBe('');
    });

    /**
     * @test Debe manejar números negativos como precio
     * @given Un precio negativo
     * @when Se crea el comando
     * @then Debe aceptar el valor (validación debe ser en otra capa)
     */
    it('debe manejar números negativos como precio', () => {
      const command = new CreateTaskCommand('/test/negative.jpg', -10);

      expect(command.price).toBe(-10);
      
      const entity = command.toEntity();
      expect(entity.price).toBe(-10);
    });

    /**
     * @test Debe manejar rutas muy largas
     * @given Una ruta extremadamente larga
     * @when Se crea el comando
     * @then Debe aceptar la ruta completa
     */
    it('debe manejar rutas muy largas', () => {
      const longPath = '/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/very/long/path/to/an/image/file/with/many/nested/directories/and/subdirectories/image.jpg';
      
      const command = new CreateTaskCommand(longPath, 25);

      expect(command.imagePath).toBe(longPath);
      
      const entity = command.toEntity();
      expect(entity.originalPath).toBe(longPath);
    });
  });
});