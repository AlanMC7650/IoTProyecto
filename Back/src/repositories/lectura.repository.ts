import { AppDataSource } from "../config/data-source";
import { LecturaCaudal } from "../entities/LecturaCaudal";

const repo = AppDataSource.getRepository(LecturaCaudal);

export const LecturaRepository = {
  ultimaPorDispositivo(id_dispositivo: number) {
    return repo.findOne({
      where: { dispositivo: { id_dispositivo } },
      order: { fecha_medicion: "DESC" },
    });
  },

  listarPorRango(
    id_dispositivo: number,
    desde: Date,
    hasta: Date,
    limite: number
  ) {
    return repo
      .createQueryBuilder("l")
      .where("l.id_dispositivo = :id_dispositivo", { id_dispositivo })
      .andWhere("l.fecha_medicion >= :desde", { desde })
      .andWhere("l.fecha_medicion <= :hasta", { hasta })
      .orderBy("l.fecha_medicion", "ASC")
      .limit(limite)
      .getMany();
  },

  // Reduce puntos para rangos largos: un punto por intervalo de `agrupar_s` segundos.
  // Válvula: abierta solo si estuvo abierta todo el intervalo. LED: el último estado.
  listarAgrupadoPorRango(
    id_dispositivo: number,
    desde: Date,
    hasta: Date,
    limite: number,
    agrupar_s: number
  ) {
    const intervalo =
      "to_timestamp(floor(extract(epoch from l.fecha_medicion) / :agrupar_s) * :agrupar_s)";

    return repo
      .createQueryBuilder("l")
      .select(intervalo, "fecha_medicion")
      .addSelect("AVG(l.caudal_lmin)", "caudal_lmin")
      .addSelect("MAX(l.volumen_l)", "volumen_l")
      .addSelect("SUM(l.pulsos)", "pulsos")
      .addSelect("AVG(l.nivel_agua)", "nivel_agua")
      .addSelect("BOOL_OR(l.fuga)", "fuga")
      .addSelect("BOOL_AND(l.valvula_abierta)", "valvula_abierta")
      .addSelect("(ARRAY_AGG(l.led_estado ORDER BY l.fecha_medicion DESC))[1]", "led_estado")
      .addSelect("AVG(l.led_brillo)", "led_brillo")
      .where("l.id_dispositivo = :id_dispositivo", { id_dispositivo })
      .andWhere("l.fecha_medicion >= :desde", { desde })
      .andWhere("l.fecha_medicion <= :hasta", { hasta })
      .setParameter("agrupar_s", agrupar_s)
      .groupBy(intervalo)
      .orderBy(intervalo, "ASC")
      .limit(limite)
      .getRawMany<{
        fecha_medicion: Date;
        caudal_lmin: string;
        volumen_l: string;
        pulsos: string;
        nivel_agua: string | null;
        fuga: boolean;
        valvula_abierta: boolean | null;
        led_estado: string | null;
        led_brillo: string | null;
      }>();
  },

  resumenPorRango(id_dispositivo: number, desde: Date, hasta: Date) {
    return repo
      .createQueryBuilder("l")
      .select("COUNT(*)", "cantidad")
      .addSelect("AVG(l.caudal_lmin)", "caudal_promedio")
      .addSelect("MAX(l.caudal_lmin)", "caudal_maximo")
      .addSelect("SUM(l.pulsos)", "pulsos")
      .addSelect("MAX(l.nivel_agua)", "nivel_agua_maximo")
      .addSelect("COUNT(*) FILTER (WHERE l.fuga)", "lecturas_con_fuga")
      .addSelect("COUNT(*) FILTER (WHERE l.valvula_abierta = false)", "lecturas_valvula_cerrada")
      .where("l.id_dispositivo = :id_dispositivo", { id_dispositivo })
      .andWhere("l.fecha_medicion >= :desde", { desde })
      .andWhere("l.fecha_medicion <= :hasta", { hasta })
      .getRawOne<{
        cantidad: string;
        caudal_promedio: string | null;
        caudal_maximo: string | null;
        pulsos: string | null;
        nivel_agua_maximo: string | null;
        lecturas_con_fuga: string;
        lecturas_valvula_cerrada: string;
      }>();
  },
};
