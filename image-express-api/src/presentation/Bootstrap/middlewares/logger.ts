/**
 * Middleware de logging HTTP con formato enriquecido
 * @module httpLogger
 */
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import ansiColors from 'ansi-colors';
import { logger as winstonLogger } from '@core/helpers/logger';
import { envs } from '@config/envs';

/**
 * Campos sensibles a filtrar en headers
 */
const SENSITIVE_HEADERS = ['authorization', 'cookie', 'x-api-key'] as const;

/**
 * Campos sensibles a filtrar en body
 */
const SENSITIVE_BODY_FIELDS = ['password', 'token', 'apiKey', 'secret'] as const;

/**
 * Configuración de límites para logs
 */
const LOG_LIMITS = {
  MAX_BODY_LENGTH: 500,
  MAX_STRING_LENGTH: 200,
  MAX_ARRAY_ITEMS: 10,
  MAX_OBJECT_KEYS: 20,
} as const;

/**
 * URLs a excluir del logging detallado
 */
const EXCLUDED_PATHS = ['/api-docs', '/swagger-ui', '/favicon.ico', '/health', '/metrics'] as const;

/**
 * Tipo para objetos genéricos de request/response
 */
type RequestData = Record<string, unknown>;

/**
 * Verifica si una ruta debe ser excluida del logging detallado
 * @param {string} path - Ruta a verificar
 * @returns {boolean} True si debe ser excluida
 */
function isExcludedPath(path: string): boolean {
  return EXCLUDED_PATHS.some(excluded => path.startsWith(excluded));
}

/**
 * Trunca un string si excede la longitud máxima
 * @param {string} str - String a truncar
 * @param {number} maxLength - Longitud máxima
 * @returns {string} String truncado
 */
function truncateString(str: string, maxLength: number = LOG_LIMITS.MAX_STRING_LENGTH): string {
  if (str.length <= maxLength) return str;
  return `${str.substring(0, maxLength)}... [truncated ${str.length - maxLength} chars]`;
}

/**
 * Trunca contenido recursivamente
 * @param {unknown} obj - Objeto a truncar
 * @param {number} depth - Profundidad actual
 * @returns {unknown} Objeto truncado
 */
function truncateContent(obj: unknown, depth: number = 0): unknown {
  if (depth > 3) return '[Max depth reached]';
  if (typeof obj === 'string') {
    return truncateString(obj);
  }

  if (Array.isArray(obj)) {
    if (obj.length > LOG_LIMITS.MAX_ARRAY_ITEMS) {
      return [
        ...obj.slice(0, LOG_LIMITS.MAX_ARRAY_ITEMS).map(item => truncateContent(item, depth + 1)),
        `... [${obj.length - LOG_LIMITS.MAX_ARRAY_ITEMS} more items]`,
      ];
    }
    return obj.map(item => truncateContent(item, depth + 1));
  }

  if (obj && typeof obj === 'object') {
    const keys = Object.keys(obj);
    if (keys.length > LOG_LIMITS.MAX_OBJECT_KEYS) {
      const truncated: Record<string, unknown> = {};
      keys.slice(0, LOG_LIMITS.MAX_OBJECT_KEYS).forEach(key => {
        truncated[key] = truncateContent((obj as Record<string, unknown>)[key], depth + 1);
      });
      truncated['...'] = `[${keys.length - LOG_LIMITS.MAX_OBJECT_KEYS} more keys]`;
      return truncated;
    }

    const result: Record<string, unknown> = {};
    keys.forEach(key => {
      result[key] = truncateContent((obj as Record<string, unknown>)[key], depth + 1);
    });
    return result;
  }

  return obj;
}

/**
 * Filtra campos sensibles de un objeto
 * @param {RequestData | null | undefined} obj - Objeto a filtrar
 * @param {ReadonlyArray<string>} fieldsToFilter - Campos a filtrar
 * @returns {RequestData} Objeto filtrado
 */
function filterSensitiveData(
  obj: RequestData | null | undefined,
  fieldsToFilter: ReadonlyArray<string>
): RequestData {
  if (!obj || typeof obj !== 'object') return {};

  const result: RequestData = {};

  for (const [key, value] of Object.entries(obj)) {
    if (fieldsToFilter.includes(key.toLowerCase())) {
      result[key] = '[FILTERED]';
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Formatea un objeto para su visualización
 * @param {unknown} obj - Objeto a formatear
 * @param {boolean} truncate - Si se debe truncar el contenido
 * @returns {string} Cadena JSON formateada
 */
function formatObject(obj: unknown, truncate: boolean = true): string {
  if (!obj || (typeof obj === 'object' && Object.keys(obj).length === 0)) {
    return '{}';
  }

  try {
    const content = truncate ? truncateContent(obj) : obj;
    return JSON.stringify(content, null, 2);
  } catch {
    return '[Error al serializar objeto]';
  }
}

/**
 * Formatea la solicitud para consola con colores
 * @param {string} requestId - ID de la solicitud
 * @param {Request} req - Request de Express
 * @param {RequestData} filteredHeaders - Headers filtrados
 * @param {RequestData} filteredBody - Body filtrado
 * @returns {string} String formateado para consola
 */
function formatConsoleRequest(
  requestId: string,
  req: Request,
  filteredHeaders: RequestData,
  filteredBody: RequestData
): string {
  return [
    `🌐 ${ansiColors.bold.cyan('REQUEST')} [${ansiColors.yellow(requestId)}] ${ansiColors.bold.cyan(`${req.method} ${req.url}`)}`,
    `${ansiColors.gray(new Date().toISOString())} | ${ansiColors.yellow(`IP: ${req.ip}`)}`,
    '',
    `${ansiColors.magenta('📝 Params:')}`,
    `${formatObject(req.params)}`,
    '',
    `${ansiColors.magenta('❓ Query:')}`,
    `${formatObject(req.query)}`,
    '',
    `${ansiColors.magenta('📨 Headers:')}`,
    `${formatObject(filteredHeaders)}`,
    '',
    `${ansiColors.magenta('📦 Body:')}`,
    `${formatObject(filteredBody)}`,
  ].join('\n');
}

/**
 * Formatea la respuesta para consola con colores
 * @param {string} requestId - ID de la solicitud
 * @param {Request} req - Request de Express
 * @param {Response} res - Response de Express
 * @param {unknown} responseBody - Body de la respuesta
 * @param {string} responseTime - Tiempo de respuesta
 * @returns {string} String formateado para consola
 */
function formatConsoleResponse(
  requestId: string,
  req: Request,
  res: Response,
  responseBody: unknown,
  responseTime: string
): string {
  const statusCode = res.statusCode;
  const isError = statusCode >= 400;
  const statusEmoji = isError ? '❌' : '✅';
  const statusColor = isError ? ansiColors.red : ansiColors.green;

  return [
    `${statusEmoji} ${ansiColors.bold.cyan('RESPONSE')} [${ansiColors.yellow(requestId)}] ${ansiColors.bold.cyan(`${req.method} ${req.url}`)}`,
    `${ansiColors.gray(new Date().toISOString())} | ${statusColor(`Status: ${statusCode}`)} | ${ansiColors.yellow(`Time: ${responseTime}ms`)}`,
    '',
    `${ansiColors.magenta('📦 Response Body:')}`,
    `${formatObject(responseBody)}`,
  ].join('\n');
}

/**
 * Middleware de registro para Express con formato enriquecido
 * @param {Request} req - Objeto de solicitud
 * @param {Response} res - Objeto de respuesta
 * @param {NextFunction} next - Función para continuar
 */
export function httpLogger(req: Request, res: Response, next: NextFunction): void {
  const requestId = uuidv4().substring(0, 8);
  const startTime = process.hrtime();
  const { method, url, ip } = req;
  const isExcluded = isExcludedPath(req.path);

  if (isExcluded && envs.NODE_ENV === 'production') {
    const originalSend = res.send;
    res.send = function (body?: unknown): Response {
      res.send = originalSend;
      const hrTime = process.hrtime(startTime);
      const responseTime = (hrTime[0] * 1000 + hrTime[1] / 1000000).toFixed(2);

      winstonLogger.info('Request processed', {
        requestId,
        method,
        url,
        statusCode: res.statusCode,
        responseTime: `${responseTime}ms`,
        excluded: true,
      });

      return originalSend.call(this, body);
    };
    next();
    return;
  }

  const filteredHeaders = filterSensitiveData(req.headers as RequestData, SENSITIVE_HEADERS);
  const filteredBody = filterSensitiveData(req.body as RequestData, SENSITIVE_BODY_FIELDS);
  const requestLog = {
    requestId,
    method,
    url,
    ip,
    params: truncateContent(req.params),
    query: truncateContent(req.query),
    headers: truncateContent(filteredHeaders),
    body: truncateContent(filteredBody),
  };

  if (envs.NODE_ENV === 'development' && !isExcluded) {
    console.log(formatConsoleRequest(requestId, req, filteredHeaders, filteredBody));
  }

  winstonLogger.info(`Incoming request [${requestId}]`, requestLog);

  if (!res.locals.loggerIntercepted) {
    res.locals.loggerIntercepted = true;
    const originalSend = res.send;

    res.send = function (body?: unknown): Response {
      res.send = originalSend;

      const hrTime = process.hrtime(startTime);
      const responseTime = (hrTime[0] * 1000 + hrTime[1] / 1000000).toFixed(2);
      let responseBody: unknown;
      try {
        responseBody = typeof body === 'string' ? JSON.parse(body) : body;
      } catch {
        responseBody =
          typeof body === 'string' ? truncateString(body, LOG_LIMITS.MAX_BODY_LENGTH) : body;
      }

      const statusCode = res.statusCode;
      const isError = statusCode >= 400;
      const responseLog = {
        requestId,
        method,
        url,
        statusCode,
        responseTime: `${responseTime}ms`,
        body: truncateContent(responseBody),
      };

      if (envs.NODE_ENV === 'development' && !isExcluded) {
        console.log(
          formatConsoleResponse(requestId, req, res, truncateContent(responseBody), responseTime)
        );
      }

      if (isError) {
        winstonLogger.error(`Response error [${requestId}]`, responseLog);
      } else {
        winstonLogger.info(`Response sent [${requestId}]`, responseLog);
      }

      return originalSend.call(this, body);
    };
  }

  next();
}

/**
 * Exportación por defecto para compatibilidad con nombre anterior
 */
export const logger = httpLogger;
