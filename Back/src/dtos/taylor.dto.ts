export type FuncionTaylor = "exponencial" | "seno" | "coseno";

export interface GenerarTaylorDTO {
  iteraciones?: number;
  funcion?: FuncionTaylor;
  x?: number;
}
