import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../modelos.dart';
import 'api.dart';
import 'cliente_http.dart';

// Canal de tiempo real del Back: GET /api/stream?dispositivo=ID con
// Server-Sent Events. Es una sola conexión abierta por pantalla (importa con
// ngrok, que tiene un límite de peticiones), y cada lectura que el ESP32 manda
// a Supabase llega por acá en el momento. Si se corta, se reconecta sola.
class TiempoReal {
  final int idDispositivo;
  final void Function(MensajeTiempoReal mensaje) alRecibir;
  // Al conectar (y al reconectar) conviene recargar para traer lo que faltó
  final void Function() alConectar;
  final void Function() alDesconectar;

  static const _reintento = Duration(seconds: 5);

  bool _cerrado = false;
  StreamSubscription<String>? _suscripcion;
  Timer? _timer;
  http.Client? _cliente;
  Completer<void>? _terminado;

  TiempoReal({
    required this.idDispositivo,
    required this.alRecibir,
    required this.alConectar,
    required this.alDesconectar,
  }) {
    _conectar();
  }

  Future<void> _conectar() async {
    if (_cerrado) return;
    final api = Api.instancia;
    // Un cliente propio, para poder cortar la conexión al salir de la pantalla
    final cliente = crearClienteHttp();
    _cliente = cliente;
    try {
      final pedido = http.Request('GET', api.url('/stream', {'dispositivo': '$idDispositivo'}))
        ..headers.addAll(api.cabeceras())
        ..headers['Accept'] = 'text/event-stream';
      final respuesta = await cliente.send(pedido);
      if (respuesta.statusCode != 200) throw Exception('HTTP ${respuesta.statusCode}');
      if (_cerrado) return;
      alConectar();

      var pendiente = '';
      final terminado = Completer<void>();
      _terminado = terminado;
      _suscripcion = respuesta.stream.transform(utf8.decoder).listen(
        (trozo) {
          pendiente += trozo.replaceAll('\r\n', '\n');
          // Cada mensaje SSE termina con una línea en blanco
          var fin = pendiente.indexOf('\n\n');
          while (fin >= 0) {
            _procesar(pendiente.substring(0, fin));
            pendiente = pendiente.substring(fin + 2);
            fin = pendiente.indexOf('\n\n');
          }
        },
        onError: (_) => terminado.isCompleted ? null : terminado.complete(),
        onDone: () => terminado.isCompleted ? null : terminado.complete(),
        cancelOnError: true,
      );
      await terminado.future;
    } catch (_) {
      // Sin conexión o servidor caído: se reintenta abajo
    }
    cliente.close();
    if (_cerrado) return;
    alDesconectar();
    _timer = Timer(_reintento, _conectar);
  }

  void _procesar(String bloque) {
    var evento = 'message';
    final datos = <String>[];
    for (final linea in bloque.split('\n')) {
      if (linea.startsWith('event:')) evento = linea.substring(6).trim();
      if (linea.startsWith('data:')) datos.add(linea.substring(5).trim());
    }
    if (evento != 'lectura' || datos.isEmpty) return;
    try {
      alRecibir(MensajeTiempoReal.desdeJson(jsonDecode(datos.join('\n')) as Map<String, dynamic>));
    } catch (_) {
      // Mensaje con un formato inesperado: se ignora
    }
  }

  void cerrar() {
    _cerrado = true;
    _timer?.cancel();
    _suscripcion?.cancel();
    _cliente?.close();
    if (_terminado?.isCompleted == false) _terminado!.complete();
  }
}
