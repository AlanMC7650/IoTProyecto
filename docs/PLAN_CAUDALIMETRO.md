# Plan: reemplazar las series simuladas por el caudalímetro YF-S201 (ESP32 + MicroPython)

Este documento describe los cambios a hacer en el repo `IoTProyecto` (https://github.com/AlanMC7650/IoTProyecto). Hoy el proyecto simula datos con series matemáticas (Leibniz, Fibonacci, Taylor). El objetivo es que los datos vengan de un **sensor real de caudal YF-S201** conectado a un **ESP32 con MicroPython**, que manda las lecturas al Back por WiFi, se guardan en PostgreSQL y se ven en la página web.

## Decisiones ya tomadas

- **Base de datos**: se sigue usando **PostgreSQL**. Lo que cambia es el esquema (tablas), no el motor.
- **Dónde corre todo**: Back, Front (compilado y servido por el Back) y Postgres corren **en la misma PC**. El ESP32 está en la **misma red WiFi** y manda los datos a la **IP local de la PC** (ej. `http://192.168.1.50:3000/api/lecturas`). No se usa ngrok para el ESP32.
- **Login**: se mantiene tal cual (tabla `cliente`, JWT). Lo de series se elimina por completo.
- Todo el código, nombres y textos de la interfaz en **español**, siguiendo el estilo que ya tiene el repo.

## Estado actual del repo (resumen)

```
BD.sql                  -> esquema actual (cliente + serie_leibniz/fibonacci/taylor)
Back/                   -> Node + Express 5 + TypeORM + pg, TypeScript
  src/config/data-source.ts   (synchronize: false, entidades en src/entities)
  src/entities/         Cliente, SerieFibonacci, SerieLeibniz, SerieTaylor
  src/controllers/ services/ repositories/ dtos/ routes/   (uno por serie + auth + cliente)
  src/middlewares/      auth.middleware.ts (JWT -> req.cliente), errorHandler.ts
  src/utils/            AppError, jwt, random
  public/               build del Front servido por Express (SPA fallback en index.ts)
Front/                  -> React 19 + Vite + Recharts + axios + react-router
  src/pages/            LoginPage, RegisterPage, DashboardPage (pestañas por serie)
  src/components/       SerieDashboard.tsx + charts/* (todo específico de series)
  src/services/         api.ts (axios + Bearer token), auth.service.ts, series.service.ts
  src/types/api.ts
Back.zip, Front.zip     -> copias viejas comprimidas, ignorarlas
```

## Arquitectura nueva

```
YF-S201 --pulsos--> ESP32 (MicroPython)
                      | WiFi, HTTP POST cada ~5 s, header X-API-Key
                      v
               Back (Express, puerto 3000, en la PC)
                      |                          ^
                      v                          | JWT (axios)
                 PostgreSQL                 Front (React, servido por el Back)
```

---

## 1. Base de datos (reemplazar `BD.sql`)

Mantener `cliente` igual. Eliminar `serie_leibniz`, `serie_fibonacci`, `serie_taylor` y sus índices. Agregar:

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- (tabla cliente igual que antes)

-- Cada ESP32 registrado por un cliente
CREATE TABLE dispositivo (
    id_dispositivo   SERIAL PRIMARY KEY,
    id_cliente       INT NOT NULL REFERENCES cliente(id_cliente) ON DELETE CASCADE,
    nombre           VARCHAR(100) NOT NULL,
    api_key_hash     CHAR(64) UNIQUE NOT NULL,      -- SHA-256 en hex de la clave API
    pulsos_por_litro DECIMAL(8,3) NOT NULL DEFAULT 450,
    ultima_conexion  TIMESTAMPTZ,
    fecha_registro   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cada medición del sensor (una por segundo)
CREATE TABLE lectura_caudal (
    id_lectura       BIGSERIAL PRIMARY KEY,
    id_dispositivo   INT NOT NULL REFERENCES dispositivo(id_dispositivo) ON DELETE CASCADE,
    caudal_lmin      DECIMAL(10,3) NOT NULL,
    volumen_l        DECIMAL(14,3) NOT NULL,   -- volumen acumulado reportado por el ESP32
    pulsos           INT NOT NULL,             -- pulsos contados en ese intervalo
    fecha_medicion   TIMESTAMPTZ NOT NULL,     -- calculada por el servidor (ver sección 2)
    fecha_recepcion  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dispositivo_cliente ON dispositivo(id_cliente);
CREATE INDEX idx_lectura_dispositivo_fecha ON lectura_caudal(id_dispositivo, fecha_medicion DESC);
```

Notas:
- La clave API **no se guarda en texto plano**, solo su hash SHA-256. Se muestra una sola vez al crear o regenerar el dispositivo.
- Dejar en el `BD.sql` un bloque comentado con los `DROP TABLE IF EXISTS serie_...` para quien ya tenga la BD vieja.

## 2. Back

### Borrar
Todo lo de series: entidades `SerieFibonacci/Leibniz/Taylor`, sus controllers, services, repositories, dtos y routes, y `utils/random.ts` si ya no se usa. Quitar las relaciones a series en la entidad `Cliente` y agregar la relación con `Dispositivo`.

### Crear (misma estructura en capas que ya usa el repo)
- `entities/Dispositivo.ts`, `entities/LecturaCaudal.ts`
- `repositories/`, `services/`, `controllers/`, `dtos/`, `routes/` para `dispositivo` y `lectura`
- `middlewares/deviceAuth.middleware.ts`: lee el header `X-API-Key`, calcula su SHA-256, busca el dispositivo y lo pone en `req.dispositivo`. Si no existe → 401.
- `utils/apiKey.ts`: genera la clave (`crypto.randomBytes(24).toString("hex")`) y la hashea.

### Endpoints

**Para el ESP32** (autenticado con `X-API-Key`, sin JWT):

`POST /api/lecturas`
```json
{
  "lecturas": [
    { "caudal_lmin": 2.13, "volumen_l": 0.452, "pulsos": 16, "ms_atras": 4000 },
    { "caudal_lmin": 2.20, "volumen_l": 0.488, "pulsos": 16, "ms_atras": 3000 }
  ]
}
```
- `ms_atras` = cuántos milisegundos antes del envío se tomó esa lectura. El ESP32 no tiene reloj real; así el servidor calcula `fecha_medicion = NOW() - ms_atras`. Esto también sirve para lecturas que quedaron en cola mientras no había WiFi.
- Validar: arreglo de 1 a 500 elementos, números finitos y no negativos, `ms_atras` ≤ 24 h. Si algo es inválido → 400 con mensaje claro.
- Inserta todo en un solo lote y actualiza `dispositivo.ultima_conexion`.
- Responde `201 { "guardadas": n }`. El ESP32 solo borra su cola si recibe 201.

**Para la web** (con el `authMiddleware` JWT existente; cada cliente solo ve sus dispositivos):

| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/api/dispositivos` | Crea un dispositivo `{ nombre }`. Devuelve el dispositivo **y la clave API en texto plano (única vez)**. |
| GET | `/api/dispositivos` | Lista los dispositivos del cliente, con `ultima_conexion` y un campo `en_linea` (última conexión hace < 15 s). |
| PATCH | `/api/dispositivos/:id` | Cambia `nombre` o `pulsos_por_litro`. |
| POST | `/api/dispositivos/:id/regenerar-clave` | Genera clave nueva, devuelve la clave en texto plano. |
| DELETE | `/api/dispositivos/:id` | Elimina el dispositivo y sus lecturas. |
| GET | `/api/dispositivos/:id/ultima` | Última lectura (para el valor "en vivo"). |
| GET | `/api/dispositivos/:id/lecturas?desde=&hasta=&limite=` | Lecturas en un rango (ISO 8601). Por defecto los últimos 10 min, límite máx. 5000, orden ascendente por fecha. |
| GET | `/api/dispositivos/:id/resumen?desde=&hasta=` | Caudal promedio y máximo, litros consumidos en el rango (`max(volumen_l) - min(volumen_l)`, o suma de `pulsos / pulsos_por_litro` si el ESP32 se reinició y el acumulado volvió a 0 — preferir la suma de pulsos), cantidad de lecturas. |

### Otros cambios en el Back
- `index.ts`: Express ya escucha en todas las interfaces; dejar un `console.log` que muestre las IPs locales de la PC al arrancar (con `os.networkInterfaces()`), para saber qué URL poner en el ESP32.
- Mantener `errorHandler` y `AppError` como están.
- Actualizar `.env.example` si hace falta.

## 3. ESP32 (MicroPython, se sube con Thonny)

Crear una carpeta nueva `ESP32/` en la raíz del repo con:

- `config.example.py` (y `config.py` en `.gitignore`):
  ```python
  WIFI_SSID = "mi_red"
  WIFI_PASSWORD = "mi_clave"
  SERVIDOR = "http://192.168.1.50:3000"   # IP local de la PC que corre el Back
  API_KEY = "pegar_aqui_la_clave_del_dispositivo"
  PIN_SENSOR = 27
  FACTOR_K = 7.5
  PULSOS_POR_LITRO = 450
  INTERVALO_ENVIO_S = 5
  ```
- `main.py`: parte del script que **ya funciona** (abajo) y le agrega:
  - Conexión WiFi con reintentos (`network.WLAN(network.STA_IF)`), sin bloquear el conteo de pulsos.
  - Cada segundo calcula la lectura (igual que ahora) y la mete en una cola en memoria, guardando `time.ticks_ms()` del momento.
  - Cada `INTERVALO_ENVIO_S` segundos hace `POST /api/lecturas` con `urequests`, header `X-API-Key` y `Content-Type: application/json`, calculando `ms_atras` de cada lectura al momento del envío. Siempre cerrar la respuesta (`r.close()`).
  - Si falla (sin WiFi, timeout, respuesta ≠ 201) conserva la cola y reintenta en el siguiente ciclo. Limitar la cola (ej. 600 lecturas) descartando las más viejas para no quedarse sin RAM. Enviar en lotes de máx. 100.
  - Usar `gc.collect()` después de cada envío.
  - Seguir imprimiendo en consola el caudal y volumen (para el Plotter de Thonny) y el resultado de cada envío.
  - Opcional: LED integrado (GPIO 2) que parpadee al enviar con éxito.
- `README.md` corto: cableado y cómo subir los archivos con Thonny.

**Script que ya funciona en Thonny (base):**
```python
from machine import Pin
import machine
import time

PIN_SENSOR = 27
FACTOR_K = 7.5           # frecuencia (Hz) = 7.5 * caudal (L/min)
PULSOS_POR_LITRO = 450

pulsos = 0
total_pulsos = 0

def contar_pulso(pin):
    global pulsos
    pulsos += 1

sensor = Pin(PIN_SENSOR, Pin.IN, Pin.PULL_UP)
sensor.irq(trigger=Pin.IRQ_FALLING, handler=contar_pulso)

t_anterior = time.ticks_ms()
while True:
    time.sleep(1)
    ahora = time.ticks_ms()
    dt = time.ticks_diff(ahora, t_anterior) / 1000
    t_anterior = ahora

    estado = machine.disable_irq()
    n = pulsos
    pulsos = 0
    machine.enable_irq(estado)

    total_pulsos += n
    caudal = (n / dt) / FACTOR_K
    volumen = total_pulsos / PULSOS_POR_LITRO
    print("Caudal_Lmin:", round(caudal, 2), "Volumen_L:", round(volumen, 3))
```

Cableado: rojo → 5V (VIN), negro → GND, amarillo (señal) → GPIO 27 (con divisor 10k/20k recomendado para bajar a 3.3 V).

Importante: mientras se envía por HTTP el conteo de pulsos sigue funcionando porque es por interrupción; el cálculo del caudal usa `dt` real, así que no se pierde precisión si un ciclo tarda más de 1 s.

## 4. Front

### Borrar
`SerieDashboard.tsx`, todos los `components/charts/*` de series, `services/series.service.ts`, `utils/exportSerie.ts` y los tipos de series en `types/api.ts`.

### Crear / cambiar
- `services/dispositivos.service.ts` y `services/lecturas.service.ts` (usando el `api` de axios existente).
- Tipos nuevos en `types/api.ts`: `Dispositivo`, `LecturaCaudal`, `ResumenCaudal`.
- `DashboardPage.tsx`: misma estructura visual (sidebar + topbar), pero:
  - Marca: algo tipo "FlowLab · Monitor de caudal" en vez de "SeriesLab".
  - El sidebar lista los **dispositivos** del cliente (en vez de las pestañas de series) con un punto verde/gris de en línea.
- Vista de un dispositivo (`components/DispositivoDashboard.tsx`):
  - Tarjetas: **caudal actual (L/min)**, **volumen acumulado (L)**, **consumo en el rango**, **estado** (en línea / desconectado + hace cuánto).
  - **Gráfica de caudal en el tiempo** (Recharts, línea) que se actualiza sola cada 2–3 s haciendo polling a `/lecturas` (solo pide lo nuevo desde la última fecha recibida).
  - Gráfica de volumen acumulado (área).
  - Selector de rango: 5 min, 1 h, 24 h, personalizado. En rangos largos el back o el front deben reducir puntos (ej. promediar por minuto) para no dibujar miles.
  - Botón para exportar las lecturas del rango a CSV.
- Vista **"Agregar dispositivo"**: formulario con nombre → muestra la clave API una sola vez con botón de copiar y un mensaje tipo "pégala en `config.py` del ESP32". Opción de regenerar clave y eliminar dispositivo.
- Estado vacío: si el cliente no tiene dispositivos, mostrar un mensaje guiando a registrar el primero.
- Reutilizar `palette.ts` y las clases de `index.css` existentes para que se vea consistente.

### Build
Después de cambiar el Front: `npm run build` en `Front/` y copiar el contenido de `Front/dist/` a `Back/public/` (reemplazando los assets viejos), como se hacía antes.

## 5. Cómo probar todo

1. Recrear la BD en Postgres con el `BD.sql` nuevo.
2. `cd Back && npm install && npm run dev`. Anotar la IP local que imprime.
3. Permitir el puerto 3000 en el firewall de Windows (red privada) para que el ESP32 pueda llegar.
4. Abrir `http://localhost:3000`, registrarse, crear un dispositivo y copiar la clave API.
5. En Thonny: copiar `config.example.py` → `config.py`, completar WiFi, IP y clave, subir `config.py` y `main.py` al ESP32.
6. Pasar agua (o soplar) por el sensor y ver que la gráfica se mueve en la web.
7. Probar desconectar el WiFi un rato y volver a conectar: las lecturas acumuladas deben llegar con su hora correcta.

Antes de poder probar con el ESP32, agregar un script de prueba `Back/scripts/simular-esp32.ts` (o `.js`) que haga POST a `/api/lecturas` con datos falsos usando una clave API, para probar el Back y el Front sin hardware.

## Orden de trabajo sugerido

1. BD (`BD.sql`) y entidades.
2. Back: dispositivos + lecturas + middleware de clave API. Probar con el script simulador.
3. Front: dashboard nuevo.
4. ESP32: `main.py` con WiFi y envío.
5. Prueba completa con el sensor real.

Hacer commits separados por cada etapa.
