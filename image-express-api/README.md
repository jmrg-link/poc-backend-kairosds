# 🖼️ Image Processing API

API REST para procesamiento de imágenes que implementa una arquitectura híbrida. Combina el patrón **Service Layer** para la gestión de peticiones HTTP síncronas con una base **CQRS y Event-Driven** para el procesamiento asíncrono de tareas, garantizando desacoplamiento y escalabilidad.

## 🎯 Características Principales

- **🏗️ Clean Architecture**: Separación clara en capas (Domain, Application, Infrastructure, Presentation)
- **⚡ CQRS Pattern**: Commands para escritura, Queries para lectura con buses independientes
- **🔄 Procesamiento Asíncrono**: BullMQ + Redis para jobs de Sharp image processing
- **📡 Sistema de Eventos**: Redis pub/sub para coordinación y observabilidad
- **📤 Múltiples Fuentes**: Path local, URL remota, upload directo con Multer
- **🧠 Cache Inteligente**: Redis con TTL y invalidación automática por eventos
- **🔒 Robustez**: Idempotencia, validación exhaustiva, error handling por tipos
- **📊 Observabilidad**: Winston-Loki, métricas custom, event tracing

## 📚 Documentación Técnica

| 📖 Documento | 🎯 Contenido |
|--------------|--------------|
| [**📋 Arquitectura General**](docs/ARCHITECTURE.md) | Clean Architecture + CQRS, responsabilidades por capa |
| [**📡 Sistema de Eventos**](docs/EVENTS_FLOW.md) | BullMQ events, Redis pub/sub, event tracing |
| [**🎭 Capas Presentation + Application**](docs/PRESENTATION_APPLICATION_LAYERS.md) | Controllers, Services, CQRS, inyección de dependencias |
| [**📚 Índice Completo**](docs/README.md) | Navegación de toda la documentación técnica |

## 🛠️ Stack Tecnológico

| Componente | Tecnología | Versión | Propósito |
|------------|------------|---------|-----------|
| **🚀 Runtime** | Node.js + TypeScript | 18+ / 5.9.2 | Base del sistema |
| **🌐 Web Framework** | Express.js | 5.1.0 | API REST |
| **🗄️ Base de Datos** | MongoDB + Mongoose | 8.18.0 | Persistencia |
| **⚡ Cache + Queue** | Redis + BullMQ | 5.7.0 + 5.58.2 | Cache + jobs asíncronos |
| **📤 File Upload** | Multer | 2.0.2 | Manejo multipart/form-data |
| **📊 Logging** | Winston + Loki | 3.17.0 + 6.1.3 | Logging empresarial |
| **✅ Validation** | class-validator | 0.14.2 | DTO validation |
| **📝 Documentation** | Swagger UI + OpenAPI | 3.0.3 | API-First docs |

## 🚀 Inicio Rápido

### Prerequisitos

```bash
# Dependencias del sistema
node --version    # 18+
npm --version     # 9+
docker --version  # 20+ (opcional)
```

### Instalación

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar entorno
cp .env.example .env
# Editar .env con configuración local

# 3. Iniciar infraestructura (Docker)
docker-compose up -d mongodb redis

# 4. Ejecutar en desarrollo
npm run dev
```

### Verificación

```bash
# Health check
curl http://localhost:3000/health

# Documentación interactiva
open http://localhost:3000/api-docs

# Test de creación
curl -X POST http://localhost:3000/api/v1/tasks \
  -H "Content-Type: application/json" \
  -d '{"imagePath":"/test/sample.jpg"}'
```

## 📡 API Endpoints

### Base URL: `http://localhost:3000/api/v1`

| Método | Endpoint | Descripción | Casos de Uso |
|--------|----------|-------------|--------------|
| `POST` | `/tasks` | Crear tarea (JSON) | Path local, URL remota |
| `POST` | `/tasks/upload` | Crear con upload | Archivo multipart |
| `GET` | `/tasks/:taskId` | Estado de tarea | Consulta individual |
| `GET` | `/tasks` | Listar tareas | Lista paginada con filtros |
| `POST` | `/tasks/:taskId/retry` | Reintentar fallida | Recovery de errores |

### Endpoints Internos (Depuración y Monitoreo)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/queue/stats` | Estadísticas de la cola de trabajos |
| `GET` | `/queue/jobs/:state` | Ver trabajos por estado (`waiting`, `active`, `failed`, etc.) |
| `DELETE` | `/queue/jobs/:id` | Eliminar un trabajo específico de la cola |
| `GET` | `/redis/keys` | Listar claves de Redis por patrón |
| `GET` | `/redis/get` | Obtener el valor de una clave de Redis |
| `DELETE` | `/redis/keys` | Eliminar claves de Redis por patrón |
| `DELETE` | `/redis/keys/:key` | Eliminar una clave específica de Redis |

### Ejemplos de Uso

#### Crear desde URL
```bash
curl -X POST http://localhost:3000/api/v1/tasks \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: unique-key-123" \
  -d '{"imageUrl": "https://example.com/image.jpg"}'
```

#### Upload de archivo
```bash
curl -X POST http://localhost:3000/api/v1/tasks/upload \
  -H "X-Idempotency-Key: unique-key-456" \
  -F "image=@/path/to/local/image.jpg"
```

#### Consultar estado
```bash
curl http://localhost:3000/api/v1/tasks/65d4a54b89c5e342b2c2c5f6
```

**Respuesta según estado:**

```json
// Estado: pending/processing
{
  "taskId": "65d4a54b89c5e342b2c2c5f6",
  "status": "pending",
  "price": 25.5
}

// Estado: completed
{
  "taskId": "65d4a54b89c5e342b2c2c5f6", 
  "status": "completed",
  "price": 25.5,
  "images": [
    {
      "resolution": "1024",
      "path": "/output/image1/1024/f322b730b287da77e1c519c7ffef4fc2.jpg"
    },
    {
      "resolution": "800",
      "path": "/output/image1/800/202fd8b3174a774bac24428e8cb230a1.jpg" 
    }
  ]
}
```

## 🏗️ Arquitectura Simplificada

### Flujo de Arquitectura Híbrida

```mermaid
graph LR
    subgraph "📱 Cliente"
        CLIENT[Cliente HTTP]
    end
    
    subgraph "🎭 API Express (Flujo Síncrono)"
        CONTROLLER[TaskController]
        SERVICE[TaskService]
        REPOSITORY[TaskRepository]
    end
    
    subgraph "⚙️ Procesamiento Asíncrono (Flujo Event-Driven)"
        QUEUE[BullMQ Queue]
        WORKER[Image Worker Externo]
        EVENTS[TaskEvents]
        SUBSCRIBER[Event Subscriber]
        MEDIATOR[CQRS Mediator]
    end
    
    subgraph "💾 Persistencia"
        MONGODB[MongoDB]
        REDIS[Redis]
    end
    
    CLIENT --> CONTROLLER
    CONTROLLER --> SERVICE
    SERVICE --> REPOSITORY
    SERVICE --> QUEUE
    
    REPOSITORY --> MONGODB
    
    QUEUE --> WORKER
    WORKER -->|Reporta a| QUEUE
    
    QUEUE -->|Notifica a| EVENTS
    EVENTS -->|Publica en| REDIS
    
    REDIS -->|Es escuchado por| SUBSCRIBER
    SUBSCRIBER -->|Usa| MEDIATOR
```
**Nota sobre la Arquitectura:** El flujo de peticiones HTTP (crear/leer tareas) es manejado por un patrón **Service Layer** (`Controller -> Service -> Repository`) para una respuesta inmediata y una lógica cohesiva. El sistema **CQRS y de Eventos** está diseñado para el flujo de trabajo asíncrono, donde un worker procesa las imágenes y emite eventos. Un suscriptor de eventos (actualmente desacoplado) es responsable de consumir estos eventos y usar el `Mediator` para actualizar el estado final en la base de datos, completando el ciclo de vida de la tarea.

### Estados de Tarea

```mermaid
stateDiagram-v2
    [*] --> Pendiente: POST /tasks
    
    Pendiente --> Procesando: Worker pickup
    Pendiente --> Fallida: Validación error
    
    Procesando --> Completada: Sharp success
    Procesando --> Fallida: Processing error
    
    Completada --> [*]: Finalizada
    
    Fallida --> Pendiente: POST /retry
    Fallida --> [*]: Error final
    
    note right of Pendiente
        • En cola BullMQ
        • Precio asignado (5-50)
        • Cache invalidado
    end note
    
    note right of Procesando
        • Worker Sharp activo
        • Status en MongoDB
        • Evento task.processing
    end note
    
    note right of Completada
        • Variantes 1024px + 800px
        • Paths en MongoDB
        • Evento task.completed
    end note
    
    note right of Fallida
        • Error registrado
        • Logs para debugging
        • Retry disponible
    end note
```

## 📁 Estructura del Proyecto

```
image-express-api/
├── 📚 docs/                          # Documentación técnica
│   ├── README.md                     # Índice de documentación
│   ├── ARCHITECTURE.md               # Clean Architecture + CQRS
│   ├── EVENTS_FLOW.md               # Sistema de eventos
│   └── PRESENTATION_APPLICATION_LAYERS.md # Capas específicas
├── 📦 src/
│   ├── 🎯 domain/                    # Entidades, DTOs, Value Objects
│   │   ├── entities/                # TaskEntity, ImageEntity
│   │   ├── dtos/                    # CreateTaskDto, GetTaskParamsDto
│   │   └── value-objects/           # TaskStatus, ImageResolution
│   ├── ⚡ application/               # CQRS + Services
│   │   ├── core/                    # CommandBus, QueryBus, Mediator
│   │   ├── commands/                # CreateTask, UpdateTaskStatus
│   │   ├── queries/                 # GetTask, ListTasks
│   │   ├── handlers/                # Command/Query handlers
│   │   ├── repositories/            # Interfaces ITaskRepository
│   │   └── services/                # ImageDownloadService, etc.
│   ├── 🔧 infrastructure/            # BD, Cache, Queue, Upload
│   │   ├── databases/               # MongoDB connector
│   │   ├── cache/                   # Redis cache + connection
│   │   ├── queues/                  # BullMQ + events
│   │   ├── schemas/                 # Mongoose schemas
│   │   └── upload/                  # Multer configuration
│   ├── 🎭 presentation/             # Controllers, Routes, Middlewares
│   │   ├── Bootstrap/               # Express app setup
│   │   └── Task/                    # Task module (CRUD)
│   └── 🔧 core/                     # Helpers, errors, types
│       ├── errors/                  # Chain of responsibility
│       ├── helpers/                 # crypto, logger, time
│       └ types/                     # TypeScript definitions
├── 🧪 tests/                        # Unit + Integration tests
├── 📝 swagger.yaml                  # OpenAPI 3.0 specification  
└── 📋 README.md                     # Esta documentación
```

## 🔧 Configuración

### Variables de Entorno

```bash
# Servidor
NODE_ENV=development
SERVER_PORT=3000

# Base de datos
MONGODB_URI=mongodb://localhost:27017/imagedb

# Redis (cache + queue)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Cola BullMQ
QUEUE_NAME=image-processing
QUEUE_CONCURRENCY=5
QUEUE_MAX_RETRIES=3

# Storage
STORAGE_INPUT_PATH=/app/uploads
STORAGE_OUTPUT_PATH=/app/output

# API
API_KEY=development-key
ENABLE_SWAGGER=true

# Logging
LOG_LEVEL=info
LOKI_URL=                    # Solo producción
LOKI_BATCH_SIZE=100
LOKI_BATCH_INTERVAL=5000

# Versioning
APP_VERSION=1.0.0
```

### Docker Compose

```yaml
version: '3.8'
services:
  mongodb:
    image: mongo:7
    ports:
      - "27017:27017"
    environment:
      - MONGO_INITDB_ROOT_USERNAME=root
      - MONGO_INITDB_ROOT_PASSWORD=password
    
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - MONGODB_URI=mongodb://root:password@mongodb:27017/imagedb?authSource=admin
      - REDIS_HOST=redis
    depends_on:
      - mongodb
      - redis
```

## 🧪 Testing

### Estrategia de Testing

```bash
# Tests unitarios (handlers, services)
npm run test:unit

# Tests de integración (endpoints E2E)
npm run test:integration

# Coverage report
npm run test:coverage

# Watch mode desarrollo
npm run test:watch
```

### Ejemplo de Test CQRS

```typescript
describe('CreateTaskCommandHandler', () => {
  test('debe crear tarea y encolar job', async () => {
    // Given
    const command = new CreateTaskCommand('/test/image.jpg', 25, 'key-123');
    
    // When
    const result = await handler.execute(command);
    
    // Then
    expect(result.status).toBe('pending');
    expect(mockRepository.create).toHaveBeenCalled();
    expect(mockQueue.addTask).toHaveBeenCalled();
  });
});
```

## 📊 Monitoreo y Observabilidad

### Health Checks

```bash
# API health
curl http://localhost:3000/health

# Queue status
redis-cli LLEN bull:image-processing:wait
redis-cli LLEN bull:image-processing:active

# Cache statistics
redis-cli INFO stats | grep keyspace
```

### Métricas Custom

```typescript
// En el código
logMetric('task_created', 1, { source: 'upload' });
logMetric('processing_time', duration, { resolution: '1024px' });

// Query métricas
logger.info('system_metrics', {
  active_tasks: await getActiveTasks(),
  queue_length: await getQueueLength(),
  cache_hit_rate: hits / total
});
```

### Event Monitoring

```bash
# Monitorear eventos en tiempo real
redis-cli SUBSCRIBE task-events

# Ejemplo de evento
{
  "taskId": "65d4a54b89c5e342b2c2c5f6",
  "eventType": "task.completed", 
  "timestamp": 1640995200000,
  "images": [...],
  "processingTime": 2340
}
```

## ⚙️ Integración con Worker

### Coordinación API ↔ Worker

```mermaid
sequenceDiagram
    participant API as Express API
    participant Queue as BullMQ
    participant Worker as Image Worker
    participant Events as Redis Pub/Sub
    participant Subscriber as Event Subscriber
    
    API->>Queue: 1. Encola un nuevo trabajo
    Queue->>Worker: 2. Entrega el trabajo
    Worker->>Worker: 3. Procesa la imagen
    Worker->>Queue: 4. Reporta el resultado (éxito/fallo)
    Queue->>API: 5. Notifica a la API del resultado
    API->>Events: 6. Publica un evento de dominio (ej. 'task.completed')
    Events->>Subscriber: 7. El suscriptor consume el evento
    Subscriber->>API: 8. Usa el Mediator de CQRS para actualizar la BD
```

### Event Types para Worker

| Evento | Origen | Propósito |
|--------|--------|-----------|
| `task.created` | API | Worker sabe que hay nueva tarea |
| `task.processing` | Worker | API actualiza estado en tiempo real |
| `task.completed` | Worker | API invalida cache y actualiza |
| `task.failed` | Worker | API marca error para retry |

## 🎯 Patrones de Diseño

### CQRS Implementation

```mermaid
graph LR
    subgraph "📝 Commands (Write)"
        CREATE_CMD[CreateTaskCommand]
        UPDATE_CMD[UpdateTaskStatusCommand]
        CREATE_H[CreateTaskHandler]
        UPDATE_H[UpdateTaskHandler]
    end
    
    subgraph "🔍 Queries (Read)"
        GET_Q[GetTaskQuery]
        LIST_Q[ListTasksQuery]
        GET_H[GetTaskHandler]
        LIST_H[ListTasksHandler]
    end
    
    subgraph "🎛️ CQRS Core"
        MEDIATOR[Mediator<br/>Central Dispatcher]
        CMD_BUS[CommandBus<br/>Write Operations]
        QUERY_BUS[QueryBus<br/>Read Operations]
    end
    
    CREATE_CMD --> CMD_BUS
    UPDATE_CMD --> CMD_BUS
    CMD_BUS --> CREATE_H
    CMD_BUS --> UPDATE_H
    
    GET_Q --> QUERY_BUS
    LIST_Q --> QUERY_BUS
    QUERY_BUS --> GET_H
    QUERY_BUS --> LIST_H
    
    MEDIATOR --> CMD_BUS
    MEDIATOR --> QUERY_BUS
    
    style MEDIATOR fill:#ff9999
    style CMD_BUS fill:#99ff99
    style QUERY_BUS fill:#99ccff
```

## 🔐 Seguridad

### Características de Seguridad

- **🔑 API Key**: Header `X-API-Key` obligatorio
- **🛡️ Helmet**: Headers de seguridad HTTP
- **🚦 Rate Limiting**: Límites por IP configurables
- **✅ Input Validation**: class-validator exhaustivo
- **🔄 Idempotencia**: X-Idempotency-Key previene duplicados
- **🧹 Sanitización**: Whitelist validation, no propiedades extra

### Headers de Seguridad

```http
# Request headers requeridos
X-API-Key: your-api-key-here
Content-Type: application/json
X-Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000

# Response headers automáticos
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
```

## 🚀 Deployment

### Producción

```bash
# Build optimizado
npm run build

# Variables de producción  
export NODE_ENV=production
export LOKI_URL=http://loki:3100
export MONGODB_URI=mongodb://prod-mongo/imagedb
export REDIS_HOST=prod-redis

# Ejecutar
npm start
```

## 📈 Performance

### Métricas de Rendimiento

| Métrica | Valor Objetivo | Optimización |
|---------|---------------|--------------|
| **Response Time** | < 100ms | Redis cache hit |
| **Throughput** | 1000 req/min | BullMQ async |
| **Cache Hit Rate** | > 80% | TTL 60s inteligente |
| **Queue Processing** | 5 jobs paralelos | Worker concurrency |
| **Error Rate** | < 1% | Validation + retry |

### Optimizaciones Implementadas

- **📄 Lean Queries**: MongoDB sin overhead Mongoose
- **🔄 Connection Pooling**: Reutilización de conexiones
- **⚡ Cache Strategy**: Redis con invalidación por eventos
- **📦 Compression**: gzip para responses grandes
- **🎯 Índices BD**: Optimizados para queries frecuentes

## 🤝 Desarrollo

### Scripts Disponibles

```json
{
  "scripts": {
    "dev": "tsx watch src/main.ts",
    "build": "tsc",
    "start": "node dist/main.js", 
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint src/ --ext .ts",
    "format": "prettier --write src/"
  }
}
```

### Flujo de Desarrollo

```mermaid
graph LR
    FEATURE[Nueva Feature] --> DOMAIN[Definir Entity/DTO]
    DOMAIN --> CMD[Crear Command/Query]
    CMD --> HANDLER[Implementar Handler]  
    HANDLER --> TEST[Tests unitarios]
    TEST --> CTRL[Controller endpoint]
    CTRL --> ROUTE[Configurar ruta]
    ROUTE --> DOCS[Actualizar Swagger]
    DOCS --> E2E[Tests integración]
    E2E --> PR[Pull Request]
```
