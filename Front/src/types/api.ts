export type Rol = "usuario" | "admin";

export interface Cliente {
  id_cliente: number;
  nombre: string;
  identificador: string;
  email: string;
  rol: Rol;
  activo: boolean;
  fecha_registro: string;
}

export interface AuthResponse {
  cliente: Cliente;
  token: string;
}

export interface RegistroPayload {
  nombre: string;
  identificador: string;
  email: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export type ModoValvula = "auto" | "abierta" | "cerrada";

export interface Dispositivo {
  id_dispositivo: number;
  nombre: string;
  estado: "pendiente" | "vinculado";
  pulsos_por_litro: string;
  limite_diario_l: string | null;
  valvula_modo: ModoValvula;
  ultima_conexion: string | null;
  fecha_registro: string;
  en_linea: boolean;
}

export interface ActualizarDispositivoPayload {
  nombre?: string;
  pulsos_por_litro?: number;
  limite_diario_l?: number | null;
}

// Lo que el ESP32 tiene que hacer con la válvula y por qué (calculado por la BD)
export interface EstadoDispositivo {
  valvula: "abrir" | "cerrar";
  motivo: "fuga" | "manual" | "limite" | null;
  modo: ModoValvula;
  limite_diario_l: number | null;
  consumo_hoy_l: number;
  fugas_pendientes: number;
}

export type EstadoLed = "apagado" | "verde" | "amarillo" | "rojo" | "limite" | "fuga" | "vinculando";

// Los decimales llegan como string desde Postgres. id_lectura no viene cuando
// las lecturas se piden agrupadas (un punto promedio por intervalo).
export interface LecturaCaudal {
  id_lectura?: string;
  caudal_lmin: string;
  volumen_l: string;
  pulsos: number;
  nivel_agua: number | null;
  fuga: boolean;
  valvula_abierta: boolean | null;
  led_estado: EstadoLed | null;
  led_brillo: number | null;
  fecha_medicion: string;
  fecha_recepcion?: string;
}

export interface RangoLecturas {
  desde?: string;
  hasta?: string;
  limite?: number;
  agrupar_s?: number;
}

export interface ResumenCaudal {
  desde: string;
  hasta: string;
  cantidad_lecturas: number;
  caudal_promedio: number;
  caudal_maximo: number;
  litros_consumidos: number;
  nivel_agua_maximo: number | null;
  lecturas_con_fuga: number;
  minutos_valvula_cerrada: number;
}

export interface Evento {
  id_evento: string;
  tipo: "FUGA" | "LIMITE" | "FLUJO_CONTINUO" | "VALVULA";
  detalle: string | null;
  fecha: string;
  atendido: boolean;
}

// Mensaje del canal de tiempo real (/api/stream)
export interface MensajeTiempoReal {
  id_dispositivo: number;
  lectura: LecturaCaudal;
  estado: EstadoDispositivo;
}

export interface UsuarioAdmin {
  id_cliente: number;
  nombre: string;
  identificador: string;
  email: string;
  rol: Rol;
  activo: boolean;
  fecha_registro: string;
  dispositivos: number;
  ultima_conexion: string | null;
}

export interface ApiErrorBody {
  error: string;
}
