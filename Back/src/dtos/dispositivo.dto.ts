export interface CrearDispositivoDTO {
  nombre: string;
}

export interface ActualizarDispositivoDTO {
  nombre?: string;
  pulsos_por_litro?: number;
}
