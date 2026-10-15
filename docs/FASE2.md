# AquaControl · Fase 2: Supabase, ngrok, actuadores y superadmin

Qué cambió respecto al caudalímetro de la fase anterior y cómo levantar todo.

## Arquitectura

```
ESP32 ──HTTPS cada 2 s──> Supabase (PostgreSQL + funciones)
                              │  NOTIFY nueva_lectura
                              ▼
Navegador <──ngrok──> Back (Node/Express en la PC) ──SQL──┘
              (REST + tiempo real por SSE)
```

- **El ESP32 no pasa por ngrok.** El plan gratuito de ngrok permite 20 000 peticiones por mes y un ESP32 enviando cada 2 s haría alrededor de 1,3 millones. El ESP32 llama directo a dos funciones de Supabase (`anunciar_dispositivo` y `registrar_lecturas`), que no tienen límite de peticiones en el plan gratuito.
- **ngrok solo publica el Back**, que sirve el dashboard y la API. El tiempo real usa Server-Sent Events: una sola petición por pestaña abierta.
- Si la PC del Back está apagada, las lecturas igual se guardan en Supabase.

## Cómo levantar todo

### 1. Base de datos (una vez)

`BD.sql` ya se corrió en Supabase. Si hay que repetirlo (por ejemplo, en otro proyecto), se puede pegar en el editor SQL de Supabase o correr con psql: conserva los datos.

Primer superadmin, en el editor SQL de Supabase:

```sql
UPDATE cliente SET rol = 'admin' WHERE email = 'tu-email@ejemplo.com';
```

### 2. Back + dashboard

```powershell
cd Back
npm install
npm run front      # compila el Front y lo copia a Back/public (solo si se cambió el Front)
npm run dev
```

En otra terminal, para publicarlo en Internet:

```powershell
cd Back
npm run tunnel     # ngrok con el dominio fijo de Back/ngrok.yml
```

Cualquiera entra a `https://<dominio>.ngrok-free.dev`. La primera visita muestra una página de aviso de ngrok: tocar "Visit Site".

> **Importante:** si `Front/.env` tiene `VITE_API_URL=https://...ngrok.../api`, el dashboard solo funciona con ngrok levantado (incluso abriéndolo en `localhost:3000`). Conviene borrar esa línea: por defecto el Front usa `/api` del mismo dominio, que sirve tanto en local como por ngrok.

### 3. ESP32

Ver [ESP32/README.md](../ESP32/README.md). En resumen: completar `config.py` con la URL y la clave pública de Supabase (igual para todos los ESP32), grabar `config.py`, `portal.py` y `main.py` con Thonny, configurar el Wi-Fi desde el celular y vincularlo en el dashboard con su código de 6 caracteres.

### Probar sin hardware

Agregar `SUPABASE_ANON_KEY` a `Back/.env` (Supabase → Project Settings → API Keys) y:

```powershell
cd Back
npm run simular              # muestra un código: vincularlo en "Agregar dispositivo"
npm run simular -- --fuga    # además simula agua en el piso al minuto
```

## Qué se cambió

### Base de datos (`BD.sql`)

| Cambio | Detalle |
|---|---|
| `cliente` | `rol` (`usuario` / `admin`) y `activo` (el admin puede suspender cuentas) |
| `dispositivo` | Nace cuando el ESP32 se anuncia (`estado = 'pendiente'`, sin dueño). Nuevas columnas `mac`, `codigo_vinculo`, `estado`, `limite_diario_l`, `valvula_modo`, `ultimo_anuncio`. `api_key_hash` pasó a `token_hash`. |
| `lectura_caudal` | `nivel_agua` (T1592), `fuga`, `valvula_abierta`, `led_estado`, `led_brillo` |
| `evento` | Tabla nueva: `FUGA`, `LIMITE`, `FLUJO_CONTINUO`, `VALVULA` |
| Funciones | `anunciar_dispositivo`, `registrar_lecturas` (las llama el ESP32), `estado_dispositivo` y `consumo_hoy_l` |
| Seguridad | RLS activado en todas las tablas y sin permisos para `anon` / `authenticated`: la API pública de Supabase no puede leer ninguna tabla (antes `cliente`, con los hashes de las contraseñas, era legible con la clave pública). `anon` solo puede ejecutar las dos funciones del ESP32. |

### Back

| Endpoint | Qué hace |
|---|---|
| `POST /api/dispositivos/vincular` | Vincula un ESP32 con su código (solo si se anunció en los últimos 10 min) |
| `PATCH /api/dispositivos/:id` | Además de nombre y pulsos por litro, `limite_diario_l` (`null` lo quita) |
| `POST /api/dispositivos/:id/valvula` | `{ "modo": "auto" \| "abierta" \| "cerrada" }` |
| `GET /api/dispositivos/:id/estado` | Qué tiene que hacer la válvula y por qué, consumo de hoy, fugas sin confirmar |
| `GET /api/dispositivos/:id/eventos` | Alertas recientes |
| `POST /api/dispositivos/:id/eventos/atender-fugas` | El usuario confirma que revisó la fuga: la válvula puede reabrirse |
| `DELETE /api/dispositivos/:id` | Desvincula: borra lecturas y eventos, el token deja de valer y el ESP32 vuelve a mostrar su código |
| `GET /api/stream?dispositivo=:id` | Tiempo real (SSE), alimentado por `LISTEN nueva_lectura` |
| `GET /api/admin/usuarios` | Solo admin: usuarios con cantidad de dispositivos y último dato |
| `GET /api/admin/usuarios/:id/dispositivos` | Solo admin: dispositivos de un usuario, para ver sus dashboards |
| `PATCH /api/admin/usuarios/:id` | Solo admin: `{ "activo": false }` suspende la cuenta |

Se quitaron `POST /api/lecturas` (con `X-API-Key`), `POST /api/dispositivos` y `regenerar-clave`: ahora el ESP32 escribe en Supabase y se vincula por código. El middleware de autenticación lee el rol y el estado de la cuenta en cada petición, así que una suspensión vale aunque el token no haya vencido.

### Front

- **Agregar dispositivo:** pide el código de 6 caracteres y un nombre (ya no muestra claves).
- **Vista del dispositivo:** un panel por componente:
  - **Flujo:** caudal actual, consumo de hoy contra el límite (editable) y gráfica.
  - **Sensor de agua:** medidor, estado SECO / HÚMEDO / FUGA, gráfica con la línea del umbral y el botón "Ya revisé la fuga".
  - **Electroválvula:** estado, motivo, botones Abrir / Cerrar / Automático y gráfica escalonada.
  - **LED RGB:** gemelo digital con el color y el brillo actuales, y su historial.
  - **Eventos recientes.**
- Se actualiza en tiempo real por SSE; la lista de dispositivos se refresca cada 60 s (cada pedido pasa por ngrok).
- **Página `/admin`** solo para el rol admin, con buscador y botón para suspender o reactivar cuentas.
- **Página `/admin/usuarios/:id`:** el admin ve los dashboards de cualquier usuario (mismos paneles, en tiempo real) y exporta sus datos a CSV. Es solo lectura: no puede mover la válvula, cambiar el límite ni desvincular.
- La marca pasó de FlowLab a AquaControl.

### ESP32

`main.py` nuevo y `portal.py`. Detalle en [ESP32/README.md](../ESP32/README.md).

### Velocidad y permisos del admin (segunda ronda)

- **Envío cada 2 s (antes 5 s)** en el ESP32 y en el simulador. No se baja más porque cada envío abre una conexión HTTPS, que en el ESP32 tarda alrededor de 1 s. El dashboard marca "en línea" con menos de 10 s sin datos y actualiza ese estado cada segundo.
- **Limpieza automática en la BD:** con una lectura cada 2 s se suman ~43 000 filas por día y por dispositivo. `registrar_lecturas` borra de vez en cuando (1 de cada 100 envíos) las lecturas de más de 30 días de ese dispositivo, para no llenar los 500 MB del plan gratuito.
- **Superadmin con permiso de lectura sobre todos los dispositivos:** lecturas, resumen, estado, eventos, tiempo real y exportación. Las acciones que modifican (válvula, límite, configuración, confirmar fuga, desvincular) siguen siendo solo del dueño.

## Qué se probó

- **Funciones SQL como `anon`:** códigos, token entregado una sola vez, token inválido, valores fuera de rango, eventos de fuga y límite, y que `anon` no puede leer `cliente`.
- **API completa contra Supabase:** registro, login, vinculación (código mal, inexistente, ya tomado), lecturas, agrupado y resumen, límite, válvula, confirmación de fuga, superadmin (403 para usuarios comunes, suspensión y reactivación) y desvinculación.
- **Tiempo real:** una lectura insertada en Supabase llegó al navegador por SSE.
- **`ESP32/main.py`:** corrido en la PC con imitaciones de los módulos de MicroPython, llamando a las funciones reales de Supabase. Mostró el código, recibió el token al vincularse, el LED cambió con el caudal, cerró la válvula ante la fuga, esperó la confirmación para reabrir y cerró al alcanzar el límite.
- **Permisos del admin:** ve, exporta y recibe en tiempo real los datos ajenos (200), y recibe 404 al intentar mover la válvula, cambiar el límite o desvincular. Un usuario común no ve nada ajeno (404) ni entra a `/admin` (403). Una lectura tardó ~1 s desde la llamada a Supabase hasta llegar al navegador.
- **Dashboard en el navegador:** los cuatro paneles con datos en vivo, los botones de la válvula y la página de admin.

**No probado:**

- El ESP32 real con los sensores y la válvula.
- `portal.py` en un ESP32.
- El simulador `npm run simular` contra la API HTTP de Supabase (necesita la clave pública, que no estaba en `.env`).
- El sitio a través de ngrok.
