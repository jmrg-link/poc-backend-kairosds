# Barrel de Rules · `.claude/rules`

Este archivo funciona como un **barrel** (al estilo de un `index.ts`): centraliza y
reexporta todas las reglas de este proyecto para que Claude tenga un único punto
de entrada al cargar el contexto. `CLAUDE.md` (raíz del repo) importa este índice
y cada rule individual aporta un dominio específico.

> Monorepo: `image-express-api` (REST) + `image-processing-worker` (background).
> Ambos comparten patrones: **Clean Architecture + Hexagonal + CQRS + Repository**.

## Índice de reglas

| Rule | Dominio | Cuándo aplicarla |
|---|---|---|
| [`architecture.md`](./architecture.md) | Hexagonal · Clean Arch · Capas | Al crear o mover archivos entre `domain / application / infrastructure / presentation` |
| [`clean-code.md`](./clean-code.md) | Clean Code · SOLID · Nombrado | En cualquier edición de código TypeScript |
| [`cqrs.md`](./cqrs.md) | CQRS · CommandBus · QueryBus · Mediator · Handlers | Al añadir casos de uso (comandos o queries) |
| [`repository.md`](./repository.md) | Repository Pattern · Mongoose · Entidades · Schemas | Al crear interfaces de repositorio o schemas de Mongoose |
| [`express.md`](./express.md) | Bootstrap de Express · Paths alias · Swagger | Al tocar `presentation/Bootstrap/app.ts` |
| [`server.md`](./server.md) | Creación del servidor HTTP · `main.ts` | Al modificar el arranque de la aplicación |
| [`middlewares.md`](./middlewares.md) | Orden, validación, idempotencia, paginación, errores | Al crear o encadenar middlewares |
| [`cors.md`](./cors.md) | Configuración CORS | Al exponer nuevos dominios u orígenes |
| [`helmet.md`](./helmet.md) | Seguridad HTTP con Helmet | Al modificar cabeceras de seguridad |
| [`loggers.md`](./loggers.md) | Winston · Loki · httpLogger · logs estructurados | Al añadir trazas o métricas |

## Principios globales (aplican siempre)

1. **TypeScript estricto.** `strict: true` activo en `tsconfig.json`. No usar `any`
   salvo en test fixtures; preferir `unknown` + narrowing.
2. **Paths alias obligatorios.** Nunca usar imports relativos profundos; usar
   `@domain`, `@application`, `@infrastructure`, `@presentation`, `@core`, `@config`.
3. **Hexagonal estricta.** `domain` no depende de nada. `application` depende de
   `domain`. `infrastructure` implementa puertos de `application`. `presentation`
   orquesta.
4. **JSDoc en español** sobre clases, métodos públicos y funciones exportadas —
   coherente con el estilo ya existente en el repositorio.
5. **Idioma.** Mensajes de error, comentarios y logs en español (es-ES).
6. **Errores tipados.** Nunca lanzar `new Error(...)` genérico desde `application`
   o `domain`; usar `BusinessError`, `NotFoundError` o `CustomError`.
7. **Async/await** siempre; nunca callbacks ni `.then()` encadenados salvo en
   `.catch(next)` del `asyncHandler`.
8. **Barrels (`index.ts`)** en cada carpeta con más de un export público, tal y
   como se usa en `application/core`, `application/handlers`, `presentation/Task/*`.
9. **Nunca** instanciar repositorios o servicios en controladores; la composición
   se hace en los *factory methods* estáticos (`TaskRoutes.createTaskController`).
10. **Clean Code > cleverness.** Código legible, nombres explícitos en español
    cuando el dominio lo es (`Tarea`, `Imagen`, `PrecioEstimado`), en inglés
    cuando es técnico (`Repository`, `Handler`, `Bus`).

## Cómo extender este barrel

Para añadir una nueva rule:

1. Crear `.claude/rules/<nombre>.md` con el formato de las existentes.
2. Registrarla en la tabla de este índice.
3. Si la rule es crítica y debe leerse siempre, enlazarla desde la sección
   "Reglas obligatorias" en `CLAUDE.md` raíz.

No duplicar contenido: si una rule ya cubre un tema, referenciarla con enlace
relativo en lugar de copiar el contenido.
