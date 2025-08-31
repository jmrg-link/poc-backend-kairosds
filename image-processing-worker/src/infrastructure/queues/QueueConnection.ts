import { QueueEvents } from 'bullmq';
import { RedisConnection } from '@infrastructure/cache/RedisConnection';

/**
 * Gestor de conexión de colas
 * @class QueueConnection
 */
export class QueueConnection {
  private static events: QueueEvents;

  /**
   * Inicializa eventos de cola
   * @static
   * @param {string} queueName - Nombre de la cola
   */
  static initializeEvents(queueName: string): void {
    this.events = new QueueEvents(queueName, {
      connection: RedisConnection.getConfig(),
    });
  }

  /**
   * Obtiene eventos de cola
   * @static
   * @returns {QueueEvents} Eventos de cola
   */
  static getEvents(): QueueEvents {
    return this.events;
  }
}
