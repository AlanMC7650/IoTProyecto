# ESP32 de AquaControl (MicroPython)

El ESP32 mide el caudal (YF-S201) y el agua en el piso (T1592), maneja la electroválvula con un relé y el LED RGB, cada 5 s envía una lectura **directo a Supabase**. No pasa por ngrok: el plan gratuito de ngrok permite 20 000 peticiones por mes y un ESP32 enviando cada 5 s haría ~518 000.

No hay que escribir el Wi-Fi ni ninguna clave por dispositivo: el Wi-Fi se configura desde el celular y el dispositivo se vincula con un código de 6 caracteres.

## Cableado

| Componente | Pin del componente | ESP32 |
|---|---|---|
| YF-S201 | Rojo / Negro / Amarillo | 5V (VIN) / GND / GPIO 27 (con divisor 10 kΩ – 20 kΩ: la señal es de 5 V) |
| Sensor de agua T1592 | S / + / − | GPIO 34 / GPIO 13 / GND |
| Módulo relé | VCC / GND / IN | 5V / GND / GPIO 26 (se activa con 0 V; para apagarlo el ESP32 deja el pin suelto) |
| Electroválvula NC 220 VAC | bobina | contacto COM–NO del relé (fase) y neutro |
| LED RGB cátodo común | R / G / B / COM | GPIO 25 / 33 / 32 (220 Ω cada uno) / GND |

El T1592 va en el piso, en el punto más bajo bajo la instalación, con las pistas hacia arriba. La parte de 220 VAC va en una caja aislada.

## Subirlo con Thonny (una sola vez por ESP32)

1. El ESP32 tiene que tener el firmware de MicroPython (Thonny: *Herramientas → Opciones → Intérprete → MicroPython (ESP32)*).
2. Copiá `config.example.py` como `config.py` y completá `SUPABASE_URL` y `SUPABASE_ANON_KEY` (Supabase → Project Settings → API Keys). Es el mismo archivo para todos los dispositivos.
3. Guardá en el ESP32 (*Archivo → Guardar como... → Dispositivo MicroPython*) los tres archivos: `config.py`, `portal.py` y `main.py`.
4. Reiniciá el ESP32 (botón EN).

## Configurar y vincular

1. **Wi-Fi:** la primera vez el ESP32 crea la red `AquaControl-XXXXXX` y el LED parpadea en azul. Conectate con el celular, abrí `http://192.168.4.1`, elegí tu red (2,4 GHz) y escribí la contraseña. El ESP32 se reinicia.
2. **Vincular:** con el LED azul parpadeando, entrá al dashboard → **Agregar dispositivo** y escribí el código (las 6 letras y números de `AquaControl-XXXXXX`; también aparece en la consola de Thonny) y un nombre.
3. En unos segundos el ESP32 recibe su token, lo guarda en `token.json` y empieza a enviar lecturas.

Para empezar de cero (otra red Wi-Fi u otro dueño): mantener el botón **BOOT** 5 segundos.

## Cómo funciona

| Situación | Qué hace el ESP32 |
|---|---|
| Agua en el piso (T1592 > 1500 de 4095) | Cierra la válvula al instante, aunque no haya Internet. Se reabre cuando el usuario confirma la fuga en el dashboard y el piso está seco. |
| Límite diario alcanzado (modo automático) | Cierra la válvula. Lleva la cuenta también sin Internet. Se reabre al día siguiente o si el usuario sube el límite. |
| El usuario abre o cierra la válvula en el dashboard | La orden llega en la respuesta del próximo envío (hasta ~5 s). |
| Sin Wi-Fi | Sigue midiendo y controlando la válvula; guarda hasta 120 lecturas (~10 min) y las envía al volver, con su hora real. |
| Lo desvinculan desde el dashboard | Borra su token y vuelve a mostrar el código. |
| El programa se cuelga | El watchdog lo reinicia a los 30 s. La válvula NC queda cerrada mientras tanto. |

## Qué se ve en la consola

```
AquaControl 24:6F:28:3F:2A:1B · código de vinculación: 3F2A1B
Esperando vinculación. Código: 3F2A1B
Vinculado como Cocina - empiezo a enviar lecturas
Válvula ABIERTA
Caudal 6.42 L/min · hoy 145.3 L · cola 0
```

## Si algo falla

| Mensaje | Causa probable |
|---|---|
| Vuelve a abrir el portal después de 30 s | La contraseña del Wi-Fi está mal o la red es de 5 GHz. |
| `Sin conexión con Supabase` | El Wi-Fi no tiene Internet, o `SUPABASE_URL` está mal escrita. |
| `Anuncio rechazado: 401` | `SUPABASE_ANON_KEY` está mal copiada. |
| `Figura vinculado pero no tengo token` | Se borró `token.json` (por ejemplo, al regrabar el ESP32): desvincularlo en el dashboard y volver a vincularlo. |
| El caudal siempre da 0 | Revisar el cable amarillo, el divisor y GPIO 27. |
| El relé no se apaga al tocar "Cerrar" (queda con las dos luces prendidas) | El módulo se activa con 0 V y los 3,3 V del ESP32 no alcanzan para apagarlo. Con `RELE_ACTIVO_EN_ALTO = False` (el valor por defecto) el ESP32 deja el pin suelto para apagarlo. Revisá que el `config.py` de la placa no diga `True`. |
| El relé hace lo contrario | Es un módulo que se activa con señal alta: poner `RELE_ACTIVO_EN_ALTO = True` en `config.py`. |
