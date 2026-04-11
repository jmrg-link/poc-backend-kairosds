# Rule · CORS

El proyecto usa el paquete oficial `cors@2.8.5`. La configuración vive en dos
sitios — es importante saber **cuál se usa realmente**:

1. `presentation/Bootstrap/app.ts` → `app.use(cors())` con defaults (permisivo).
2. `presentation/Bootstrap/middlewares/cors.ts` → `corsOptions` con preset
   explícito, exportado desde el barrel `middlewares/index.ts`.

> El `corsOptions` del barrel está listo para ser usado; para activarlo basta
> con cambiar `app.use(cors())` por `app.use(corsOptions)` en `app.ts`. **No
> eliminar el preset** por considerarlo muerto: es la configuración canónica
> del proyecto.

## 1. Preset canónico

```ts
// presentation/Bootstrap/middlewares/cors.ts
import cors from 'cors';

export const corsOptions = cors({
  origin: true,            // refleja el Origin del request
  credentials: true,       // permite cookies/autenticación
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Idempotency-Key',
    'X-API-Key',
  ],
});
```

Reglas del preset:

- **`origin: true`** refleja el origen del navegador. Para producción
  restrictiva, reemplazar por un **array** o una **función** que valide contra
  `envs.CORS_ALLOWED_ORIGINS` (añadir esa env en `config/envs.ts` si hace
  falta).
- **`credentials: true`** exige que el frontend envíe `credentials: 'include'`.
  Si se cambia a `false`, también hay que dejar de aceptar cookies.
- **Métodos explícitos**: añadir `PATCH` solo cuando haya un endpoint que lo
  use. No dejarlo "por si acaso".
- **`allowedHeaders`**: debe incluir todas las cabeceras custom usadas por el
  proyecto. Actualmente:
  - `X-Idempotency-Key` — leída por `idempotencyMiddleware`.
  - `X-API-Key` — reservada para autenticación futura.
  - `Authorization` — JWTs si se añaden.

## 2. Dónde colocar `cors` en la cadena

```ts
app.use(helmet());       // 1. seguridad
app.use(corsOptions);    // 2. CORS (antes de parsers de body)
app.use(compression());
app.use(express.json({ limit: '10mb' }));
```

**Regla:** `cors` va siempre **antes** de cualquier parser o middleware que
pueda rechazar la petición. Si pones `cors` después de `express.json`, el
preflight `OPTIONS` puede fallar en el parser antes de que CORS responda.

## 3. Cómo añadir un nuevo origen permitido

### Opción A — Lista estática por env

En `config/envs.ts`:

```ts
CORS_ALLOWED_ORIGINS: str({ default: 'http://localhost:5173' }),
```

Y en `cors.ts`:

```ts
const allowedOrigins = envs.CORS_ALLOWED_ORIGINS.split(',').map(s => s.trim());

export const corsOptions = cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error('Origen no permitido por CORS'));
  },
  credentials: true,
  // ...
});
```

### Opción B — Reflejo bajo condición

Si se necesita reflejar el origen solo para ciertos subdominios:

```ts
origin: (origin, cb) => {
  if (!origin) return cb(null, true);
  const ok = /^https:\/\/.*\.kairosds\.com$/.test(origin);
  cb(ok ? null : new Error('Origen no permitido'), ok);
},
```

## 4. Preflight `OPTIONS`

- `cors()` atiende los preflight automáticamente; no definir un handler
  manual `app.options(...)`.
- Si un endpoint requiere un header custom nuevo, **añadirlo a
  `allowedHeaders`**. No hacerlo provoca errores silenciosos en el navegador
  del tipo *"Request header field X is not allowed by
  Access-Control-Allow-Headers"*.

## 5. Errores y mensajes

- Si un origen es rechazado, el preset genera un `Error` genérico. Para
  integrarlo con el `errorMiddleware`, convertir a `BusinessError(..., 'CORS_ORIGIN_DENIED', 403)`
  dentro del callback.

## 6. Anti-patrones

- ❌ `app.use(cors())` permisivo en producción con `credentials: true` — viola
  la especificación (no se puede usar `Access-Control-Allow-Origin: *` con
  credenciales).
- ❌ Hardcodear orígenes `https://prod.example.com` en `cors.ts`: ponerlos en
  `envs`.
- ❌ Responder manualmente a `OPTIONS` en controllers — duplica el trabajo
  del middleware.
- ❌ Omitir `X-Idempotency-Key` de `allowedHeaders` si se añade un nuevo
  endpoint que lo use.
- ❌ Usar un preset distinto por ruta: mantener **un único** `corsOptions`
  global.
