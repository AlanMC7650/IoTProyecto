# AquaControl en Wokwi

Simulación del circuito de la fase 2 (ESP32 + MicroPython). Probado en wokwi.com.

## Cómo abrirlo

1. Entrar a https://wokwi.com/projects/new/micropython-esp32
2. Pestaña `diagram.json`: borrar todo y pegar el contenido de [diagram.json](diagram.json).
3. Pestaña `main.py`: borrar todo y pegar [main.py](main.py).
4. Play. Para guardarlo con un link propio hay que iniciar sesión en Wokwi y pulsar **Save**.

## Qué representa cada pieza

| En Wokwi | En el circuito real | Pin |
|---|---|---|
| Potenciómetro deslizante | Caudal que pasa por el YF-S201 (el ESP32 genera los pulsos en GPIO 4, puenteado a GPIO 27) | 35 / 4 → 27 |
| Módulo relé | Módulo relé que alimenta la electroválvula NC 220 VAC | 26 |
| LED azul tras el relé | Electroválvula: encendido = válvula abierta | — |
| LED RGB + 3 resistencias de 220 Ω | LED RGB de cátodo común | 25 (R), 33 (G), 32 (B) |
| Potenciómetro giratorio | Sensor de agua T1592 (detector de fugas en el piso) | señal 34, alimentación 13 |

## Qué probar

- Subir el deslizante: el caudal aumenta y el LED se enciende de a poco, de verde a amarillo y a rojo (más de 8 L/min).
- Girar el potenciómetro (sensor de agua) por encima de la mitad: "ALERTA: agua detectada", la válvula se cierra y el LED parpadea rojo/azul. Al bajarlo y pasar 10 s seco, se vuelve a abrir.
- Dejar correr el agua hasta 20 L: se alcanza el límite diario, la válvula se cierra y el LED queda en rojo "respirando".

En el ESP32 real: `SIMULACION = False` y, si el módulo relé se activa con nivel bajo, `RELE_ACTIVO_EN_ALTO = False`.
