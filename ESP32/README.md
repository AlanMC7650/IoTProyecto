# ESP32 + caudalímetro YF-S201 (MicroPython)

El ESP32 cuenta los pulsos del sensor, calcula una lectura por segundo y las envía cada 5 s por WiFi al Back (`POST /api/lecturas`). Si se queda sin WiFi guarda hasta 600 lecturas (~10 min) y las manda cuando vuelve, con su hora correcta.

## Cableado

| Cable del YF-S201 | ESP32 |
|---|---|
| Rojo (VCC) | 5V (VIN) |
| Negro (GND) | GND |
| Amarillo (señal) | GPIO 27 |

El sensor se alimenta con 5 V y su señal también sale a 5 V, pero los pines del ESP32 trabajan a 3.3 V. Se recomienda un **divisor resistivo** en el cable amarillo: 10 kΩ entre la señal y el GPIO 27, y 20 kΩ entre el GPIO 27 y GND.

## Cómo subirlo con Thonny

1. El ESP32 tiene que tener el firmware de MicroPython (en Thonny: *Herramientas → Opciones → Intérprete → MicroPython (ESP32)*).
2. Copiá `config.example.py` como `config.py` y completá:
   - `WIFI_SSID` y `WIFI_PASSWORD`: tu red (tiene que ser de **2.4 GHz**, el ESP32 no ve redes de 5 GHz).
   - `SERVIDOR`: la URL "En la red" que imprime el Back al arrancar, por ejemplo `http://192.168.1.50:3000`.
   - `API_KEY`: la clave que te muestra la web al registrar el dispositivo.
3. En Thonny abrí `config.py` y `main.py` y guardá cada uno en el ESP32 con *Archivo → Guardar como... → Dispositivo MicroPython*, con esos mismos nombres.
4. Reiniciá el ESP32 (botón EN o Ctrl+D en la consola). Como el archivo se llama `main.py`, arranca solo cada vez que se enciende.

## Qué se ve en la consola

```
Conectando a WiFi: mi_red
Caudal_Lmin: 0.0 Volumen_L: 0.0
WiFi conectado, IP: 192.168.1.73
Caudal_Lmin: 2.13 Volumen_L: 0.036
Envio OK: 5 lecturas, quedan 0 en cola
```

Las líneas `Caudal_Lmin: ... Volumen_L: ...` se pueden graficar con *Ver → Plotter* de Thonny.

## Si algo falla

| Mensaje | Causa probable |
|---|---|
| `Sin WiFi, N lecturas en cola` | SSID o clave incorrectos, o la red es de 5 GHz. |
| `Envio fallido (se reintenta): ...` | El ESP32 no llega a la PC: IP incorrecta en `SERVIDOR`, el Back no está corriendo, o el firewall de Windows bloquea el puerto 3000. |
| `Envio rechazado, estado 401` | `API_KEY` incorrecta (o se regeneró la clave en la web). |
| `Envio rechazado, estado 400` | El Back rechazó los datos; el mensaje dice qué campo. |
| El caudal siempre da 0 | Revisar el cable amarillo y `PIN_SENSOR`. |
