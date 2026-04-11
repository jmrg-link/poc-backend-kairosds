# Rule · Middlewares

Todos los middlewares reutilizables viven en
`presentation/Bootstrap/middlewares/` y se reexportan desde
`presentation/Bootstrap/middlewares/index.ts`. Esta rule documenta **el
orden**, **las convenciones** y **cómo crear uno nuevo**.

## 1. Catálogo actual

| Middleware | Archivo | Propósito |
|---|---|---|
| `httpLogger` / `logger` | `logger.ts` | Trazas HTTP con Winston, filtrado de campos sensibles, truncado de payloads |
| `errorMiddleware` | `errorMiddleware.ts` | Chain of Responsibility para errores |
| `notFoundHandler` | `errorMiddleware.ts` | 404 para rutas inexistentes |
| `asyncHandler` | `errorMiddleware.ts` | Wrapper para async controllers |
| `validationMiddleware(Dto)` | `validation.middleware.ts` | Valida `req.body` con class-validator |
| `paramsValidationMiddleware(Dto)` | `validation.middleware.ts` | Valida `req.params` |
| `queryValidationMiddleware(Dto)` | `validation.middleware.ts` | Valida `req.query` |
| `idempotencyMiddleware` | `idempotency.middleware.ts` | Lee `X-Idempotency-Key` y la expone como `req.idempotencyKey` |
| `pagination` | `pagination.ts` | Calcula `req.pagination = { page, limit, offset }` |
| `multerErrorMiddleware` | `multerError.middleware.ts` | Traduce errores de Multer a JSON |
| `corsOptions` | `cors.ts` | Preset de CORS (ver `cors.md`) |

## 2. Orden de ejecución obligatorio (global)

```
helmet           → seguridad HTTP (headers)
cors             → antes que cualquier parser
compression      → antes de que se escriba respuesta
express.json     → body JSON (max 10mb)
express.urlencoded
httpLogger       → después de body parsers (para poder loggear body)
<routes>
errorMiddleware  → SIEMPRE el último
```

## 3. Orden por ruta (dentro de `TaskRoutes`)

```
[idempotencyMiddleware, uploadToDisk.single('image'), validationMiddleware(Dto)]
controller.create
```

Reglas:

- **`idempotencyMiddleware` antes del upload**: la clave se necesita en la
  transacción que crea la tarea, no importa si hay fichero.
- **`uploadToDisk.single(...)` antes de `validationMiddleware`**: Multer
  rellena `req.body` y `req.file`; `validationMiddleware` lo necesita.
- **`validationMiddleware` salta si es `multipart/form-data`**: lo hace por
  diseño (ver `validation.middleware.ts` líneas 37-44) porque los DTOs se
  validan con el cuerpo ya parseado.
- **`pagination` antes de `queryValidationMiddleware(PaginationDto)`** en
  rutas de listado, para que `req.pagination` ya exista si el handler la
  necesita.

## 4. Convenciones al crear un middleware

### 4.1. Signature estándar

```ts
import { Request, Response, NextFunction } from 'express';

export function myMiddleware(req: Request, res: Response, next: NextFunction): void {
  // ...
  next();
}
```

- Tipado explícito `(req, res, next)`, devolver `void`.
- **Llamar siempre a `next()`** salvo que respondas tú mismo.
- Para errores: `next(error)` — nunca responder JSON directamente; delega al
  `errorMiddleware`.

### 4.2. Signature factory (parametrizada)

Cuando el middleware necesita configuración (DTO, regex, flag), se exporta
una **factory** que devuelve `RequestHandler`:

```ts
export function validationMiddleware<T extends object>(
  type: ClassConstructor<T>,
  skipMissingProperties = false
): RequestHandler {
  return async (req, _res, next) => { /* ... */ };
}
```

### 4.3. Extender `Request` con tipos

Si el middleware adorna `req`, declarar la extensión de tipos en el mismo
archivo o en `core/types/express.d.ts`:

```ts
declare global {
  namespace Express {
    interface Request {
      idempotencyKey?: string;
    }
  }
}
```

**Regla:** nunca hacer `(req as any).foo = ...`. Si ya no hay alternativa,
usar un type assertion tipado: `(req as Request & { foo?: string }).foo`.

### 4.4. Errores desde middlewares

- **Formatear con `ValidationError`/`ParamValidationError`/`QueryValidationError`**
  y pasar por `next(err)`. El `errorMiddleware` tiene handlers específicos.
- No crear nuevos tipos de error sin añadir el handler correspondiente en
  `core/errors/error-handlers/`.

## 5. `errorMiddleware` — Chain of Responsibility

Está implementado en `errorMiddleware.ts` con la cadena:

```
ParamValidation → QueryValidation → FormValidation →
  ValidationHandler → NotFoundHandler → BusinessHandler → MongoHandler
```

Si ninguno matchea, cae al default `INTERNAL_SERVER_ERROR 500`.

Para añadir un nuevo tipo de error:

1. Crear `core/errors/MyError.ts` extendiendo `CustomError`.
2. Crear `core/errors/error-handlers/MyErrorHandler.ts` que extiende
   `ErrorHandler` con `canHandle(error)` y `handle(error)`.
3. Registrarlo en `buildErrorHandlerChain()` en el orden correcto (más
   específico primero).

## 6. Logging en middlewares

- Usar `winstonLogger` (importado de `@core/helpers/logger`), no `console.log`.
- Incluir `requestId` cuando sea posible (ver `httpLogger` que lo genera con
  `uuidv4().substring(0, 8)`).
- **Filtrar campos sensibles.** `httpLogger` ya lo hace con `SENSITIVE_HEADERS`
  y `SENSITIVE_BODY_FIELDS`. No loggear tokens, passwords ni API keys.

## 7. Testing de middlewares

- Tests unitarios en `tests/unit/presentation/Bootstrap/middlewares/`.
- Mockear `req`, `res`, `next` con objetos planos:

```ts
const req = { params: { taskId: '123' } } as unknown as Request;
const res = {} as Response;
const next = jest.fn();
await middleware(req, res, next);
expect(next).toHaveBeenCalledWith(expect.any(Error));
```

## 8. Anti-patrones

- ❌ `res.json(...)` directamente desde un middleware de validación — usa
  `next(error)`.
- ❌ Middlewares que mutan `req.body` sin reflejarlo en los tipos.
- ❌ Usar `console.log` en producción desde middlewares.
- ❌ Orden roto: `errorMiddleware` antes de las rutas, o `cors` después de
  `express.json`.
- ❌ Middlewares de autenticación que llaman a DB en cada request sin caché.
- ❌ Registrar rutas sin su middleware de validación cuando hay DTO disponible.
