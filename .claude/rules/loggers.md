# Rule · Loggers (Winston + Loki + httpLogger)

El proyecto tiene **dos loggers**:

1. **Logger estructurado** — `@core/helpers/logger.ts` → `logger` (instancia
   de Winston). Se usa desde services, handlers, repositorios, workers.
2. **Logger HTTP** — `presentation/Bootstrap/middlewares/logger.ts` →
   `httpLogger` middleware. Traza cada request/response con formato
   enriquecido en desarrollo y JSON en producción.

Ambos comparten infraestructura: Winston + transport de consola + transport
opcional de Loki para producción.

## 1. Winston — `logger` cross-cutting

Referencia: `core/helpers/logger.ts`.

```ts
import { logger } from '@core/helpers/logger';

logger.info('Tarea creada exitosamente', {
  taskId: '...',
  idempotencyKey: '...',
  processingTime: 42,
});

logger.error('Error creando tarea', { error: err.message });
logger.warn('Tarea no encontrada', { taskId });
logger.debug('Valor intermedio', { payload });
```

Reglas:

- **Niveles permitidos** (ver `config/envs.ts` `LOG_LEVEL`): `error`, `warn`,
  `info`, `debug`.
- **Formato "mensaje + metadata"**. El primer argumento es siempre un string
  descriptivo; el segundo, un objeto con contexto. **Nunca** concatenar
  variables en el string (`logger.info(\`Tarea ${id} creada\`)`).
- **Metadata coherente.** Usar las mismas claves en todo el proyecto:
  `taskId`, `idempotencyKey`, `status`, `source`, `processingTime`,
  `requestId`. Así las queries de Loki/Grafana son consistentes.
- **`defaultMeta`** ya añade `service: 'image-express-api'` y `hostname`.
  No hace falta duplicarlos.
- **Errores:** `winston.format.errors({ stack: true })` ya está activo, así
  que `logger.error('msg', { error })` captura el stack automáticamente.

## 2. Formato por entorno

- **Development** — `createConsoleFormat()` imprime:
  ```
  2026-04-11T10:00:00.000Z [INFO]: Tarea creada exitosamente
  {
    "taskId": "...",
    "idempotencyKey": "..."
  }
  ```
  con `ansi-colors` para el nivel y `metadata` en cian.
- **Production** — `winston.format.json()` emite una línea JSON por log, lista
  para ser ingerida por Loki.

## 3. Loki transport

Referencia: `core/helpers/logger.ts` `createLokiTransport()`.

- Solo se activa si `envs.NODE_ENV === 'production'` **y** `envs.LOKI.URL`
  está definido.
- Labels fijos: `app`, `environment`, `version` (tomados de
  `envs.APP_VERSION`).
- **Batching** activo: `interval: envs.LOKI.BATCH_INTERVAL` (5000ms por
  defecto). Nunca hacer flush manual.
- Si falla la conexión con Loki, el error va a `console.error`. La API
  **no debe caerse** por un problema de logging.

Reglas:

- Para añadir un label nuevo (p.ej. `region`), hacerlo en el `labels` del
  transport, no en cada log individual.
- No usar Loki como sistema de métricas: los contadores van a Prometheus vía
  `logMetric` (ver sección 5).

## 4. `httpLogger` middleware

Referencia: `presentation/Bootstrap/middlewares/logger.ts`.

Capabilities:

- **`requestId` corto** de 8 caracteres generado con `uuidv4().substring(0, 8)`.
- **Filtrado de campos sensibles** en headers (`authorization`, `cookie`,
  `x-api-key`) y en body (`password`, `token`, `apiKey`, `secret`). Los
  reemplaza por `[FILTERED]`.
- **Truncado** de payloads gigantes según `LOG_LIMITS`:
  - `MAX_BODY_LENGTH: 500`
  - `MAX_STRING_LENGTH: 200`
  - `MAX_ARRAY_ITEMS: 10`
  - `MAX_OBJECT_KEYS: 20`
- **Paths excluidos del logging detallado** en producción (`/api-docs`,
  `/swagger-ui`, `/favicon.ico`, `/health`, `/metrics`).
- **Formato consola enriquecido** en development con emojis y colores; JSON
  en producción.

Reglas:

- **No duplicar** `httpLogger` con otro middleware de logging. Si necesitas
  otra traza específica, hazla en el controller con `logger.info(...)` y un
  `requestId` propagado.
- **Propagar `requestId`** a los logs del service/handler cuando sea posible:
  ```ts
  req.requestId && logger.info('...', { requestId: req.requestId, ... });
  ```
  (requiere extender el tipo de `Request`).
- **No loggear binarios.** Si el endpoint recibe un fichero con Multer, el
  logger ya trunca, pero **no** añadas tú `req.file.buffer` a un log.

## 5. Métricas via `logMetric`

```ts
import { logMetric } from '@core/helpers/logger';

logMetric('task_created', 1, { source: 'upload' });
logMetric('image_processing_duration_ms', 842, { taskId });
```

Reglas:

- El `logMetric` emite un `logger.info('metric', { metric, value, ...labels })`.
- Prometheus consume los logs vía Loki; por eso la convención del campo
  `metric`. **No** cambiarla.
- Para histogramas, enviar el valor como número puro; para contadores,
  siempre `1`.

## 6. Anti-patrones

- ❌ `console.log` en código de negocio. Solo se tolera en `main.ts` y en
  hooks de conexión (`DatabaseConnector`, `RedisCache`).
- ❌ Loggear dentro de bucles sin límite: usa `LOG_LIMITS` mentalmente, o
  resume el resultado del bucle.
- ❌ Concatenar strings con `${}` en el mensaje principal — rompe el
  agrupamiento en Loki/Grafana.
- ❌ Loggear el objeto `error` completo sin más contexto:
  `logger.error(error)`. Usa `logger.error('descripción', { error: error.message, taskId })`.
- ❌ Añadir un segundo logger (`pino`, `bunyan`) — el proyecto usa Winston.
  Una sola librería de logging.
- ❌ Silenciar logs en test redefiniendo `console.log`; usa
  `logger.transports[0].silent = true` si realmente necesitas silenciar en
  tests.
