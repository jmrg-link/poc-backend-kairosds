# Rule · Repository Pattern + Mongoose + TypeScript

El proyecto aplica **Repository Pattern hexagonal** de forma estricta: la capa
`application` define el **puerto** (interfaz) y `infrastructure` /
`presentation/<Feature>/repositories/` provee la **implementación** con
Mongoose.

## 1. El puerto (interface) vive en `application/repositories`

```ts
// application/repositories/ITaskRepository.ts
import { TaskEntity } from '@domain/entities/TaskEntity';

export interface ITaskRepository {
  create(task: Partial<TaskEntity>): Promise<TaskEntity>;
  findById(id: string): Promise<TaskEntity | null>;
  findByIdempotencyKey(key: string): Promise<TaskEntity | null>;
  updateStatus(id: string, status: string, data?: Record<string, unknown>): Promise<void>;
  find(filter: Partial<TaskEntity>, skip: number, limit: number): Promise<TaskEntity[]>;
  count(filter: Partial<TaskEntity>): Promise<number>;
}
```

Reglas del puerto:

- **Zero dependencias externas.** `import` solo desde `@domain`.
- Los parámetros son **tipos de dominio**, no `ObjectId` ni `Document`.
- Los retornos son **entidades de dominio**, nunca documentos Mongoose.
- Nombres verbales neutros de ORM: `findById` (no `findOne`), `count`, `create`,
  `updateStatus`. Si un método es específico del dominio (ej.
  `findByIdempotencyKey`), se mantiene en la interfaz porque expresa una regla
  de negocio.

## 2. La implementación Mongoose

Ubicación real en este repo:

- `image-express-api/src/presentation/Task/repositories/TaskRepository.ts`
- `image-processing-worker/src/infrastructure/repositories/TaskRepository.ts`

Plantilla:

```ts
import { Connection, Model } from 'mongoose';
import { TaskEntity } from '@domain/entities/TaskEntity';
import { ITaskRepository } from '@application/repositories/ITaskRepository';
import { getTaskModel } from '@infrastructure/schemas';

export class TaskRepository implements ITaskRepository {
  private readonly model: Model<TaskEntity>;

  constructor(db: Connection) {
    this.model = getTaskModel(db);
  }

  async create(task: Partial<TaskEntity>): Promise<TaskEntity> {
    const created = await this.model.create(task);
    return created.toObject();
  }

  async findById(id: string): Promise<TaskEntity | null> {
    return await this.model.findById(id).lean();
  }
  // ...
}
```

Reglas de implementación:

1. **Inyectar la `Connection` por constructor.** Nunca importar `mongoose`
   directamente para crear conexiones en el repositorio.
2. **Usar `.lean()`** en todas las lecturas → devuelve POJO plano, más rápido
   y acorde al tipo `TaskEntity`.
3. **Usar `.toObject()`** en `create` después del `save`/`create`.
4. **`updateStatus` actualiza `updatedAt: new Date()`** explícitamente aunque
   `timestamps: true` esté en el schema, porque el update manual puede
   saltárselos según el método de Mongoose.
5. **No exponer Mongoose.** Nunca devolver `Document<T>` ni `HydratedDocument<T>`.
6. **Un repositorio por colección lógica.** Si tu feature toca dos colecciones,
   crea dos repositorios y orquesta en el `Service` o `Handler`.

## 3. El schema de Mongoose

Los schemas viven en `infrastructure/schemas/*.ts` y se construyen con una
factory que recibe la `Connection`, para soportar multi-DB:

```ts
// infrastructure/schemas/TaskSchema.ts
import { Schema, Connection } from 'mongoose';
import { TaskEntity, TaskStatus } from '@domain/entities/TaskEntity';

const TaskSchema = new Schema<TaskEntity>(
  {
    status: {
      type: String,
      enum: Object.values(TaskStatus),
      default: TaskStatus.PENDING,
      required: true,
      index: true,
    },
    // ... resto de campos
  },
  { timestamps: true }
);

TaskSchema.index({ status: 1, createdAt: -1 });

export function getTaskModel(db: Connection) {
  return db.model<TaskEntity>('Task', TaskSchema, 'tasks');
}
```

Reglas del schema:

- **`new Schema<TaskEntity>(...)`** tipado con la entidad de dominio para
  asegurar coherencia.
- **Enums desde `domain`.** Nunca duplicar valores en el schema; siempre
  `Object.values(TaskStatus)`.
- **Índices explícitos** para queries frecuentes (ej.
  `status + createdAt desc` para `ListTasksQuery`).
- **`timestamps: true`** salvo que haya una razón explícita para gestionar
  `createdAt/updatedAt` manualmente.
- **`unique + sparse`** para claves de idempotencia.
- **Factory `getTaskModel(db)`** en lugar de `mongoose.model(...)` global —
  permite multi-tenant/multi-connection.

## 4. Composición en `presentation`

La implementación se inyecta en el *factory method* de la ruta:

```ts
// presentation/Task/routes/TaskRoutes.ts
private static createTaskController(): TaskController {
  const db = DatabaseConnector.getImageDb();
  const queue = new TaskQueueProducer();
  const repository = new TaskRepository(db);
  const imageDownloadService = new ImageDownloadService();
  const service = new TaskService(repository, queue, imageDownloadService);
  return new TaskController(service);
}
```

**Regla:** nunca instanciar `TaskRepository` dentro del controller, handler o
service. La composición es siempre en el `createFooController` de las rutas o
en `CQRSModule.configure(...)`.

## 5. Errores y NotFound

- `findById` devuelve `TaskEntity | null`. **El handler/service decide**
  lanzar `NotFoundError`. El repositorio jamás lanza errores de dominio.
- Para errores de Mongoose (cast, duplicate key…), ya existe
  `MongoErrorHandler` en la cadena de `errorMiddleware`. No capturar ni
  traducir manualmente en el repositorio.

## 6. Testing

- Los repositorios se testean con `mongodb-memory-server` en
  `tests/integration/`.
- Los handlers/services se testean con **mocks** de la interfaz
  `ITaskRepository`, no con el repo real:

```ts
const repoMock: jest.Mocked<ITaskRepository> = {
  create: jest.fn(),
  findById: jest.fn(),
  // ...
};
```

## 7. Anti-patrones

- ❌ `import mongoose from 'mongoose'` en `application/`.
- ❌ Exponer `_id` como `ObjectId` en el DTO; siempre `string`.
- ❌ `model.findOne(...).then(...)` encadenado — usar `await`.
- ❌ `find().lean()` devolviendo `any`; usa `Model<TaskEntity>` tipado.
- ❌ Operaciones batch (`$in`) sin índice: revisar antes de añadir.
- ❌ Actualizar con `save()` en vez de `findByIdAndUpdate` cuando ya tienes el
  id — evita race conditions.
