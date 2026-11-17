# Cliente HTTP/1.1 mínimo con la conexión TLS siempre abierta (keep-alive).
#
# urequests abre una conexión HTTPS nueva en cada envío: DNS + TCP + saludo TLS
# le llevan de 3 a 5 s al ESP32. Acá el socket TLS se abre una vez y se reusa
# para cada POST, así un envío tarda lo que tarda la ida y vuelta a Supabase.
#
# - Lee respuestas con Content-Length, con Transfer-Encoding: chunked y hasta
#   que el servidor cierra.
# - Si el servidor cerró la conexión (por inactividad o por "Connection: close")
#   la reabre sola. Si el envío falló sin llegar a recibir nada por una conexión
#   reusada, reintenta una vez por una conexión nueva; si no, lanza OSError y el
#   que llama deja la lectura en la cola.
# - Funciona igual en MicroPython (ESP32) y en CPython (banco de pruebas en la PC).

import socket
import sys
import gc

try:
    import ssl
except ImportError:
    import ussl as ssl

try:
    import ujson as json
except ImportError:
    import json

CPYTHON = sys.implementation.name == "cpython"


class ConexionCerrada(OSError):
    """El servidor cerró la conexión antes de responder."""


class ClienteHTTP:
    def __init__(self, url_base, cabeceras=None, timeout=10):
        # url_base: "https://xxxx.supabase.co"
        if not url_base.startswith("https://"):
            raise ValueError("solo https")
        resto = url_base[8:].split("/", 1)
        self.host = resto[0]
        self.puerto = 443
        if ":" in self.host:
            self.host, p = self.host.split(":")
            self.puerto = int(p)
        self.prefijo = ("/" + resto[1]).rstrip("/") if len(resto) > 1 else ""
        self.cabeceras = cabeceras or {}
        self.timeout = timeout
        self._sock = None      # el socket TLS
        self._lee = None       # de donde se lee (en CPython, un archivo con buffer)
        self.conexiones = 0    # cuántas veces se abrió (para el banco de pruebas)
        self.envios = 0        # cuántos POST salieron por la conexión actual

    # --- Conexión --------------------------------------------------------------
    def abierta(self):
        return self._sock is not None

    def conectar(self):
        self.cerrar()
        gc.collect()           # el saludo TLS necesita unos 40 KB de RAM juntos
        direccion = socket.getaddrinfo(self.host, self.puerto, socket.AF_INET, socket.SOCK_STREAM)[0][-1]
        s = socket.socket()
        try:
            s.settimeout(self.timeout)
            s.connect(direccion)
            s = self._envolver_tls(s)
        except BaseException:
            s.close()
            raise
        self._sock = s
        self._lee = s.makefile("rb") if CPYTHON else s
        self.conexiones += 1
        self.envios = 0

    def _envolver_tls(self, s):
        # server_hostname es necesario: Supabase (Cloudflare) elige el certificado
        # por SNI y sin él corta el saludo.
        if CPYTHON:
            return ssl.create_default_context().wrap_socket(s, server_hostname=self.host)
        try:
            import tls   # MicroPython 1.23 en adelante
            ctx = tls.SSLContext(tls.PROTOCOL_TLS_CLIENT)
            ctx.verify_mode = tls.CERT_NONE   # igual que urequests: el ESP32 no trae CAs
            return ctx.wrap_socket(s, server_hostname=self.host)
        except ImportError:
            return ssl.wrap_socket(s, server_hostname=self.host)

    def cerrar(self):
        if self._sock is None and self._lee is None:
            return
        for objeto in (self._lee, self._sock):
            if objeto is not None:
                try:
                    objeto.close()
                except Exception:
                    pass
        self._sock = None
        self._lee = None
        gc.collect()

    # --- Envío -------------------------------------------------------------------
    def post_json(self, ruta, cuerpo):
        """POST con cuerpo JSON. Devuelve (codigo_http, datos). Lanza OSError si
        no hay conexión o el servidor no respondió."""
        datos = json.dumps(cuerpo)
        if not isinstance(datos, bytes):
            datos = datos.encode()
        reusada = self.abierta()
        if not reusada:
            self.conectar()
        try:
            return self._pedir(ruta, datos)
        except Exception as e:
            # Una conexión reusada que el servidor ya había cerrado falla al
            # escribir o devuelve fin de datos sin responder: el pedido no llegó a
            # procesarse y se puede repetir. Un timeout no se repite (puede que sí
            # se haya procesado): la lectura queda en la cola para el próximo envío.
            self.cerrar()
            if not reusada or not isinstance(e, ConexionCerrada):
                raise
        self.conectar()
        try:
            return self._pedir(ruta, datos)
        except Exception:
            self.cerrar()
            raise

    def _pedir(self, ruta, datos):
        partes = ["POST ", self.prefijo, ruta, " HTTP/1.1\r\nHost: ", self.host,
                  "\r\nConnection: keep-alive\r\nContent-Length: ", str(len(datos)), "\r\n"]
        for clave in self.cabeceras:
            partes.append(clave + ": " + self.cabeceras[clave] + "\r\n")
        partes.append("\r\n")
        try:
            self._escribir("".join(partes).encode() + datos)
        except OSError as e:
            raise ConexionCerrada("no se pudo escribir: " + str(e))
        self.envios += 1
        partes = None
        datos = None

        codigo, cerrar, largo, chunked = self._leer_cabecera()
        if chunked:
            cuerpo = self._leer_chunked()
        elif largo is not None:
            cuerpo = self._leer_exacto(largo)
        else:
            cuerpo = self._leer_hasta_cierre()
            cerrar = True
        if cerrar:
            self.cerrar()
        try:
            resultado = json.loads(cuerpo) if cuerpo else None
        except ValueError:
            resultado = None
        cuerpo = None
        gc.collect()
        return codigo, resultado

    def _escribir(self, b):
        if CPYTHON:
            self._sock.sendall(b)
            return
        vista = memoryview(b)
        while vista:
            n = self._sock.write(vista)
            if n is None:          # sin lugar todavía en el buffer: se reintenta
                continue
            if n <= 0:
                raise OSError("escritura cortada")
            vista = vista[n:]

    # --- Lectura de la respuesta -------------------------------------------------
    def _linea(self, primera=False):
        try:
            linea = self._lee.readline()
        except OSError as e:
            # Cualquier error que no sea timeout al esperar la primera línea
            # (ECONNRESET, ECONNABORTED, error de mbedtls...) = el servidor ya
            # había cerrado la conexión y no llegó a ver el pedido
            if primera and not _es_timeout(e):
                raise ConexionCerrada("conexión reiniciada: " + str(e))
            raise
        if not linea:
            if primera:
                raise ConexionCerrada("el servidor cerró la conexión")
            raise OSError("respuesta cortada")
        return linea

    def _leer_cabecera(self):
        estado = self._linea(primera=True)
        partes = estado.split(None, 2)
        if len(partes) < 2 or not partes[0].startswith(b"HTTP/"):
            raise OSError("línea de estado inválida: " + repr(estado[:40]))
        codigo = int(partes[1])
        cerrar = partes[0] == b"HTTP/1.0"
        largo = None
        chunked = False
        while True:
            linea = self._linea()
            if linea in (b"\r\n", b"\n"):
                break
            dos = linea.split(b":", 1)
            if len(dos) != 2:
                continue
            clave = dos[0].strip().lower()
            valor = dos[1].strip().lower()
            if clave == b"content-length":
                largo = int(valor)
            elif clave == b"transfer-encoding":
                chunked = b"chunked" in valor
            elif clave == b"connection":
                if valor == b"close":
                    cerrar = True
                elif valor == b"keep-alive":
                    cerrar = False
        if codigo == 100:          # "100 Continue": viene otra cabecera atrás
            return self._leer_cabecera()
        if codigo == 204 or codigo == 304:
            largo = 0
        return codigo, cerrar, largo, chunked

    def _leer_exacto(self, n):
        if n == 0:
            return b""
        b = self._lee.read(n)
        if b is None or len(b) < n:
            raise OSError("respuesta cortada")
        return b

    def _leer_chunked(self):
        trozos = []
        while True:
            linea = self._linea()
            n = int(linea.split(b";", 1)[0].strip(), 16)
            if n == 0:
                # Cabeceras finales (casi nunca hay) hasta la línea vacía
                while self._linea() not in (b"\r\n", b"\n"):
                    pass
                break
            trozos.append(self._leer_exacto(n))
            self._leer_exacto(2)   # \r\n después de cada trozo
        return b"".join(trozos)

    def _leer_hasta_cierre(self):
        trozos = []
        while True:
            b = self._lee.read(512)
            if not b:
                break
            trozos.append(b)
        return b"".join(trozos)


def _es_timeout(e):
    if CPYTHON and isinstance(e, socket.timeout):
        return True
    codigo = e.args[0] if e.args and isinstance(e.args[0], int) else None
    # MicroPython: 116 ETIMEDOUT, 110 en algunos puertos, 11 EAGAIN
    return codigo in (11, 110, 116) or "timed out" in str(e)
