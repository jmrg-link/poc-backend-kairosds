/**
 * Logger centralizado de la aplicación con Winston y Loki
 * @module logger
 */
import winston from 'winston';
import LokiTransport from 'winston-loki';
import ansiColors from 'ansi-colors';
import { envs } from '@config/envs';

/**
 * Formato personalizado para consola en desarrollo
 * @returns {winston.Logform.Format} Formato de Winston para consola
 */
function createConsoleFormat(): winston.Logform.Format {
  return winston.format.printf(({ level, message, timestamp, ...metadata }) => {
    const coloredLevel = winston.format.colorize().colorize(level, level.toUpperCase());
    const timeStr = typeof timestamp === 'string' ? timestamp : new Date().toISOString();
    const time = ansiColors.gray(timeStr);

    let output = `${time} [${coloredLevel}]: ${message}`;

    if (Object.keys(metadata).length > 0 && metadata.metadata) {
      const meta = metadata.metadata;
      if (Object.keys(meta).length > 0) {
        output += `\n${ansiColors.cyan(JSON.stringify(meta, null, 2))}`;
      }
    }

    return output;
  });
}

/**
 * Crea transport de Loki para producción
 * @returns {LokiTransport | null} Transport de Loki o null si no está configurado
 */
function createLokiTransport(): LokiTransport | null {
  if (envs.NODE_ENV !== 'production' || !envs.LOKI.URL) {
    return null;
  }

  return new LokiTransport({
    host: envs.LOKI.URL,
    labels: {
      app: 'image-express-api',
      environment: envs.NODE_ENV,
      version: envs.APP_VERSION,
    },
    json: true,
    format: winston.format.json(),
    replaceTimestamp: true,
    batching: true,
    interval: envs.LOKI.BATCH_INTERVAL,
    onConnectionError: (err: Error) => {
      console.error('Loki connection error:', err);
    },
  });
}

/**
 * Logger centralizado de la aplicación
 */
export const logger = winston.createLogger({
  level: envs.LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] })
  ),
  defaultMeta: {
    service: 'image-express-api',
    hostname: process.env.HOSTNAME ?? 'unknown',
  },
  transports: [
    new winston.transports.Console({
      format:
        envs.NODE_ENV === 'production'
          ? winston.format.json()
          : winston.format.combine(winston.format.timestamp(), createConsoleFormat()),
    }),
  ],
});

const lokiTransport = createLokiTransport();
if (lokiTransport) {
  logger.add(lokiTransport);
  logger.info('Loki transport initialized');
}

/**
 * Logger para métricas específicas
 * @param {string} metric - Nombre de métrica
 * @param {number} value - Valor
 * @param {Record<string, unknown>} [labels] - Labels adicionales
 */
export function logMetric(metric: string, value: number, labels?: Record<string, unknown>): void {
  logger.info('metric', {
    metric,
    value,
    ...labels,
  });
}
