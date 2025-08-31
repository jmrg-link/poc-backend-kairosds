import dotenv from 'dotenv';
import { cleanEnv, str, port, num, bool } from 'envalid';

dotenv.config();

/**
 * Configuración de variables de entorno validadas
 * @constant envs
 */
const envConfig = cleanEnv(process.env, {
  NODE_ENV: str({ choices: ['development', 'test', 'production'], default: 'development' }),
  SERVER_PORT: port({ default: 3000 }),
  SERVER_API_VERSION: str({ default: 'v1' }),
  MONGODB_URI: str({
    default: 'mongodb://root:password@localhost:27017/imagedb?authSource=admin',
  }),
  REDIS_HOST: str({ default: 'localhost' }),
  REDIS_PORT: port({ default: 6379 }),
  REDIS_PASSWORD: str({ default: 'password' }),
  REDIS_DB: num({ default: 0 }),
  QUEUE_NAME: str({ default: 'image-processing' }),
  QUEUE_CONCURRENCY: num({ default: 5 }),
  QUEUE_MAX_RETRIES: num({ default: 3 }),
  STORAGE_INPUT_PATH: str({ default: '/app/uploads' }),
  STORAGE_OUTPUT_PATH: str({ default: '/app/output' }),
  API_KEY: str({ default: 'development-key' }),
  ENABLE_SWAGGER: bool({ default: true }),
  LOG_LEVEL: str({ choices: ['error', 'warn', 'info', 'debug'], default: 'info' }),
  LOKI_URL: str({
    default: '',
    desc: 'Loki URL for production logging (e.g., http://loki:3100)',
  }),
  LOKI_BATCH_SIZE: num({ default: 100 }),
  LOKI_BATCH_INTERVAL: num({ default: 5000 }),
  APP_VERSION: str({ default: '1.0.0' }),
});

export const envs = {
  NODE_ENV: envConfig.NODE_ENV,
  SERVER: {
    PORT: envConfig.SERVER_PORT,
    API_VERSION: envConfig.SERVER_API_VERSION,
  },
  MONGODB_URI: envConfig.MONGODB_URI,
  REDIS: {
    HOST: envConfig.REDIS_HOST,
    PORT: envConfig.REDIS_PORT,
    PASSWORD: envConfig.REDIS_PASSWORD,
    DB: envConfig.REDIS_DB,
  },
  QUEUE: {
    NAME: envConfig.QUEUE_NAME,
    CONCURRENCY: envConfig.QUEUE_CONCURRENCY,
    MAX_RETRIES: envConfig.QUEUE_MAX_RETRIES,
  },
  STORAGE: {
    INPUT_PATH: envConfig.STORAGE_INPUT_PATH,
    OUTPUT_PATH: envConfig.STORAGE_OUTPUT_PATH,
  },
  API_KEY: envConfig.API_KEY,
  ENABLE_SWAGGER: envConfig.ENABLE_SWAGGER,
  LOG_LEVEL: envConfig.LOG_LEVEL,
  LOKI: {
    URL: envConfig.LOKI_URL,
    BATCH_SIZE: envConfig.LOKI_BATCH_SIZE,
    BATCH_INTERVAL: envConfig.LOKI_BATCH_INTERVAL,
  },
  APP_VERSION: envConfig.APP_VERSION,
};
