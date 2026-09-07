# Proyecto: Series Matemáticas — Contexto para desarrollo

## Descripción general

Proyecto universitario (examen de una materia). Consiste en un sistema que:
1. Genera datos randómicos para 3 series matemáticas.
2. Guarda cada iteración de cálculo en PostgreSQL.
3. Muestra un dashboard con los datos generados y su error, usando el gráfico más adecuado para cada serie.

Requisitos del enunciado (textual):
- Usar la BD que más guste → **elegido: PostgreSQL local**.
- 3 diseños de tablas, una por cada serie matemática.
- Un identificador para cada cliente.
- Se generan datos randómicos.
- Dashboard con los datos generados + su error (igual que práctica de clase).
- Identificar qué gráfico se acomoda mejor para cada serie.

Se reutiliza la **misma arquitectura y stack** de otro proyecto previo (MedicalSys, proyecto universitario de arquitectura de software), aplicando MVC por capas estricto.

## Series elegidas

1. **Leibniz** → aproximación de π. Script de referencia de clase en Python ya definido (ver abajo).
2. **Fibonacci** → razón F(n)/F(n-1) convergiendo al número áureo (φ).
3. **Taylor** → expansión en serie de una función (`exponencial`, `seno` o `coseno`) evaluada en un punto `x`, convergiendo al valor real de la función.

Script de referencia (Leibniz, dado por la cátedra):
```python
import math
def pi_leibniz_tabla():
    N = int(input("Ingrese el número máximo de elementos (términos) de la serie: "))
    s = 0.0
    sign = 1.0
    denom = 1.0
    for i in range(1, N + 1):
        s += sign / denom
        pi_aprox = 4.0 * s
        error = abs(pi_aprox - math.pi)
        sign = -sign
        denom += 2.0
```
Lógica a replicar en TypeScript dentro del Service de Leibniz: por cada iteración, guardar `valor_calculado`, `valor_real` (constante) y `error = abs(calculado - real)`.

Pendiente de definir junto con el usuario: fórmulas exactas de Fibonacci (razón) y Taylor (qué función usar por default, rango de `x`) al momento de escribir los Services — por ahora el diseño de tabla ya contempla los campos necesarios.

## Gráfico sugerido por serie (a confirmar/refinar en el dashboard)
- **Leibniz**: line chart (convergencia suave, error decreciente).
- **Fibonacci**: la razón converge rápido y suave → line chart para la razón; si se grafica `fibonacci_n` crudo, usar escala logarítmica o barras (crecimiento exponencial aplastaría la escala lineal).
- **Taylor**: line chart (convergencia suave hacia el valor real de la función).

Esto se termina de decidir cuando se construya el dashboard — no está cerrado aún.

## Decisiones de arquitectura y stack (idénticas a MedicalSys)

| Capa | Tecnología |
|---|---|
| Backend | Node.js + Express + TypeScript |
| ORM | TypeORM (patrón Entity/Repository/Service clásico, no Prisma) |
| Base de datos | PostgreSQL **local** (NO Supabase en este proyecto) |
| Frontend | React + Vite + TypeScript |
| Autenticación | JWT (jsonwebtoken) + bcrypt — *si el examen lo requiere; a confirmar si hace falta login o el dashboard es de acceso libre* |

Arquitectura backend en capas, sin excepciones:
```
Cliente (React) → Routes → Middlewares (JWT/permisos) → Controllers → Services (lógica de negocio) → Repositories (acceso a datos) → Entities (TypeORM) → PostgreSQL
```

Reglas heredadas de MedicalSys que aplican igual acá:
- Nunca lógica de negocio en Entities ni Controllers — todo en Services.
- Controllers solo validan forma del request y delegan.
- El backend nunca confía en el frontend — toda regla se revalida server-side.
- Manejo de errores centralizado: clase `AppError` + middleware `errorHandler` global, sin exponer stack traces ni SQL crudo al cliente.
- Contraseñas (si aplica) siempre hasheadas con bcrypt, nunca en texto plano.

## Estado actual de la base de datos — ✅ COMPLETO

Postgres local, ya creado y corrido el DDL completo. 4 tablas:

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE cliente (
    id_cliente      SERIAL PRIMARY KEY,
    nombre          VARCHAR(150) NOT NULL,
    identificador   VARCHAR(50) UNIQUE NOT NULL,
    fecha_registro  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE serie_leibniz (
    id_leibniz        SERIAL PRIMARY KEY,
    id_cliente        INT NOT NULL REFERENCES cliente(id_cliente) ON DELETE CASCADE,
    id_ejecucion      UUID NOT NULL DEFAULT gen_random_uuid(),
    iteracion         INT NOT NULL,
    valor_calculado   DECIMAL(20,15) NOT NULL,
    valor_real        DECIMAL(20,15) NOT NULL,
    error             DECIMAL(20,15) NOT NULL,
    fecha_generacion  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE serie_fibonacci (
    id_fibonacci      SERIAL PRIMARY KEY,
    id_cliente        INT NOT NULL REFERENCES cliente(id_cliente) ON DELETE CASCADE,
    id_ejecucion      UUID NOT NULL DEFAULT gen_random_uuid(),
    iteracion         INT NOT NULL,
    fibonacci_n       BIGINT NOT NULL,
    razon_calculada   DECIMAL(20,15) NOT NULL,
    valor_real        DECIMAL(20,15) NOT NULL,
    error             DECIMAL(20,15) NOT NULL,
    fecha_generacion  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE serie_taylor (
    id_taylor         SERIAL PRIMARY KEY,
    id_cliente        INT NOT NULL REFERENCES cliente(id_cliente) ON DELETE CASCADE,
    id_ejecucion      UUID NOT NULL DEFAULT gen_random_uuid(),
    funcion           VARCHAR(20) NOT NULL CHECK (funcion IN ('exponencial', 'seno', 'coseno')),
    x_valor           DECIMAL(10,6) NOT NULL,
    iteracion         INT NOT NULL,
    valor_calculado   DECIMAL(20,15) NOT NULL,
    valor_real        DECIMAL(20,15) NOT NULL,
    error             DECIMAL(20,15) NOT NULL,
    fecha_generacion  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_leibniz_cliente ON serie_leibniz(id_cliente);
CREATE INDEX idx_leibniz_ejecucion ON serie_leibniz(id_ejecucion);
CREATE INDEX idx_fibonacci_cliente ON serie_fibonacci(id_cliente);
CREATE INDEX idx_fibonacci_ejecucion ON serie_fibonacci(id_ejecucion);
CREATE INDEX idx_taylor_cliente ON serie_taylor(id_cliente);
CREATE INDEX idx_taylor_ejecucion ON serie_taylor(id_ejecucion);
```

Notas de diseño:
- **1 tabla por serie** (no tabla cabecera + detalle separada) — cada fila es una iteración individual.
- `id_ejecucion` (UUID) agrupa las filas de una misma corrida de un mismo cliente, para poder distinguir "última corrida" o listar historial sin necesitar tabla extra. No es FK a ninguna tabla, solo se genera en el backend al momento de correr la generación randómica.
- `DECIMAL(20,15)` para no perder precisión en errores muy pequeños.
- `synchronize: false` en TypeORM — el schema ya existe por SQL manual, TypeORM no debe tocarlo.

## Estado actual del backend — ✅ API COMPLETA (falta frontend)

Carpeta raíz: `App/` con subcarpetas `Back/` y `Front/`.

Nota: la base real (`.env`) quedó con `DB_NAME=iot`, no `series_matematicas` como se planeó originalmente — coincide con `BD.sql` en la raíz.

### Completado en `Back/`:
- `npm init -y` corrido.
- Dependencias instaladas: `express typeorm pg reflect-metadata jsonwebtoken bcrypt cors dotenv uuid` (+ dev: `typescript ts-node-dev @types/node @types/express @types/jsonwebtoken @types/bcrypt @types/cors @types/uuid`).
- Estructura de carpetas creada (idéntica a MedicalSys):
  ```
  Back/src/
  ├── config/           → data-source.ts (TypeORM DataSource)
  ├── entities/         → Cliente, SerieLeibniz, SerieFibonacci, SerieTaylor
  ├── migrations/       → (vacío, no se usa; synchronize:false y schema manual)
  ├── repositories/     → cliente, leibniz, fibonacci, taylor
  ├── services/         → cliente, leibniz, fibonacci, taylor (lógica matemática acá)
  ├── controllers/      → cliente, leibniz, fibonacci, taylor
  ├── routes/           → cliente, leibniz, fibonacci, taylor + index.ts (agrega todo bajo /api)
  ├── dtos/             → cliente, leibniz, fibonacci, taylor
  ├── middlewares/      → errorHandler.ts
  ├── permissions/      → (vacío, no se implementó JWT — ver decisión abajo)
  ├── utils/            → AppError.ts, random.ts
  └── scripts/test/     → (vacío)
  ```
- `.env`, `tsconfig.json` (fix de decorators), `data-source.ts`, entidades e `index.ts` (bootstrap + conecta AppDataSource + levanta Express) — completos y verificados corriendo.
- **Fix crítico de `npm run dev`**: `package.json` tenía `typescript: ^7.0.2` (el nuevo compilador nativo v7, publicado como `latest` en npm), incompatible con la API interna que usa `ts-node` 10.9.2 (`TypeError: Cannot read properties of undefined (reading 'fileExists')`). Se fijó `typescript: ^5.9.3` (última estable de la serie 5.x) y quedó andando.
- Script `"dev": "ts-node-dev --respawn --transpile-only src/index.ts"` en `package.json`.
- **Autenticación JWT implementada** (el usuario pidió login/registro después de armar la API abierta). Decisión de diseño: no se creó una tabla `usuario` separada — `cliente` pasó a ser también la entidad de login, agregando `email` (unique) y `password_hash` (columna con `select: false` en la entidad, nunca se devuelve por defecto). Cambio de esquema aplicado con `ALTER TABLE` manual (la tabla estaba vacía, sin backfill necesario) y reflejado en `BD.sql`.
  - `POST /api/auth/registro` — body `{ nombre, identificador, email, password }`, hashea con bcrypt (10 rounds), valida email/duplicados/longitud de password (mín. 6), devuelve `{ cliente, token }`.
  - `POST /api/auth/login` — body `{ email, password }`, devuelve `{ cliente, token }` (401 genérico "Credenciales inválidas" si falla, no distingue email vs password).
  - `utils/jwt.ts` (firmar/verificar, `expiresIn: '8h'`) y `middlewares/auth.middleware.ts` (lee `Authorization: Bearer <token>`, agrega `req.cliente = { id_cliente, identificador }` vía `declare global` de Express).
  - **Todas las rutas de series y `/api/clientes/me` ahora requieren token** (`router.use(authMiddleware)` en cada archivo de rutas de serie). El `id_cliente` para generar/listar se toma siempre de `req.cliente` (del token), nunca del body/params — nadie puede generar u obtener series de otro cliente.
  - Se eliminó el `POST /api/clientes` abierto (lo reemplaza `/auth/registro`) y el listado abierto de clientes; solo queda `GET /api/clientes/me` (perfil propio).
  - Rutas de series cambiaron de `/cliente/:id_cliente` a `/mias` (todas las filas propias) y `/mias/ejecuciones` (historial de corridas propio); `/ejecucion/:id_ejecucion` ahora también filtra por `id_cliente` del token, así que la ejecución de otro cliente da 404 aunque se adivine el UUID.
  - Probado end-to-end: registro, login, credenciales inválidas (401), rutas protegidas sin token (401), identificador duplicado (409), y que un cliente no puede ver la ejecución de otro (404). Datos de prueba borrados de `iot`.
- **Manejo de errores centralizado**: `utils/AppError.ts` + `middlewares/errorHandler.ts`, montado al final de `index.ts`. Como el proyecto usa Express 5, los controllers son `async` sin try/catch — Express 5 reenvía automáticamente promesas rechazadas al `errorHandler`.
- **Repositories**: wrappers finos sobre `AppDataSource.getRepository(Entity)`. Los de las 3 series exponen `guardarLote` (bulk insert, tipado `DeepPartial<Entity>[]` para poder pasar `cliente: { id_cliente }` sin el resto de los campos), `listarPorCliente`, `listarPorEjecucion` y `listarEjecucionesPorCliente` (query builder agrupando por `id_ejecucion` — para armar el "historial de corridas" en el dashboard).
- **Services** (lógica de negocio + fórmulas matemáticas):
  - `LeibnizService.generar`: réplica exacta del script de cátedra (acumulador `s`, `sign`, `denom`), N iteraciones random entre 50-500 si no se especifica (límite duro 5000).
  - `FibonacciService.generar`: F(0)=0, F(1)=1 con BigInt; por iteración calcula F(n+1)/F(n) → converge a φ=(1+√5)/2. N random 20-80, límite duro 90 (F(92) desborda BIGINT y `Number` pierde precisión antes de eso).
  - `TaylorService.generar`: recurrencia término-a-término (sin recalcular factorial completo) para `exponencial` (e^x), `seno`, `coseno`. Si no se pasan `funcion`/`x`/`iteraciones`, se randomizan (`funcion` al azar entre las 3, `x` random en [-2,2], N random 10-40, límite duro 200). Así se satisface "se generan datos randómicos" dejando también la opción de pedir valores puntuales.
  - Todos generan un `id_ejecucion` (uuid v4) nuevo por corrida y guardan todas las filas de esa corrida con ese mismo id.
  - `AuthService`: `registrar` y `login` (ver arriba). `ClienteService`: solo `obtenerPorId` (404 si no existe), usado internamente por los services de series y por el perfil.
- **Controllers + Routes**, montadas en `index.ts` bajo `/api`:
  - `POST /api/auth/registro`, `POST /api/auth/login` (públicas)
  - `GET /api/clientes/me` (requiere token) — perfil del cliente autenticado
  - `POST /api/series/{leibniz|fibonacci|taylor}/generar` (requiere token) — body `{ iteraciones? }` (Taylor además admite `funcion?`, `x?`); `id_cliente` sale del token
  - `GET /api/series/{leibniz|fibonacci|taylor}/mias` (requiere token) — todas las filas propias
  - `GET /api/series/{leibniz|fibonacci|taylor}/mias/ejecuciones` (requiere token) — historial de corridas propio (para elegir cuál graficar)
  - `GET /api/series/{leibniz|fibonacci|taylor}/ejecucion/:id_ejecucion` (requiere token) — filas de una corrida puntual, solo si es del cliente autenticado (404 si es de otro)
- **Probado end-to-end con curl** dos rondas: (1) API abierta original — crear cliente, generar las 3 series, listar ejecuciones, errores 404/409; (2) con auth — registro, login, credenciales inválidas (401), rutas sin token (401), identificador duplicado (409), aislamiento entre clientes (404 al intentar ver ejecución ajena). Todo responde correctamente. Datos de prueba insertados durante las pruebas ya se borraron de la BD `iot`.

### Pendiente en `Back/`:
- Nada bloqueante — la API (con login/registro) está lista para que el frontend consuma.

## Estado actual del frontend — ✅ COMPLETO (funcional, probado con Playwright)

`Front/` inicializado con `npm create vite@latest . -- --template react-ts` (React 19, Vite 8, TS ~6.0.3 — no tiene el problema de TS7 del backend porque Vite usa esbuild, no `tsc`, para el dev server). Dependencias agregadas: `react-router-dom` (v7, modo declarativo `<BrowserRouter>`), `axios`, `recharts`.

```
Front/src/
├── types/api.ts          → interfaces compartidas con el backend (Cliente, FilaSerie, etc.)
├── services/
│   ├── api.ts            → instancia axios + interceptor que agrega Authorization: Bearer <token>
│   ├── auth.service.ts   → registrar, login, perfil (/clientes/me)
│   ├── series.service.ts → generar/listarMias/listarEjecuciones/listarPorEjecucion, parametrizado por tipo
│   └── errors.ts         → extrae { error } del body de una AxiosError
├── context/AuthContext.tsx → token+cliente en localStorage, valida sesión contra /clientes/me al montar
├── components/
│   ├── ProtectedRoute.tsx
│   ├── SerieDashboard.tsx  → UI genérica reusada por las 3 series (form generar, historial, charts)
│   └── charts/             → ConvergenciaChart, ErrorChart, CrecimientoChart (Fibonacci, log scale) + palette.ts
├── pages/LoginPage.tsx, RegisterPage.tsx, DashboardPage.tsx (tabs Leibniz/Fibonacci/Taylor)
└── App.tsx                → rutas: /login, /registro, /dashboard (protegida)
```

- **Gráficos**: se armaron siguiendo el skill de dataviz del proyecto (paleta categórica validada para daltonismo, un solo eje nunca dual-eje, líneas finas, leyenda, tooltip). Cada serie muestra: (1) valor calculado vs valor real superpuestos, (2) error absoluto por iteración; Fibonacci además tiene (3) crecimiento de F(n) crudo en escala logarítmica (en lineal se aplasta contra el eje por ser exponencial) — es la respuesta concreta a "identificar qué gráfico se acomoda mejor para cada serie" que pedía el enunciado.
- El formulario de generar deja `iteraciones` (y en Taylor `funcion`/`x`) vacíos = aleatorio, o se puede fijar un valor puntual.
- El historial de corridas (`/mias/ejecuciones`) permite volver a ver cualquier ejecución pasada sin tener que regenerar.
- **Probado con Playwright** (headless, instalado en el scratchpad — no se agregó como dependencia del proyecto): registro → dashboard → generar Leibniz/Fibonacci/Taylor → reload mantiene sesión (token en localStorage) → logout. Cero errores de consola. Screenshots confirmaron visualmente que las 3 series convergen correctamente (Leibniz oscila hacia π, Fibonacci hacia φ, Taylor hacia e^x/sen/cos según la función). Datos de prueba borrados de `iot` al terminar.
- Se agregó `App/.gitignore` (no existía ninguno) cubriendo `node_modules/`, `dist/` y `.env` — importante porque el repo git real es `C:/Users/Alan` (todo el home, no solo este proyecto), así que sin esto un `git add` amplio podría llegar a commitear el `.env` del backend con la password de Postgres en texto plano.

## Preferencias de trabajo del usuario
- Le gusta avanzar paso a paso, confirmando cada paso antes de seguir.
- Prefiere comandos de terminal explícitos y completos, listos para copiar y pegar.
- Trabaja en español.
