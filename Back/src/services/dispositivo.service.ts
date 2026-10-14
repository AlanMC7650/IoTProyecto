import { DispositivoRepository } from "../repositories/dispositivo.repository";
import { EventoRepository } from "../repositories/evento.repository";
import { AppError } from "../utils/AppError";
import { Dispositivo, ModoValvula } from "../entities/Dispositivo";
import {
  ActualizarDispositivoDTO,
  ValvulaDTO,
  VincularDispositivoDTO,
} from "../dtos/dispositivo.dto";

const MAX_NOMBRE = 100;
const MAX_PULSOS_POR_LITRO = 99999;
const MAX_LIMITE_L = 9_999_999;
// Un dispositivo se considera en línea si envió datos hace menos de 15 s (envía cada 5 s)
const MS_EN_LINEA = 15_000;
// El código solo sirve si el ESP32 se anunció hace poco (está encendido y esperando)
const MS_VALIDEZ_CODIGO = 10 * 60 * 1000;
const MAX_EVENTOS = 100;
const CODIGO_REGEX = /^[0-9A-F]{6}$/;
const MODOS: ModoValvula[] = ["auto", "abierta", "cerrada"];
const TEXTO_MODO: Record<ModoValvula, string> = {
  auto: "Válvula en modo automático",
  abierta: "Válvula abierta manualmente desde el dashboard",
  cerrada: "Válvula cerrada manualmente desde el dashboard",
};

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
  const en_linea =
    !!dispositivo.ultima_conexion &&
    Date.now() - dispositivo.ultima_conexion.getTime() < MS_EN_LINEA;
  return { ...dispositivo, en_linea };
}

export const DispositivoService = {
  async vincular(id_cliente: number, data: VincularDispositivoDTO) {
    const codigo =
      typeof data?.codigo === "string" ? data.codigo.trim().toUpperCase() : "";
    if (!CODIGO_REGEX.test(codigo)) {
      throw new AppError(
        "El código tiene 6 caracteres (números y letras de la A a la F)",
        400
      );
    }
    const nombre = validarNombre(data?.nombre);

    const pendiente = await DispositivoRepository.buscarPendientePorCodigo(
      codigo,
      new Date(Date.now() - MS_VALIDEZ_CODIGO)
    );
    if (!pendiente) {
      throw new AppError(
        "No hay ningún dispositivo esperando con ese código. Revisá que el ESP32 esté encendido, conectado al Wi-Fi y con el LED azul parpadeando.",
        404
      );
    }
    const vinculado = await DispositivoRepository.vincular(
      pendiente.id_dispositivo,
      id_cliente,
      nombre
    );
    if (!vinculado) {
      throw new AppError("Ese dispositivo ya fue vinculado a otra cuenta", 409);
    }

    return conEstado(await this.obtenerPropio(pendiente.id_dispositivo, id_cliente));
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
    if (data?.limite_diario_l !== undefined) {
      const limite = data.limite_diario_l;
      if (limite === null) {
        cambios.limite_diario_l = null;
      } else if (
        typeof limite !== "number" ||
        !Number.isFinite(limite) ||
        limite <= 0 ||
        limite > MAX_LIMITE_L
      ) {
        throw new AppError(
          "limite_diario_l debe ser un número de litros mayor a 0, o null para quitarlo",
          400
        );
      } else {
        cambios.limite_diario_l = limite.toFixed(3);
      }
    }
    if (Object.keys(cambios).length === 0) {
      throw new AppError(
        "Enviá nombre, pulsos_por_litro o limite_diario_l para actualizar",
        400
      );
    }

    await DispositivoRepository.actualizar(id_dispositivo, cambios);
    return conEstado(await this.obtenerPropio(id_dispositivo, id_cliente));
  },

  // El ESP32 recibe el modo en la respuesta de su próximo envío (menos de 5 s)
  async cambiarValvula(id_dispositivo: number, id_cliente: number, data: ValvulaDTO) {
    const actual = await this.obtenerPropio(id_dispositivo, id_cliente);
    const modo = data?.modo;
    if (!MODOS.includes(modo)) {
      throw new AppError("modo debe ser auto, abierta o cerrada", 400);
    }
    if (modo !== actual.valvula_modo) {
      await DispositivoRepository.actualizar(id_dispositivo, { valvula_modo: modo });
      await EventoRepository.crear(id_dispositivo, "VALVULA", TEXTO_MODO[modo]);
    }
    return this.estado(id_dispositivo, id_cliente);
  },

  async estado(id_dispositivo: number, id_cliente: number) {
    await this.obtenerPropio(id_dispositivo, id_cliente);
    return DispositivoRepository.estado(id_dispositivo);
  },

  async eventos(id_dispositivo: number, id_cliente: number, limite?: string) {
    await this.obtenerPropio(id_dispositivo, id_cliente);
    let cantidad = 20;
    if (limite !== undefined) {
      cantidad = Number(limite);
      if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > MAX_EVENTOS) {
        throw new AppError(`limite debe ser un entero entre 1 y ${MAX_EVENTOS}`, 400);
      }
    }
    return EventoRepository.listarPorDispositivo(id_dispositivo, cantidad);
  },

  async atenderFugas(id_dispositivo: number, id_cliente: number) {
    await this.obtenerPropio(id_dispositivo, id_cliente);
    await EventoRepository.atenderFugas(id_dispositivo);
    return DispositivoRepository.estado(id_dispositivo);
  },

  async desvincular(id_dispositivo: number, id_cliente: number) {
    await this.obtenerPropio(id_dispositivo, id_cliente);
    await DispositivoRepository.desvincular(id_dispositivo);
  },
};
