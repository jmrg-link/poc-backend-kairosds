# Documentación de Construcción de Contenedores - API Express con TypeScript

## Descripción General

Este documento describe la implementación del Dockerfile multi-etapa para la API de Express con TypeScript. El Dockerfile produce una imagen Docker utilizando Clean Architecture y patrones CQRS.

## Especificaciones de la Imagen Final

| Propiedad | Valor |
|-----------|-------|
| Tamaño | 229MB |
| Imagen Base | node:22-alpine |
| Usuario | nodeuser (no-root) |
| Arquitectura | Build multi-etapa |

## Estrategia de Build Multi-Etapa

El Dockerfile implementa un proceso de construcción de tres etapas para minimizar el tamaño de la imagen final y maximizar la seguridad.

### Etapa 1: Instalación de Dependencias

**Propósito**: Instalar solo dependencias de producción

La primera etapa utiliza node:22-alpine como base y ejecuta npm ci con la opción --omit=dev para instalar únicamente las dependencias necesarias para producción.

**Características Clave**:

- Utiliza npm ci --omit=dev para dependencias de producción únicamente
- Limpia la caché npm

### Etapa 2: Proceso de Construcción

**Propósito**: Compilar TypeScript a JavaScript

La segunda etapa instala todas las dependencias (incluyendo las de desarrollo) necesarias para el proceso de compilación de TypeScript.

**Características Clave**:

- Instala todas las dependencias incluyendo las de desarrollo para la construcción
- Copia la configuración de TypeScript
- Copia el código fuente
- Ejecuta el build con configuración TypeScript

### Etapa 3: Imagen de Ejecución

**Propósito**: Imagen final de producción

La etapa final crea la imagen de producción con solo el código compilado y las dependencias de producción.

**Características Clave**:

- Solo código compilado y dependencias de producción
- Usuario no-root para seguridad
- Configuración adecuada de permisos
- Documentación Swagger incluida

## Configuración de TypeScript

### tsconfig.json

La configuración de TypeScript utiliza configuraciones modernas:

- module: "nodenext"
- moduleResolution: "nodenext"
- rootDir: "./src"
- outDir: "./dist"

**Características**:

- Configuración moderna de módulos nodenext
- Estructura de directorios correcta
- Compatibilidad con Docker multi-etapa

### Estructura de Salida del Build

```textplain
Estructura Fuente     Salida del Build
src/                →   dist/
├── application/    →   ├── application/
├── core/           →   ├── core/
├── domain/         →   ├── domain/
├── infrastructure/ →   ├── infrastructure/
├── presentation/   →   ├── presentation/
└── main.ts         →   └── main.js
```

## Estructura de la Imagen Final

### Diseño de Directorios

```textplain
/home/node/app/
├── dist/                 # Código JavaScript compilado
│   ├── application/      # Capas de Clean Architecture
│   ├── core/             # Utilidades y helpers
│   ├── domain/           # Entidades y DTOs
│   ├── infrastructure/   # Adaptadores externos
│   ├── presentation/     # Controladores y rutas
│   └── main.js           # Punto de entrada de la aplicación
├── node_modules/         # Solo dependencias de producción
├── logs/                 # Directorio de archivos de log
└── swagger.yaml          # Documentación de la API
```

### Archivos Excluidos

Los siguientes archivos no se incluyen en la imagen final:

- Archivos fuente TypeScript (src/)
- Archivos de prueba (tests/)
- Documentación (docs/)
- Archivos de entorno (.env)
- Configuración ESLint (eslint.config.js)
- Configuración Jest (jest.config.js)
- Dependencias de desarrollo

## Variables de Entorno

### Configuración de Producción

La imagen establece NODE_ENV=production por defecto.

### Variables de Ejecución

La aplicación espera estas variables de entorno desde Docker Compose:

- NODE_ENV: production
- SERVER_PORT: 3000
- SERVER_API_VERSION: v1
- MONGODB_URI: Cadena de conexión a la base de datos
- REDIS_HOST: Host del servidor de caché
- REDIS_PORT: Puerto del servidor de caché
- REDIS_PASSWORD: Autenticación de caché
- STORAGE_INPUT_PATH: Directorio de imágenes de entrada
- STORAGE_OUTPUT_PATH: Directorio de imágenes procesadas
- API_KEY: Clave API de la aplicación
- ENABLE_SWAGGER: Bandera de documentación API
- LOG_LEVEL: Nivel de logging
- LOKI_URL: Endpoint de agregación de logs

## Comandos de Construcción

### Build de Desarrollo

Para construcción estándar:

```textplain
docker build -t image-express-api .
```

Para construcción sin caché:

```textplain
docker build --no-cache -t image-express-api .
```

Para construcción con progreso detallado:

```textplain
docker build --no-cache --progress=plain -t image-express-api .
```

### Build de Producción

- Para construcción con progreso detallado:

```textplain
docker build --no-cache -t image-express-api .
```

Para build multi-arquitectura:

```textplain
docker buildx build --platform linux/amd64,linux/arm64 -t image-express-api .
```

## Comandos de Ejecución

### Ejecución Independiente

Para ejecutar el contenedor:

```textplain
docker run -d \
  --name api-backend \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e MONGODB_URI=mongodb://localhost:27017/imagedb \
  -v $(pwd)/storage:/app/storage \
  image-express-api
```

Para ver logs:

```textplain
docker logs -f api-backend
```

Para acceder al shell del contenedor:

```textplain
docker exec -it api-backend sh
```

### Integración con Docker Compose

Para desplegar con el stack completo:

```textplain
docker-compose up -d api-backend
```

Para reconstruir y reiniciar:

```textplain
docker-compose build api-backend
docker-compose up -d api-backend
```

## Verificación de Salud

### Checks de Salud del Servicio

Para verificar la versión de Node.js:

```textplain
docker run --rm image-express-api sh -c "node --version"
```

Para verificar la estructura de directorios:

```textplain
docker run --rm image-express-api sh -c "ls -la /home/node/app"
```

Para verificar la configuración del usuario:

```textplain
docker run --rm image-express-api sh -c "whoami"
```

## Métricas de Rendimiento

### Análisis de Imagen

Para verificar el tamaño de la imagen:

```textplain
docker images image-express-api
```

Para analizar las capas de la imagen:

```textplain
docker history image-express-api
```

Para análisis detallado con la herramienta dive:

```textplain
dive image-express-api
```

### Características del Build

1. Build multi-etapa: Separación clara de responsabilidades
2. Alpine Linux: Imagen base mínima
3. Dependencias de producción: Solo paquetes necesarios
4. Limpieza de caché: Eliminación de archivos temporales
5. Seguridad del usuario: Ejecución no-root
6. Archivos necesarios: Solo archivos requeridos incluidos

## Implementación de Seguridad

### Prácticas Aplicadas

La imagen implementa las siguientes prácticas de seguridad:

- Ejecución de usuario no-root
- Asignación específica de permisos
- Imagen base oficial
- Variables de entorno seguras

### Escaneo de Seguridad

Para escaneo de vulnerabilidades:

```textplain
docker scan image-express-api
```

Para análisis de seguridad con trivy:

```textplain
trivy image image-express-api
```

Para benchmark de seguridad:

```textplain
docker-bench-security
```

## Guía de Resolución de Problemas

### Problemas Comunes

1. **Tamaño de Imagen**:

   Verificar que solo se usen dependencias de producción ejecutando:

   ```textplain
   docker run --rm image-express-api sh -c "ls node_modules | wc -l"
   ```

2. **Problemas de Permisos**:

   Verificar la configuración del usuario ejecutando:

   ```textplain
   docker run --rm image-express-api sh -c "whoami && id"
   ```

3. **Fallos de Construcción**:

   Construir con logs detallados ejecutando:

   ```textplain
   docker build --progress=plain --no-cache .
   ```

### Comandos de Debugging

Para logs de construcción:

```textplain
docker build --progress=plain .
```

Para logs de ejecución:

```textplain
docker logs -f nombre-contenedor
```

Para acceso al shell del contenedor:

```textplain
docker exec -it nombre-contenedor sh
```
