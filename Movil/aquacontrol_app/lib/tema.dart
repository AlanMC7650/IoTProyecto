import 'package:flutter/material.dart';

// Mismos colores que el dashboard web
const colorPrimario = Color(0xFF2A9D8F);
const colorValvula = Color(0xFF7B61C9);
const colorPeligro = Color(0xFFE63946);
const colorOk = Color(0xFF2CA02C);
const colorTextoSuave = Color(0xFF8D99AE);

// Color de cada estado del LED RGB, igual que el LED físico
const Map<String, Color> coloresLed = {
  'apagado': Color(0xFFC3CAD5),
  'verde': Color(0xFF2CA02C),
  'amarillo': Color(0xFFF4A300),
  'rojo': Color(0xFFE63946),
  'limite': Color(0xFFE63946),
  'fuga': Color(0xFF1F77B4),
  'vinculando': Color(0xFF1F77B4),
};

const Map<String, String> textosLed = {
  'apagado': 'Apagado: no pasa agua',
  'verde': 'Verde: caudal bajo (hasta 4 L/min)',
  'amarillo': 'Amarillo: caudal medio (4 a 8 L/min)',
  'rojo': 'Rojo: pasa mucha agua',
  'limite': 'Rojo intermitente: límite diario alcanzado',
  'fuga': 'Rojo y azul: agua en el piso',
  'vinculando': 'Azul: esperando que lo vinculen',
};

ThemeData temaAquaControl() {
  final esquema = ColorScheme.fromSeed(seedColor: colorPrimario, primary: colorPrimario);
  return ThemeData(
    colorScheme: esquema,
    useMaterial3: true,
    scaffoldBackgroundColor: const Color(0xFFF4F7F6),
    appBarTheme: const AppBarTheme(backgroundColor: Colors.white, foregroundColor: Color(0xFF2B2D42), elevation: 0),
    cardTheme: CardThemeData(
      color: Colors.white,
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 14),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: const BorderSide(color: Color(0xFFE7ECEB)),
      ),
    ),
    inputDecorationTheme: const InputDecorationTheme(border: OutlineInputBorder()),
  );
}

// "hace 5 s", "hace 3 min", "hace 2 h", "hace 4 días"
String haceCuanto(DateTime fecha) {
  final segundos = DateTime.now().difference(fecha).inSeconds.clamp(0, 1 << 31);
  if (segundos < 60) return 'hace $segundos s';
  final minutos = (segundos / 60).round();
  if (minutos < 60) return 'hace $minutos min';
  final horas = (minutos / 60).round();
  if (horas < 24) return 'hace $horas h';
  final dias = (horas / 24).round();
  return 'hace $dias ${dias == 1 ? 'día' : 'días'}';
}
