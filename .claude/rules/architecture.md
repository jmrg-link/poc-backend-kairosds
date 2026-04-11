# Rule · Architecture (Hexagonal + Clean Architecture + Capas)

Esta rule describe **cómo está organizado el código** y **qué puede depender de
qué**. Es la guía más importante: una edición que viole estas fronteras es
rechazable en revisión.

## 1. Capas y direccionalidad de dependencias

```
┌─────────────────────────── presentation ────────────────────────────┐
│  Routes · Controllers · Bootstrap (app, server, middlewares)         │
│  Conoce: application + core + domain (nunca infra directo)           │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ depende
┌──────────────────────────────▼───────────────────────────────────────┐
│                          application                                 │
│  Commands · Queries · Handlers · Services · Repository interfaces    │
│  Conoce: domain + core                                                │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ depende
┌──────────────────────────────▼───────────────────────────────────────┐
│                             domain                                   │
│  Entities · DTOs · Value Objects · Reglas de negocio puras           │
│  No conoce NADA. Sin imports externos.                                │
└──────────────────────────────────────────────────────────────────────┘

┌─────────────────────────── infrastructure ──────────────────────────┐
│  Mongoose schemas · Repositories impl · BullMQ · Redis · Multer      │
│  Implementa interfaces de `application/repositories`.                 │
│  Puede importar `application` (interfaces) y `domain` (entidades).   │
└──────────────────────────────────────────────────────────────────────┘
```

**Regla de oro:** las flechas de dependencia **siempre apuntan hacia `domain`**.
Jamás al revés.

## 2. Estructura real del repositorio (referencia)

```
image-express-api/src/
├── main.ts                                 # Entry point
├── config/envs.ts                          # Variables validadas con envalid
├── core/                                   # Helpers cross-cutting
│   ├── errors/                             # CustomError, ErrorHandlerChain
│   ├── helpers/                            # logger, crypto, time, mongoose
│   └── types/                              # Augmentations de express.d.ts
├── domain/
│   ├── entities/                           # TaskEntity, ImageEntity
│   └── dtos/                               # CreateTaskDto, PaginationDto...
├── application/
│   ├── core/                               # CommandBus, QueryBus, Mediator, CQRSModule
│   ├── commands/                           # CreateTaskCommand, UpdateTaskStatusCommand
│   ├── queries/                            # GetTaskQuery, ListTasksQuery
│   ├── handlers/                           # *CommandHandler, *QueryHandler
│   ├── repositories/                       # INTERFACES (ITaskRepository)
│   └── services/                           # CacheService, IdempotencyService...
├── infrastructure/
│   ├── databases/DatabaseConnector.ts
│   ├── schemas/TaskSchema.ts               # Mongoose schemas
│   ├── cache/RedisCache.ts
│   ├── queues/TaskQueueProducer.ts
│   └── upload/MulterConfig.ts
└── presentation/
    ├── Bootstrap/
    │   ├── app.ts                          # createApp()
    │   ├── server.ts                       # createServer()
    │   ├── routes.ts                       # AppRoutes
    │   └── middlewares/                    # cors, helmet, logger, errorMiddleware...
    └── Task/
        ├── routes/TaskRoutes.ts
        ├── controllers/TaskController.ts
        ├── services/TaskService.ts         # Service Layer síncrono
        └── repositories/TaskRepository.ts  # Implementación Mongoose
```

## 3. Reglas de frontera

- **`domain/`** es **puro TypeScript**. No puede importar `express`, `mongoose`,
  `winston` ni nada con IO. Solo tipos, enums, clases con reglas de negocio
  (`TaskStatusTransition` en `TaskEntity.ts` es un ejemplo válido).
- **`application/repositories/I*Repository.ts`** son **interfaces**. Nunca
  contienen lógica ni import de librerías externas. Son los *ports* hexagonales.
- **`infrastructure/` implementa puertos.** El cliente de Mongoose, Redis o
  BullMQ vive aquí. Si un handler necesita `Mongoose`, **no**: necesita
  `ITaskRepository`.
- **`presentation/` compone.** Los `*Routes.ts` hacen *factory* de dependencias
  (`TaskRoutes.createTaskController`). No se usa contenedor DI externo; la
  composición manual es la regla.
- **`core/` son helpers cross-cutting** que pueden ser usados por cualquier
  capa (logger, crypto, ansiColors). No son negocio.

## 4. Cómo añadir una nueva feature (checklist)

1. **Domain** — añadir o extender la entidad en `domain/entities`. Si es nueva,
   crear enum de estados y `*StatusTransition` si tiene lifecycle.
2. **Domain** — añadir DTOs en `domain/dtos` con `class-validator` decoradores.
3. **Application** — añadir el puerto en `application/repositories/I*.ts`.
4. **Application** — añadir `*Command` o `*Query` en `application/commands|queries`.
5. **Application** — añadir `*Handler` en `application/handlers`.
6. **Application** — registrar el handler en `application/core/CQRSModule.ts`.
7. **Infrastructure** — implementar el schema en `infrastructure/schemas`.
8. **Infrastructure** — implementar el repositorio en
   `presentation/<Feature>/repositories/*.ts` (o `infrastructure/repositories/` en worker).
9. **Presentation** — `controller` → `routes` → registro en `AppRoutes`.
10. **Middlewares** — encadenar validación/idempotencia según `middlewares.md`.

## 5. Hexagonal vs Service Layer — cuándo usar cada uno

El proyecto usa **arquitectura híbrida**:

- **Service Layer (`presentation/Task/services/TaskService.ts`)** — para el flujo
  HTTP síncrono de la API. Orquesta repositorio + cola + servicios de dominio.
  Útil cuando el endpoint hace algo simple y lineal.
- **CQRS (`application/core/*`)** — para casos de uso que pueden escalar,
  beneficiarse de *cache-aside* (GetTaskQuery con TTL), o que se disparan desde
  eventos del worker (`UpdateTaskStatusCommand`).

**Regla:** si el caso de uso lo dispara **HTTP**, empieza por Service Layer. Si
lo dispara un **evento de cola o pub/sub**, empieza por CQRS.

## 6. Anti-patrones a rechazar

- Importar `mongoose` desde `application/` o `domain/`.
- Importar `express` desde `application/` o `domain/`.
- Crear un `new TaskRepository()` dentro de un handler o controller.
- Instanciar un `new Mediator()` dentro de un controlador (se construye en
  `CQRSModule.configure`).
- Devolver entidades crudas en la respuesta HTTP: siempre mapear a `*Dto`.
- Lanzar `throw new Error(...)` con string libre en `application/`: usar
  `BusinessError` o `NotFoundError` tipados.
