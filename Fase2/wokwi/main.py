# AquaControl - Fase 2 (modelo de simulación en Wokwi, MicroPython en ESP32)
#
# Hardware real                         En Wokwi se reemplaza por
# - YF-S201 (señal en GPIO 27)          PWM en GPIO 4 puenteado a GPIO 27; el
#                                       potenciómetro deslizante (GPIO 35) fija el caudal
# - Electroválvula NC 220 VAC + relé    Módulo relé en GPIO 26 + LED azul ("válvula abierta")
# - LED RGB cátodo común (25, 33, 32)   Igual
# - Sensor de agua T1592 (S en GPIO 34, Potenciómetro con VCC en GPIO 13 y señal en GPIO 34
#   + alimentado desde GPIO 13)
#
# Lógica:
# - Una lectura por segundo: caudal (L/min), volumen (L), pulsos, nivel del sensor de agua.
# - La válvula se cierra sola si hay fuga (sensor T1592 mojado) o si se supera el límite diario.
# - El LED RGB se enciende de forma gradual según el caudal: verde -> amarillo -> rojo.
#   Fuga: parpadeo rojo/azul. Límite alcanzado: rojo que "respira".

from machine import Pin, PWM, ADC
import machine
import network
import time
import math

SIMULACION = True            # False en el ESP32 real (no genera pulsos falsos)
ENVIAR = False               # True para enviar al Back (en Wokwi el Back local no es alcanzable)

WIFI_SSID = "Wokwi-GUEST"
WIFI_PASSWORD = ""
SERVIDOR = "http://192.168.1.50:3000"
API_KEY = "pegar_aqui_la_clave_del_dispositivo"

# --- Pines ---
PIN_SENSOR_FLUJO = 27
PIN_RELE = 26
PIN_R, PIN_G, PIN_B = 25, 33, 32
PIN_AGUA_SENAL = 34          # ADC1: funciona con WiFi encendido (ADC2 no)
PIN_AGUA_ALIM = 13           # se alimenta solo al medir para evitar la corrosión de las pistas
PIN_SIM_PULSOS = 4           # solo simulación
PIN_SIM_CAUDAL = 35          # solo simulación

# --- Parámetros ---
FACTOR_K = 7.5               # YF-S201: f (Hz) = 7.5 * Q (L/min)
PULSOS_POR_LITRO = 450
LIMITE_DIARIO_L = 20         # en el sistema real lo define el usuario desde el dashboard
CAUDAL_MEDIO = 4.0           # L/min: el LED pasa de verde a amarillo
CAUDAL_ALTO = 8.0            # L/min: rojo ("pasa mucha agua")
CAUDAL_MAX_SIM = 15.0
UMBRAL_FUGA = 1500           # 0-4095: por encima se considera que hay agua en el piso
UMBRAL_SECO = 800            # histéresis para dar la fuga por terminada
SEGUNDOS_SECO_PARA_REABRIR = 10
RELE_ACTIVO_EN_ALTO = True   # muchos módulos reales se activan con LOW: poner False

# --- Sensor de flujo por interrupción ---
pulsos = 0
total_pulsos = 0


def contar_pulso(pin):
    global pulsos
    pulsos += 1


sensor_flujo = Pin(PIN_SENSOR_FLUJO, Pin.IN, Pin.PULL_UP)
sensor_flujo.irq(trigger=Pin.IRQ_FALLING, handler=contar_pulso)

# --- Relé / electroválvula NC: relé activado = válvula abierta ---
rele = Pin(PIN_RELE, Pin.OUT)


def mover_valvula(abrir):
    rele.value(1 if abrir == RELE_ACTIVO_EN_ALTO else 0)


mover_valvula(False)         # arranca cerrada hasta evaluar el estado

# --- LED RGB por PWM ---
led_r = PWM(Pin(PIN_R), freq=1000, duty_u16=0)
led_g = PWM(Pin(PIN_G), freq=1000, duty_u16=0)
led_b = PWM(Pin(PIN_B), freq=1000, duty_u16=0)


def pintar(r, g, b, brillo):
    led_r.duty_u16(int(65535 * r * brillo))
    led_g.duty_u16(int(65535 * g * brillo))
    led_b.duty_u16(int(65535 * b * brillo))


def color_por_caudal(q):
    # Verde (0) -> amarillo (CAUDAL_MEDIO) -> rojo (CAUDAL_ALTO)
    if q <= CAUDAL_MEDIO:
        return q / CAUDAL_MEDIO, 1.0, 0.0
    t = min((q - CAUDAL_MEDIO) / (CAUDAL_ALTO - CAUDAL_MEDIO), 1.0)
    return 1.0, 1.0 - t, 0.0

# --- Sensor de agua T1592 ---
agua_alim = Pin(PIN_AGUA_ALIM, Pin.OUT, value=0)
agua_adc = ADC(Pin(PIN_AGUA_SENAL))
agua_adc.atten(ADC.ATTN_11DB)


def leer_nivel_agua():
    agua_alim.value(1)
    time.sleep_ms(10)
    total = 0
    for _ in range(5):
        total += agua_adc.read()
    agua_alim.value(0)
    return total // 5

# --- Simulación del caudalímetro (solo Wokwi) ---
if SIMULACION:
    pot_caudal = ADC(Pin(PIN_SIM_CAUDAL))
    pot_caudal.atten(ADC.ATTN_11DB)
    gen_pulsos = PWM(Pin(PIN_SIM_PULSOS), freq=10, duty_u16=0)


def simular_caudal():
    # Con la válvula cerrada no pasa agua, aunque el potenciómetro esté arriba
    q = pot_caudal.read() / 4095 * CAUDAL_MAX_SIM if valvula_abierta else 0
    f = q * FACTOR_K
    if f < 1:
        gen_pulsos.duty_u16(0)
    else:
        gen_pulsos.freq(int(f))
        gen_pulsos.duty_u16(32768)

# --- WiFi y envío (opcional) ---
wlan = network.WLAN(network.STA_IF)
wlan.active(True)
if ENVIAR:
    wlan.connect(WIFI_SSID, WIFI_PASSWORD)


def enviar(lectura):
    if not ENVIAR or not wlan.isconnected():
        return
    import urequests
    import ujson
    r = None
    try:
        r = urequests.post(SERVIDOR + "/api/lecturas",
                           data=ujson.dumps({"lecturas": [lectura]}),
                           headers={"Content-Type": "application/json",
                                    "X-API-Key": API_KEY})
        print("Envio:", r.status_code)
    except Exception as e:
        print("Envio fallido (se reintenta):", e)
    finally:
        if r is not None:
            r.close()

# --- Bucle principal: LED cada 20 ms, lectura cada 1 s ---
caudal = 0.0
brillo = 0.0
fuga = False
segundos_seco = 0
limite_alcanzado = False
valvula_abierta = False
t_anterior = time.ticks_ms()
fase = 0

while True:
    time.sleep_ms(20)
    fase += 1
    ahora = time.ticks_ms()

    if time.ticks_diff(ahora, t_anterior) >= 1000:
        dt = time.ticks_diff(ahora, t_anterior) / 1000
        t_anterior = ahora
        if SIMULACION:
            simular_caudal()

        estado = machine.disable_irq()
        n = pulsos
        pulsos = 0
        machine.enable_irq(estado)

        total_pulsos += n
        caudal = (n / dt) / FACTOR_K
        volumen = total_pulsos / PULSOS_POR_LITRO
        nivel = leer_nivel_agua()

        if nivel >= UMBRAL_FUGA:
            if not fuga:
                print("ALERTA: agua detectada en el piso, se cierra la valvula")
            fuga = True
            segundos_seco = 0
        elif fuga and nivel <= UMBRAL_SECO:
            segundos_seco += 1
            if segundos_seco >= SEGUNDOS_SECO_PARA_REABRIR:
                fuga = False
                print("Sensor seco: fin de la alerta de fuga")

        if volumen >= LIMITE_DIARIO_L and not limite_alcanzado:
            limite_alcanzado = True
            print("Limite diario alcanzado:", LIMITE_DIARIO_L, "L")

        abrir = not fuga and not limite_alcanzado
        if abrir != valvula_abierta:
            valvula_abierta = abrir
            mover_valvula(abrir)
            print("Valvula", "ABIERTA" if abrir else "CERRADA")

        print("Caudal_Lmin:", round(caudal, 2), "Volumen_L:", round(volumen, 3),
              "Nivel_agua:", nivel, "Valvula:", int(valvula_abierta))
        enviar({"caudal_lmin": round(caudal, 3), "volumen_l": round(volumen, 3),
                "pulsos": n, "nivel_agua": nivel, "fuga": fuga,
                "valvula_abierta": valvula_abierta, "ms_atras": 0})

    # LED RGB
    if fuga:
        rojo = (fase // 15) % 2 == 0
        pintar(1 if rojo else 0, 0, 0 if rojo else 1, 1.0)
    elif limite_alcanzado:
        pintar(1, 0, 0, 0.15 + 0.85 * (0.5 + 0.5 * math.sin(fase / 12)))
    else:
        # Encendido gradual: el brillo se acerca de a poco al objetivo
        objetivo = 0.0 if caudal < 0.1 else 0.15 + 0.85 * min(caudal / CAUDAL_ALTO, 1.0)
        brillo += (objetivo - brillo) * 0.06
        r, g, b = color_por_caudal(caudal)
        pintar(r, g, b, brillo)
