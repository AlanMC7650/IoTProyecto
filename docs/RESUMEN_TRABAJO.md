# Resumen del trabajo realizado · AquaControl, fase 2

Todo lo que se hizo para pasar del caudalímetro a la fase 2: informe, simulación, base de datos y código. El detalle técnico del código (endpoints, tablas, cómo levantarlo) está en [FASE2.md](FASE2.md).

## 1. Informe de la segunda evaluación

Archivo: [Fase2/Informe_AquaControl_2da_Evaluacion_v2.docx](../Fase2/Informe_AquaControl_2da_Evaluacion_v2.docx). Sigue la plantilla de la materia (10 secciones). La versión anterior, sin `_v2`, quedó superada.

- **Contenido:** 22 páginas, figuras en [Fase2/figuras](../Fase2/figuras) (arquitectura, circuito, modelo entidad-relación, secuencia de vinculación y maqueta del dashboard) y tablas de conexiones, endpoints, errores y problemas con sus soluciones.
- **Decisiones de diseño que explica:**
  - **Sensor T1592:** se usa como detector de fugas en el piso, bajo la instalación. Si se moja, el ESP32 cierra la válvula al instante.
  - **El ESP32 envía directo a Supabase y no por ngrok:** el plan gratuito de ngrok permite 20 000 peticiones por mes, y un ESP32 enviando cada 5 s haría unas 518 000 (y cada 2 s, como quedó después, ~1,3 millones).
  - **Dashboard de los actuadores:** la electroválvula y el LED se muestran por su estado en el tiempo. La válvula tiene estado, botones e historial; el LED se muestra como "gemelo digital", con su color y brillo.
  - **Electroválvula normalmente cerrada:** si se corta la luz o el ESP32 falla, el agua queda cortada.
- **Falta completar:** el número de grupo, la fecha de entrega y las capturas reales (marcadas como `[Insertar captura: …]`).

## 2. Modelo de simulación en Wokwi

Archivos en [Fase2/wokwi](../Fase2/wokwi): `diagram.json`, `main.py` y una guía.

- Se cargó y corrió en wokwi.com.
- Wokwi no tiene sensor de flujo ni electroválvula, así que se simulan:
  - **Sensor de flujo:** un deslizador fija el caudal y el ESP32 genera los pulsos.
  - **Electroválvula:** un LED azul conectado a la salida del relé.
- Verificado: el cálculo del caudal, el cambio de color del LED y el cierre de la válvula al detectar agua.
- No se usó Fritzing, porque no se puede generar desde texto.

## 3. Merge de la rama `feature/ngrok`

La rama `caudalimetro` tenía un merge a medias con `feature/ngrok` y el Back no arrancaba. Se resolvió en el commit `e542b37`:

- **Se conservó:** todo lo del caudalímetro.
- **Se descartó:** lo de las series que traía esa rama.
- **Se agregó:** el script `npm run tunnel` (ngrok).
- **Se corrigió:** la carpeta de salida de TypeScript, que pisaba el build del Front.

## 4. Base de datos en Supabase

- Se corrió `BD.sql` en Supabase. No se borró nada: las tablas de series y los 3 usuarios siguen.
- **Arreglo de seguridad:**
  - **Antes:** la tabla `cliente`, con los hashes de las contraseñas, era legible por cualquiera que tuviera la clave pública de Supabase.
  - **Ahora:** RLS está activo en todas las tablas, la clave pública no puede leer ninguna, y solo puede ejecutar las dos funciones que usa el ESP32.
- **Tablas y columnas nuevas:**
  - **Cliente:** rol (usuario o admin) y cuenta activa o suspendida.
  - **Dispositivo:** vinculación por código y control de la válvula.
  - **Lecturas:** campos del sensor de agua, la válvula y el LED.
  - **Evento:** tabla nueva para las alertas.

## 5. Implementación de la fase 2

Todavía sin commitear. Detalle en [FASE2.md](FASE2.md).

| Parte | Qué se hizo |
|---|---|
| Back | Vinculación por código, válvula (abrir, cerrar, automático), límite diario, eventos y confirmación de fugas, desvincular, tiempo real por SSE (una sola petición por pestaña, importante para ngrok) y panel de superadmin con suspensión de cuentas. Se quitó el envío con clave API. |
| Front | Cuatro paneles (flujo, sensor de agua, electroválvula, LED), lista de eventos, pantalla para vincular por código y página `/admin`. La marca pasó a AquaControl. |
| ESP32 | `portal.py` (configurar el Wi-Fi desde el celular) y `main.py` nuevo: se vincula solo, envía a Supabase cada 2 s y controla relé, LED y sensor de agua. Fuga y límite funcionan sin Internet; el botón BOOT borra la configuración. |
| Simulador | `npm run simular` hace lo mismo que el ESP32, para probar sin hardware. |

## 6. Segunda ronda: más velocidad y admin con acceso a todos los dashboards

- **Más velocidad:** los datos ahora se envían cada 2 s en vez de cada 5 s y el estado "en línea" se actualiza cada segundo. Para no llenar Supabase, la BD borra sola las lecturas de más de 30 días.
- **Superadmin:** puede abrir los dashboards de cualquier usuario desde "Ver dashboards" en `/admin`, verlos en tiempo real y exportarlos a CSV. Es solo lectura: no puede mover válvulas ni cambiar configuraciones ajenas.

## 7. Qué se probó y qué no

**Probado:**

- **Funciones de Supabase:** probadas con la clave pública.
- **API completa contra Supabase:** registro, vinculación, válvula, límite, fugas, superadmin, suspensión y desvinculación.
- **Tiempo real:** una lectura llegó al navegador sin recargar.
- **Firmware:** corrido en la PC imitando el ESP32 y llamando a las funciones reales. Mostró el código, se vinculó, cerró la válvula ante la fuga, esperó la confirmación para reabrir y cerró al llegar al límite.
- **Dashboard en el navegador:** con datos en vivo, botones de la válvula y página de admin.
- **Limpieza:** se borraron todos los datos de prueba de Supabase.

**No probado:**

- El ESP32 real con los sensores y la válvula.
- `portal.py` en el ESP32.
- `npm run simular` (necesita la clave pública de Supabase en `Back/.env`).
- El sitio a través de ngrok.

## 8. Pendientes del equipo

1. Revisar los cambios y hacer el commit.
2. Volver a grabar `ESP32/main.py` con Thonny en el ESP32 que ya está funcionando, para que envíe cada 2 s.
3. Borrar la línea `VITE_API_URL` de `Front/.env`. Con esa línea, el dashboard solo funciona si ngrok está corriendo, incluso abierto en `localhost`.
4. Nombrar el primer superadmin en el editor SQL de Supabase:
   ```sql
   UPDATE cliente SET rol = 'admin' WHERE email = 'tu-email@ejemplo.com';
   ```
5. Completar `ESP32/config.py` con la URL y la clave pública de Supabase, y agregar `SUPABASE_ANON_KEY` en `Back/.env` para el simulador.
6. Probar con el hardware real y tomar las capturas para el informe.
7. Completar en el informe el número de grupo y la fecha de entrega.

## 9. Diferencias entre el informe y el código

| Tema | Informe | Código |
|---|---|---|
| Seguridad por usuario en la BD | Rol propio de base de datos con políticas por usuario | RLS bloquea la API pública de Supabase y la API del Back filtra por usuario en cada consulta |
| Ubicación del SQL | Carpeta `supabase/` | `BD.sql` en la raíz |
| Frecuencia de envío | Cada 5 s | Cada 2 s |
| Superadmin | Solo ve la lista de usuarios | También ve y exporta los dashboards de cada usuario (solo lectura) |

Conviene ajustar el informe o el código antes de entregar, para que coincidan.
