# AquaControl móvil (Flutter)

App para Android con lo mismo que el dashboard web: ver los dispositivos, el caudal en tiempo real, abrir y cerrar la electroválvula, poner un límite diario y ver los eventos. Usa la **misma API del Back** (publicada con ngrok), así que no hace falta cambiar nada del servidor.

## Qué tiene

| Pantalla | Qué hace |
|---|---|
| Iniciar sesión / Crear cuenta | Mismo usuario que la web. La sesión queda guardada en el teléfono (el token JWT vence a las 8 h). |
| Servidor | En la pantalla de inicio de sesión. Por defecto, el dominio de ngrok del equipo; se puede cambiar, por ejemplo, a `http://192.168.1.50:3000` si el teléfono está en el mismo Wi-Fi que la PC. |
| Mis dispositivos | Lista con el estado (en línea / desconectado). Se actualiza deslizando hacia abajo. |
| Vincular | Se escribe el código de 6 caracteres del ESP32 (el de la red `AquaControl-XXXXXX`) y un nombre. |
| Dispositivo | Caudal en vivo y gráfica de los últimos 10 minutos, consumo de hoy contra el límite, electroválvula (Abrir / Cerrar / Auto, con el aviso de fuga sin confirmar), LED RGB como gemelo digital, eventos recientes. |

**Tiempo real:** la pantalla del dispositivo abre una sola conexión SSE (`GET /api/stream`), igual que la web. Cada lectura que el ESP32 manda a Supabase llega sola, sin recargar; si se corta, se reconecta y recarga lo que faltó. La lista de dispositivos no consulta sola cada pocos segundos para no gastar el límite de peticiones de ngrok.

## Estructura

```
lib/
  main.dart               arranque y navegación según haya sesión o no
  config.dart             servidor por defecto (ngrok), umbrales
  modelos.dart            Cliente, Dispositivo, Lectura, EstadoDispositivo, Evento
  tema.dart               colores (los mismos de la web)
  servicios/
    api.dart              llamadas a la API REST del Back
    sesion.dart           token y servidor guardados en el teléfono
    tiempo_real.dart      canal SSE con reconexión
    cliente_http*.dart    cliente HTTP (en el navegador usa fetch para poder leer el SSE)
  pantallas/              login, registro, inicio, vincular, dispositivo
  widgets/grafica_caudal.dart
```

## Instalar en un celular Android

El APK ya compilado queda en:

```
build/app/outputs/flutter-apk/app-release.apk
```

1. Pasá ese archivo al celular (cable USB, Drive, WhatsApp).
2. Abrilo y aceptá "instalar apps de origen desconocido" si el teléfono lo pide.
3. Abrí **AquaControl** e iniciá sesión con tu usuario de la web.

Para que funcione, en la PC tienen que estar corriendo el Back (`npm run dev` en `Back/`) y ngrok (`npm run tunnel`).

## Compilar y probar

```powershell
cd Movil/aquacontrol_app
flutter pub get
flutter analyze
flutter test

# APK para instalar
flutter build apk --release

# Con el celular conectado por USB (depuración USB activada)
flutter run

# Probar en Chrome contra el Back local
flutter run -d chrome --dart-define=API_URL=http://localhost:3000
```

`--dart-define=API_URL=...` cambia el servidor por defecto al compilar; igual se puede cambiar después desde la app.

## Si `flutter build apk` falla con "Unable to establish loopback connection"

Pasa en esta PC: Java no puede crear su canal interno en la carpeta temporal del usuario (la ruta real tiene un espacio, `Juan Jose`). Además, `JAVA_HOME` apunta a Java 25 y el Gradle de la plantilla (8.14) soporta hasta Java 24. Se resuelve así, en la misma terminal de PowerShell antes de compilar:

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:JAVA_TOOL_OPTIONS = "-Djdk.net.unixdomain.tmpdir=C:\Windows\Temp"
flutter build apk --release
```

Esas dos variables valen solo para esa terminal; no cambian la configuración de la PC.

Para un APK más chico (~17 MB en vez de 47 MB) se puede compilar uno por tipo de procesador con `flutter build apk --release --split-per-abi` e instalar `app-arm64-v8a-release.apk`, que es el de casi todos los celulares actuales.

## Notas

- `flutter doctor` avisa que la ruta del Android SDK tiene un espacio (`C:\Users\Juan Jose\...`). Para esta app no impidió compilar; si algún día una librería con código nativo (NDK) falla, hay que mover el SDK a una ruta sin espacios.
- El APK de `--release` está firmado con la clave de depuración de Flutter: sirve para instalarlo y mostrarlo, no para publicarlo en Google Play.
- El panel del sensor de agua no aparece, igual que en la web, porque el T1592 todavía no está instalado. El aviso de fuga sin confirmar sí aparece en el panel de la electroválvula.
