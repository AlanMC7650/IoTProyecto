import { v4 as uuidv4 } from "uuid";
import { LeibnizRepository } from "../repositories/leibniz.repository";
import { ClienteService } from "./cliente.service";
import { AppError } from "../utils/AppError";
import { randomInt } from "../utils/random";
import { GenerarLeibnizDTO } from "../dtos/leibniz.dto";

const MIN_ITERACIONES = 50;
const MAX_ITERACIONES = 500;
const LIMITE_ITERACIONES = 5000;

export const LeibnizService = {
  async generar(id_cliente: number, data: GenerarLeibnizDTO) {
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
    let s = 0;
    let sign = 1;
    let denom = 1;

    for (let iteracion = 1; iteracion <= N; iteracion++) {
      s += sign / denom;
      const valor_calculado = 4 * s;
      const error = Math.abs(valor_calculado - Math.PI);

      filas.push({
        cliente: { id_cliente },
        id_ejecucion,
        iteracion,
        valor_calculado: valor_calculado.toFixed(15),
        valor_real: Math.PI.toFixed(15),
        error: error.toFixed(15),
      });

      sign = -sign;
      denom += 2;
    }

    await LeibnizRepository.guardarLote(filas);
    return { id_ejecucion, iteraciones: N, filas };
  },

  listarPorCliente(id_cliente: number) {
    return LeibnizRepository.listarPorCliente(id_cliente);
  },

  async listarPorEjecucion(id_ejecucion: string, id_cliente: number) {
    const filas = await LeibnizRepository.listarPorEjecucion(
      id_ejecucion,
      id_cliente
    );
    if (filas.length === 0) {
      throw new AppError("Ejecución no encontrada", 404);
    }
    return filas;
  },

  listarEjecuciones(id_cliente: number) {
    return LeibnizRepository.listarEjecucionesPorCliente(id_cliente);
  },
};
