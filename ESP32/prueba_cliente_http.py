# Banco de pruebas de cliente_http.py en la PC (CPython), contra el Supabase real.
#
#   python ESP32/prueba_cliente_http.py
#
# Toma SUPABASE_ANON_KEY (y SUPABASE_URL, o el id del proyecto de DB_USER) de
# Back/.env, igual que Back/scripts/simular-esp32.ts. No escribe lecturas: usa
# registrar_lecturas con un token inválido (Supabase responde el error sin tocar
# la base) y anunciar_dispositivo con la MAC del simulador (02:00:00:00:00:01).
#
# Prueba:
#   1. Varios POST seguidos por la misma conexión y cuánto tarda cada uno.
#   2. Respuestas con Content-Length y con Transfer-Encoding: chunked (esta última
#      con un servidor local, porque Supabase hoy responde con Content-Length).
#   3. Reconexión: socket cortado del lado nuestro, servidor que cierra entre
#      pedidos y "Connection: close".
#   4. Que un timeout no se repite (para no duplicar lecturas).

import os
import socket
import ssl
import sys
import threading
import time

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import cliente_http  # noqa: E402
from cliente_http import ClienteHTTP  # noqa: E402

fallas = 0


def comprobar(condicion, mensaje):
    global fallas
    print(("  OK   " if condicion else "  FALLA ") + mensaje)
    if not condicion:
        fallas += 1


def leer_env():
    datos = {}
    with open(os.path.join(AQUI, "..", "Back", ".env"), encoding="utf-8") as f:
        for linea in f:
            linea = linea.strip()
            if linea and not linea.startswith("#") and "=" in linea:
                k, v = linea.split("=", 1)
                datos[k.strip()] = v.strip().strip('"').strip("'")
    return datos


def cliente_supabase():
    env = leer_env()
    env.update({k: v for k, v in os.environ.items() if k.startswith("SUPABASE_")})
    url = env.get("SUPABASE_URL")
    if not url:
        url = "https://" + env["DB_USER"].split(".")[1] + ".supabase.co"
    cab = {"apikey": env["SUPABASE_ANON_KEY"], "Content-Type": "application/json"}
    return ClienteHTTP(url.rstrip("/") + "/rest/v1/rpc", cab, timeout=10)


LECTURA = {"caudal_lmin": 0, "volumen_l": 0, "pulsos": 0, "nivel_agua": 0, "fuga": False,
           "valvula_abierta": False, "led_estado": "apagado", "led_brillo": 0, "ms_atras": 0}


def registrar(c):
    return c.post_json("/registrar_lecturas", {"p_token": "token-invalido-banco-de-pruebas",
                                               "p_lecturas": [LECTURA]})


def prueba_remota(c, registrar, supabase):
    lugar = "Supabase real" if supabase else c.host
    print("\n1. %s: varios envíos por la misma conexión" % lugar)
    print("  host:", c.host)
    tiempos = []
    for i in range(8):
        t = time.perf_counter()
        codigo, datos = registrar(c)
        tiempos.append(time.perf_counter() - t)
        msg = datos.get("message") if isinstance(datos, dict) else datos
        print("  envío %d: HTTP %s en %.0f ms, conexiones abiertas %d, %s"
              % (i + 1, codigo, tiempos[-1] * 1000, c.conexiones, str(msg)[:60]))
    comprobar(c.conexiones == 1, "8 envíos con una sola conexión")
    if supabase:
        comprobar(isinstance(codigo, int) and codigo >= 400 and "token" in str(msg),
                  "token inválido rechazado con un mensaje que menciona 'token'")
    else:
        comprobar(codigo in (200, 429), "respuestas HTTP válidas (429 = límite de httpbin)")
    comprobar(max(tiempos[1:]) < tiempos[0], "los envíos reusados tardan menos que el primero")
    print("  primero (con saludo TLS): %.0f ms · siguientes: %.0f ms promedio"
          % (tiempos[0] * 1000, sum(tiempos[1:]) / len(tiempos[1:]) * 1000))

    if supabase:
        codigo, datos = c.post_json("/anunciar_dispositivo", {"p_mac": "02:00:00:00:00:01"})
        print("  anunciar_dispositivo: HTTP", codigo, "claves:", sorted(datos) if isinstance(datos, dict) else datos)
        comprobar(codigo == 200 and isinstance(datos, dict), "anunciar_dispositivo por la misma conexión")
        comprobar(c.conexiones == 1, "sigue la misma conexión")

    print("\n2. %s: reconexión si el socket se corta" % lugar)
    c._sock.shutdown(socket.SHUT_RDWR)   # como si el Wi-Fi o el servidor lo hubieran cortado
    codigo, datos = registrar(c)
    comprobar(codigo is not None and c.conexiones == 2, "se reabrió sola y respondió (HTTP %s)" % codigo)
    codigo, datos = registrar(c)
    comprobar(c.conexiones == 2, "el siguiente envío vuelve a reusar la nueva conexión")

    c._lee.close()                       # socket muerto del lado nuestro (falla al escribir);
    c._sock.close()                      # en CPython el makefile también lo tiene abierto
    codigo, datos = registrar(c)
    comprobar(codigo is not None and c.conexiones == 3, "socket cerrado: se reabrió (HTTP %s)" % codigo)

    print("\n3. %s: cuánto aguanta la conexión sin usarse" % lugar)
    for espera in (10, 30, 65):
        antes = c.conexiones
        time.sleep(espera)
        t = time.perf_counter()
        codigo, _ = registrar(c)
        print("  tras %d s quieta: HTTP %s en %.0f ms, %s"
              % (espera, codigo, (time.perf_counter() - t) * 1000,
                 "misma conexión" if c.conexiones == antes else "la reabrió"))
        comprobar(codigo is not None, "respondió tras %d s sin uso" % espera)
    c.cerrar()


# --- Servidor HTTPS local para los casos que Supabase no muestra ----------------
def servidor_local(manejar):
    """Servidor TLS en 127.0.0.1 con un certificado de prueba. manejar(conn, n)
    atiende la conexión n (0, 1, ...)."""
    import datetime
    import tempfile
    # Certificado autofirmado para "localhost" (pip install cryptography)
    from cryptography import x509
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.x509.oid import NameOID
    k = ec.generate_private_key(ec.SECP256R1())
    nombre = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "localhost")])
    ahora = datetime.datetime.now(datetime.timezone.utc)
    c = (x509.CertificateBuilder().subject_name(nombre).issuer_name(nombre)
         .public_key(k.public_key()).serial_number(x509.random_serial_number())
         .not_valid_before(ahora - datetime.timedelta(minutes=5))
         .not_valid_after(ahora + datetime.timedelta(days=1))
         .add_extension(x509.SubjectAlternativeName([x509.DNSName("localhost")]), critical=False)
         .add_extension(x509.BasicConstraints(ca=True, path_length=None), critical=True)
         .sign(k, hashes.SHA256()))
    carpeta = tempfile.mkdtemp()
    cert, clave = os.path.join(carpeta, "c.pem"), os.path.join(carpeta, "k.pem")
    with open(cert, "wb") as f:
        f.write(c.public_bytes(serialization.Encoding.PEM))
    with open(clave, "wb") as f:
        f.write(k.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                                serialization.NoEncryption()))
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(cert, clave)
    escucha = socket.socket()
    escucha.bind(("127.0.0.1", 0))
    escucha.listen(5)

    def bucle():
        n = 0
        while True:
            try:
                conn, _ = escucha.accept()
            except OSError:
                return
            try:
                conn = ctx.wrap_socket(conn, server_side=True)
                threading.Thread(target=manejar, args=(conn, n), daemon=True).start()
            except ssl.SSLError:
                pass
            n += 1
    threading.Thread(target=bucle, daemon=True).start()
    return escucha, cert


def leer_pedido(f):
    linea = f.readline()
    if not linea:
        return None
    largo = 0
    while True:
        h = f.readline()
        if h in (b"\r\n", b""):
            break
        if h.lower().startswith(b"content-length:"):
            largo = int(h.split(b":")[1])
    return linea, f.read(largo)


def prueba_local():
    print("\n4. Servidor local: chunked, Connection: close, cierre entre pedidos y timeout")
    pedidos = []

    def manejar(conn, n):
        f = conn.makefile("rb")
        while True:
            p = leer_pedido(f)
            if p is None:
                conn.close()
                return
            pedidos.append((n, p[0]))
            ruta = p[0].split()[1]
            if ruta.endswith(b"/chunked"):
                cuerpo = [b'{"valvula":', b' "abrir", "consumo_hoy_l"', b': 12.5}']
                r = b"HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\nContent-Type: application/json\r\n\r\n"
                for t in cuerpo:
                    r += b"%x;ext=1\r\n" % len(t) + t + b"\r\n"
                conn.sendall(r + b"0\r\nX-Final: 1\r\n\r\n")
            elif ruta.endswith(b"/cerrar"):
                conn.sendall(b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}")
                conn.close()
                return
            elif ruta.endswith(b"/colgar"):
                time.sleep(3)   # no responde a tiempo
                conn.close()
                return
            elif ruta.endswith(b"/cortar_despues"):
                # responde y cierra sin avisar (como un servidor que cierra por inactividad)
                conn.sendall(b"HTTP/1.1 200 OK\r\nContent-Length: 11\r\n\r\n{\"ok\":true}")
                time.sleep(0.2)
                conn.close()
                return
            else:
                conn.sendall(b"HTTP/1.1 200 OK\r\nContent-Length: 11\r\n\r\n{\"ok\":true}")

    escucha, cert = servidor_local(manejar)
    puerto = escucha.getsockname()[1]

    # El cliente usa create_default_context(): se le hace confiar en el certificado de prueba
    original = ssl.create_default_context
    ssl.create_default_context = lambda: original(cafile=cert)
    try:
        c = ClienteHTTP("https://localhost:%d/base" % puerto, {"Content-Type": "application/json"}, timeout=1)
        codigo, datos = c.post_json("/chunked", {"a": 1})
        comprobar(codigo == 200 and datos == {"valvula": "abrir", "consumo_hoy_l": 12.5},
                  "respuesta chunked (con extensiones y cabeceras finales): %s" % datos)
        codigo, datos = c.post_json("/normal", {})
        comprobar(datos == {"ok": True} and c.conexiones == 1, "después de un chunked se reusa la conexión")
        comprobar(pedidos[-1][1].startswith(b"POST /base/normal "), "la ruta lleva el prefijo de la URL")

        codigo, datos = c.post_json("/cerrar", {})
        comprobar(datos == {} and not c.abierta(), "con 'Connection: close' cierra el socket")
        c.post_json("/normal", {})
        comprobar(c.conexiones == 2, "y el siguiente envío abre una conexión nueva")

        c.post_json("/cortar_despues", {})
        time.sleep(0.5)                  # el servidor ya cerró, el cliente no se enteró
        comprobar(c.abierta(), "el cliente cree que la conexión sigue abierta")
        codigo, datos = c.post_json("/normal", {})
        comprobar(datos == {"ok": True} and c.conexiones == 3,
                  "servidor que cerró entre pedidos: reintenta solo por una conexión nueva")

        antes = len(pedidos)
        try:
            c.post_json("/colgar", {})
            comprobar(False, "timeout debería lanzar OSError")
        except OSError as e:
            comprobar(True, "timeout lanza OSError (%s)" % type(e).__name__)
        time.sleep(0.2)
        comprobar(len(pedidos) == antes + 1, "un timeout no se repite (no duplica la lectura)")
        comprobar(not c.abierta(), "tras el timeout el socket queda cerrado")
        codigo, datos = c.post_json("/normal", {})
        comprobar(datos == {"ok": True}, "y el siguiente envío reconecta")

        escucha.close()
        c.cerrar()
        try:
            c.post_json("/normal", {})
            comprobar(False, "sin servidor debería lanzar OSError")
        except OSError as e:
            comprobar(True, "sin servidor lanza OSError (%s) y el que llama deja la cola" % type(e).__name__)
    finally:
        ssl.create_default_context = original


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    print("cliente_http en", sys.implementation.name, "· CPYTHON =", cliente_http.CPYTHON)
    if "--url" in sys.argv:
        # Cualquier servidor HTTPS que acepte POST y responda JSON, p. ej.
        #   python ESP32/prueba_cliente_http.py --url https://httpbin.org
        url = sys.argv[sys.argv.index("--url") + 1]
        c = ClienteHTTP(url, {"Content-Type": "application/json"}, timeout=10)
        prueba_remota(c, lambda c: c.post_json("/post", {"p_lecturas": [LECTURA]}), False)
    elif "--sin-supabase" not in sys.argv:
        prueba_remota(cliente_supabase(), registrar, True)
    prueba_local()
    print("\n%s" % ("TODO OK" if fallas == 0 else "%d FALLAS" % fallas))
    sys.exit(1 if fallas else 0)
