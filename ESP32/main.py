# AquaControl - ESP32 con MicroPython.
#
# Sensores:   YF-S201 (caudal, GPIO 27) y T1592 (agua en el piso, señal GPIO 34,
#             alimentación GPIO 13).
# Actuadores: relé de la electroválvula NC (GPIO 26) y LED RGB (GPIO 25/33/32).
#
# No hay que escribir ninguna clave por dispositivo:
#   1. Sin Wi-Fi guardado crea la red AquaControl-XXXXXX (portal.py).
#   2. Se anuncia en Supabase con su MAC y muestra su código (LED azul parpadeando).
#   3. El usuario escribe ese código en el dashboard; el ESP32 recibe su token y
#      lo guarda en token.json.
#   4. Cada 5 s envía una lectura a Supabase y aplica la orden de la válvula que
#      viene en la respuesta.
# La fuga y el límite diario se resuelven acá mismo, aunque no haya Internet.
# Mantener presionado el botón BOOT 5 s borra el Wi-Fi y la vinculación.

from machine import Pin, PWM, ADC, WDT
import machine
import network
import time
import math
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
import portal

# --- Pines -------------------------------------------------------------------
PIN_FLUJO = 27
PIN_RELE = 26
PIN_R, PIN_G, PIN_B = 25, 33, 32
PIN_AGUA_SENAL = 34          # ADC1: funciona con el Wi-Fi encendido (ADC2 no)
PIN_AGUA_ALIM = 13           # el T1592 se alimenta solo al medir (menos corrosión)
PIN_BOOT = 0

# --- Parámetros -----------------------------------------------------------------
FACTOR_K = 7.5               # YF-S201: f (Hz) = 7.5 * Q (L/min)
PULSOS_POR_LITRO = 450       # se reemplaza por el valor del dashboard al conectar
UMBRAL_FUGA = 1500           # 0-4095: agua en el piso
UMBRAL_SECO = 800
CAUDAL_MEDIO = 4.0           # L/min: verde -> amarillo
CAUDAL_ALTO = 8.0            # L/min: rojo
INTERVALO_ENVIO_S = 5
MAX_COLA = 120               # ~10 minutos sin conexión
MAX_LOTE = 20
ESPERA_WIFI_SIN_VINCULAR_S = 30   # sin vincular y sin conectar: vuelve al portal
SEGUNDOS_SECO_SIN_SERVIDOR = 30   # sin vincular, la fuga se libera sola al secarse
RELE_ACTIVO_EN_ALTO = getattr(config, "RELE_ACTIVO_EN_ALTO", True)

URL_RPC = config.SUPABASE_URL.rstrip("/") + "/rest/v1/rpc/"
CABECERAS = {"apikey": config.SUPABASE_ANON_KEY, "Content-Type": "application/json"}
ARCHIVO_TOKEN = "token.json"

sta = network.WLAN(network.STA_IF)
sta.active(True)
MAC = ":".join("{:02X}".format(b) for b in sta.config("mac"))
CODIGO = MAC.replace(":", "")[-6:]

# --- LED RGB -------------------------------------------------------------------
led_r = PWM(Pin(PIN_R), freq=1000, duty_u16=0)
led_g = PWM(Pin(PIN_G), freq=1000, duty_u16=0)
led_b = PWM(Pin(PIN_B), freq=1000, duty_u16=0)


def pintar(r, g, b, brillo):
    led_r.duty_u16(int(65535 * r * brillo))
    led_g.duty_u16(int(65535 * g * brillo))
    led_b.duty_u16(int(65535 * b * brillo))


def parpadeo_azul():
    pintar(0, 0, 1, 1.0 if (time.ticks_ms() // 500) % 2 else 0.05)


# --- Archivos ------------------------------------------------------------------
def leer_json(nombre):
    try:
        with open(nombre) as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def guardar_json(nombre, datos):
    with open(nombre, "w") as f:
        json.dump(datos, f)


def borrar(nombre):
    try:
        import os
        os.remove(nombre)
    except OSError:
        pass


# --- Wi-Fi ---------------------------------------------------------------------
wifi = portal.leer_wifi()
if wifi is None:
    portal.configurar("AquaControl-" + CODIGO, parpadeo_azul)   # reinicia al guardar

datos_token = leer_json(ARCHIVO_TOKEN) or {}
token = datos_token.get("token")
# Última orden recibida: así, si arranca sin Internet, respeta lo que había
orden_valvula = datos_token.get("valvula", "abrir")

print("AquaControl", MAC, "· código de vinculación:", CODIGO)
sta.connect(wifi["ssid"], wifi.get("clave", ""))
ultimo_intento_wifi = time.ticks_ms()
inicio = time.ticks_ms()

# --- Sensores y actuadores -----------------------------------------------------
pulsos = 0


def contar_pulso(pin):
    global pulsos
    pulsos += 1


sensor_flujo = Pin(PIN_FLUJO, Pin.IN, Pin.PULL_UP)
sensor_flujo.irq(trigger=Pin.IRQ_FALLING, handler=contar_pulso)

rele = Pin(PIN_RELE, Pin.OUT)
agua_alim = Pin(PIN_AGUA_ALIM, Pin.OUT, value=0)
agua_adc = ADC(Pin(PIN_AGUA_SENAL))
agua_adc.atten(ADC.ATTN_11DB)
boton = Pin(PIN_BOOT, Pin.IN, Pin.PULL_UP)


def mover_valvula(abrir):
    # Electroválvula NC: relé activado = válvula abierta
    rele.value(1 if abrir == RELE_ACTIVO_EN_ALTO else 0)


def leer_nivel_agua():
    agua_alim.value(1)
    time.sleep_ms(10)
    total = 0
    for _ in range(5):
        total += agua_adc.read()
    agua_alim.value(0)
    return total // 5


mover_valvula(False)   # empieza cerrada hasta evaluar el estado

# --- Comunicación con Supabase -------------------------------------------------
def rpc(funcion, cuerpo):
    """Devuelve (codigo_http, datos). Lanza OSError si no hay conexión."""
    gc.collect()   # una conexión HTTPS usa unos 40 KB de RAM
    r = None
    try:
        try:
            r = requests.post(URL_RPC + funcion, data=json.dumps(cuerpo),
                              headers=CABECERAS, timeout=10)
        except TypeError:
            # Versiones viejas de urequests no aceptan timeout
            r = requests.post(URL_RPC + funcion, data=json.dumps(cuerpo), headers=CABECERAS)
        try:
            datos = r.json()
        except ValueError:
            datos = None
        return r.status_code, datos
    finally:
        if r is not None:
            r.close()
        gc.collect()


def anunciar():
    global token
    codigo_http, datos = rpc("anunciar_dispositivo", {"p_mac": MAC})
    if codigo_http != 200 or not datos:
        print("Anuncio rechazado:", codigo_http, datos)
        return
    if datos.get("token"):
        token = datos["token"]
        guardar_json(ARCHIVO_TOKEN, {"token": token, "valvula": orden_valvula})
        print("Vinculado como", datos.get("nombre"), "- empiezo a enviar lecturas")
    elif datos.get("estado") == "pendiente":
        print("Esperando vinculación. Código:", datos.get("codigo"))
    else:
        print("Figura vinculado pero no tengo token: desvincularlo desde el dashboard")


def enviar_cola():
    """Envía lo que haya en la cola. Devuelve la respuesta de Supabase o None."""
    global token
    lote = cola[:MAX_LOTE]
    ahora = time.ticks_ms()
    lecturas = []
    for (t, lectura) in lote:
        item = dict(lectura)
        # El ESP32 no tiene reloj real: se manda hace cuánto se midió
        item["ms_atras"] = time.ticks_diff(ahora, t)
        lecturas.append(item)

    codigo_http, datos = rpc("registrar_lecturas", {"p_token": token, "p_lecturas": lecturas})
    if codigo_http == 200 and datos:
        del cola[:len(lote)]   # solo se borra lo que Supabase confirmó
        return datos

    mensaje = str(datos.get("message", "")) if isinstance(datos, dict) else ""
    print("Envío rechazado:", codigo_http, mensaje)
    if "token" in mensaje:
        # Lo desvincularon desde el dashboard: vuelve a anunciarse
        token = None
        borrar(ARCHIVO_TOKEN)
        del cola[:]
    return None


# --- Estado del programa -------------------------------------------------------
cola = []                   # (ticks_ms, lectura)
total_pulsos = 0
pulsos_intervalo = 0
nivel_intervalo = 0
fuga_local = False          # se activa al detectar agua y se libera al confirmarla
segundos_seco = 0
consumo_servidor = 0.0      # litros de hoy según Supabase
litros_desde_respuesta = 0.0
limite = None
modo = "auto"
fugas_pendientes = 0
motivo = None               # por qué Supabase manda cerrar: fuga, manual o limite
limite_local = False
caudal = 0.0
brillo = 0.0
led_estado = "apagado"
valvula_abierta = False
boton_desde = None

t_segundo = time.ticks_ms()
t_envio = t_segundo
fase = 0
wdt = WDT(timeout=30000)    # reinicia el ESP32 si el programa se cuelga


def esperando_portal():
    wdt.feed()
    parpadeo_azul()


while True:
    wdt.feed()
    time.sleep_ms(20)
    fase += 1
    ahora = time.ticks_ms()

    # Botón BOOT 5 s: borrar Wi-Fi y vinculación
    if boton.value() == 0:
        boton_desde = boton_desde or ahora
        if time.ticks_diff(ahora, boton_desde) > 5000:
            print("Borrando configuración...")
            borrar(portal.ARCHIVO_WIFI)
            borrar(ARCHIVO_TOKEN)
            machine.reset()
    else:
        boton_desde = None

    # --- Medición, una vez por segundo ---
    if time.ticks_diff(ahora, t_segundo) >= 1000:
        dt = time.ticks_diff(ahora, t_segundo) / 1000
        t_segundo = ahora

        estado_irq = machine.disable_irq()
        n = pulsos
        pulsos = 0
        machine.enable_irq(estado_irq)

        total_pulsos += n
        pulsos_intervalo += n
        litros_desde_respuesta += n / PULSOS_POR_LITRO
        caudal = (n / dt) / FACTOR_K
        nivel = leer_nivel_agua()
        nivel_intervalo = max(nivel_intervalo, nivel)

        if nivel >= UMBRAL_FUGA:
            if not fuga_local:
                print("ALERTA: agua en el piso, se cierra la válvula")
            fuga_local = True
            segundos_seco = 0
        elif fuga_local and nivel <= UMBRAL_SECO:
            segundos_seco += 1
            # Vinculado: se libera cuando el usuario confirma la fuga en el dashboard.
            # Sin vincular no hay quién confirme: se libera tras un rato seco.
            if (token and fugas_pendientes == 0) or (not token and segundos_seco >= SEGUNDOS_SECO_SIN_SERVIDOR):
                fuga_local = False
                print("Fuga liberada")

        # Límite diario también sin Internet: lo último que dijo Supabase + lo medido después
        limite_local = (modo == "auto" and limite is not None
                        and consumo_servidor + litros_desde_respuesta >= limite)
        abrir = not fuga_local and not limite_local and orden_valvula == "abrir"
        if abrir != valvula_abierta:
            valvula_abierta = abrir
            mover_valvula(abrir)
            print("Válvula", "ABIERTA" if abrir else "CERRADA")

    # --- Envío, cada 5 s ---
    if time.ticks_diff(ahora, t_envio) >= INTERVALO_ENVIO_S * 1000:
        dt = time.ticks_diff(ahora, t_envio) / 1000
        t_envio = ahora

        if token:
            cola.append((ahora, {
                "caudal_lmin": round(pulsos_intervalo / dt / FACTOR_K, 3),
                "volumen_l": round(total_pulsos / PULSOS_POR_LITRO, 3),
                "pulsos": pulsos_intervalo,
                "nivel_agua": nivel_intervalo,
                "fuga": nivel_intervalo >= UMBRAL_FUGA,
                "valvula_abierta": valvula_abierta,
                "led_estado": led_estado,
                "led_brillo": int(brillo * 100),
            }))
            if len(cola) > MAX_COLA:
                del cola[:len(cola) - MAX_COLA]   # se descartan las más viejas
        pulsos_intervalo = 0
        nivel_intervalo = 0

        if not sta.isconnected():
            if not token and time.ticks_diff(ahora, inicio) > ESPERA_WIFI_SIN_VINCULAR_S * 1000:
                # Nunca se vinculó y no conecta: probablemente la clave del Wi-Fi está mal
                print("No conecta al Wi-Fi: abro el portal de configuración")
                portal.configurar("AquaControl-" + CODIGO, esperando_portal)
            if time.ticks_diff(ahora, ultimo_intento_wifi) > 10000:
                ultimo_intento_wifi = ahora
                print("Sin Wi-Fi, reintentando.", len(cola), "lecturas en cola")
                try:
                    sta.disconnect()
                    sta.connect(wifi["ssid"], wifi.get("clave", ""))
                except OSError as e:
                    print("Error de Wi-Fi:", e)
        else:
            try:
                if not token:
                    anunciar()
                else:
                    for _ in range(3):   # se pone al día de a poco después de un corte
                        if not cola:
                            break
                        respuesta = enviar_cola()
                        if respuesta is None:
                            break
                        consumo_servidor = float(respuesta.get("consumo_hoy_l") or 0)
                        litros_desde_respuesta = 0.0
                        limite = respuesta.get("limite_diario_l")
                        limite = float(limite) if limite is not None else None
                        modo = respuesta.get("modo", "auto")
                        fugas_pendientes = int(respuesta.get("fugas_pendientes") or 0)
                        PULSOS_POR_LITRO = float(respuesta.get("pulsos_por_litro") or PULSOS_POR_LITRO)
                        motivo = respuesta.get("motivo")
                        nueva = respuesta.get("valvula", "abrir")
                        if nueva != orden_valvula:
                            orden_valvula = nueva
                            guardar_json(ARCHIVO_TOKEN, {"token": token, "valvula": orden_valvula})
                            print("Orden del servidor: válvula", nueva, "-", respuesta.get("motivo"))
                    print("Caudal", round(caudal, 2), "L/min · hoy", consumo_servidor, "L · cola", len(cola))
            except Exception as e:
                print("Sin conexión con Supabase, se reintenta:", e)

    # --- LED RGB (cada 20 ms, para que los cambios sean graduales) ---
    if not token:
        led_estado = "vinculando"
        brillo = 1.0
        parpadeo_azul()
    elif fuga_local:
        led_estado = "fuga"
        brillo = 1.0
        rojo = (fase // 15) % 2 == 0
        pintar(1 if rojo else 0, 0, 0 if rojo else 1, 1.0)
    elif limite_local or motivo == "limite":
        led_estado = "limite"
        brillo = 0.15 + 0.85 * (0.5 + 0.5 * math.sin(fase / 12))
        pintar(1, 0, 0, brillo)
    else:
        objetivo = 0.0 if caudal < 0.1 else 0.15 + 0.85 * min(caudal / CAUDAL_ALTO, 1.0)
        brillo += (objetivo - brillo) * 0.06   # se acerca de a poco: encendido gradual
        if caudal < 0.1 and brillo < 0.02:
            led_estado = "apagado"
            pintar(0, 0, 0, 0)
        elif caudal <= CAUDAL_MEDIO:
            led_estado = "verde"
            pintar(caudal / CAUDAL_MEDIO, 1.0, 0.0, brillo)
        else:
            t = min((caudal - CAUDAL_MEDIO) / (CAUDAL_ALTO - CAUDAL_MEDIO), 1.0)
            led_estado = "rojo" if caudal > CAUDAL_ALTO else "amarillo"
            pintar(1.0, 1.0 - t, 0.0, brillo)
