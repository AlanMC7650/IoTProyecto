# Caudalímetro YF-S201 en ESP32 (MicroPython).
# Cuenta los pulsos del sensor por interrupción, calcula una lectura por segundo
# y las envía en lotes por WiFi al Back (POST /api/lecturas).

from machine import Pin
import machine
import network
import time
import gc

try:
    import urequests as requests
except ImportError:
    import requests

try:
    import ujson as json
except ImportError:
    import json

import config

PIN_SENSOR = config.PIN_SENSOR
FACTOR_K = config.FACTOR_K                    # frecuencia (Hz) = 7.5 * caudal (L/min)
PULSOS_POR_LITRO = config.PULSOS_POR_LITRO
INTERVALO_ENVIO_S = config.INTERVALO_ENVIO_S

URL_LECTURAS = config.SERVIDOR.rstrip("/") + "/api/lecturas"
CABECERAS = {"Content-Type": "application/json", "X-API-Key": config.API_KEY}

MAX_COLA = 600               # lecturas guardadas como máximo mientras no hay conexión (~10 min)
MAX_LOTE = 100               # lecturas por POST
MAX_LOTES_POR_CICLO = 3      # para ponerse al día de a poco después de un corte
TIMEOUT_HTTP_S = 5
REINTENTO_WIFI_MS = 10000
PIN_LED = 2                  # LED integrado: parpadea cuando un envío sale bien

pulsos = 0
total_pulsos = 0
cola = []                    # cada elemento: (ticks_ms, caudal, volumen, pulsos)


def contar_pulso(pin):
    global pulsos
    pulsos += 1


sensor = Pin(PIN_SENSOR, Pin.IN, Pin.PULL_UP)
sensor.irq(trigger=Pin.IRQ_FALLING, handler=contar_pulso)

led = Pin(PIN_LED, Pin.OUT)
led.value(0)

wlan = network.WLAN(network.STA_IF)
wlan.active(True)
ultimo_intento_wifi = None
wifi_avisado = False


def revisar_wifi():
    # No espera a que conecte: solo pide la conexión y sigue, así el ciclo de
    # medición nunca se frena. Si no conectó, se vuelve a pedir cada 10 s.
    global ultimo_intento_wifi, wifi_avisado

    if wlan.isconnected():
        if not wifi_avisado:
            print("WiFi conectado, IP:", wlan.ifconfig()[0])
            wifi_avisado = True
        return True

    wifi_avisado = False
    ahora = time.ticks_ms()
    if (ultimo_intento_wifi is None
            or time.ticks_diff(ahora, ultimo_intento_wifi) >= REINTENTO_WIFI_MS):
        ultimo_intento_wifi = ahora
        print("Conectando a WiFi:", config.WIFI_SSID)
        try:
            wlan.disconnect()
            wlan.connect(config.WIFI_SSID, config.WIFI_PASSWORD)
        except OSError as e:
            print("Error de WiFi:", e)
    return False


def enviar_lote():
    # Envía hasta MAX_LOTE lecturas (las más viejas primero).
    # Devuelve True solo si el servidor respondió 201.
    lote = cola[:MAX_LOTE]
    ahora = time.ticks_ms()
    cuerpo = json.dumps({
        "lecturas": [
            {
                "caudal_lmin": caudal,
                "volumen_l": volumen,
                "pulsos": n,
                # El ESP32 no tiene reloj real: se manda hace cuánto se midió
                "ms_atras": time.ticks_diff(ahora, t),
            }
            for (t, caudal, volumen, n) in lote
        ]
    })

    r = None
    try:
        try:
            r = requests.post(URL_LECTURAS, data=cuerpo, headers=CABECERAS,
                              timeout=TIMEOUT_HTTP_S)
        except TypeError:
            # Versiones viejas de urequests no aceptan timeout
            r = requests.post(URL_LECTURAS, data=cuerpo, headers=CABECERAS)

        if r.status_code == 201:
            # La cola solo se vacía si el servidor confirmó que guardó el lote
            del cola[:len(lote)]
            print("Envio OK:", len(lote), "lecturas, quedan", len(cola), "en cola")
            return True

        print("Envio rechazado, estado", r.status_code, r.text)
        return False
    except Exception as e:
        print("Envio fallido (se reintenta):", e)
        return False
    finally:
        if r is not None:
            r.close()
        cuerpo = None
        gc.collect()


def enviar_pendientes():
    if not cola:
        return
    if not revisar_wifi():
        print("Sin WiFi,", len(cola), "lecturas en cola")
        return

    for _ in range(MAX_LOTES_POR_CICLO):
        if not cola or not enviar_lote():
            return
        led.value(1)
        time.sleep_ms(40)
        led.value(0)


revisar_wifi()
t_anterior = time.ticks_ms()
t_ultimo_envio = t_anterior

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

    cola.append((ahora, round(caudal, 3), round(volumen, 3), n))
    if len(cola) > MAX_COLA:
        # Sin RAM infinita: se descartan las lecturas más viejas
        del cola[:len(cola) - MAX_COLA]

    if time.ticks_diff(ahora, t_ultimo_envio) >= INTERVALO_ENVIO_S * 1000:
        t_ultimo_envio = ahora
        enviar_pendientes()
