# CLAUDE.md — Guía para Claude Code en este repo

Este archivo es el **punto de entrada** que Claude Code lee automáticamente
al abrir el repositorio. Funciona como un **barrel** de reglas: delega el
detalle a los archivos en `.claude/rules/` y aquí solo se listan los
principios globales, la estructura del proyecto y los enlaces al índice.

> ⚠️ **Lectura obligatoria antes de editar código:** sigue los enlaces de la
> tabla de reglas. Son concisos y evitan errores de arquitectura.

---

## 1. Contexto del proyecto

Monorepo de un **sistema de procesamiento de imágenes** en TypeScript con
dos servicios:

| Servicio | Rol | Stack principal |
|---|---|---|
| `image-express-api` | API REST síncrona (CRUD de tareas, listado, retry, health) | Express 5, Mongoose 8, BullMQ, Redis, Winston + Loki |
| `image-processing-worker` | Worker asíncrono que procesa imágenes de la cola | BullMQ, Sharp, Mongoose, Redis Pub/Sub |

Ambos comparten el **mismo patrón arquitectónico**:

- **Clean Architecture** con capas `domain / application / infrastructure / presentation`
- **Hexagonal** (puertos en `application/repositories`, adapters en `infrastructure`)
- **CQRS** manual (CommandBus + QueryBus + Mediator en `application/core`)
- **Repository pattern** con Mongoose
- **Chain of Responsibility** para manejo de errores

Stack transversal:

- **TypeScript 5.9** con `strict: true` y paths alias (`@domain`, `@application`, `@infrastructure`, `@presentation`, `@core`, `@config`).
- **MongoDB** con Mongoose 8.
- **Redis** para caché (cache-aside) y colas BullMQ.
- **Winston + Loki** para logs estructurados.
- **class-validator + class-transformer** para DTOs.
- **envalid** para validar variables de entorno.

---

## 2. Estructura del repositorio

```
poc-backend-kairosds/
├── CLAUDE.md                        ← este archivo (barrel de rules)
├── .claude/
│   └── rules/                       ← reglas detalladas (ver tabla abajo)
├── image-express-api/
│   ├── src/
│   │   ├── main.ts                  ← entrypoint (orden: DB→Cache→Events→Queue→Server)
│   │   ├── config/envs.ts           ← envalid, variables validadas
│   │   ├── domain/                  ← entidades + DTOs (zero IO)
│   │   ├── application/             ← commands, queries, handlers, CQRSModule, repo interfaces
│   │   ├── infrastructure/          ← Mongoose schemas, Redis, BullMQ
│   │   ├── core/                    ← helpers cross-cutting (logger, errors, crypto)
│   │   └── presentation/
│   │       ├── Bootstrap/           ← createApp, createServer, middlewares
│   │       └── Task/                ← controller + service + repository + routes
│   ├── swagger.yaml                 ← doc OpenAPI, servida en /api-docs
│   ├── tsconfig.json                ← paths alias
│   └── eslint.config.js             ← reglas de calidad (max-depth 5, complexity 15)
├── image-processing-worker/
│   └── src/                         ← misma estructura que la API
├── docker-compose.yml               ← stack completo (API + worker + Mongo + Redis + Loki + Grafana)
└── config/                          ← configuraciones de Prometheus, Loki, Grafana
```

---

## 3. Barrel de reglas (`.claude/rules/`)

Toda decisión que vaya más allá de un fix trivial debe consultarse con la
rule correspondiente. El índice maestro vive en
[`.claude/rules/index.md`](./.claude/rules/index.md).

| Rule | Dominio | Cuándo leerla |
|---|---|---|
| [`architecture.md`](./.claude/rules/architecture.md) | Hexagonal · Clean Arch · Capas · Fronteras | Antes de crear/mover archivos entre capas |
| [`clean-code.md`](./.claude/rules/clean-code.md) | Clean Code · SOLID · Nombres · JSDoc | En cualquier edición TS |
| [`cqrs.md`](./.claude/rules/cqrs.md) | CommandBus · QueryBus · Mediator · Handlers | Al añadir un caso de uso |
| [`repository.md`](./.claude/rules/repository.md) | Repository + Mongoose + Schemas | Al tocar persistencia |
| [`express.md`](./.claude/rules/express.md) | Bootstrap de Express · createApp · Paths alias | Al tocar `Bootstrap/app.ts` |
| [`server.md`](./.claude/rules/server.md) | `createServer` · `main.ts` · orden de init | Al tocar el arranque |
| [`middlewares.md`](./.claude/rules/middlewares.md) | Orden, validación, idempotencia, errores | Al crear o encadenar middlewares |
| [`cors.md`](./.claude/rules/cors.md) | `corsOptions`, orígenes, cabeceras permitidas | Al exponer un nuevo dominio |
| [`helmet.md`](./.claude/rules/helmet.md) | Cabeceras de seguridad | Al ajustar seguridad HTTP |
| [`loggers.md`](./.claude/rules/loggers.md) | Winston, Loki, `httpLogger`, métricas | Al añadir trazas o métricas |

---

## 4. Reglas globales (no negociables)

Estas reglas aplican siempre y complementan el detalle de los archivos en
`.claude/rules/`:

1. **TypeScript estricto.** `strict: true`. Nada de `any` salvo fixtures de
   test. Preferir `unknown` + narrowing.
2. **Paths alias obligatorios.** `@domain`, `@application`, `@infrastructure`,
   `@presentation`, `@core`, `@config`. Nunca `../../../`.
3. **Hexagonal estricta.** `domain` no importa nada. `application` solo
   importa `domain` y `core`. `infrastructure` implementa puertos de
   `application`. `presentation` compone.
4. **JSDoc en español** en clases, métodos públicos y funciones exportadas.
5. **Errores tipados.** `BusinessError`, `NotFoundError`, `CustomError`. Nunca
   `throw new Error(...)` con string libre en `application/` o `domain/`.
6. **Async/await siempre.** Nada de `.then()` encadenado, salvo `.catch(next)`
   en `asyncHandler`.
7. **Logs estructurados.** `logger.info('msg', { metadata })`, nunca
   `console.log` en negocio (solo en `main.ts` y hooks de conexión).
8. **Composición manual** en los `*Routes.createFooController()` y en
   `CQRSModule.configure(...)`. Nada de `new TaskRepository()` dentro de un
   handler.
9. **DTOs en entradas y salidas.** Nunca devolver `TaskEntity` crudo: mapear
   siempre a `*ResponseDto`.
10. **Idioma de logs, errores y comentarios:** español (es-ES). Nombres
    técnicos en inglés (`Repository`, `Handler`, `Bus`).

---

## 5. Cómo añadir una feature nueva (resumen)

El detalle está en [`architecture.md §4`](./.claude/rules/architecture.md).
Resumen de checklist:

1. **Domain** → entidad + enum de estados + DTOs con `class-validator`.
2. **Application** → puerto `I<Feature>Repository` + Commands/Queries +
   Handlers. Registrar en `CQRSModule`.
3. **Infrastructure** → Mongoose schema en `infrastructure/schemas` con
   factory `get<Feature>Model(db)`.
4. **Presentation** → `controller`, `service` (si el flujo HTTP es síncrono),
   `routes` con `createFooController()`. Registrar en `AppRoutes`.
5. **Middlewares** → encadenar validación/idempotencia según
   [`middlewares.md §3`](./.claude/rules/middlewares.md).
6. **Tests** → unit para handlers/services con mocks de interfaces,
   integration para repositorios con `mongodb-memory-server`.

---

## 6. Comandos útiles

Desde `image-express-api/`:

```bash
npm run dev         # tsx watch src/main.ts
npm run build       # tsc && tsc-alias
npm run test        # jest --detectOpenHandles
npm run lint        # eslint src/
npm run fix:all     # prettier + eslint --fix
```

Stack completo (API + worker + infra) con Docker Compose desde la raíz:

```bash
docker-compose up --build -d
```

---

## 7. Qué NO hacer

- ❌ No mezclar arquitecturas: Service Layer **o** CQRS para el mismo caso
  de uso, nunca los dos.
- ❌ No instanciar `mongoose.model(...)` directamente; usar la factory del
  schema.
- ❌ No añadir middlewares globales fuera de `createApp()` en `app.ts`.
- ❌ No hacer `app.listen()` sin pasar por `createServer()`.
- ❌ No responder errores con `res.status(500).json(...)` directamente:
  delegar al `errorMiddleware` vía `next(error)`.
- ❌ No registrar handlers CQRS fuera de `CQRSModule.configure()`.
- ❌ No usar `console.log` en negocio ni en middlewares: siempre `logger`
  de Winston (`@core/helpers/logger`).
- ❌ No crear nuevos loggers paralelos (pino, bunyan…).
- ❌ No saltarse la validación de DTOs en endpoints que reciben body.

---

*Para el detalle completo, seguir los enlaces de la tabla de reglas en la
sección 3.*
