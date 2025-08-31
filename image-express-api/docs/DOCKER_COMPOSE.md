# Docker Compose - Sistema de Procesamiento de Imágenes

## Descripción General

El proyecto utiliza Docker Compose para orquestar un sistema empresarial completo de procesamiento de imágenes que implementa **Clean Architecture + CQRS + Event-Driven patterns**.

## Stack Tecnológico

### Runtime y Framework
- **Node.js**: v22 LTS
- **Framework**: Express.js con TypeScript
- **Arquitectura**: Clean Architecture + CQRS

### Bases de Datos y Cache
- **MongoDB**: 7.0 con autenticación
- **Redis**: 7.4 para cache (Cache-Aside) y colas (BullMQ)

### Procesamiento
- **Image Processing**: Sharp con resoluciones 1024px y 800px
- **Queue System**: BullMQ para procesamiento asíncrono

### Monitoreo y Observabilidad
- **Métricas**: Prometheus 2.48
- **Dashboards**: Grafana 10.2
- **Logs**: Loki 3.0 para agregación de logs

### Proxy y Seguridad
- **Proxy Reverso**: Traefik v3.5 con HTTP/3
- **SSL**: Certificados automáticos con Let's Encrypt
- **Rate Limiting**: 100 req/min promedio, burst 200

## Arquitectura de Red

### Redes Docker

```yaml
networks:
  proxy:      # Frontend y routing (Traefik + API)
  backend:    # Servicios internos (API + Worker + BD)
  monitoring: # Stack de observabilidad
```

### Topología de Red
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   PROXY     │    │   BACKEND   │    │ MONITORING  │
│             │    │             │    │             │
│ - Traefik   │    │ - API       │    │ - Loki      │
│ - API       │◄──►│ - Worker    │    │ - Prometheus│
│ - Grafana   │    │ - MongoDB   │    │ - Grafana   │
│             │    │ - Redis     │    │ - Traefik   │
└─────────────┘    └─────────────┘    └─────────────┘
```

## Servicios

### 1. Traefik (Proxy Reverso)

**Propósito**: Proxy reverso, load balancer, SSL automático

```yaml
traefik:
  image: traefik:v3.5
  ports:
    - "80:80"     # HTTP
    - "443:443"   # HTTPS/HTTP3
    - "8082:8082" # Métricas
```

**Características**:
- ✅ HTTP/3 habilitado
- ✅ SSL automático con Let's Encrypt
- ✅ Rate limiting (100 req/min)
- ✅ Headers de seguridad
- ✅ CORS configurado
- ✅ Métricas para Prometheus

### 2. API Backend (Express + TypeScript)

**Propósito**: API REST con Clean Architecture + CQRS

```yaml
api-backend:
  build: ./image-express-api
  environment:
    NODE_ENV: production
    SERVER_PORT: 3000
    MONGODB_URI: mongodb://root:${MONGO_PASSWORD}@mongodb:27017/imagedb
    REDIS_HOST: redis
    STORAGE_INPUT_PATH: /app/storage/images/input
    STORAGE_OUTPUT_PATH: /app/storage/images/output
```

**Características**:
- ✅ Clean Architecture + CQRS
- ✅ Swagger UI habilitado
- ✅ Rate limiting por Traefik
- ✅ Logs estructurados a Loki
- ✅ Métricas de aplicación

### 3. Worker (Procesamiento de Imágenes)

**Propósito**: Procesamiento asíncrono con Sharp

```yaml
worker:
  build: ./image-processing-worker
  environment:
    CONCURRENCY: 5
    MAX_RETRIES: 3
    STORAGE_INPUT_PATH: /app/storage/images/input
    STORAGE_OUTPUT_PATH: /app/storage/images/output
```

**Características**:
- ✅ Event-Driven Architecture
- ✅ BullMQ para colas
- ✅ Procesamiento con Sharp
- ✅ Reintentos automáticos
- ✅ Logs centralizados

### 4. MongoDB (Base de Datos)

**Propósito**: Persistencia principal

```yaml
mongodb:
  image: mongo:7.0
  environment:
    MONGO_INITDB_ROOT_USERNAME: root
    MONGO_INITDB_ROOT_PASSWORD: ${MONGO_ROOT_PASSWORD}
    MONGO_INITDB_DATABASE: imagedb
```

**Características**:
- ✅ Autenticación habilitada
- ✅ OpLog optimizado (1024MB)
- ✅ Healthcheck configurado
- ✅ Volúmenes persistentes

### 5. Redis (Cache y Colas)

**Propósito**: Cache de aplicación y sistema de colas

```yaml
redis:
  image: redis:7.4-alpine
  command: |
    redis-server
    --maxmemory 768mb
    --maxmemory-policy noeviction
    --requirepass ${REDIS_PASSWORD}
    --save 900 1
    --appendonly yes
```

**Características**:
- ✅ Persistencia con AOF
- ✅ Snapshot automático
- ✅ Política de memoria configurada
- ✅ Autenticación por contraseña

## Almacenamiento Compartido

### Configuración de Volúmenes

```yaml
# API Backend
volumes:
  - ./storage:/app/storage

# Worker
volumes:
  - ./storage:/app/storage
```

### Estructura de Directorios

```
./storage/
├── images/
│   ├── input/     # Imágenes originales
│   │   ├── {taskId}/
│   │   │   └── original.jpg
│   └── output/    # Imágenes procesadas
│       ├── {taskId}/
│       │   ├── 1024x1024.jpg
│       │   └── 800x800.jpg
```

### Flujo de Datos

1. **API** recibe imagen → `storage/images/input/{taskId}/`
2. **Worker** procesa → `input/{taskId}/` → `output/{taskId}/`
3. **API** sirve procesadas desde → `storage/images/output/{taskId}/`

## Monitoreo y Observabilidad

### Stack de Monitoreo

```yaml
# Métricas
prometheus:
  image: prom/prometheus:v2.48.0
  
# Dashboards  
grafana:
  image: grafana/grafana:10.2.0
  
# Logs
loki:
  image: grafana/loki:3.0.0
```

### Endpoints de Monitoreo

- **Grafana**: `https://grafana.${DOMAIN}`
- **Prometheus**: `http://localhost:9090`
- **Loki**: `http://localhost:3100`
- **Traefik Dashboard**: `https://traefik.${DOMAIN}`

## Variables de Entorno

### Archivo .env Requerido

```bash
# Dominio
DOMAIN=localhost

# Seguridad
API_KEY=your-api-key
TRAEFIK_AUTH=admin:$2y$10$encrypted_password

# Base de Datos
MONGO_ROOT_PASSWORD=secure_mongo_password
MONGO_PASSWORD=secure_mongo_password

# Cache
REDIS_PASSWORD=secure_redis_password

# Monitoreo
GRAFANA_PASSWORD=secure_grafana_password

# SSL (para producción)
SSL_EMAIL=admin@yourdomain.com

# Aplicación
APP_VERSION=1.0.0
WORKER_ID=worker-1
```

## Comandos de Gestión

### Desarrollo

```bash
# Levantar todo el stack
docker-compose up -d

# Logs en tiempo real
docker-compose logs -f api-backend worker

# Rebuild de servicios
docker-compose build --no-cache api-backend worker
```

### Producción

```bash
# Deploy completo
docker-compose -f docker-compose.yml up -d

# Backup de MongoDB
docker exec poc-mongodb mongodump --uri="mongodb://root:${MONGO_PASSWORD}@localhost:27017/imagedb?authSource=admin"

# Monitoreo de recursos
docker stats
```

### Mantenimiento

```bash
# Limpiar volúmenes huérfanos
docker volume prune

# Limpiar imágenes antiguas
docker image prune -a

# Restart de servicio específico
docker-compose restart api-backend
```

## Health Checks

Todos los servicios incluyen health checks:

```yaml
healthcheck:
  test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
  interval: 30s
  timeout: 10s
  retries: 5
```

## Seguridad

### Headers de Seguridad (Traefik)

- **HSTS**: 31536000 segundos
- **Content Type Nosniff**: Habilitado
- **XSS Filter**: Habilitado
- **Frame Options**: Deny

### Rate Limiting

- **Promedio**: 100 requests/minuto
- **Burst**: 200 requests
- **Periodo**: 1 minuto

## Escalabilidad

### Horizontal Scaling

```yaml
# Múltiples workers
worker:
  deploy:
    replicas: 3
    
# Load balancing automático por Traefik
```

### Vertical Scaling

```yaml
# Recursos por servicio
deploy:
  resources:
    limits:
      memory: 512M
      cpus: '0.5'
```

## Troubleshooting

### Logs Centralizados

```bash
# Ver logs de API
docker-compose logs api-backend

# Ver logs de Worker
docker-compose logs worker

# Ver todos los logs
docker-compose logs -f
```

### Verificación de Red

```bash
# Verificar conectividad
docker network ls
docker network inspect proxy backend monitoring
```

### Estado de Servicios

```bash
# Health status
docker-compose ps
docker inspect $(docker ps -q) --format='{{.Name}}: {{.State.Health.Status}}'