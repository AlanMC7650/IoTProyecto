# Arreglo: el dashboard se muestra "Desconectado" y con datos incorrectos

Instrucciones para implementar en el repo de AquaControl (rama `iblingteamo`). Están escritas para un agente de código: incluyen el diagnóstico con mediciones, los cambios archivo por archivo y cómo verificarlos.

## Síntoma

Con el ESP32 real (MAC `30:76:F5:E7:FD:CC`, `id_dispositivo = 33`) y el dashboard abierto por ngrok:

- El dashboard alterna entre "En línea" y "Desconectado". Mientras dice "Desconectado" muestra caudal "—", LED "Sin datos" y, en la válvula, lo que *debería* hacer en vez de lo que hace. Por eso parece que el tiempo real dejó de andar y que los datos están mal.
- El monitor serie del ESP32 muestra errores intermitentes al enviar:
  ```
  Sin conexión con Supabase, se reintenta: [Errno 104] ECONNRESET
  Sin conexión con Supabase, se reintenta: HTTP error: BadStatusLine:
  ```

## Diagnóstico (medido el 15/10 a las 12:15-12:20)

| Prueba | Resultado |
|---|---|
| `LISTEN nueva_lectura` directo contra Supabase durante 30 s | ✅ llegó un aviso por cada lectura guardada (6 de 6) |
| SSE `GET /api/stream?dispositivo=33` a través del ngrok | ✅ la lectura llegó al instante |
| Ritmo real del ESP32 en los últimos 30 min | ❌ 219 lecturas, **una cada 7,7 s en promedio**, **37 pausas de más de 10 s** (la mayor, 66 s) |

**Conclusión:** la base de datos, el Back y el SSE funcionan. El commit `3247261` ya cubre la escucha que moría en silencio. El problema es el ritmo del ESP32:

1. **Cada envío abre una conexión HTTPS nueva** a Supabase (`urequests` no reutiliza conexiones). En el ESP32 el handshake TLS más la petición tardan de 3 a 5 s, y el bucle principal queda bloqueado mientras tanto. Con `INTERVALO_ENVIO_S = 2`, en la práctica sale una lectura cada 4 a 8 s. Cuando un envío falla (`ECONNRESET`), la pausa se alarga.
2. **"En línea" se considera con menos de 10 s** desde la última lectura (`MS_EN_LINEA = 10_000` en el Back y en el Front). Con este ritmo se pasa ese límite seguido.
3. **"Estuvo cerrada N min" supone 2 s por lectura** (`SEGUNDOS_POR_LECTURA = 2`). Con lecturas cada ~8 s, el tiempo con la válvula cerrada da unas 4 veces menos de lo real.

Antes del commit `d9fdf62` ("arreglo del delay") el intervalo era de 5 s y esto no pasaba.

## Antes de empezar

Alan tiene cambios **sin commitear** en la rama `iblingteamo` que tocan los mismos archivos. Pedile que los suba primero para no generar conflictos:

- `Front/src/components/DispositivoDashboard.tsx`:
  - el resumen del rango ("En el rango…", "estuvo cerrada N min") se actualiza con cada lectura del SSE, con las funciones `sumarLectura` y `SEGUNDOS_POR_LECTURA`;
  - el panel del sensor de agua quedó oculto con `MOSTRAR_SENSOR_AGUA = false`, porque todavía no tienen el sensor. **No volver a mostrarlo.**
- `Front/src/types/api.ts` y `Back/src/services/lectura.service.ts`: campo nuevo `segundos_valvula_cerrada` en el resumen.
- `Back/public`: el Front recompilado.

## Cambios a implementar

### 1. ESP32: medir cada 2 s y enviar en tandas cada ~6 s

Archivo: `ESP32/main.py`.

Separar dos intervalos que hoy son uno solo (`INTERVALO_ENVIO_S`):

```python
INTERVALO_LECTURA_S = 2      # cada cuánto se arma una lectura y se agrega a la cola
INTERVALO_ENVIO_S = 6        # cada cuánto se manda la cola a Supabase (una conexión HTTPS por envío)
```

- **El bloque `# --- Envío, cada INTERVALO_ENVIO_S ---`**, alrededor de la línea 310, hoy hace dos cosas: arma la lectura (`cola.append(...)`, y resetea `pulsos_intervalo` y `nivel_intervalo`) y la envía. Dividilo en dos bloques con su propio temporizador:
  - **Lectura** (`t_lectura`, cada `INTERVALO_LECTURA_S`): calcula `dt` desde la lectura anterior, arma el dict con `caudal_lmin = pulsos_intervalo / dt / FACTOR_K`, lo agrega a la cola con su `ticks_ms` y resetea los acumuladores. Esto es lo mismo que hoy, solo que en su propio bloque.
  - **Envío** (`t_envio`, cada `INTERVALO_ENVIO_S`): todo lo de Wi-Fi, `anunciar()` y `enviar_cola()`, sin cambios. `enviar_cola()` ya manda hasta `MAX_LOTE` lecturas en un solo POST, con `ms_atras` para cada una.
- Después de un envío, que bloquea de 3 a 5 s, la siguiente lectura va a tener un `dt` más largo. Está bien: el caudal se divide por el `dt` real y los pulsos los sigue contando la interrupción. No intentes "rellenar" lecturas faltantes.
- **La respuesta de `registrar_lecturas`** (válvula, límite, `consumo_hoy_l`, etc.) se sigue aplicando igual. La orden de la válvula ahora tarda hasta ~6 s en llegar; actualizá el comentario del encabezado y el `README` del ESP32.
- **`MAX_COLA = 150`** sigue siendo ~5 min sin conexión a una lectura cada 2 s. No lo subas, por la RAM con HTTPS.
- **Lo que no hay que tocar:** la lógica local de fuga y límite, el watchdog (30 s), el botón BOOT y el LED. Siguen corriendo en el bucle de 20 ms y de 1 s como hasta ahora.

### 2. BD: avisar cada lectura del lote, no solo la última

Archivo: `BD.sql`, función `registrar_lecturas`, alrededor de la línea 308.

Hoy hace `SELECT * INTO v_ultima ... ORDER BY id_lectura DESC LIMIT 1` y un único `pg_notify` con esa lectura. Con lotes de 3 lecturas, el dashboard recibiría solo 1 de cada 3 puntos por tiempo real.

Cambiarlo para que haga un `pg_notify('nueva_lectura', ...)` **por cada lectura insertada en esta llamada, en orden ascendente de `fecha_medicion`**, cada una con el mismo formato que hoy (`id_dispositivo`, `lectura` y `estado`). Así el Front no cambia: `onLectura` en `Front/src/services/tiempoReal.ts` ya procesa un aviso por lectura, y `setPuntos` en `DispositivoDashboard.tsx` descarta los puntos posteriores al que llega, por eso el orden ascendente es necesario.

- **Avisos separados, no un arreglo en un solo aviso:** el payload de `pg_notify` tiene un límite de 8000 bytes y un lote puede tener hasta 30 lecturas.
- **Para identificar las filas del lote:** usar `INSERT ... RETURNING` hacia una variable o tabla temporal, o filtrar por `id_lectura` mayor al último existente antes del insert.
- **Para aplicarlo:** correr la función actualizada en el editor SQL de Supabase. `BD.sql` es idempotente (`CREATE OR REPLACE`).

### 3. Back y Front: "en línea" con 30 s

- `Back/src/services/dispositivo.service.ts`, línea 16: `const MS_EN_LINEA = 30_000;`. Actualizá el comentario: el ESP32 envía cada ~6 s y un envío puede fallar.
- `Front/src/components/DispositivoDashboard.tsx`, línea 30: `const MS_EN_LINEA = 30_000;`, con el mismo comentario.

Con 30 s, un envío fallido, o incluso dos, no marca el dispositivo como desconectado.

### 4. Textos que dicen "2 s"

Buscá con `grep -rn "2 s" Back/src Front/src ESP32 docs` y actualizá lo que se refiera al envío. Por ejemplo, en `PanelesComponentes.tsx` hay "El ESP32 la aplica en su próximo envío (unos 2 s)", que debería decir "unos 6 s". Lo que se refiera a la lectura sigue en 2 s.

`SEGUNDOS_POR_LECTURA = 2` en `lectura.service.ts` y en `DispositivoDashboard.tsx` **queda como está**: con el cambio 1 vuelve a haber una lectura cada 2 s.

### 5. Recompilar el Front

```powershell
cd Back
npm run front
```

Commitear también `Back/public`, porque ngrok sirve el Front desde ahí.

## Restricciones

- **No agregar pedidos periódicos del navegador al Back.** Cada pedido pasa por ngrok y el plan gratuito tiene 20 000 por mes. El tiempo real tiene que seguir siendo solo el SSE.
- **El ESP32 tiene que seguir enviando directo a Supabase**, no por ngrok.
- **No cambiar el formato del aviso `nueva_lectura`** ni el del SSE.

## Cómo verificar

1. **Sin hardware:** el simulador (`Back/scripts/simular-esp32.ts`) manda una lectura por envío, así que conviene adaptarlo igual que el ESP32 (leer cada 2 s y enviar la cola cada 6 s) para probar los lotes.

   El simulador tiene un bug: con `SUPABASE_URL=` vacío en `.env` falla diciendo que falta la clave. En la línea 25 hay que cambiar `process.env.SUPABASE_URL ??` por `process.env.SUPABASE_URL ||`. Después:
   ```powershell
   cd Back
   npm run dev
   npm run simular     # en otra terminal; vincular el código en el dashboard
   ```
   - El dashboard muestra "En línea" todo el tiempo, sin parpadear a "Desconectado".
   - En la gráfica entran 3 puntos nuevos cada ~6 s, separados ~2 s entre sí.
2. **En la BD**, con el ESP32 real enviando durante 10 min:
   ```sql
   SELECT count(*) AS lecturas,
          round(avg(d)::numeric, 1) AS seg_promedio,
          count(*) FILTER (WHERE d > 30) AS huecos_mayores_30s
   FROM (
     SELECT extract(epoch FROM fecha_medicion - lag(fecha_medicion) OVER (ORDER BY fecha_medicion)) AS d
     FROM lectura_caudal
     WHERE id_dispositivo = 33 AND fecha_recepcion > now() - interval '10 min'
   ) x;
   ```
   Esperado: `seg_promedio` entre 2 y 3, unas 250 lecturas, y `huecos_mayores_30s` en 0 salvo cortes de Wi-Fi. Se mide por `fecha_medicion` porque las lecturas de un mismo lote comparten `fecha_recepcion`.
3. **Válvula:** cerrar y abrir desde el dashboard. El ESP32 la aplica en menos de ~6 s y el panel deja de decir "Orden enviada…".
4. **Monitor serie del ESP32:** deberían verse muchos menos `ECONNRESET`, porque hay un tercio de las conexiones.
