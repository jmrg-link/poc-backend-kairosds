# Rule · CQRS (Command Query Responsibility Segregation)

El proyecto implementa CQRS *a mano* (sin librerías tipo NestJS CQRS) en
`image-express-api/src/application/core/`. Esta rule explica **cómo añadir**
comandos, queries y handlers sin romper el patrón.

## 1. Piezas

| Pieza | Archivo | Propósito |
|---|---|---|
| `ICommand` | `application/core/Command.ts` | Marker interface para comandos |
| `ICommandHandler<TC, TR>` | `application/core/Command.ts` | Contrato `execute(command): Promise<TR>` |
| `IQuery<TR>` | `application/core/Query.ts` | Marker interface para queries |
| `IQueryHandler<TQ, TR>` | `application/core/Query.ts` | Contrato `execute(query): Promise<TR>` |
| `CommandBus` | `application/core/CommandBus.ts` | `Map<string, handler>` con `registerByName` + `execute` |
| `QueryBus` | `application/core/QueryBus.ts` | Idem para queries |
| `Mediator` | `application/core/Mediator.ts` | Fachada `send(command)` / `query(query)` |
| `CQRSModule` | `application/core/CQRSModule.ts` | Factory estático que **registra todos los handlers** |

## 2. Commands vs Queries — cuándo usar cada uno

- **Command** — **muta** estado. Ejemplo: `CreateTaskCommand`,
  `UpdateTaskStatusCommand`. Devuelve un DTO de respuesta *mínimo*
  (o `void`).
- **Query** — **lee** estado, nunca muta. Ejemplo: `GetTaskQuery`,
  `ListTasksQuery`. Puede (y debe) usar caché con TTL. Devuelve el DTO leído.

Si un caso de uso hace "lee y luego modifica", es un **Command** que puede
internamente invocar una Query vía `Mediator`.

## 3. Cómo crear un nuevo Command (plantilla)

### 3.1. Definir el comando

```ts
// application/commands/FooBarCommand.ts
import { ICommand } from '@application/core';

/**
 * Comando para <explica>
 * @class FooBarCommand
 */
export class FooBarCommand implements ICommand {
  constructor(
    public readonly entityId: string,
    public readonly payload: FooPayload
  ) {}
}
```

Reglas:

- **`class`, no type alias.** `CommandBus` usa `command.constructor.name` como
  clave (`CommandBus.execute` línea 31 de `CommandBus.ts`).
- Todas las propiedades **`public readonly`** — un comando es inmutable.
- Si el comando debe traducirse a entidad, añadir método `toEntity()` como
  `CreateTaskCommand.toEntity()`.

### 3.2. Definir el handler

```ts
// application/handlers/FooBarCommandHandler.ts
import { ICommandHandler } from '@application/core';
import { FooBarCommand } from '@application/commands/FooBarCommand';
import { IFooRepository } from '@application/repositories';
import { FooResponseDto } from '@domain/dtos';

export class FooBarCommandHandler
  implements ICommandHandler<FooBarCommand, FooResponseDto>
{
  constructor(
    private readonly repository: IFooRepository,
    private readonly cache?: CacheService
  ) {}

  async execute(command: FooBarCommand): Promise<FooResponseDto> {
    // 1. Validaciones de negocio (lanzar BusinessError/NotFoundError)
    // 2. Delegar al repositorio
    // 3. Invalidar caché si aplica
    // 4. Mapear a DTO
    return this.mapToDto(updated);
  }

  private mapToDto(entity: FooEntity): FooResponseDto { /* ... */ }
}
```

### 3.3. Registrar el handler en `CQRSModule`

Editar `application/core/CQRSModule.ts` y añadir:

```ts
commandBus.registerByName(
  'FooBarCommand',
  new FooBarCommandHandler(fooRepository, cacheService)
);
```

**Importante:** el string debe coincidir *exactamente* con el nombre de la
clase porque `CommandBus.execute` hace `command.constructor.name`.

### 3.4. Exportar en el barrel

Añadir el export en `application/commands/index.ts` y
`application/handlers/index.ts`.

## 4. Cómo crear una nueva Query (plantilla)

### 4.1. Definir la query

```ts
// application/queries/GetFooQuery.ts
import { IQuery } from '@application/core';
import { FooResponseDto } from '@domain/dtos';

/**
 * Query para obtener un Foo
 * @class GetFooQuery
 */
export class GetFooQuery implements IQuery<FooResponseDto> {
  constructor(public readonly fooId: string) {}
}
```

### 4.2. Handler con *cache-aside*

Este patrón está canónicamente implementado en `GetTaskQueryHandler`:

```ts
async execute(query: GetFooQuery): Promise<FooResponseDto> {
  const cacheKey = `foo:${query.fooId}`;

  return this.cacheService.getOrSet(
    cacheKey,
    async () => {
      const entity = await this.repository.findById(query.fooId);
      if (!entity) throw new NotFoundError(`Foo ${query.fooId} no encontrado`);
      return this.mapToDto(entity);
    },
    this.TTL_SECONDS
  );
}
```

Reglas:

- **TTL como `private readonly TTL_SECONDS = 60`** dentro de la clase.
- Las queries **nunca mutan**, ni siquiera para logging pesado.
- Si la query paginada, el TTL debe ser **menor** (ejemplo
  `ListTasksQueryHandler`) o incluir los filtros en la clave.

## 5. Invocar desde Presentation

Desde un controller o service:

```ts
const mediator: Mediator = CQRSModule.configure(taskRepository, queue, cache);
const task = await mediator.send<TaskResponseDto>(new CreateTaskCommand(...));
const result = await mediator.query<TaskResponseDto>(new GetTaskQuery(id));
```

`CQRSModule.configure(...)` devuelve un mediator **ya configurado con todos los
handlers**. No hay un contenedor DI global; la composición es manual.

## 6. Errores comunes a evitar

- ❌ Registrar el handler con un nombre distinto al de la clase:
  `registerByName('CreateTask', ...)` → el `execute` buscará
  `'CreateTaskCommand'` y fallará con `Handler para comando ... no encontrado`.
- ❌ Pasar lógica de infraestructura al handler directamente (por ejemplo
  inyectar un `mongoose.Model`). Siempre va la **interfaz** `ITaskRepository`.
- ❌ Devolver la `TaskEntity` cruda. Los handlers devuelven **DTOs**.
- ❌ Reutilizar un handler para dos casos de uso: uno por cada command/query.
- ❌ Hacer `new Mediator()` directamente; usar `CQRSModule.configure(...)`.

## 7. Cuándo NO usar CQRS

- Cuando el endpoint es trivial (health check, métricas) → controller directo.
- Cuando la lógica es puramente orquestación HTTP y no hay caché ni eventos
  asíncronos: usa `Service Layer` (`TaskService` en `presentation/Task/services`).
- Si hay un caso en que *tanto Service Layer como CQRS* coexisten para lo
  mismo, elegir **uno** y borrar el otro: evitar duplicación.
