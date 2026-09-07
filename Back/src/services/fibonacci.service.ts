import { v4 as uuidv4 } from "uuid";
import { FibonacciRepository } from "../repositories/fibonacci.repository";
import { ClienteService } from "./cliente.service";
import { AppError } from "../utils/AppError";
import { randomInt } from "../utils/random";
import { GenerarFibonacciDTO } from "../dtos/fibonacci.dto";

const MIN_ITERACIONES = 20;
const MAX_ITERACIONES = 80;
// Límite duro: F(92) ya no entra en BIGINT y Number pierde precisión bastante antes.
const LIMITE_ITERACIONES = 90;
const PHI = (1 + Math.sqrt(5)) / 2;

export const FibonacciService = {
  async generar(id_cliente: number, data: GenerarFibonacciDTO) {
    await ClienteService.obtenerPorId(id_cliente);

    const N = data.iteraciones ?? randomInt(MIN_ITERACIONES, MAX_ITERACIONES);
    if (!Number.isInteger(N) || N < 1 || N > LIMITE_ITERACIONES) {
      throw new AppError(
        `iteraciones debe ser un entero entre 1 y ${LIMITE_ITERACIONES}`,
        400
      );
    }

    const id_ejecucion = uuidv4();
    const filas = [];
    let a = 0n; // F(0)
    let b = 1n; // F(1)

    for (let iteracion = 1; iteracion <= N; iteracion++) {
      const c = a + b; // F(iteracion + 1)
      const razon_calculada = Number(c) / Number(b);
      const error = Math.abs(razon_calculada - PHI);

      filas.push({
        cliente: { id_cliente },
        id_ejecucion,
        iteracion,
        fibonacci_n: c.toString(),
        razon_calculada: razon_calculada.toFixed(15),
        valor_real: PHI.toFixed(15),
        error: error.toFixed(15),
      });

      a = b;
      b = c;
    }

    await FibonacciRepository.guardarLote(filas);
    return { id_ejecucion, iteraciones: N, filas };
  },

  listarPorCliente(id_cliente: number) {
    return FibonacciRepository.listarPorCliente(id_cliente);
  },

  async listarPorEjecucion(id_ejecucion: string, id_cliente: number) {
    const filas = await FibonacciRepository.listarPorEjecucion(
      id_ejecucion,
      id_cliente
    );
    if (filas.length === 0) {
      throw new AppError("Ejecución no encontrada", 404);
    }
    return filas;
  },

  listarEjecuciones(id_cliente: number) {
    return FibonacciRepository.listarEjecucionesPorCliente(id_cliente);
  },
};
