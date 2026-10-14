import { AppDataSource } from "../config/data-source";
import { Evento, TipoEvento } from "../entities/Evento";

const repo = AppDataSource.getRepository(Evento);

export const EventoRepository = {
  listarPorDispositivo(id_dispositivo: number, limite: number) {
    return repo.find({
      where: { dispositivo: { id_dispositivo } },
      order: { fecha: "DESC" },
      take: limite,
    });
  },

  crear(id_dispositivo: number, tipo: TipoEvento, detalle: string) {
    return repo.save(repo.create({ dispositivo: { id_dispositivo }, tipo, detalle }));
  },

  // El usuario confirma que revisó la fuga: la válvula puede volver a abrirse
  async atenderFugas(id_dispositivo: number) {
    const resultado = await repo.update(
      { dispositivo: { id_dispositivo }, tipo: "FUGA", atendido: false },
      { atendido: true }
    );
    return resultado.affected ?? 0;
  },
};
