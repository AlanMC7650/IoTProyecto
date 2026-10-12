import { DeepPartial } from "typeorm";
import { AppDataSource } from "../config/data-source";
import { LecturaCaudal } from "../entities/LecturaCaudal";

const repo = AppDataSource.getRepository(LecturaCaudal);

export const LecturaRepository = {
  guardarLote(filas: DeepPartial<LecturaCaudal>[]) {
    return repo.insert(filas);
  },

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

  // Reduce puntos para rangos largos: un punto por intervalo de `agrupar_s` segundos
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
      }>();
  },

  resumenPorRango(id_dispositivo: number, desde: Date, hasta: Date) {
    return repo
      .createQueryBuilder("l")
      .select("COUNT(*)", "cantidad")
      .addSelect("AVG(l.caudal_lmin)", "caudal_promedio")
      .addSelect("MAX(l.caudal_lmin)", "caudal_maximo")
      .addSelect("SUM(l.pulsos)", "pulsos")
      .where("l.id_dispositivo = :id_dispositivo", { id_dispositivo })
      .andWhere("l.fecha_medicion >= :desde", { desde })
      .andWhere("l.fecha_medicion <= :hasta", { hasta })
      .getRawOne<{
        cantidad: string;
        caudal_promedio: string | null;
        caudal_maximo: string | null;
        pulsos: string | null;
      }>();
  },
};
