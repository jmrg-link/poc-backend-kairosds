# Rule · Express (Bootstrap de la aplicación)

`image-express-api` usa **Express 5** (`"express": "5.1.0"`). El arranque está
centralizado en `src/presentation/Bootstrap/app.ts` con el patrón factory
`createApp(): Application`.

## 1. Estructura del bootstrap

```
presentation/Bootstrap/
├── app.ts                 # createApp() — arma la Application
├── server.ts              # createServer() — envuelve app en http.Server
├── routes.ts              # AppRoutes — health + v1 routes
├── interfaces/index.ts    # tipos compartidos del bootstrap
└── middlewares/           # middlewares reutilizables (ver middlewares.md)
```

## 2. `createApp()` — orden canónico

Referencia: `presentation/Bootstrap/app.ts`.

```ts
export function createApp(): Application {
  const app = express();

  // 1. Seguridad primero
  app.use(helmet());

  // 2. CORS (antes de cualquier parser de body)
  app.use(cors());

  // 3. Compresión
  app.use(compression());

  // 4. Body parsers (con límite explícito)
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // 5. HTTP logger con filtrado de campos sensibles
  app.use(httpLogger);

  // 6. Swagger (opcional por env)
  if (envs.ENABLE_SWAGGER) {
    const swaggerDocument = YAML.load(path.join(__dirname, '../../../swagger.yaml'));
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  }

  // 7. Rutas bajo /api → AppRoutes instancia todas las v1
  const router = express.Router();
  new AppRoutes(router);
  app.use('/api', router);

  // 8. Middleware global de errores SIEMPRE al final
  app.use(errorMiddleware);

  return app;
}
```

**Regla:** mantén este orden. Cualquier middleware nuevo debe encajar donde
corresponde (ver `middlewares.md` para la justificación del orden).

## 3. Rutas — `AppRoutes`

- Health check en `/api/health` — no autenticado, no filtrado.
- Todas las rutas de negocio bajo `/api/v1/...`.
- Se registran añadiendo el `*Routes` al array interno de
  `AppRoutes.initializeV1Routes`:

```ts
const routes = [TaskRoutes /* , UserRoutes, OtherFeatureRoutes */];
```

- Cada `*Routes` debe ser una clase con `static get routes(): Router` que
  instancia su propio router y expone las rutas. Ver `TaskRoutes`.

## 4. Paths alias (tsconfig + runtime)

`tsconfig.json` define:

```json
"paths": {
  "@domain/*":         ["src/domain/*"],
  "@application/*":    ["src/application/*"],
  "@infrastructure/*": ["src/infrastructure/*"],
  "@presentation/*":   ["src/presentation/*"],
  "@core/*":           ["src/core/*"],
  "@config":           ["src/config/index"],
  "@config/*":         ["src/config/*"]
}
```

- En **dev** `tsx` resuelve alias automáticamente.
- En **prod** el build usa `tsc && tsc-alias` para reescribir los alias a
  rutas relativas en `dist/`.
- **Nunca** usar imports relativos profundos (`../../../`). Si necesitas tres
  saltos o más, casi siempre hay un alias que encaja.

## 5. `express.Router` vs `app.use`

- Nunca uses `app.get('/api/v1/tasks', ...)` directamente en `app.ts`. Todas
  las rutas **deben** pasar por `AppRoutes` → `*Routes.routes`.
- `app.use('/api', router)` es el único punto de montaje del router de
  negocio.

## 6. Tipos globales de Request

El proyecto extiende `Express.Request` en varias rules:

```ts
// core/types/express.d.ts + validation.middleware.ts
declare global {
  namespace Express {
    interface Request {
      validatedBody?: any;
      validatedParams?: Record<string, string>;
      validatedQuery?: Record<string, string>;
      pagination?: { page: number; limit: number; offset: number };
      idempotencyKey?: string;
    }
  }
}
```

Si añades un middleware que adorna `req`, declara aquí la extensión de tipos
en lugar de hacer casts `(req as any)`.

## 7. Errores y `asyncHandler`

- Los controladores usan `try/catch → next(error)`. Ver `TaskController`.
- Alternativamente, `asyncHandler(fn)` (en `errorMiddleware.ts`) envuelve una
  función async y delega al middleware global. Úsalo si el body del
  controller es una sola expresión.
- **Nunca** respondas errores directamente con `res.status(500)` — debe
  pasarse al `errorMiddleware` que usa la Chain of Responsibility.

## 8. Anti-patrones

- ❌ Instanciar `express()` fuera de `createApp()`.
- ❌ `app.use` directo en `main.ts` — todo va en `createApp()`.
- ❌ Mezclar `bodyParser` legacy con `express.json()` — usar solo el built-in.
- ❌ Llamar a `app.listen()` sin pasar por `createServer()` de
  `presentation/Bootstrap/server.ts`.
- ❌ Rutas hardcoded con sufijo `/api/v1` dentro de `*Routes`; la versión la
  añade `AppRoutes`.
