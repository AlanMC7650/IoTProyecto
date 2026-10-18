import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../config.dart';
import '../modelos.dart';

// Sesión del usuario: la dirección del servidor, el token JWT y el perfil.
// Se guarda en el teléfono para no pedir el login cada vez que se abre la app.
class Sesion extends ChangeNotifier {
  Sesion._();
  static final Sesion instancia = Sesion._();

  static const _claveServidor = 'servidor';
  static const _claveToken = 'token';

  String servidor = servidorPorDefecto;
  String? token;
  Cliente? cliente;

  bool get iniciada => token != null;

  Future<void> cargar() async {
    final prefs = await SharedPreferences.getInstance();
    servidor = prefs.getString(_claveServidor) ?? servidorPorDefecto;
    token = prefs.getString(_claveToken);
  }

  Future<void> cambiarServidor(String nuevo) async {
    servidor = nuevo.trim().replaceAll(RegExp(r'/+$'), '');
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_claveServidor, servidor);
  }

  Future<void> iniciar(String nuevoToken, Cliente perfil) async {
    token = nuevoToken;
    cliente = perfil;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_claveToken, nuevoToken);
    notifyListeners();
  }

  Future<void> cerrar() async {
    if (token == null) return;
    token = null;
    cliente = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_claveToken);
    notifyListeners();
  }
}
