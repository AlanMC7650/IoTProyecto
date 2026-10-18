import 'package:flutter/material.dart';

import 'pantallas/inicio.dart';
import 'pantallas/login.dart';
import 'servicios/api.dart';
import 'servicios/sesion.dart';
import 'tema.dart';

// AquaControl móvil: la misma funcionalidad del dashboard web (ver dispositivos,
// caudal en tiempo real, abrir y cerrar la electroválvula, límite diario y
// eventos), usando la misma API del Back publicada con ngrok.
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Sesion.instancia.cargar();
  runApp(const AquaControlApp());
}

final claveNavegador = GlobalKey<NavigatorState>();

class AquaControlApp extends StatefulWidget {
  const AquaControlApp({super.key});

  @override
  State<AquaControlApp> createState() => _AquaControlAppState();
}

class _AquaControlAppState extends State<AquaControlApp> {
  final _sesion = Sesion.instancia;
  bool _verificando = true;

  @override
  void initState() {
    super.initState();
    _sesion.addListener(_alCambiarSesion);
    _verificarSesionGuardada();
  }

  // Si quedó un token guardado, se comprueba que siga valiendo (vence a las 8 h)
  Future<void> _verificarSesionGuardada() async {
    if (_sesion.iniciada) {
      try {
        _sesion.cliente = await Api.instancia.perfil();
      } on ApiException catch (e) {
        if (e.estado == 401 || e.estado == 403) await _sesion.cerrar();
      }
    }
    if (mounted) setState(() => _verificando = false);
  }

  void _alCambiarSesion() {
    // Al cerrar sesión (o si el token venció) se vuelve a la primera pantalla
    claveNavegador.currentState?.popUntil((ruta) => ruta.isFirst);
    setState(() {});
  }

  @override
  void dispose() {
    _sesion.removeListener(_alCambiarSesion);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'AquaControl',
      debugShowCheckedModeBanner: false,
      navigatorKey: claveNavegador,
      theme: temaAquaControl(),
      home: _verificando
          ? const Scaffold(body: Center(child: CircularProgressIndicator()))
          : _sesion.iniciada
              ? const InicioPantalla()
              : const LoginPantalla(),
    );
  }
}
