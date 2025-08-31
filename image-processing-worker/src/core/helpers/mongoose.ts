import { Connection } from 'mongoose';
import ansiColors from 'ansi-colors';

/**
 * Reintenta conexión a MongoDB con backoff exponencial
 * @param {Function} connectFn - Función de conexión
 * @param {number} maxRetries - Máximo de reintentos
 * @returns {Promise<Connection>} Conexión establecida
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
      console.log(ansiColors.yellow(`Retry ${retries}/${maxRetries} in ${delay}ms...`));
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error('Max retries reached for MongoDB connection');
}

/**
 * Manejador de errores de conexión MongoDB
 * @param {Error} error - Error de conexión
 */
export function handleConnectionError(error: Error): void {
  console.error(ansiColors.red('MongoDB connection error:'), error.message);
}
