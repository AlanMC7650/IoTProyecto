import { LecturaRepository } from "../repositories/lectura.repository";
import { DispositivoService } from "./dispositivo.service";
import { AppError } from "../utils/AppError";
import { RangoLecturasDTO } from "../dtos/lectura.dto";

// Las lecturas las inserta la función registrar_lecturas de la BD, que el
// ESP32 llama directo en Supabase. Este servicio solo las consulta.

const RANGO_POR_DEFECTO_MS = 10 * 60 * 1000;
const LIMITE_MAXIMO = 5000;
const MAX_AGRUPAR_S = 24 * 60 * 60;
// El ESP32 envía una lectura cada 5 s: se usa para estimar el tiempo con la válvula cerrada
const SEGUNDOS_POR_LECTURA = 5;

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

function numeroONull(valor: string | null) {
  return valor === null ? null : Number(valor);
}

export const LecturaService = {
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
      nivel_agua: f.nivel_agua === null ? null : Math.round(Number(f.nivel_agua)),
      fuga: f.fuga,
      valvula_abierta: f.valvula_abierta,
      led_estado: f.led_estado,
      led_brillo: f.led_brillo === null ? null : Math.round(Number(f.led_brillo)),
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
    const cerrada = Number(fila?.lecturas_valvula_cerrada ?? 0);

    return {
      desde,
      hasta,
      cantidad_lecturas: Number(fila?.cantidad ?? 0),
      caudal_promedio: Number(Number(fila?.caudal_promedio ?? 0).toFixed(3)),
      caudal_maximo: Number(Number(fila?.caudal_maximo ?? 0).toFixed(3)),
      litros_consumidos: Number(litros.toFixed(3)),
      nivel_agua_maximo: numeroONull(fila?.nivel_agua_maximo ?? null),
      lecturas_con_fuga: Number(fila?.lecturas_con_fuga ?? 0),
      minutos_valvula_cerrada: Math.round((cerrada * SEGUNDOS_POR_LECTURA) / 60),
    };
  },
};
