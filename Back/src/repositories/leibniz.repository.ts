import { DeepPartial } from "typeorm";
import { AppDataSource } from "../config/data-source";
import { SerieLeibniz } from "../entities/SerieLeibniz";

const repo = AppDataSource.getRepository(SerieLeibniz);

export const LeibnizRepository = {
  guardarLote(filas: DeepPartial<SerieLeibniz>[]) {
    return repo.save(filas);
  },

  listarPorCliente(id_cliente: number) {
    return repo.find({
      where: { cliente: { id_cliente } },
      order: { id_ejecucion: "ASC", iteracion: "ASC" },
    });
  },

  listarPorEjecucion(id_ejecucion: string, id_cliente: number) {
    return repo.find({
      where: { id_ejecucion, cliente: { id_cliente } },
      order: { iteracion: "ASC" },
    });
  },

  listarEjecucionesPorCliente(id_cliente: number) {
    return repo
      .createQueryBuilder("s")
      .select("s.id_ejecucion", "id_ejecucion")
      .addSelect("MIN(s.fecha_generacion)", "fecha_generacion")
      .addSelect("COUNT(*)", "cantidad_iteraciones")
      .where("s.id_cliente = :id_cliente", { id_cliente })
      .groupBy("s.id_ejecucion")
      .orderBy("fecha_generacion", "DESC")
      .getRawMany();
  },

  eliminarPorEjecucion(id_ejecucion: string, id_cliente: number) {
    return repo.delete({ id_ejecucion, cliente: { id_cliente } });
  },
};
