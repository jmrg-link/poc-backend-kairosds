import { Connection } from 'mongoose';
import ansiColors from 'ansi-colors';

/**
 * Configura eventos de conexión MongoDB
 * @param {Connection} connection - Conexión MongoDB
 * @param {string} dbName - Nombre de la BD
 */
export function setupConnectionEvents(connection: Connection, dbName: string): void {
  connection.on('connected', () => {
    console.log(ansiColors.green(`✓ Connected to ${dbName}`));
  });

  connection.on('error', err => {
    console.error(ansiColors.red(`✗ ${dbName} connection error:`), err);
  });

  connection.on('disconnected', () => {
    console.log(ansiColors.yellow(`⚠ Disconnected from ${dbName}`));
  });

  connection.on('reconnected', () => {
    console.log(ansiColors.green(`✓ Reconnected to ${dbName}`));
  });
}
