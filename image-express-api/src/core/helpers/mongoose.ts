import { Connection } from 'mongoose';
import ansiColors from 'ansi-colors';

/**
 * Reintenta conexión a MongoDB con backoff exponencial
 *
 * Implementa una estrategia de reconexión robusta con delays exponenciales
 * para manejar interrupciones temporales de la base de datos.
 *
 * @param connectFn - Función que retorna una promesa de conexión MongoDB
 * @param maxRetries - Número máximo de intentos de reconexión (default: 5)
 * @returns Promise que resuelve con la conexión establecida
 * @throws Error cuando se agotan todos los reintentos
 *
 * @example
 * ```typescript
 * const connection = await connectWithRetry(
 *   () => mongoose.connect(uri),
 *   3
 * );
 * ```
 */
export async function connectWithRetry(
  connectFn: () => Promise<Connection>,
  maxRetries: number = 5
): Promise<Connection> {
  let retries = 0;

  while (retries < maxRetries) {
    try {
      return await connectFn();
    } catch (error) {
      retries++;
      const delay = Math.min(1000 * Math.pow(2, retries), 30000);
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(
        ansiColors.yellow(
          `Retry ${retries}/${maxRetries} in ${delay}ms... (Error: ${errorMessage})`
        )
      );
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error('Max retries reached for MongoDB connection');
}

/**
 * Manejador de errores de conexión MongoDB
 *
 * Procesa y registra errores de conexión con formato estandarizado.
 * Utiliza colores ANSI para mejorar la legibilidad en consola.
 *
 * @param error - Error de conexión MongoDB capturado
 *
 * @example
 * ```typescript
 * try {
 *   await mongoose.connect(uri);
 * } catch (error) {
 *   handleConnectionError(error);
 * }
 * ```
 */
export function handleConnectionError(error: Error): void {
  console.error(ansiColors.red('MongoDB connection error:'), error.message);
  console.error(ansiColors.gray('Stack trace:'), error.stack);
}
