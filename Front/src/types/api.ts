export interface Cliente {
  id_cliente: number;
  nombre: string;
  identificador: string;
  email: string;
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

export interface Dispositivo {
  id_dispositivo: number;
  nombre: string;
  pulsos_por_litro: string;
  ultima_conexion: string | null;
  fecha_registro: string;
  en_linea: boolean;
}

export interface DispositivoCreado {
  dispositivo: Dispositivo;
  // Clave API en texto plano: el Back la devuelve una sola vez
  api_key: string;
}

export interface ActualizarDispositivoPayload {
  nombre?: string;
  pulsos_por_litro?: number;
}

// Los decimales llegan como string desde Postgres. id_lectura no viene cuando
// las lecturas se piden agrupadas (un punto promedio por intervalo).
export interface LecturaCaudal {
  id_lectura?: string;
  caudal_lmin: string;
  volumen_l: string;
  pulsos: number;
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
}

export interface ApiErrorBody {
  error: string;
}
