# 📚 Documentación Técnica Detallada

## Índice de Documentación

| Documento | Descripción |
|-----------|-------------|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Visión general de la arquitectura híbrida del sistema. |
| [`EVENTS_FLOW.md`](EVENTS_FLOW.md) | Flujo detallado del sistema de eventos asíncronos. |
| [`PRESENTATION_APPLICATION_LAYERS.md`](PRESENTATION_APPLICATION_LAYERS.md) | Responsabilidades de las capas Presentation y Application. |
| [`DATABASE.md`](DATABASE.md) | Detalles sobre los esquemas, entidades e índices de MongoDB. |
| [`QUEUE_CACHE.md`](QUEUE_CACHE.md) | Detalles sobre el uso de BullMQ para colas y Redis para caché. |
| [`TESTING_DOCUMENTATION.md`](TESTING_DOCUMENTATION.md) | **Documentación completa de testing** - 335 tests con 70.84% coverage (+54.86% mejora). |

---

## ⚙️ Flujo Detallado de Handlers (CQRS)

Esta sección detalla la lógica interna de los `Handlers` clave del sistema, que se ejecutan en el flujo asíncrono.

### 1. `CreateTaskCommandHandler`

Este handler se encarga de la lógica de negocio para crear una tarea. Aunque el flujo HTTP síncrono utiliza `TaskService`, este handler contiene la lógica CQRS equivalente.

```mermaid
sequenceDiagram
    participant C as CreateTaskCommand
    participant H as CreateTaskCommandHandler
    participant R as ITaskRepository
    participant Q as TaskQueueProducer
    
    H->>R: findByIdempotencyKey(C.idempotencyKey)
    alt Clave de Idempotencia Existe
        R-->>H: TaskEntity existente
        H-->>C: Retorna TaskResponseDto existente
    else Clave no existe o es nula
        R-->>H: null
        H->>H: Genera precio aleatorio
        H->>R: create(TaskEntity con estado PENDING)
        R-->>H: TaskEntity creada
        H->>Q: addTask(taskId, imagePath)
        Q-->>H: Job encolado
        H-->>C: Retorna nueva TaskResponseDto
    end
```

### 2. `GetTaskQueryHandler` (con Caché)

Este handler optimiza las lecturas utilizando una estrategia de caché "Cache-Aside".

```mermaid
sequenceDiagram
    participant Q as GetTaskQuery
    participant H as GetTaskQueryHandler
    participant CS as CacheService
    participant R as ITaskRepository
    
    H->>CS: getOrSet("task:" + Q.taskId)
    
    alt Cache Miss
        CS->>R: findById(Q.taskId)
        R-->>CS: TaskEntity desde la BD
        CS->>CS: Almacena la entidad en caché con TTL
        CS-->>H: Retorna TaskEntity
    else Cache Hit
        CS-->>H: Retorna TaskEntity desde la caché
    end
    
    H->>H: Mapea Entity a TaskResponseDto
    H-->>Q: Retorna DTO
```

### 3. `UpdateTaskStatusCommandHandler`

Este handler es invocado por el suscriptor de eventos para actualizar el estado de una tarea.

```mermaid
sequenceDiagram
    participant C as UpdateTaskStatusCommand
    participant H as UpdateTaskStatusCommandHandler
    participant R as ITaskRepository
    participant TST as TaskStatusTransition
    participant CS as CacheService

    H->>R: findById(C.taskId)
    R-->>H: TaskEntity actual
    
    H->>TST: validateTransition(actual, C.newStatus)
    TST-->>H: Transición válida
    
    H->>R: updateStatus(C.taskId, C.newStatus, C.data)
    
    H->>CS: invalidatePattern("task:" + C.taskId)
    H->>CS: invalidatePattern("tasks:list:*")
```

---

## ⛓️ Cadena de Responsabilidad en Middlewares

El sistema utiliza una serie de middlewares de Express que actúan como una Cadena de Responsabilidad. Cada middleware procesa la petición y, si todo es correcto, la pasa al siguiente, o de lo contrario, la corta y devuelve un error.

### Flujo de Middlewares para `POST /tasks`

```mermaid
graph TD
    A[Petición HTTP] --> B{idempotencyMiddleware};
    B --> C{Multer File Upload};
    C --> D{validationMiddleware};
    D --> E[TaskController.create];
    
    subgraph "Cadena de Middlewares"
        direction LR
        B -- ✅ Pasa al siguiente --> C;
        C -- ✅ Pasa al siguiente --> D;
        D -- ✅ Pasa al siguiente --> E;
    end

    B -- ❗️ Clave duplicada --> F[HTTP 409 Conflict];
    C -- ❗️ Error de subida --> G[errorMiddleware];
    D -- ❗️ DTO inválido --> G[errorMiddleware];
```

---

##  errorHandler

La gestión de errores se centraliza en `errorMiddleware.ts`, que a su vez utiliza una Cadena de Responsabilidad para delegar el manejo a un `ErrorHandler` específico según el tipo de error.

### Flujo del `errorMiddleware`

```mermaid
graph TD
    A[Ocurre un Error en el Controlador/Servicio] --> B{errorMiddleware};
    
    subgraph "Cadena de Handlers de Error"
        direction LR
        C{BusinessErrorHandler}
        D{NotFoundErrorHandler}
        E{MongoErrorHandler}
        F[ErrorHandler Genérico]
        
        C -- No es mi tipo --> D;
        D -- No es mi tipo --> E;
        E -- No es mi tipo --> F;
    end

    B --> C;
    C -- ✅ Error manejado --> G[Respuesta HTTP formateada];
    D -- ✅ Error manejado --> G;
    E -- ✅ Error manejado --> G;
    F -- ✅ Error manejado --> G;
```

-   **BusinessErrorHandler**: Maneja errores de lógica de negocio (`BusinessError`).
-   **NotFoundErrorHandler**: Maneja errores de recursos no encontrados (`NotFoundError`).
-   **MongoErrorHandler**: Maneja errores específicos de MongoDB (ej. claves duplicadas).
-   **ErrorHandler Genérico**: Captura cualquier otro error y devuelve una respuesta genérica 500.

---

## 🧠 Estrategia de Caché

La estrategia de caché se implementa siguiendo el patrón **Cache-Aside**, donde la aplicación es responsable de leer y escribir en la caché.

-   **Lectura (Queries)**: El `GetTaskQueryHandler` y `ListTasksQueryHandler` primero intentan obtener los datos de la caché a través del `CacheService`. Si no los encuentran (cache miss), los obtienen del repositorio (base de datos), los guardan en la caché para futuras peticiones y luego los devuelven.
-   **Escritura/Invalidación (Commands)**: Cuando un estado cambia (ej. `UpdateTaskStatusCommandHandler`), el handler no solo actualiza la base de datos, sino que también invalida activamente las entradas de caché relevantes. Utiliza `invalidatePattern` para eliminar claves específicas (como `task:ID`) y claves de listas (`tasks:list:*`) para asegurar que las próximas lecturas obtengan datos frescos.
-   **TTLs (Time-To-Live)**: Se asignan TTLs a las claves de caché para garantizar que los datos no se queden obsoletos indefinidamente, incluso si falla la invalidación explícita.
