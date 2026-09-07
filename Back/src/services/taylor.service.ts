import { v4 as uuidv4 } from "uuid";
import { TaylorRepository } from "../repositories/taylor.repository";
import { ClienteService } from "./cliente.service";
import { AppError } from "../utils/AppError";
import { randomInt, randomFloat } from "../utils/random";
import { FuncionTaylor, GenerarTaylorDTO } from "../dtos/taylor.dto";

const MIN_ITERACIONES = 10;
const MAX_ITERACIONES = 40;
const LIMITE_ITERACIONES = 200;
const X_MIN = -2;
const X_MAX = 2;
const FUNCIONES: FuncionTaylor[] = ["exponencial", "seno", "coseno"];

function valorReal(funcion: FuncionTaylor, x: number): number {
  switch (funcion) {
    case "exponencial":
      return Math.exp(x);
    case "seno":
      return Math.sin(x);
    case "coseno":
      return Math.cos(x);
  }
}

// Calcula el siguiente término de la serie a partir del anterior (recurrencia),
// evitando recalcular potencias y factoriales completos en cada iteración.
function siguienteTermino(
  funcion: FuncionTaylor,
  terminoAnterior: number,
  k: number,
  x: number
): number {
  if (funcion === "exponencial") {
    return k === 0 ? 1 : (terminoAnterior * x) / k;
  }
  if (funcion === "seno") {
    return k === 0 ? x : (terminoAnterior * -x * x) / (2 * k * (2 * k + 1));
  }
  // coseno
  return k === 0 ? 1 : (terminoAnterior * -x * x) / ((2 * k - 1) * (2 * k));
}

export const TaylorService = {
  async generar(id_cliente: number, data: GenerarTaylorDTO) {
    await ClienteService.obtenerPorId(id_cliente);

    const funcion = data.funcion ?? FUNCIONES[randomInt(0, FUNCIONES.length - 1)];
    if (!FUNCIONES.includes(funcion)) {
      throw new AppError(
        "funcion inválida: debe ser exponencial, seno o coseno",
        400
      );
    }

    const x = data.x ?? Number(randomFloat(X_MIN, X_MAX).toFixed(6));
    if (typeof x !== "number" || !Number.isFinite(x)) {
      throw new AppError("x debe ser un número finito", 400);
    }

    const N = data.iteraciones ?? randomInt(MIN_ITERACIONES, MAX_ITERACIONES);
    if (!Number.isInteger(N) || N < 1 || N > LIMITE_ITERACIONES) {
      throw new AppError(
        `iteraciones debe ser un entero entre 1 y ${LIMITE_ITERACIONES}`,
        400
      );
    }

    const id_ejecucion = uuidv4();
    const real = valorReal(funcion, x);
    const filas = [];
    let sum = 0;
    let term = 0;

    for (let k = 0; k < N; k++) {
      term = siguienteTermino(funcion, term, k, x);
      sum += term;
      const iteracion = k + 1;
      const error = Math.abs(sum - real);

      filas.push({
        cliente: { id_cliente },
        id_ejecucion,
        funcion,
        x_valor: x.toFixed(6),
        iteracion,
        valor_calculado: sum.toFixed(15),
        valor_real: real.toFixed(15),
        error: error.toFixed(15),
      });
    }

    await TaylorRepository.guardarLote(filas);
    return { id_ejecucion, iteraciones: N, funcion, x, filas };
  },

  listarPorCliente(id_cliente: number) {
    return TaylorRepository.listarPorCliente(id_cliente);
  },

  async listarPorEjecucion(id_ejecucion: string, id_cliente: number) {
    const filas = await TaylorRepository.listarPorEjecucion(
      id_ejecucion,
      id_cliente
    );
    if (filas.length === 0) {
      throw new AppError("Ejecución no encontrada", 404);
    }
    return filas;
  },

  listarEjecuciones(id_cliente: number) {
    return TaylorRepository.listarEjecucionesPorCliente(id_cliente);
  },
};
