import { DispositivoRepository } from "../repositories/dispositivo.repository";
import { ClienteService } from "./cliente.service";
import { AppError } from "../utils/AppError";
import { generarApiKey, hashApiKey } from "../utils/apiKey";
import { Dispositivo } from "../entities/Dispositivo";
import {
  ActualizarDispositivoDTO,
  CrearDispositivoDTO,
} from "../dtos/dispositivo.dto";

const MAX_NOMBRE = 100;
const MAX_PULSOS_POR_LITRO = 99999;
// Un dispositivo se considera en línea si envió datos hace menos de 15 s
const MS_EN_LINEA = 15_000;

function validarNombre(nombre: unknown): string {
  if (typeof nombre !== "string" || !nombre.trim()) {
    throw new AppError("nombre es obligatorio", 400);
  }
  const limpio = nombre.trim();
  if (limpio.length > MAX_NOMBRE) {
    throw new AppError(
      `nombre no puede superar los ${MAX_NOMBRE} caracteres`,
      400
    );
  }
  return limpio;
}

function conEstado(dispositivo: Dispositivo) {
  const { api_key_hash, ...resto } = dispositivo;
  const en_linea =
    !!dispositivo.ultima_conexion &&
    Date.now() - dispositivo.ultima_conexion.getTime() < MS_EN_LINEA;
  return { ...resto, en_linea };
}

export const DispositivoService = {
  async crear(id_cliente: number, data: CrearDispositivoDTO) {
    await ClienteService.obtenerPorId(id_cliente);
    const nombre = validarNombre(data?.nombre);

    const api_key = generarApiKey();
    const creado = await DispositivoRepository.crear(
      id_cliente,
      nombre,
      hashApiKey(api_key)
    );

    const dispositivo = await this.obtenerPropio(
      creado.id_dispositivo,
      id_cliente
    );
    return { dispositivo: conEstado(dispositivo), api_key };
  },

  async listar(id_cliente: number) {
    const dispositivos = await DispositivoRepository.listarPorCliente(
      id_cliente
    );
    return dispositivos.map(conEstado);
  },

  // Devuelve el dispositivo solo si pertenece al cliente
  async obtenerPropio(id_dispositivo: number, id_cliente: number) {
    if (!Number.isInteger(id_dispositivo) || id_dispositivo <= 0) {
      throw new AppError("id de dispositivo inválido", 400);
    }

    const dispositivo = await DispositivoRepository.buscarPorIdYCliente(
      id_dispositivo,
      id_cliente
    );
    if (!dispositivo) {
      throw new AppError("Dispositivo no encontrado", 404);
    }
    return dispositivo;
  },

  async actualizar(
    id_dispositivo: number,
    id_cliente: number,
    data: ActualizarDispositivoDTO
  ) {
    await this.obtenerPropio(id_dispositivo, id_cliente);

    const cambios: Partial<Dispositivo> = {};
    if (data?.nombre !== undefined) {
      cambios.nombre = validarNombre(data.nombre);
    }
    if (data?.pulsos_por_litro !== undefined) {
      const ppl = data.pulsos_por_litro;
      if (
        typeof ppl !== "number" ||
        !Number.isFinite(ppl) ||
        ppl <= 0 ||
        ppl > MAX_PULSOS_POR_LITRO
      ) {
        throw new AppError(
          `pulsos_por_litro debe ser un número mayor a 0 y hasta ${MAX_PULSOS_POR_LITRO}`,
          400
        );
      }
      cambios.pulsos_por_litro = ppl.toFixed(3);
    }
    if (Object.keys(cambios).length === 0) {
      throw new AppError("Enviá nombre o pulsos_por_litro para actualizar", 400);
    }

    await DispositivoRepository.actualizar(id_dispositivo, cambios);
    return conEstado(await this.obtenerPropio(id_dispositivo, id_cliente));
  },

  async regenerarClave(id_dispositivo: number, id_cliente: number) {
    await this.obtenerPropio(id_dispositivo, id_cliente);

    const api_key = generarApiKey();
    await DispositivoRepository.actualizar(id_dispositivo, {
      api_key_hash: hashApiKey(api_key),
    });
    return { api_key };
  },

  async eliminar(id_dispositivo: number, id_cliente: number) {
    await this.obtenerPropio(id_dispositivo, id_cliente);
    // Las lecturas se borran por el ON DELETE CASCADE de la BD
    await DispositivoRepository.eliminar(id_dispositivo);
  },
};
