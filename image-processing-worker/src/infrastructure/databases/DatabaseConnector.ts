import mongoose, { ConnectOptions, Connection } from 'mongoose';
import { setupConnectionEvents } from './connectionEvents';
import ansiColors from 'ansi-colors';

/**
 * Conector principal de base de datos MongoDB
 * @class DatabaseConnector
 */
export class DatabaseConnector {
  private static imageDb: Connection;

  /**
   * Inicializa conexión a MongoDB
   * @static
   * @param {string} mongoUri - URI de conexión
   * @returns {Promise<void>}
   */
  public static async initialize(mongoUri: string): Promise<void> {
    console.log(ansiColors.blue('Connecting to MongoDB...'));

    this.imageDb = mongoose.createConnection(mongoUri, {
      dbName: 'imagedb',
      family: 4,
      authSource: 'admin',
      readPreference: 'secondaryPreferred',
      retryWrites: true,
      autoIndex: false,
    } as ConnectOptions);

    setupConnectionEvents(this.imageDb, 'imagedb');
    await this.imageDb.asPromise();
  }

  /**
   * Desconecta de MongoDB
   * @static
   * @returns {Promise<void>}
   */
  public static async disconnect(): Promise<void> {
    await this.imageDb.close();
  }

  /**
   * Obtiene la conexión de imageDb
   * @static
   * @returns {Connection} Conexión MongoDB
   * @throws {Error} Si no está inicializada
   */
  public static getImageDb(): Connection {
    if (!this.imageDb) {
      throw new Error('ImageDb connection not initialized');
    }
    return this.imageDb;
  }
}
