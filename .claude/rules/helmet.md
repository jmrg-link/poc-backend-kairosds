# Rule · Helmet (Seguridad HTTP)

El proyecto usa `helmet@8.1.0`. Se aplica **primero** en `createApp()`, antes
de CORS y cualquier parser de body.

## 1. Configuración actual

Referencia: `presentation/Bootstrap/app.ts` línea 24.

```ts
app.use(helmet());
```

Se usa el preset por defecto de Helmet v8, que incluye:

- `Content-Security-Policy` con valores conservadores
- `Strict-Transport-Security` (HSTS) con `max-age: 15552000`
- `X-Content-Type-Options: nosniff`
- `X-DNS-Prefetch-Control: off`
- `X-Download-Options: noopen`
- `X-Frame-Options: SAMEORIGIN`
- `X-Permitted-Cross-Domain-Policies: none`
- `Referrer-Policy: no-referrer`
- `Origin-Agent-Cluster: ?1`
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Resource-Policy: same-origin`

## 2. Cuándo desviarse del preset

### 2.1. Swagger UI requiere relajar CSP

Si `ENABLE_SWAGGER=true` y el `Content-Security-Policy` por defecto bloquea
los recursos de `swagger-ui-express`, configurar Helmet con directivas
explícitas para `/api-docs`:

```ts
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'script-src': ["'self'", "'unsafe-inline'"],
      'style-src':  ["'self'", "'unsafe-inline'", 'https:'],
      'img-src':    ["'self'", 'data:', 'https:'],
    },
  },
}));
```

**Regla:** solo relajar CSP si hay un problema real de carga en Swagger. En
producción, considera **no** servir Swagger (`ENABLE_SWAGGER=false`).

### 2.2. Frontend en otro dominio con COEP/CORP

Si un cliente en otro dominio necesita consumir recursos estáticos servidos
por la API (imágenes procesadas, etc.), puede requerir desactivar
`crossOriginResourcePolicy`:

```ts
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
```

Esto se combina con la rule `cors.md`: ambas cabeceras deben ser coherentes.

## 3. HSTS y HTTPS

- **HSTS solo tiene sentido sobre HTTPS.** El stack de Docker Compose hace
  terminación TLS en **Traefik**; la API corre en HTTP plano detrás.
- Helmet añade HSTS igualmente; el navegador lo ignora si la request vino por
  HTTP. Para desactivarlo localmente:

```ts
app.use(helmet({
  hsts: false,
}));
```

**Regla:** no desactivar HSTS en producción salvo incidencia concreta.

## 4. CSP y nonces

Si se añade un endpoint que sirve HTML (no solo JSON), la CSP por defecto
bloquea scripts inline. Opciones:

1. Servir el HTML desde un frontend separado (preferido).
2. Usar nonces por request, pero entonces el CSP debe calcularse *per-request*
   en un middleware, no en `app.use(helmet(...))` global.

**Regla del proyecto:** la API es JSON-only. Cualquier endpoint que empiece
a devolver HTML debe justificar el cambio de CSP en el PR.

## 5. Cabeceras custom de seguridad

Helmet **no** incluye:

- `Permissions-Policy` (ex `Feature-Policy`) — añadir manualmente si se
  necesita restringir `camera=()`, `geolocation=()`, etc.
- `Cache-Control` agresivo — definirlo por ruta en el controller cuando
  aplique.

## 6. Orden en la cadena de middlewares

```ts
app.use(helmet());       // 1. Seguridad (cabeceras)
app.use(corsOptions);    // 2. CORS
app.use(compression());  // 3. Compresión
app.use(express.json()); // 4. Body parser
```

**Regla:** Helmet va **primero**. Añadir cabeceras antes de cualquier lógica
garantiza que incluso las respuestas de error las llevan.

## 7. Anti-patrones

- ❌ `app.use(helmet({ contentSecurityPolicy: false }))` sin justificación.
  Desactivar la CSP anula la mitad del valor de Helmet.
- ❌ Añadir cabeceras de seguridad manualmente (`res.setHeader('X-Frame-Options', ...)`)
  cuando Helmet ya las pone.
- ❌ Usar Helmet solo en algunas rutas con `router.use(helmet())` — va en
  global.
- ❌ Confiar en Helmet para validar input: Helmet no filtra payloads, solo
  añade cabeceras. La validación va en `validationMiddleware`.
