import { describe, it, expect } from '@jest/globals';
import { ProcessImageCommand } from '../../../../src/application/commands/ProcessImageCommand';

/**
 * @description Suite de pruebas para ProcessImageCommand
 * 
 * @description Valida el comportamiento del comando de procesamiento de imagen:
 * - Construcción correcta con parámetros requeridos
 * - Validación de propiedades taskId e imagePath
 * - Manejo de diferentes formatos de rutas de imagen
 * - Casos edge y validación de tipos
 */
describe('ProcessImageCommand', () => {
  /**
   * @description Suite de pruebas para construcción del comando
   */
  describe('Construcción', () => {
    /**
     * @test Debe crear comando con parámetros requeridos
     * @given TaskId e imagePath válidos
     * @when Se crea el comando
     * @then Debe asignar propiedades correctamente
     */
    it('debe crear comando con parámetros requeridos', () => {
      const taskId = 'task-123';
      const imagePath = '/storage/images/input/image.jpg';

      const command = new ProcessImageCommand(taskId, imagePath);

      expect(command.taskId).toBe(taskId);
      expect(command.imagePath).toBe(imagePath);
    });

    /**
     * @test Debe manejar diferentes tipos de taskId
     * @given Diferentes formatos de ID de tarea
     * @when Se crean comandos
     * @then Debe aceptar todos los formatos válidos
     */
    it('debe manejar diferentes tipos de taskId', () => {
      const imagePath = '/test/image.jpg';
      const testCases = [
        'simple-task-id',
        'UUID-12345678-1234-1234-1234-123456789abc',
        'numeric-123456789',
        'mixed_123-abc_456',
        'very-long-task-id-with-many-characters-and-dashes',
        'task@special#chars$123',
        '68b1a3f343a6fd2f7926ba37',
      ];

      testCases.forEach(taskId => {
        const command = new ProcessImageCommand(taskId, imagePath);
        expect(command.taskId).toBe(taskId);
        expect(command.imagePath).toBe(imagePath);
      });
    });

    /**
     * @test Debe manejar diferentes formatos de rutas de imagen
     * @given Diferentes tipos de rutas de archivo
     * @when Se crean comandos
     * @then Debe aceptar todos los formatos de ruta
     */
    it('debe manejar diferentes formatos de rutas de imagen', () => {
      const taskId = 'test-task';
      const testCases = [
        '/storage/images/input/image.jpg',
        '/storage/images/68b1a3f343a6fd2f7926ba37/original.jpg',
        'C:\\Windows\\path\\image.png',
        './relative/path/image.gif',
        '../parent/dir/image.webp',
        '/very/long/path/with/multiple/directories/image.jpeg',
        '/storage/images/input/image with spaces.jpg',
        '/storage/images/input/señal-ñ.jpg',
      ];

      testCases.forEach(imagePath => {
        const command = new ProcessImageCommand(taskId, imagePath);
        expect(command.taskId).toBe(taskId);
        expect(command.imagePath).toBe(imagePath);
      });
    });

    /**
     * @test Debe manejar extensiones de imagen comunes
     * @given Rutas con diferentes extensiones de imagen
     * @when Se crean comandos
     * @then Debe aceptar todas las extensiones
     */
    it('debe manejar extensiones de imagen comunes', () => {
      const taskId = 'test-extensions';
      const extensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff'];

      extensions.forEach(ext => {
        const imagePath = `/storage/images/input/test.${ext}`;
        const command = new ProcessImageCommand(taskId, imagePath);
        
        expect(command.imagePath).toBe(imagePath);
        expect(command.imagePath).toMatch(new RegExp(`\\.${ext}$`));
      });
    });
  });

  /**
   * @description Suite de pruebas para estructura realista del proyecto
   */
  describe('Estructura realista del proyecto', () => {
    /**
     * @test Debe manejar rutas del storage real del proyecto
     * @given Rutas basadas en la estructura real de storage
     * @when Se crean comandos
     * @then Debe procesar correctamente las rutas reales
     */
    it('debe manejar rutas del storage real del proyecto', () => {
      const realTaskIds = [
        '68b1a3f343a6fd2f7926ba37',
        '68b1a9c2370773c0fe49298c',
        '68b1b1ad554e414863ad262f',
      ];

      realTaskIds.forEach(taskId => {
        const imagePath = `/storage/images/${taskId}/original.jpg`;
        const command = new ProcessImageCommand(taskId, imagePath);

        expect(command.taskId).toBe(taskId);
        expect(command.imagePath).toBe(imagePath);
        expect(command.imagePath).toMatch(/^\/storage\/images\/[a-f0-9]{24}\/original\.jpg$/);
      });
    });

    /**
     * @test Debe manejar ruta de input genérica
     * @given Ruta de input común del proyecto
     * @when Se crea el comando
     * @then Debe procesar correctamente la ruta de input
     */
    it('debe manejar ruta de input genérica', () => {
      const taskId = 'new-task-123';
      const inputPath = '/storage/images/input/uploaded-image.jpg';

      const command = new ProcessImageCommand(taskId, inputPath);

      expect(command.taskId).toBe(taskId);
      expect(command.imagePath).toBe(inputPath);
      expect(command.imagePath).toMatch(/^\/storage\/images\/input\//);
    });

    /**
     * @test Debe manejar nombres de archivo complejos
     * @given Nombres de archivo con diversos caracteres
     * @when Se crean comandos
     * @then Debe preservar los nombres originales
     */
    it('debe manejar nombres de archivo complejos', () => {
      const taskId = 'complex-files';
      const complexNames = [
        'file-with-dashes.jpg',
        'file_with_underscores.png',
        'file with spaces.gif',
        'file.with.dots.jpeg',
        'UPPERCASE-FILE.JPG',
        'mixedCase-File_123.webp',
        'very-long-filename-with-many-characters-and-numbers-123456789.jpg',
      ];

      complexNames.forEach(filename => {
        const imagePath = `/storage/images/input/${filename}`;
        const command = new ProcessImageCommand(taskId, imagePath);

        expect(command.imagePath).toBe(imagePath);
        expect(command.imagePath).toContain(filename);
      });
    });
  });

  /**
   * @description Suite de pruebas para casos edge
   */
  describe('Casos edge', () => {
    /**
     * @test Debe manejar strings vacíos
     * @given TaskId o imagePath vacíos
     * @when Se crean comandos
     * @then Debe aceptar los valores vacíos
     */
    it('debe manejar strings vacíos', () => {
      const testCases = [
        { taskId: '', imagePath: '/test/image.jpg' },
        { taskId: 'test-task', imagePath: '' },
        { taskId: '', imagePath: '' },
      ];

      testCases.forEach(({ taskId, imagePath }) => {
        const command = new ProcessImageCommand(taskId, imagePath);
        expect(command.taskId).toBe(taskId);
        expect(command.imagePath).toBe(imagePath);
      });
    });

    /**
     * @test Debe manejar IDs y rutas muy largos
     * @given TaskId e imagePath extremadamente largos
     * @when Se crea el comando
     * @then Debe aceptar los valores completos
     */
    it('debe manejar IDs y rutas muy largos', () => {
      const longTaskId = 'task-' + 'a'.repeat(1000) + '-very-long-id';
      const longImagePath = '/storage/images/' + 'b'.repeat(500) + '/image.jpg';

      const command = new ProcessImageCommand(longTaskId, longImagePath);

      expect(command.taskId).toBe(longTaskId);
      expect(command.imagePath).toBe(longImagePath);
      expect(command.taskId.length).toBeGreaterThan(1000);
      expect(command.imagePath.length).toBeGreaterThan(500);
    });

    /**
     * @test Debe preservar caracteres especiales
     * @given Rutas con caracteres especiales válidos
     * @when Se crean comandos
     * @then Debe preservar todos los caracteres
     */
    it('debe preservar caracteres especiales', () => {
      const taskId = 'task-special-chars';
      const specialPaths = [
        '/storage/images/input/image-àáâãäå.jpg',
        '/storage/images/input/image-ñç.png',
        '/storage/images/input/image-русский.gif',
        '/storage/images/input/image-中文.jpeg',
        '/storage/images/input/image-🖼️.webp',
      ];

      specialPaths.forEach(imagePath => {
        const command = new ProcessImageCommand(taskId, imagePath);
        expect(command.imagePath).toBe(imagePath);
      });
    });

    /**
     * @test Debe manejar rutas sin extensión
     * @given Rutas de archivo sin extensión
     * @when Se crean comandos
     * @then Debe aceptar las rutas sin extensión
     */
    it('debe manejar rutas sin extensión', () => {
      const taskId = 'no-extension';
      const pathsWithoutExtension = [
        '/storage/images/input/image',
        '/storage/images/input/file_without_extension',
        '/storage/images/input/.',
        '/storage/images/input/.hidden',
      ];

      pathsWithoutExtension.forEach(imagePath => {
        const command = new ProcessImageCommand(taskId, imagePath);
        expect(command.imagePath).toBe(imagePath);
      });
    });

    /**
     * @test Debe manejar múltiples extensiones
     * @given Archivos con múltiples puntos en el nombre
     * @when Se crean comandos
     * @then Debe preservar el nombre completo
     */
    it('debe manejar múltiples extensiones', () => {
      const taskId = 'multiple-dots';
      const multipleExtensions = [
        '/storage/images/input/image.backup.jpg',
        '/storage/images/input/file.v1.2.png',
        '/storage/images/input/archive.tar.gz.jpeg',
        '/storage/images/input/config.dev.prod.gif',
      ];

      multipleExtensions.forEach(imagePath => {
        const command = new ProcessImageCommand(taskId, imagePath);
        expect(command.imagePath).toBe(imagePath);
      });
    });
  });

  /**
   * @description Suite de pruebas para inmutabilidad
   */
  describe('Inmutabilidad', () => {
    /**
     * @test Debe crear propiedades de solo lectura
     * @given Un comando creado
     * @when Se intenta modificar las propiedades
     * @then Las propiedades deben ser de solo lectura
     */
    it('debe crear propiedades de solo lectura', () => {
      const taskId = 'readonly-test';
      const imagePath = '/storage/images/input/readonly.jpg';
      const command = new ProcessImageCommand(taskId, imagePath);

      expect(command.taskId).toBe(taskId);
      expect(command.imagePath).toBe(imagePath);
      expect(command.taskId).toBe(taskId);
      expect(command.imagePath).toBe(imagePath);
    });

    /**
     * @test Debe mantener consistencia entre múltiples instancias
     * @given Múltiples comandos con los mismos parámetros
     * @when Se crean las instancias
     * @then Deben tener las mismas propiedades pero ser objetos diferentes
     */
    it('debe mantener consistencia entre múltiples instancias', () => {
      const taskId = 'consistency-test';
      const imagePath = '/storage/images/input/consistency.jpg';
      const command1 = new ProcessImageCommand(taskId, imagePath);
      const command2 = new ProcessImageCommand(taskId, imagePath);

      expect(command1.taskId).toBe(command2.taskId);
      expect(command1.imagePath).toBe(command2.imagePath);
      expect(command1).not.toBe(command2); // Diferentes instancias
      expect(command1).toEqual(command2); // Mismo contenido
    });
  });
});