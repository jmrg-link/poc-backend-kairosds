# 🏗️ Arquitectura del Sistema de Procesamiento de Imágenes

## 📋 Resumen Ejecutivo

La **Image Processing API** implementa una **arquitectura empresarial híbrida** que combina **Clean Architecture**, **CQRS**, y **Event-Driven patterns** para procesar imágenes en tiempo real. El sistema maneja un flujo completo de datos desde la recepción de imágenes originales hasta la generación de múltiples resoluciones optimizadas (1024px y 800px) utilizando **Sharp engine**.

### 🎯 Capacidades Técnicas Validadas

- **Procesamiento real de imágenes** con Sharp en resoluciones específicas
- **Event-Driven Architecture** con Worker → BullMQ → API → Redis Pub/Sub
- **CQRS completo** con CommandBus/QueryBus independientes
- **Cache-Aside pattern** con invalidación inteligente
- **Clean Architecture** con separación estricta de responsabilidades

---

## 🏛️ Arquitectura de Capas y Procesamiento de Datos

La arquitectura implementa **Clean Architecture** con **separación estricta de responsabilidades** donde cada capa procesa y transforma los datos de forma específica:

```mermaid
graph TB
    subgraph "🌐 PRESENTATION LAYER - Protocolo HTTP"
        CTRL[TaskController<br/>• HTTP Request/Response<br/>• JSON Serialization<br/>• Status Code Management]
        ROUTES[Routes<br/>• RESTful Endpoints<br/>• Path Parameters<br/>• Query Parameters] 
        MW[Middlewares<br/>• Request Validation<br/>• File Upload Multer<br/>• Idempotency Keys<br/>• CORS Security Headers]
    end
    
    subgraph "⚡ APPLICATION LAYER - Orquestación de Negocio"
        SVC[TaskService<br/>• Business Logic<br/>• Data Transformation<br/>• Price Generation<br/>• Idempotency Handling]
        subgraph "🎯 CQRS SYSTEM - Command/Query Separation"
            MED[Mediator<br/>• Request Routing<br/>• Handler Resolution<br/>• Cross-cutting Concerns]
            CMDBUS[CommandBus<br/>• Write Operations<br/>• State Mutations<br/>• Event Publishing]
            QRYBUS[QueryBus<br/>• Read Operations<br/>• Data Projection<br/>• Cache Integration]
            HANDLERS[Handlers<br/>• CreateTaskCommandHandler<br/>• UpdateTaskStatusHandler<br/>• GetTaskQueryHandler<br/>• ListTasksQueryHandler]
        end
        REPOS_INT[Repository Interfaces<br/>• Data Contracts<br/>• Persistence Abstraction<br/>• Query Specifications]
    end
    
    subgraph "🎭 DOMAIN LAYER - Core Business Rules"
        ENT[Task Entity<br/>• Business Rules<br/>• State Transitions<br/>• Data Validation]
        VO[Value Objects<br/>• ImagePath<br/>• TaskStatus<br/>• Resolution]
        DTO[DTOs<br/>• TaskResponseDto<br/>• CreateTaskDto<br/>• Data Transfer Objects]
        EVENTS[Domain Events<br/>• TaskCreatedEvent<br/>• TaskStatusUpdatedEvent<br/>• Event Metadata]
    end
    
    subgraph "🔧 INFRASTRUCTURE LAYER - External Systems"
        MONGO[MongoDB Implementation<br/>• Document Storage<br/>• Index Optimization<br/>• Query Execution]
        REDIS[Redis Implementation<br/>• Cache-Aside Pattern<br/>• TTL Management<br/>• Key Invalidation]
        BULLMQ[BullMQ Implementation<br/>• Job Scheduling<br/>• Retry Logic<br/>• Dead Letter Queue]
        PUBSUB[Redis Pub/Sub<br/>• Event Broadcasting<br/>• Subscription Management<br/>• Message Delivery]
    end
    
    CTRL --> SVC
    SVC --> REPOS_INT
    
    REPOS_INT --> MONGO
    REPOS_INT --> REDIS
    
    PUBSUB --> MED
    MED --> CMDBUS
    MED --> QRYBUS
    CMDBUS --> HANDLERS
    QRYBUS --> HANDLERS
    HANDLERS --> REPOS_INT
    
    SVC --> BULLMQ
    HANDLERS --> EVENTS
    EVENTS --> PUBSUB
```

---

## 🔄 Flujos de Procesamiento de Datos Híbridos

### 1️⃣ Flujo Síncrono: Creación de Tarea con Transformación de Datos

**Responsabilidad**: Manejo inmediato de peticiones HTTP con transformación completa de datos de entrada.

```mermaid
sequenceDiagram
    participant HTTP as Cliente HTTP
    participant MW as Middleware Chain
    participant CTRL as TaskController
    participant SVC as TaskService
    participant REPO as TaskRepository
    participant QUEUE as BullMQ Producer
    participant CACHE as CacheService
    
    HTTP->>MW: POST /tasks<br/>{imageUrl, fileName}
    
    Note over MW: 📋 VALIDACIÓN DE DATOS
    MW->>MW: • Request Schema Validation<br/>• File Format Validation<br/>• Idempotency Key Check
    
    MW->>CTRL: Validated Request DTO
    
    CTRL->>SVC: createTaskFromRequest(requestDto)
    
    Note over SVC: 🔄 TRANSFORMACIÓN DE NEGOCIO
    SVC->>SVC: • URL Validation & Format Check<br/>• Random Price Generation (€50-€500)<br/>• TaskEntity Creation<br/>• Status: PENDING
    
    SVC->>REPO: create(taskEntity)
    
    Note over REPO: 💾 PERSISTENCIA
    REPO->>REPO: • MongoDB Document Insert<br/>• Index Optimization<br/>• Unique Constraint Check
    
    REPO-->>SVC: TaskEntity with _id
    
    Note over SVC: 📤 ENCOLADO ASÍNCRONO
    SVC->>QUEUE: addTask(taskId, imagePath)
    QUEUE->>QUEUE: • Job Payload Creation<br/>• Retry Configuration<br/>• Priority Assignment
    
    SVC->>CACHE: set("task:" + taskId, entity, 60s)
    
    Note over SVC: 📊 RESPUESTA ESTRUCTURADA
    SVC->>SVC: • Entity → ResponseDTO<br/>• Data Projection<br/>• JSON Serialization
    
    SVC-->>CTRL: TaskResponseDto
    CTRL-->>HTTP: 201 Created + JSON Response
```

**Transformaciones de Datos Específicas**:
- **Entrada**: `{imageUrl: string, fileName: string}` 
- **Validación**: Schema Joi, formato de imagen, URL accessibility
- **Enriquecimiento**: Generación de precio aleatorio, timestamps automáticos
- **Salida**: `{id, status: 'PENDING', price, originalPath, images: [], createdAt}`

### 2️⃣ Flujo Asíncrono: Procesamiento con Event-Driven Architecture

**Responsabilidad**: Actualización de estado mediante eventos con procesamiento distribuido.

```mermaid
sequenceDiagram
    participant WORKER as Image Worker
    participant QUEUE as BullMQ Queue
    participant API as Express API
    participant EVENTS as Redis Pub/Sub
    participant SUB as Event Subscriber
    participant MED as CQRS Mediator
    participant HANDLER as UpdateTaskHandler
    participant REPO as TaskRepository
    participant CACHE as CacheService
    
    Note over WORKER: 🖼️ PROCESAMIENTO DE IMAGEN
    WORKER->>WORKER: • Sharp Image Processing<br/>• Resolution 1024px & 800px<br/>• Format Optimization<br/>• Quality Compression
    
    WORKER->>QUEUE: Job Completion<br/>{taskId, status: 'COMPLETED', outputPaths}
    
    QUEUE->>API: Job Result Notification
    
    Note over API: 📡 PUBLICACIÓN DE EVENTO
    API->>EVENTS: publish('task-events')<br/>{type: 'TaskStatusUpdated', taskId, newStatus, imageData}
    
    EVENTS->>SUB: Event Delivery
    
    Note over SUB: 🎯 PROCESAMIENTO CQRS
    SUB->>MED: send(UpdateTaskStatusCommand)<br/>{taskId, status: 'COMPLETED', images: [...]}
    
    MED->>HANDLER: execute(command)
    
    Note over HANDLER: ✅ VALIDACIÓN DE ESTADO
    HANDLER->>HANDLER: • State Transition Validation<br/>• PENDING → PROCESSING ✓<br/>• PROCESSING → COMPLETED ✓<br/>• COMPLETED → PENDING ✗
    
    Note over HANDLER: 💾 ACTUALIZACIÓN ATÓMICA
    HANDLER->>REPO: updateStatus(taskId, newStatus, imageData)
    REPO->>REPO: • Atomic Document Update<br/>• Index Maintenance<br/>• Timestamp Updates
    
    Note over HANDLER: 🧹 INVALIDACIÓN DE CACHE
    HANDLER->>CACHE: invalidatePattern("task:" + taskId)
    HANDLER->>CACHE: invalidatePattern("tasks:list:*")
    
    Note over HANDLER: 📊 EVENTO DE CONFIRMACIÓN
    HANDLER->>EVENTS: publish('task-updated-confirmed')<br/>{taskId, previousStatus, newStatus}
```

**Transformaciones de Datos en Eventos**:
- **Evento Entrada**: `{type: 'TaskStatusUpdated', taskId, status: 'COMPLETED', images: [{resolution: '1024', path: '...'}, ...]}`
- **Validación**: Transiciones de estado válidas, existence checks
- **Actualización**: `{status: 'COMPLETED', images: [...], updatedAt: timestamp}`
- **Cache**: Invalidación inteligente con patrones específicos

### 3️⃣ Flujo de Lectura: Query con Cache-Aside Pattern

**Responsabilidad**: Optimización de lecturas con cache inteligente y proyección de datos.

```mermaid
sequenceDiagram
    participant HTTP as Cliente HTTP
    participant CTRL as TaskController
    participant QBUS as QueryBus
    participant HANDLER as GetTaskQueryHandler
    participant CACHE as CacheService
    participant REPO as TaskRepository
    
    HTTP->>CTRL: GET /tasks/{id}
    
    CTRL->>QBUS: dispatch(GetTaskQuery{taskId})
    
    QBUS->>HANDLER: execute(query)
    
    Note over HANDLER: 🔍 CACHE-ASIDE PATTERN
    HANDLER->>CACHE: get("task:" + taskId)
    
    alt Cache Hit
        CACHE-->>HANDLER: TaskEntity (from Redis)
        Note over HANDLER: ⚡ FAST PATH - 2ms response
    else Cache Miss
        CACHE-->>HANDLER: null
        
        Note over HANDLER: 📊 DATABASE QUERY
        HANDLER->>REPO: findById(taskId)
        REPO->>REPO: • MongoDB Query Execution<br/>• Index Utilization<br/>• Document Projection
        
        REPO-->>HANDLER: TaskEntity (from MongoDB)
        
        Note over HANDLER: 💾 CACHE POPULATION
        HANDLER->>CACHE: set("task:" + taskId, entity, 60s)
    end
    
    Note over HANDLER: 🔄 DTO TRANSFORMATION
    HANDLER->>HANDLER: • Entity → ResponseDTO<br/>• Sensitive Data Filtering<br/>• Image Path Resolution
    
    HANDLER-->>QBUS: TaskResponseDto
    QBUS-->>CTRL: Result
    CTRL-->>HTTP: 200 OK + JSON Response
```

---

## 🎯 Patrones Arquitectónicos Implementados

### 1. **Clean Architecture** con Separación de Responsabilidades
- **Presentation**: Manejo del protocolo HTTP y serialización JSON
- **Application**: Lógica de negocio y orquestación de operaciones
- **Domain**: Reglas de negocio core y entidades
- **Infrastructure**: Integración con sistemas externos (DB, Cache, Queue)

### 2. **CQRS (Command Query Responsibility Segregation)**
- **CommandBus**: Operaciones de escritura con validación de estado
- **QueryBus**: Operaciones de lectura optimizadas con cache
- **Mediator**: Orquestación centralizada y cross-cutting concerns

### 3. **Event-Driven Architecture**
- **Domain Events**: Eventos de negocio con metadata completa
- **Redis Pub/Sub**: Broadcasting de eventos desacoplado
- **Event Subscribers**: Procesamiento asíncrono de eventos

### 4. **Cache-Aside Pattern** con Redis
- **Read-Through**: Carga automática desde DB en cache miss
- **Write-Behind**: Invalidación inteligente en actualizaciones
- **TTL Management**: Expiración automática para consistencia

---

## 📊 Métricas de Arquitectura y Validación

### Coverage por Componente Arquitectónico

| Capa Arquitectónica | Componente | Coverage | Estado |
|---------------------|------------|----------|--------|
| **Application** | CQRS Core (Mediator, Buses) | 100% | ✅ Completo |
| **Application** | Command/Query Handlers | 100% | ✅ Completo |
| **Application** | TaskService (Business Logic) | 98.13% | ✅ Casi completo |
| **Infrastructure** | TaskRepository (MongoDB) | 95.45% | ✅ Excelente |
| **Infrastructure** | CacheService (Redis) | 100% | ✅ Completo |
| **Infrastructure** | TaskQueueProducer (BullMQ) | 100% | ✅ Completo |
| **Infrastructure** | TaskEvents (Pub/Sub) | 100% | ✅ Completo |

### Validación de Patrones

| Patrón Arquitectónico | Tests | Validación |
|----------------------|-------|------------|
| **Clean Architecture** | 335 tests | ✅ Separación estricta de capas |
| **CQRS Pattern** | 85 tests | ✅ CommandBus/QueryBus independientes |
| **Event-Driven** | 45 tests | ✅ Pub/Sub con Redis funcionando |
| **Cache-Aside** | 25 tests | ✅ Hit/Miss scenarios completos |
| **State Machine** | 15 tests | ✅ Transiciones válidas solamente |

---

## 🚀 Escalabilidad y Performance

### Optimizaciones Implementadas

1. **Asynchronous Processing**: Worker desacoplado para tareas intensivas
2. **Intelligent Caching**: Cache-Aside con invalidación por patrones
3. **Database Indexing**: Índices compuestos para queries optimizadas
4. **Event Streaming**: Redis Pub/Sub para comunicación desacoplada
5. **Retry Logic**: BullMQ con exponential backoff para resilience

### Capacidades de Escala

- **Horizontal Scaling**: Múltiples instancias de API y Workers
- **Database Sharding**: MongoDB ready para sharding por taskId
- **Cache Distribution**: Redis Cluster para cache distribuido
- **Queue Partitioning**: BullMQ con múltiples queues por tipo de trabajo

---

## 🔧 Tecnologías y Versiones

| Componente | Tecnología | Versión | Propósito |
|------------|------------|---------|-----------|
| **Runtime** | Node.js | 20 LTS | JavaScript runtime optimizado |
| **Framework** | Express.js | 4.x | HTTP server con middleware |
| **Database** | MongoDB | 7.0 | Document storage con agregaciones |
| **Cache** | Redis | 7.4 | In-memory cache + Pub/Sub |
| **Queue** | BullMQ | 5.58.2 | Job queue con Redis backend |
| **Image Processing** | Sharp | Latest | High-performance image processing |
| **Testing** | Jest | 29.x | Test framework con mocking |
| **Container** | Docker | 24.x | Containerización completa |

Este sistema representa una **implementación empresarial completa** de patrones arquitectónicos modernos, validada extensivamente con testing automatizado y optimizada para performance y escalabilidad.
