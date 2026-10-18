import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../modelos.dart';
import 'cliente_http.dart';
import 'sesion.dart';

class ApiException implements Exception {
  final String mensaje;
  final int? estado;
  ApiException(this.mensaje, [this.estado]);

  @override
  String toString() => mensaje;
}

// Cliente de la API REST del Back (/api). Es la misma que usa el dashboard web.
class Api {
  Api._();
  static final Api instancia = Api._();

  final http.Client _http = crearClienteHttp();
  final Sesion _sesion = Sesion.instancia;
  static const _espera = Duration(seconds: 20);

  Map<String, String> cabeceras({bool json = false}) => {
        if (json) 'Content-Type': 'application/json',
        if (_sesion.token != null) 'Authorization': 'Bearer ${_sesion.token}',
        // Evita la página de aviso del plan gratuito de ngrok
        'ngrok-skip-browser-warning': '1',
      };

  Uri url(String ruta, [Map<String, String>? query]) =>
      Uri.parse('${_sesion.servidor}/api$ruta').replace(queryParameters: query);

  Future<dynamic> _pedir(String metodo, String ruta,
      {Object? cuerpo, Map<String, String>? query, bool cerrarSiVence = true}) async {
    final pedido = http.Request(metodo, url(ruta, query))
      ..headers.addAll(cabeceras(json: cuerpo != null));
    if (cuerpo != null) pedido.body = jsonEncode(cuerpo);

    http.Response respuesta;
    try {
      respuesta = await http.Response.fromStream(await _http.send(pedido).timeout(_espera));
    } on TimeoutException {
      throw ApiException('El servidor no respondió. Revisá que el Back y ngrok estén encendidos.');
    } catch (_) {
      throw ApiException('No se pudo conectar con ${_sesion.servidor}. Revisá la dirección del servidor y tu conexión.');
    }

    final texto = utf8.decode(respuesta.bodyBytes);
    final datos = texto.isEmpty ? null : _decodificar(texto);
    if (respuesta.statusCode >= 200 && respuesta.statusCode < 300) return datos;

    // Token vencido o cuenta suspendida: se cierra la sesión y la app vuelve al login
    if (cerrarSiVence && (respuesta.statusCode == 401 || respuesta.statusCode == 403)) {
      unawaited(_sesion.cerrar());
    }
    final mensaje = datos is Map && datos['error'] != null
        ? datos['error'].toString()
        : 'Error ${respuesta.statusCode} del servidor';
    throw ApiException(mensaje, respuesta.statusCode);
  }

  dynamic _decodificar(String texto) {
    try {
      return jsonDecode(texto);
    } catch (_) {
      // Por ejemplo, la página de error de ngrok cuando el túnel está apagado
      throw ApiException('El servidor respondió algo inesperado. ¿Está encendido el túnel de ngrok?');
    }
  }

  // --- Autenticación ---

  Future<void> login(String email, String password) async {
    final r = await _pedir('POST', '/auth/login',
        cuerpo: {'email': email, 'password': password}, cerrarSiVence: false);
    await _sesion.iniciar(r['token'] as String, Cliente.desdeJson(r['cliente'] as Map<String, dynamic>));
  }

  Future<void> registrar(String nombre, String identificador, String email, String password) async {
    final r = await _pedir('POST', '/auth/registro',
        cuerpo: {'nombre': nombre, 'identificador': identificador, 'email': email, 'password': password},
        cerrarSiVence: false);
    await _sesion.iniciar(r['token'] as String, Cliente.desdeJson(r['cliente'] as Map<String, dynamic>));
  }

  Future<Cliente> perfil() async =>
      Cliente.desdeJson(await _pedir('GET', '/clientes/me') as Map<String, dynamic>);

  // --- Dispositivos ---

  Future<List<Dispositivo>> dispositivos() async => (await _pedir('GET', '/dispositivos') as List)
      .map((d) => Dispositivo.desdeJson(d as Map<String, dynamic>))
      .toList();

  Future<Dispositivo> vincular(String codigo, String nombre) async => Dispositivo.desdeJson(
      await _pedir('POST', '/dispositivos/vincular', cuerpo: {'codigo': codigo, 'nombre': nombre})
          as Map<String, dynamic>);

  Future<void> cambiarLimite(int id, double? litros) =>
      _pedir('PATCH', '/dispositivos/$id', cuerpo: {'limite_diario_l': litros});

  Future<EstadoDispositivo> estado(int id) async =>
      EstadoDispositivo.desdeJson(await _pedir('GET', '/dispositivos/$id/estado') as Map<String, dynamic>);

  Future<EstadoDispositivo> cambiarValvula(int id, String modo) async => EstadoDispositivo.desdeJson(
      await _pedir('POST', '/dispositivos/$id/valvula', cuerpo: {'modo': modo}) as Map<String, dynamic>);

  Future<EstadoDispositivo> atenderFugas(int id) async => EstadoDispositivo.desdeJson(
      await _pedir('POST', '/dispositivos/$id/eventos/atender-fugas') as Map<String, dynamic>);

  Future<List<Evento>> eventos(int id, {int limite = 10}) async =>
      (await _pedir('GET', '/dispositivos/$id/eventos', query: {'limite': '$limite'}) as List)
          .map((e) => Evento.desdeJson(e as Map<String, dynamic>))
          .toList();

  Future<Lectura?> ultima(int id) async {
    final r = await _pedir('GET', '/dispositivos/$id/ultima');
    return r == null ? null : Lectura.desdeJson(r as Map<String, dynamic>);
  }

  Future<List<Lectura>> lecturas(int id, DateTime desde) async =>
      (await _pedir('GET', '/dispositivos/$id/lecturas', query: {'desde': desde.toUtc().toIso8601String()})
              as List)
          .map((l) => Lectura.desdeJson(l as Map<String, dynamic>))
          .toList();
}
