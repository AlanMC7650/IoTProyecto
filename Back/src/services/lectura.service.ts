import { LecturaRepository } from "../repositories/lectura.repository";
import { DispositivoRepository } from "../repositories/dispositivo.repository";
import { DispositivoService } from "./dispositivo.service";
import { AppError } from "../utils/AppError";
import { Dispositivo } from "../entities/Dispositivo";
import {
  LecturaDTO,
  RangoLecturasDTO,
  RegistrarLecturasDTO,
} from "../dtos/lectura.dto";

const MAX_LECTURAS_POR_ENVIO = 500;
const MAX_MS_ATRAS = 24 * 60 * 60 * 1000;
const RANGO_POR_DEFECTO_MS = 10 * 60 * 1000;
const LIMITE_MAXIMO = 5000;
const MAX_AGRUPAR_S = 24 * 60 * 60;
// Topes de las columnas DECIMAL / INT de lectura_caudal
const MAX_CAUDAL = 9_999_999;
const MAX_VOLUMEN = 99_999_999_999;
const MAX_PULSOS = 2_147_483_647;

function esNumeroValido(valor: unknown, maximo: number): valor is number {
  return (
    typeof valor === "number" &&
    Number.isFinite(valor) &&
    valor >= 0 &&
    valor <= maximo
  );
}

function validarLectura(lectura: LecturaDTO, indice: number) {
  const donde = `lecturas[${indice}]`;
  if (typeof lectura !== "object" || lectura === null) {
    throw new AppError(`${donde} debe ser un objeto`, 400);
  }
  if (!esNumeroValido(lectura.caudal_lmin, MAX_CAUDAL)) {
    throw new AppError(
      `${donde}.caudal_lmin debe ser un número finito y no negativo`,
      400
    );
  }
  if (!esNumeroValido(lectura.volumen_l, MAX_VOLUMEN)) {
    throw new AppError(
      `${donde}.volumen_l debe ser un número finito y no negativo`,
      400
    );
  }
  if (
    !esNumeroValido(lectura.pulsos, MAX_PULSOS) ||
    !Number.isInteger(lectura.pulsos)
  ) {
    throw new AppError(
      `${donde}.pulsos debe ser un entero no negativo`,
      400
    );
  }
  if (!esNumeroValido(lectura.ms_atras, MAX_MS_ATRAS)) {
    throw new AppError(
      `${donde}.ms_atras debe ser un número entre 0 y ${MAX_MS_ATRAS} (24 h)`,
      400
    );
  }
}

function parsearFecha(valor: string | undefined, campo: string) {
  if (valor === undefined || valor === "") return undefined;
  const fecha = new Date(String(valor));
  if (Number.isNaN(fecha.getTime())) {
    throw new AppError(`${campo} debe ser una fecha ISO 8601 válida`, 400);
  }
  return fecha;
}

function parsearRango(query: RangoLecturasDTO) {
  const hasta = parsearFecha(query.hasta, "hasta") ?? new Date();
  const desde =
    parsearFecha(query.desde, "desde") ??
    new Date(hasta.getTime() - RANGO_POR_DEFECTO_MS);
  if (desde > hasta) {
    throw new AppError("desde no puede ser posterior a hasta", 400);
  }
  return { desde, hasta };
}

function parsearEntero(
  valor: string | undefined,
  campo: string,
  maximo: number
) {
  if (valor === undefined || valor === "") return undefined;
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < 1 || numero > maximo) {
    throw new AppError(`${campo} debe ser un entero entre 1 y ${maximo}`, 400);
  }
  return numero;
}

export const LecturaService = {
  async registrar(dispositivo: Dispositivo, data: RegistrarLecturasDTO) {
    const lecturas = data?.lecturas;
    if (
      !Array.isArray(lecturas) ||
      lecturas.length < 1 ||
      lecturas.length > MAX_LECTURAS_POR_ENVIO
    ) {
      throw new AppError(
        `lecturas debe ser un arreglo de 1 a ${MAX_LECTURAS_POR_ENVIO} elementos`,
        400
      );
    }
    lecturas.forEach(validarLectura);

    const ahora = Date.now();
    const { id_dispositivo } = dispositivo;
    const filas = lecturas.map((l) => ({
      dispositivo: { id_dispositivo },
      caudal_lmin: l.caudal_lmin.toFixed(3),
      volumen_l: l.volumen_l.toFixed(3),
      pulsos: l.pulsos,
      fecha_medicion: new Date(ahora - l.ms_atras),
    }));

    await LecturaRepository.guardarLote(filas);
    await DispositivoRepository.marcarConexion(id_dispositivo);
    return { guardadas: filas.length };
  },

  async ultima(id_dispositivo: number, id_cliente: number) {
    await DispositivoService.obtenerPropio(id_dispositivo, id_cliente);
    return LecturaRepository.ultimaPorDispositivo(id_dispositivo);
  },

  async listar(
    id_dispositivo: number,
    id_cliente: number,
    query: RangoLecturasDTO
  ) {
    await DispositivoService.obtenerPropio(id_dispositivo, id_cliente);
    const { desde, hasta } = parsearRango(query);
    const limite =
      parsearEntero(query.limite, "limite", LIMITE_MAXIMO) ?? LIMITE_MAXIMO;
    const agrupar_s = parsearEntero(query.agrupar_s, "agrupar_s", MAX_AGRUPAR_S);

    if (!agrupar_s) {
      return LecturaRepository.listarPorRango(
        id_dispositivo,
        desde,
        hasta,
        limite
      );
    }

    const filas = await LecturaRepository.listarAgrupadoPorRango(
      id_dispositivo,
      desde,
      hasta,
      limite,
      agrupar_s
    );
    return filas.map((f) => ({
      fecha_medicion: f.fecha_medicion,
      caudal_lmin: Number(f.caudal_lmin).toFixed(3),
      volumen_l: f.volumen_l,
      pulsos: Number(f.pulsos),
    }));
  },

  async resumen(
    id_dispositivo: number,
    id_cliente: number,
    query: RangoLecturasDTO
  ) {
    const dispositivo = await DispositivoService.obtenerPropio(
      id_dispositivo,
      id_cliente
    );
    const { desde, hasta } = parsearRango(query);
    const fila = await LecturaRepository.resumenPorRango(
      id_dispositivo,
      desde,
      hasta
    );

    // Se usa la suma de pulsos (y no max - min del volumen acumulado) porque
    // el acumulado vuelve a 0 cada vez que el ESP32 se reinicia.
    const pulsos = Number(fila?.pulsos ?? 0);
    const litros = pulsos / Number(dispositivo.pulsos_por_litro);

    return {
      desde,
      hasta,
      cantidad_lecturas: Number(fila?.cantidad ?? 0),
      caudal_promedio: Number(Number(fila?.caudal_promedio ?? 0).toFixed(3)),
      caudal_maximo: Number(Number(fila?.caudal_maximo ?? 0).toFixed(3)),
      litros_consumidos: Number(litros.toFixed(3)),
    };
  },
};
