# Rule · Clean Code

Convenciones de Clean Code, SOLID y nombrado aplicadas al código real del
proyecto. Toda edición debe seguirlas.

## 1. Naming

- **Clases** en `PascalCase`: `TaskRepository`, `CreateTaskCommandHandler`,
  `DatabaseConnector`.
- **Interfaces** con prefijo `I` *solo* para puertos/contratos hexagonales
  (`ITaskRepository`, `ICommand`, `IQueryHandler`). Para tipos de datos puros
  **no** usar prefijo (`TaskEntity`, `TaskResponseDto`, `ProcessedImage`).
- **Enums** en `PascalCase`, valores en `SCREAMING_SNAKE` o `lowerCase` según
  semántica. Ver `TaskStatus` (`PENDING`, `PROCESSING`, ...).
- **Métodos y funciones** en `camelCase`: `createTaskFromRequest`,
  `validateTransition`.
- **Constantes** en `SCREAMING_SNAKE_CASE`: `MAX_FILE_SIZE`, `DEFAULT_LIMIT`.
- **Archivos**: `PascalCase.ts` para clases (`TaskController.ts`); `kebab-case.ts`
  o `camelCase.ts` para middlewares y helpers (`idempotency.middleware.ts`,
  `logger.ts`). **Respetar el estilo existente** en cada carpeta.

## 2. Tamaño y forma de funciones

- **Máxima profundidad `5`** (forzado por ESLint `max-depth: 5`).
- **Complejidad ciclomática máxima `15`** (forzado por ESLint `complexity: 15`).
- Si una función supera estos umbrales, **extraer métodos privados**; el código
  del proyecto lo hace (ver `TaskService.createTaskFromRequest` delegando en
  `resolveImagePath` y `moveImageToTaskDirectory`).
- **Early return** sobre *nested if*. Ejemplo canónico en
  `TaskService.resolveImagePath` → encadena `if (...)` con `return`.

## 3. Inmutabilidad y `readonly`

- ESLint fuerza `@typescript-eslint/prefer-readonly: error`.
- **Propiedades inyectadas** en el constructor siempre `private readonly`:
  ```ts
  constructor(
    private readonly repository: ITaskRepository,
    private readonly queue: TaskQueueProducer
  ) {}
  ```
- Constantes dentro de clases: `private static readonly MAX_FILE_SIZE = ...`.

## 4. Tipado estricto

- **No usar `any`** — ESLint lo marca como warning, y en la práctica solo se
  tolera con `eslint-disable-next-line` puntual en *mappers* hacia DTOs.
- Preferir `unknown` + *type guards* cuando el tipo no se conoce.
- Usar `Partial<T>` para updates parciales y `Pick<T, K>` / `Omit<T, K>` para
  DTOs derivados de entidades.
- Definir tipos *interface* locales cuando un parámetro es un objeto con forma
  concreta (ver `interface LogContext` en `TaskService.ts`).

## 5. Nullish coalescing y optional chaining

Forzados por ESLint:

- `??` en lugar de `||` para valores por defecto (`task.idempotencyKey ?? generateUUID()`).
- `?.` para accesos encadenados (`req.pagination?.page`).

## 6. Errores

- Jamás `throw new Error("texto libre")` desde `application/` o `domain/`.
- Usar:
  - `NotFoundError` cuando el recurso no existe.
  - `BusinessError(message, code, statusCode)` cuando la lógica de negocio
    rechaza una operación.
  - `CustomError` como base para tipos nuevos.
- En controladores, envolver en `try/catch` y delegar con `next(error)` al
  middleware central `errorMiddleware` (ver `TaskController`).

## 7. Async

- `async/await` siempre. ESLint fuerza `@typescript-eslint/await-thenable: error`.
- `@typescript-eslint/no-floating-promises: warn` — toda promesa debe ser
  `await`-ada o pasada a `.catch(next)`.
- Para async handlers de Express, usar el patrón ya presente: `try/catch` con
  `next(error)`.

## 8. DRY — pero sin abstracciones prematuras

- Mappers entidad → DTO se repiten en handlers y services: **no** unificarlos
  con un helper genérico sin razón concreta. La duplicación *controlada* es
  aceptable hasta que haya tres casos iguales (*Rule of three*).
- Lo mismo aplica a validación: no inventar un "super middleware" si ya existen
  `validationMiddleware`, `paramsValidationMiddleware` y `queryValidationMiddleware`.

## 9. Single Responsibility

- Un archivo = una clase o un grupo cohesivo de funciones.
- Un handler CQRS resuelve **un** caso de uso. Si necesita otro, debe invocar
  al mediator (`Mediator.send` / `Mediator.query`) en lugar de duplicar lógica.

## 10. JSDoc

- **Obligatorio** en clases, métodos públicos y funciones exportadas.
- En **español**, con `@param`, `@returns`, `@throws`, `@description`. Ver
  `TaskController` como referencia canónica del estilo.
- En métodos privados utilitarios, JSDoc corto de una línea es suficiente.

## 11. Imports

- Usar **paths alias** (`@application/...`, `@domain/...`, `@infrastructure/...`,
  `@presentation/...`, `@core/...`, `@config/envs`). Nunca `../../../`.
- Agrupar imports: *built-ins de node → externos npm → alias internos → relativos*.
- Un archivo que re-exporte debe ser un `index.ts` (*barrel*) limpio, sin
  lógica.

## 12. Commits/Edits

- No renombrar `_vars` no usados para "limpiar"; ESLint ya los ignora con el
  patrón `^_`.
- No añadir comentarios "// removed" ni re-exports de compatibilidad: si algo
  no se usa, **borrarlo**.
- No añadir JSDoc a código que no tocas: mantén el scope de tu cambio.
