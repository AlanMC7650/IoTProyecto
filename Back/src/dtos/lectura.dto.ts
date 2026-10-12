export interface LecturaDTO {
  caudal_lmin: number;
  volumen_l: number;
  pulsos: number;
  // Milisegundos transcurridos entre la medición y el envío (el ESP32 no tiene reloj real)
  ms_atras: number;
}

export interface RegistrarLecturasDTO {
  lecturas: LecturaDTO[];
}

export interface RangoLecturasDTO {
  desde?: string;
  hasta?: string;
  limite?: string;
  // Si viene, se promedian las lecturas en intervalos de esa cantidad de segundos
  agrupar_s?: string;
}
