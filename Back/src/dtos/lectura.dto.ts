export interface RangoLecturasDTO {
  desde?: string;
  hasta?: string;
  limite?: string;
  // Si viene, se promedian las lecturas en intervalos de esa cantidad de segundos
  agrupar_s?: string;
}
