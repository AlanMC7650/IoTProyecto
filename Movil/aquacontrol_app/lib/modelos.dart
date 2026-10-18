// Modelos de los datos que devuelve el Back (/api). Los decimales de Postgres
// llegan como texto por la API REST y como número por el tiempo real, así que
// todo pasa por aDouble.

double? aDouble(dynamic valor) {
  if (valor == null) return null;
  if (valor is num) return valor.toDouble();
  return double.tryParse(valor.toString());
}

class Cliente {
  final int id;
  final String nombre;
  final String email;
  final String rol;

  Cliente({required this.id, required this.nombre, required this.email, required this.rol});

  factory Cliente.desdeJson(Map<String, dynamic> j) => Cliente(
        id: j['id_cliente'] as int,
        nombre: j['nombre'] as String,
        email: j['email'] as String,
        rol: (j['rol'] ?? 'usuario') as String,
      );
}

class Dispositivo {
  final int id;
  final String nombre;
  final double pulsosPorLitro;
  final double? limiteDiarioL;
  final String valvulaModo;
  final DateTime? ultimaConexion;
  final bool enLinea;

  Dispositivo({
    required this.id,
    required this.nombre,
    required this.pulsosPorLitro,
    required this.limiteDiarioL,
    required this.valvulaModo,
    required this.ultimaConexion,
    required this.enLinea,
  });

  factory Dispositivo.desdeJson(Map<String, dynamic> j) => Dispositivo(
        id: j['id_dispositivo'] as int,
        nombre: (j['nombre'] ?? 'Sin nombre') as String,
        pulsosPorLitro: aDouble(j['pulsos_por_litro']) ?? 450,
        limiteDiarioL: aDouble(j['limite_diario_l']),
        valvulaModo: (j['valvula_modo'] ?? 'auto') as String,
        ultimaConexion: j['ultima_conexion'] == null ? null : DateTime.parse(j['ultima_conexion'] as String),
        enLinea: (j['en_linea'] ?? false) as bool,
      );
}

class Lectura {
  final DateTime fecha;
  final double caudal;
  final double volumen;
  final int? nivelAgua;
  final bool fuga;
  final bool? valvulaAbierta;
  final String? ledEstado;
  final int? ledBrillo;

  Lectura({
    required this.fecha,
    required this.caudal,
    required this.volumen,
    required this.nivelAgua,
    required this.fuga,
    required this.valvulaAbierta,
    required this.ledEstado,
    required this.ledBrillo,
  });

  factory Lectura.desdeJson(Map<String, dynamic> j) => Lectura(
        fecha: DateTime.parse(j['fecha_medicion'] as String),
        caudal: aDouble(j['caudal_lmin']) ?? 0,
        volumen: aDouble(j['volumen_l']) ?? 0,
        nivelAgua: aDouble(j['nivel_agua'])?.round(),
        fuga: (j['fuga'] ?? false) as bool,
        valvulaAbierta: j['valvula_abierta'] as bool?,
        ledEstado: j['led_estado'] as String?,
        ledBrillo: aDouble(j['led_brillo'])?.round(),
      );
}

// Qué tiene que hacer la válvula y por qué (lo calcula la base de datos)
class EstadoDispositivo {
  final String valvula; // abrir | cerrar
  final String? motivo; // fuga | manual | limite
  final String modo; // auto | abierta | cerrada
  final double? limiteDiarioL;
  final double consumoHoyL;
  final int fugasPendientes;

  EstadoDispositivo({
    required this.valvula,
    required this.motivo,
    required this.modo,
    required this.limiteDiarioL,
    required this.consumoHoyL,
    required this.fugasPendientes,
  });

  factory EstadoDispositivo.desdeJson(Map<String, dynamic> j) => EstadoDispositivo(
        valvula: (j['valvula'] ?? 'abrir') as String,
        motivo: j['motivo'] as String?,
        modo: (j['modo'] ?? 'auto') as String,
        limiteDiarioL: aDouble(j['limite_diario_l']),
        consumoHoyL: aDouble(j['consumo_hoy_l']) ?? 0,
        fugasPendientes: aDouble(j['fugas_pendientes'])?.round() ?? 0,
      );
}

class Evento {
  final String tipo;
  final String? detalle;
  final DateTime fecha;
  final bool atendido;

  Evento({required this.tipo, required this.detalle, required this.fecha, required this.atendido});

  factory Evento.desdeJson(Map<String, dynamic> j) => Evento(
        tipo: j['tipo'] as String,
        detalle: j['detalle'] as String?,
        fecha: DateTime.parse(j['fecha'] as String),
        atendido: (j['atendido'] ?? false) as bool,
      );
}

// Mensaje del canal de tiempo real (/api/stream)
class MensajeTiempoReal {
  final Lectura lectura;
  final EstadoDispositivo estado;

  MensajeTiempoReal(this.lectura, this.estado);

  factory MensajeTiempoReal.desdeJson(Map<String, dynamic> j) => MensajeTiempoReal(
        Lectura.desdeJson(j['lectura'] as Map<String, dynamic>),
        EstadoDispositivo.desdeJson(j['estado'] as Map<String, dynamic>),
      );
}
