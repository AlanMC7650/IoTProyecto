// Dirección del Back por defecto: el dominio fijo de ngrok del equipo.
// Se puede cambiar desde la pantalla de inicio de sesión ("Servidor") o al
// compilar: flutter run --dart-define=API_URL=http://192.168.1.50:3000
const String servidorPorDefecto = String.fromEnvironment(
  'API_URL',
  defaultValue: 'https://undercook-overdrawn-exclusive.ngrok-free.dev',
);

// Igual que el dashboard web: en línea si la última lectura tiene menos de 30 s
const Duration tiempoEnLinea = Duration(seconds: 30);

// Rango que muestra la gráfica de caudal
const Duration rangoGrafica = Duration(minutes: 10);

// Mismo umbral que ESP32/main.py (1500 de 4095)
const int umbralFuga = 1500;
