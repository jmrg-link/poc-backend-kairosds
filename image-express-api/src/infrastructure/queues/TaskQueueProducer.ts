import { Queue, Job } from 'bullmq';
import { RedisConnection } from '@infrastructure/cache/RedisConnection';
import { envs } from '@config/envs';

/**
 * @interface TaskJobData
 * @description Estructura de datos para los trabajos de procesamiento de imágenes
 */
interface TaskJobData {
  taskId: string;
  imagePath: string;
  timestamp: number;
}

/**
 * @interface QueueMock
 * @description Mock de cola para entorno de testing
 */
interface QueueMock {
  add: (name: string, data: TaskJobData, options?: object) => Promise<{ id: string }>;
  getJobCounts: (...states: string[]) => Promise<Record<string, number>>;
  getJobs: (states: string[], start: number, end: number, asc?: boolean) => Promise<Job[]>;
  remove: (jobId: string) => Promise<number>;
}

/**
 * @class TaskQueueProducer
 * @description Productor de cola para tareas de procesamiento de imágenes.
 * Gestiona la creación y encolado de trabajos utilizando BullMQ y Redis.
 * Implementa el patrón Singleton para asegurar una única instancia de cola.
 * @since 1.0.0
 */
export class TaskQueueProducer {
  /**
   * @private
   * @static
   * @property {Queue | QueueMock} queue - Instancia de la cola BullMQ o mock para testing
   */
  private static queue: Queue | QueueMock;

  /**
   * @private
   * @static
   * @property {boolean} initialized - Flag para controlar la inicialización única
   */
  private static initialized = false;

  /**
   * @constructor
   * @description Constructor que asegura la inicialización de la cola
   */
  constructor() {
    if (!TaskQueueProducer.initialized) {
      TaskQueueProducer.initializeQueue();
    }
  }

  /**
   * @private
   * @static
   * @method initializeQueue
   * @description Inicializa la cola de tareas conectando con Redis.
   * En entorno de testing, crea un mock para evitar dependencias externas.
   * @throws {Error} Si falla la inicialización en entorno no-test
   */
  private static initializeQueue(): void {
    if (!this.queue) {
      try {
        this.queue = new Queue(envs.QUEUE.NAME, {
          connection: RedisConnection.getConfig(),
        });
        this.initialized = true;
      } catch (error) {
        console.error('Error inicializando cola:', error);
        if (process.env.NODE_ENV === 'test') {
          this.queue = {
            add: (): Promise<{ id: string }> => Promise.resolve({ id: 'test-job-id' }),
            getJobCounts: (): Promise<Record<string, number>> => Promise.resolve({}),
            getJobs: (): Promise<Job[]> => Promise.resolve([]),
            remove: (): Promise<number> => Promise.resolve(1),
          } as QueueMock;
          this.initialized = true;
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * @static
   * @method initialize
   * @description Método público para inicializar manualmente la cola si es necesario
   * @returns {void}
   */
  static initialize(): void {
    this.initializeQueue();
  }

  /**
   * @method addTask
   * @description Añade una nueva tarea de procesamiento de imagen a la cola.
   * Configura reintentos automáticos y backoff exponencial para manejo de fallos.
   * @param {string} taskId - ID único de la tarea a procesar
   * @param {string} imagePath - Ruta del archivo de imagen a procesar
   * @returns {Promise<void>}
   * @throws {Error} Si la cola no está inicializada en entorno no-test
   */
  async addTask(taskId: string, imagePath: string): Promise<void> {
    if (!TaskQueueProducer.queue) {
      console.warn('Cola no inicializada, saltando encolado de tarea:', taskId);
      return;
    }

    await TaskQueueProducer.queue.add(
      'process-image',
      {
        taskId,
        imagePath,
        timestamp: Date.now(),
      },
      {
        attempts: envs.QUEUE.MAX_RETRIES,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      }
    );
  }

  /**
   * @static
   * @method getQueue
   * @description Obtiene la instancia de la cola, inicializándola si es necesario.
   * Utilizado principalmente por el controlador para operaciones de monitoreo.
   * @returns {Queue | QueueMock} La instancia de la cola
   */
  static getQueue(): Queue | QueueMock {
    if (!this.queue) {
      this.initializeQueue();
    }
    return this.queue;
  }
}
