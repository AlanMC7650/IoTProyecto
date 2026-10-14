export interface VincularDispositivoDTO {
  // Código de 6 caracteres que muestra el ESP32 mientras espera ser vinculado
  codigo: string;
  nombre: string;
}

export interface ActualizarDispositivoDTO {
  nombre?: string;
  pulsos_por_litro?: number;
  // null quita el límite
  limite_diario_l?: number | null;
}

export interface ValvulaDTO {
  modo: "auto" | "abierta" | "cerrada";
}
