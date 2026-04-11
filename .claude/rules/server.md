# Rule · Server (HTTP bootstrap y `main.ts`)

El servidor HTTP está separado de la app Express en dos archivos:

- `presentation/Bootstrap/server.ts` — envuelve la `Application` en `http.Server`.
- `main.ts` — arranca conexiones, crea el server y hace `listen`.

Esta separación permite que **los tests de integración** (`supertest`) usen
`createApp()` sin levantar un servidor real.

## 1. `createServer()`

```ts
// presentation/Bootstrap/server.ts
import http from 'http';
import { Application } from 'express';
import { createApp } from './app';

export function createServer(): http.Server {
  const app: Application = createApp();
  return http.createServer(app);
}
```

Reglas:

- No hay configuración de HTTPS local; la terminación TLS se delega a Traefik
  en el stack de Docker Compose. Si alguna vez se necesita HTTPS *directo*,
  añádelo aquí y **no** en `app.ts`.
- No añadir `setTimeout`, `keepAliveTimeout` sin justificación: Node por
  defecto cubre el caso.

## 2. `main.ts` — orden de inicialización

Referencia: `src/main.ts`.

```ts
import 'reflect-metadata';                      // class-validator/transformer
import { DatabaseConnector } from '@infrastructure/databases';
import { RedisCache }        from '@infrastructure/cache';
import { TaskQueueProducer } from '@infrastructure/queues';
import { TaskEvents }        from '@infrastructure/queues/events/TaskEvents';
import { envs }              from '@config/envs';
import { createServer }      from '@presentation/Bootstrap/server';

process.env.TZ = 'Europe/Madrid';

async function main(): Promise<void> {
  console.log(`Server init at ${startupTimeLocal}`);

  await DatabaseConnector.initialize(envs.MONGODB_URI);  // 1. DB primero
  RedisCache.initialize();                                // 2. Cache
  TaskEvents.initialize();                                // 3. Pub/Sub
  TaskQueueProducer.initialize();                         // 4. Queue

  const server = createServer();                          // 5. HTTP server
  server.listen(envs.SERVER.PORT, () => {
    console.log(`API Server listening on port ${envs.SERVER.PORT}`);
  });
}

main().catch(error => {
  console.error('Failed to start the application:', error);
  process.exit(1);
});
```

Reglas del arranque:

1. **`reflect-metadata` primero.** `class-validator` y `class-transformer` lo
   requieren para los decoradores. Si se mueve al final o se olvida, las
   validaciones fallan en runtime.
2. **Orden estricto:** DB → Cache → Events → Queue → Server. Un servicio que
   dependa del anterior **no** debe arrancarse antes.
3. **`await` en MongoDB.** Es la única conexión que bloquea. Redis y BullMQ
   se inicializan síncronamente porque usan *lazy connect*.
4. **`process.env.TZ`** fijo en `Europe/Madrid` — coherente con los logs y con
   las `Date` almacenadas en MongoDB.
5. **`main().catch(... process.exit(1))`** — nunca dejar una promesa sin
   `.catch`. Si falla el arranque, el proceso debe morir para que el
   orquestador (Docker/Traefik) lo reintente.
6. **Nunca** hacer `app.listen(...)` directamente en `main.ts` — usar siempre
   `createServer()`.

## 3. Shutdown graceful (opcional, recomendado)

Si se añade shutdown graceful, debe ir en `main.ts`:

```ts
process.on('SIGTERM', async () => {
  server.close();
  await DatabaseConnector.disconnect();
  process.exit(0);
});
```

- Escuchar `SIGTERM` **y** `SIGINT`.
- Cerrar primero el `http.Server` (deja de aceptar nuevas conexiones) y
  después los recursos externos (DB, Redis, cola).
- Timeout máximo ~10s antes de `process.exit(1)` forzado.

## 4. Healthcheck

El healthcheck vive en `AppRoutes.initializeHealthCheck` (`/api/health`) y
devuelve:

```json
{
  "status": "ok",
  "service": "image-express-api",
  "timestamp": "<ISO>",
  "uptime": <seconds>
}
```

**Regla:** este endpoint no debe depender de DB ni Redis; así el orquestador
puede distinguir *"el proceso está vivo"* de *"tengo un problema aguas
abajo"*. Si se necesita un *readiness probe* con dependencias, crear
`/api/ready` aparte.

## 5. Anti-patrones

- ❌ Poner lógica de conexión a DB en `app.ts`.
- ❌ Crear el servidor directamente con `http.createServer(express())` sin
  pasar por `createServer()`.
- ❌ `await` en middlewares que se registran en el arranque — si necesitas
  esperar a que un cliente esté listo, hazlo en `main.ts`.
- ❌ Llamar a `createServer()` dentro de tests de integración: usa `createApp()`
  y `supertest(app)` directamente.
- ❌ `console.log` de secretos (URIs con password) al arrancar. Si imprimes la
  URI de Mongo, enmascarar la contraseña.
