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

export type TipoSerie = "leibniz" | "fibonacci" | "taylor";

export type FuncionTaylor = "exponencial" | "seno" | "coseno";

export interface GenerarPayload {
  iteraciones?: number;
  funcion?: FuncionTaylor;
  x?: number;
}

// Fila normalizada: para Fibonacci, razon_calculada se mapea a valor_calculado
// en el service para poder reusar los mismos componentes de gráfico/tabla.
export interface FilaSerie {
  iteracion: number;
  valor_calculado: string;
  valor_real: string;
  error: string;
  fecha_generacion: string;
  id_ejecucion: string;
  fibonacci_n?: string;
  funcion?: FuncionTaylor;
  x_valor?: string;
}

export interface GenerarResultado {
  id_ejecucion: string;
  iteraciones: number;
  funcion?: FuncionTaylor;
  x?: number;
  filas: FilaSerie[];
}

export interface EjecucionResumen {
  id_ejecucion: string;
  fecha_generacion: string;
  cantidad_iteraciones: string;
  funcion?: FuncionTaylor;
  x_valor?: string;
}

export interface ApiErrorBody {
  error: string;
}
