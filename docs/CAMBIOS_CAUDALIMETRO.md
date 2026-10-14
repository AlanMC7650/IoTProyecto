# Cambios hechos: de las series simuladas al caudalímetro YF-S201

> **Nota:** esta es la etapa anterior. Lo actual (Supabase, ngrok, vinculación automática, válvula, LED, sensor de agua y superadmin) está en [FASE2.md](FASE2.md).

Este documento resume qué se cambió en el proyecto siguiendo [PLAN_CAUDALIMETRO.md](PLAN_CAUDALIMETRO.md) y cómo ejecutar todo.

El trabajo está en la rama **`caudalimetro`** (sin subir a GitHub), con un commit por etapa.

## Resumen

- Se eliminó todo lo de las series (Leibniz, Fibonacci, Taylor) en la BD, el Back y el Front.
- El login y el registro quedaron igual (tabla `cliente`, JWT).
- Ahora cada cliente registra **dispositivos** (ESP32). Cada uno tiene una **clave API** con la que envía sus lecturas al Back.
- La web (ahora "FlowLab · Monitor de caudal") muestra el caudal en vivo, el volumen, el consumo y el estado de cada dispositivo.
- Hay una carpeta nueva `ESP32/` con el programa de MicroPython y un simulador en `Back/scripts/` para probar sin hardware.

## Cómo ejecutar todo

### 1. Base de datos

`BD.sql` se puede correr sobre una BD vacía o sobre la BD `iot` que ya existe: usa `IF NOT EXISTS`, así que conserva la tabla `cliente` con sus usuarios y solo crea las tablas nuevas.

```powershell
# Si la BD todavía no existe:
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -c "CREATE DATABASE iot"

# Crear las tablas (sirve también para actualizar la BD vieja):
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d iot -f BD.sql
```

Las tablas viejas `serie_*` no molestan si quedan. Para borrarlas, descomentar el bloque de `DROP TABLE` que está al principio de `BD.sql` antes de correrlo.

> **Importante:** hasta que no se corra este paso la web no funciona (el Back responde "Error interno del servidor" al listar dispositivos, porque las tablas no existen).

### 2. Back (sirve también la web)

```powershell
cd Back
npm install
npm run dev
```

Al arrancar imprime las direcciones, por ejemplo:

```
Servidor corriendo en puerto 3000
  En esta PC:  http://localhost:3000
  En la red:   http://192.168.1.50:3000   <- usar esta en SERVIDOR del config.py del ESP32
```

Si aparece más de una dirección "En la red" (pasa cuando hay adaptadores virtuales), la que sirve es la del WiFi, normalmente `192.168.x.x`.

El archivo `Back/.env` es el mismo de antes. Hay una variable nueva y opcional, `DB_LOGGING=true`, para volver a ver cada consulta SQL en la consola (ahora por defecto solo se muestran los errores).

### 3. Firewall de Windows (solo para el ESP32)

Para que el ESP32 pueda llegar a la PC hay que permitir el puerto 3000 en redes privadas. En PowerShell **como administrador**:

```powershell
netsh advfirewall firewall add rule name="FlowLab Back 3000" dir=in action=allow protocol=TCP localport=3000 profile=private
```

La red WiFi tiene que estar marcada como "Privada" en Windows.

### 4. Web

1. Abrir `http://localhost:3000`.
2. Iniciar sesión o registrarse.
3. **Agregar dispositivo** → poner un nombre → la web muestra la **clave API una sola vez**. Copiarla.

### 5a. Probar sin hardware (simulador)

En otra terminal:

```powershell
cd Back
npm run simular -- LA_CLAVE_API
```

Genera una lectura falsa por segundo y las envía cada 5 s, igual que el ESP32. En la web el dispositivo pasa a "En línea" y la gráfica se empieza a mover. Si el Back corre en otro puerto o en otra PC, la URL va como segundo argumento: `npm run simular -- LA_CLAVE_API http://192.168.1.50:3000`.

### 5b. Con el ESP32 real

Detalle completo (cableado y errores comunes) en [ESP32/README.md](../ESP32/README.md). En resumen:

1. Copiar `ESP32/config.example.py` como `ESP32/config.py` y completar el WiFi (2.4 GHz), `SERVIDOR` (la dirección "En la red" que imprime el Back) y `API_KEY`.
2. En Thonny, guardar `config.py` y `main.py` en el ESP32.
3. Reiniciar el ESP32. En la consola tiene que aparecer `WiFi conectado` y después `Envio OK: 5 lecturas`.
4. Pasar agua o soplar por el sensor y mirar la gráfica en la web.
5. Prueba de corte: apagar el WiFi un par de minutos y volver a prenderlo. Las lecturas acumuladas llegan con su hora real y la gráfica se completa (puede tardar hasta 30 s en redibujar ese tramo).

### Cuando se cambia algo del Front

El Back sirve el Front ya compilado desde `Back/public`. Después de tocar el Front:

```powershell
cd Back
npm run front
```

Ese comando hace `npm run build` en `Front/` y copia `Front/dist` a `Back/public`. No hace falta reiniciar el Back.

Para desarrollar con recarga automática sigue sirviendo `npm run dev` en `Front/` (puerto 5173), con el Back corriendo en el 3000.

## Qué se cambió

### Base de datos (`BD.sql`)

- Se quitaron `serie_leibniz`, `serie_fibonacci`, `serie_taylor` y sus índices.
- Tablas nuevas: `dispositivo` y `lectura_caudal`, con sus índices, tal como las define el plan.
- La clave API no se guarda: solo su hash SHA-256.

### Back

Se borró todo lo de series (entidades, controllers, services, repositories, dtos, routes) y `utils/random.ts`. También la dependencia `uuid`, que ya no se usaba.

Archivos nuevos, con la misma estructura en capas:

| Archivo | Qué hace |
|---|---|
| `entities/Dispositivo.ts`, `entities/LecturaCaudal.ts` | Entidades de las tablas nuevas. `Cliente` ahora se relaciona con `Dispositivo`. |
| `utils/apiKey.ts` | Genera la clave API y calcula su hash. |
| `middlewares/deviceAuth.middleware.ts` | Lee `X-API-Key`, busca el dispositivo y lo deja en `req.dispositivo`. Si no existe responde 401. |
| `repositories/`, `services/`, `controllers/`, `dtos/`, `routes/` de `dispositivo` y `lectura` | Lógica y endpoints. |
| `scripts/simular-esp32.ts` | Simulador del ESP32 (`npm run simular`). |
| `scripts/copiar-front.js` | Copia el build del Front a `Back/public` (`npm run front`). |

Endpoints:

| Método | Ruta | Autenticación | Qué hace |
|---|---|---|---|
| POST | `/api/lecturas` | `X-API-Key` | El ESP32 envía de 1 a 500 lecturas. Responde `201 { "guardadas": n }`. |
| POST | `/api/dispositivos` | JWT | Crea un dispositivo y devuelve la clave API (única vez). |
| GET | `/api/dispositivos` | JWT | Lista los dispositivos del cliente con `en_linea` (envió datos hace menos de 15 s). |
| PATCH | `/api/dispositivos/:id` | JWT | Cambia `nombre` o `pulsos_por_litro`. |
| POST | `/api/dispositivos/:id/regenerar-clave` | JWT | Genera una clave nueva; la anterior deja de servir. |
| DELETE | `/api/dispositivos/:id` | JWT | Elimina el dispositivo y sus lecturas. |
| GET | `/api/dispositivos/:id/ultima` | JWT | Última lectura. |
| GET | `/api/dispositivos/:id/lecturas?desde=&hasta=&limite=&agrupar_s=` | JWT | Lecturas del rango (por defecto últimos 10 min, máximo 5000, orden ascendente). |
| GET | `/api/dispositivos/:id/resumen?desde=&hasta=` | JWT | Caudal promedio y máximo, litros consumidos y cantidad de lecturas. |

Cada cliente solo ve sus propios dispositivos: pedir uno ajeno responde 404.

Cambios en archivos que ya existían:

- `index.ts`: sirve `Back/public` con fallback para la SPA e imprime las IPs locales al arrancar.
- `config/data-source.ts`: el log de SQL pasa a mostrar solo errores (con el ESP32 enviando y la web consultando cada pocos segundos, la consola era ilegible).
- `.env.example`: se agregó `DB_LOGGING`.

### Front

Se borraron `SerieDashboard.tsx`, los gráficos de series, `series.service.ts`, `exportSerie.ts` y los tipos de series.

| Archivo | Qué hace |
|---|---|
| `pages/DashboardPage.tsx` | Misma estructura (sidebar + topbar). El sidebar lista los dispositivos con un punto verde o gris según estén en línea, y la opción de agregar uno. Si no hay dispositivos, muestra un mensaje que guía a registrar el primero. |
| `components/DispositivoDashboard.tsx` | Vista de un dispositivo: 4 tarjetas (caudal actual, volumen acumulado, consumo en el rango, estado), gráfica de caudal, gráfica de volumen, selector de rango (5 min, 1 h, 24 h, personalizado), exportar CSV y un panel de configuración (renombrar, pulsos por litro, regenerar clave, eliminar). |
| `components/AgregarDispositivo.tsx` | Formulario para registrar un dispositivo; al crear muestra la clave. |
| `components/ClaveApi.tsx` | Caja que muestra la clave una sola vez, con botón de copiar. |
| `components/charts/CaudalChart.tsx`, `VolumenChart.tsx`, `ejeTiempo.ts` | Gráficas con Recharts (línea y área) sobre un eje de tiempo. |
| `services/dispositivos.service.ts`, `services/lecturas.service.ts` | Llamadas a la API con el `api` de axios que ya existía. |
| `utils/exportLecturas.ts`, `utils/tiempo.ts` | Exportación a CSV y textos del tipo "hace 5 s". |
| `types/api.ts` | Tipos `Dispositivo`, `LecturaCaudal`, `ResumenCaudal`. |

Cómo se actualiza la gráfica: cada 2,5 s pide solo las lecturas nuevas desde la última fecha recibida. Cada 30 s recarga el rango completo, para que aparezcan las lecturas que el ESP32 tenía en cola y llegan con hora vieja.

También se cambió la marca en login y registro (SeriesLab → FlowLab), el título de la pestaña, y se quitaron de `index.css` los estilos que eran solo de series.

### ESP32 (carpeta nueva)

- `main.py`: parte del script que ya funcionaba y le agrega WiFi con reintentos sin frenar la medición, cola en memoria (máx. 600 lecturas), envío cada 5 s en lotes de hasta 100, `ms_atras` por lectura, y parpadeo del LED (GPIO 2) cuando un envío sale bien. Solo vacía la cola si el servidor responde 201.
- `config.example.py`: plantilla de configuración. `config.py` está en `.gitignore`.
- `README.md`: cableado, cómo subirlo con Thonny y errores comunes.

## Diferencias con el plan

| Tema | Qué se hizo y por qué |
|---|---|
| `Back/public` y el fallback SPA | El plan los daba por existentes, pero en el repo local no estaban. Se agregaron a `index.ts` y se generó `Back/public`. |
| Reducción de puntos en rangos largos | La hace el Back con un parámetro nuevo, `agrupar_s`: promedia las lecturas por intervalos. El Front lo usa en rangos de más de 10 min (1 h → cada 5 s, 24 h → cada 2 min), así nunca dibuja más de ~800 puntos. |
| Litros consumidos | Se calculan siempre con la suma de pulsos dividida por `pulsos_por_litro` del dispositivo (la opción que el plan pedía preferir), no con máximo − mínimo del volumen. |
| `fecha_medicion` | Se calcula en el Back (hora del servidor − `ms_atras`) y no con `NOW()` de Postgres. Como corren en la misma PC, es equivalente. |
| URL de la API en el Front | El valor por defecto pasó de `http://localhost:3000/api` a `/api`. Con la URL anterior la web no funcionaba al abrirla desde otro equipo de la red. |
| Huecos en la gráfica | Cuando el dispositivo estuvo desconectado, la línea se corta en vez de unir los extremos. No estaba en el plan. |
| Exportar CSV | Exporta las lecturas reales del rango (una por segundo), no los promedios de la gráfica. |

## Qué se probó y qué no

Probado contra una base de datos de prueba aparte, que ya se borró (la BD `iot` no se tocó):

- Todos los endpoints: casos correctos, validaciones (400), sin clave o con clave inválida (401), dispositivo de otro cliente (404), regenerar clave (la vieja deja de funcionar).
- La web en Chrome con el simulador enviando datos: los cuatro rangos, exportar CSV, agregar, configurar, regenerar clave, eliminar, estado vacío y vista en celular. Sin errores en la consola del navegador.
- `ESP32/main.py` ejecutado en la PC con módulos de MicroPython simulados: sin WiFi acumuló lecturas en la cola y al conectar llegaron con su hora correcta.

**No probado:** el `main.py` en un ESP32 real con el sensor conectado. Es el paso 5b de arriba.

## Pendientes y avisos

- Un JSON mal formado en `POST /api/lecturas` responde 500 en vez de 400. Viene del `errorHandler` existente, que el plan pedía no tocar. El ESP32 siempre envía JSON válido, así que no afecta el uso normal.
- La tabla `lectura_caudal` crece unas 86.400 filas por día por dispositivo encendido. No hay limpieza automática de lecturas viejas.
- El proxy de `/api` en `Front/vite.config.ts` sigue sin commitear (ya estaba así antes de este trabajo). `npm run dev` del Front lo necesita.
