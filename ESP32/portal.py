# Portal de configuración Wi-Fi de AquaControl.
# Si el ESP32 no tiene una red guardada (o no logra conectarse), crea su propia
# red "AquaControl-XXXXXX" y sirve un formulario en http://192.168.4.1 para
# elegir la red de la casa y escribir su contraseña desde el celular.
# Guarda los datos en wifi.json y reinicia el ESP32.

import network
import socket
import machine
import time

try:
    import ujson as json
except ImportError:
    import json

ARCHIVO_WIFI = "wifi.json"


def leer_wifi():
    try:
        with open(ARCHIVO_WIFI) as f:
            datos = json.load(f)
        if datos.get("ssid"):
            return datos
    except (OSError, ValueError):
        pass
    return None


def _decodificar(texto):
    # Decodifica application/x-www-form-urlencoded (los + y los %XX)
    texto = texto.replace("+", " ")
    partes = texto.split("%")
    salida = bytearray(partes[0].encode())
    for parte in partes[1:]:
        try:
            salida.append(int(parte[:2], 16))
            salida.extend(parte[2:].encode())
        except ValueError:
            salida.extend(("%" + parte).encode())
    return salida.decode()


def _escapar(texto):
    return (texto.replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


def _pagina(nombre_red, redes, mensaje=""):
    opciones = "".join(
        '<option value="{0}">{0}</option>'.format(_escapar(r)) for r in redes)
    return """<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AquaControl</title><style>
body{{font-family:sans-serif;background:#F4F7F6;margin:0;padding:24px;color:#2B2D42}}
form{{max-width:360px;margin:auto;background:#fff;padding:24px;border-radius:14px;box-shadow:0 6px 20px #0001}}
h1{{font-size:20px;margin:0 0 4px;color:#2A9D8F}}p{{font-size:13px;color:#596275}}
label{{display:block;font-size:12px;font-weight:bold;margin:14px 0 6px}}
select,input{{width:100%;box-sizing:border-box;padding:10px;border:1px solid #D7E0DE;border-radius:8px;font-size:15px}}
button{{width:100%;margin-top:18px;padding:12px;border:0;border-radius:8px;background:#2A9D8F;color:#fff;font-size:15px;font-weight:bold}}
.msg{{color:#C62828}}</style></head><body><form method="post" action="/guardar">
<h1>AquaControl</h1><p>Dispositivo <b>{0}</b>. Elegí la red Wi-Fi de tu casa (2,4 GHz).</p>
<p class="msg">{1}</p>
<label>Red</label><select name="ssid">{2}</select>
<label>O escribila si no aparece</label><input name="ssid_manual" placeholder="Nombre de la red">
<label>Contraseña</label><input name="clave" type="password">
<button type="submit">Guardar y reiniciar</button></form></body></html>""".format(
        _escapar(nombre_red), mensaje, opciones)


def _leer_peticion(cliente):
    datos = b""
    while b"\r\n\r\n" not in datos and len(datos) < 4096:
        parte = cliente.recv(512)
        if not parte:
            break
        datos += parte
    cabecera, _, cuerpo = datos.partition(b"\r\n\r\n")
    lineas = cabecera.decode().split("\r\n")
    largo = 0
    for linea in lineas[1:]:
        if linea.lower().startswith("content-length:"):
            largo = int(linea.split(":")[1])
    while len(cuerpo) < largo:
        parte = cliente.recv(512)
        if not parte:
            break
        cuerpo += parte
    metodo, ruta = (lineas[0].split(" ") + ["", ""])[:2]
    return metodo, ruta, cuerpo.decode()


def _responder(cliente, html):
    cliente.send(b"HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nConnection: close\r\n\r\n")
    cliente.sendall(html.encode())
    cliente.close()


def configurar(nombre_red, al_esperar=None):
    """Bloquea hasta que el usuario guarda una red; después reinicia el ESP32.
    al_esperar se llama seguido (por ejemplo, para hacer parpadear el LED)."""
    sta = network.WLAN(network.STA_IF)
    sta.active(True)
    try:
        redes = sorted(set(r[0].decode() for r in sta.scan() if r[0]))
    except OSError:
        redes = []

    ap = network.WLAN(network.AP_IF)
    ap.active(True)
    ap.config(essid=nombre_red)
    print("Portal Wi-Fi: conectate a la red", nombre_red, "y abrí http://192.168.4.1")

    servidor = socket.socket()
    servidor.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    servidor.bind(("0.0.0.0", 80))
    servidor.listen(2)
    servidor.settimeout(0.3)

    while True:
        if al_esperar:
            al_esperar()
        try:
            cliente, _ = servidor.accept()
        except OSError:
            continue
        try:
            cliente.settimeout(5)
            metodo, ruta, cuerpo = _leer_peticion(cliente)
            if metodo == "POST" and ruta.startswith("/guardar"):
                campos = {}
                for par in cuerpo.split("&"):
                    clave, _, valor = par.partition("=")
                    campos[clave] = _decodificar(valor)
                ssid = campos.get("ssid_manual", "").strip() or campos.get("ssid", "").strip()
                if not ssid:
                    _responder(cliente, _pagina(nombre_red, redes, "Elegí o escribí una red."))
                    continue
                with open(ARCHIVO_WIFI, "w") as f:
                    json.dump({"ssid": ssid, "clave": campos.get("clave", "")}, f)
                _responder(cliente, "<h2 style='font-family:sans-serif'>Listo. El ESP32 se reinicia y se conecta a "
                           + _escapar(ssid) + ". Ya podés volver a tu Wi-Fi.</h2>")
                time.sleep(2)
                machine.reset()
            else:
                _responder(cliente, _pagina(nombre_red, redes))
        except OSError as e:
            print("Portal: error con un cliente:", e)
            try:
                cliente.close()
            except OSError:
                pass
