import { AppDataSource } from "../config/data-source";
import { Dispositivo } from "../entities/Dispositivo";
import { Evento } from "../entities/Evento";
import { LecturaCaudal } from "../entities/LecturaCaudal";

const repo = AppDataSource.getRepository(Dispositivo);

export interface EstadoDispositivoBD {
  valvula: "abrir" | "cerrar";
  motivo: "fuga" | "manual" | "limite" | null;
  modo: string;
  limite_diario_l: number | null;
  consumo_hoy_l: number;
  fugas_pendientes: number;
}

export const DispositivoRepository = {
  listarPorCliente(id_cliente: number) {
    return repo.find({
      where: { cliente: { id_cliente }, estado: "vinculado" },
      order: { id_dispositivo: "ASC" },
    });
  },

  buscarPorIdYCliente(id_dispositivo: number, id_cliente: number) {
    return repo.findOne({
      where: { id_dispositivo, cliente: { id_cliente }, estado: "vinculado" },
    });
  },

  // Para el superadmin: cualquier dispositivo vinculado, sea de quien sea
  buscarVinculadoPorId(id_dispositivo: number) {
    return repo.findOne({ where: { id_dispositivo, estado: "vinculado" } });
  },

  // Dispositivo que se anunció hace poco y todavía no tiene dueño
  buscarPendientePorCodigo(codigo: string, anunciadoDesde: Date) {
    return repo
      .createQueryBuilder("d")
      .where("d.codigo_vinculo = :codigo", { codigo })
      .andWhere("d.estado = 'pendiente'")
      .andWhere("d.ultimo_anuncio >= :desde", { desde: anunciadoDesde })
      .getOne();
  },

  // Solo se vincula si sigue pendiente (evita que dos usuarios lo tomen a la vez)
  async vincular(id_dispositivo: number, id_cliente: number, nombre: string) {
    const resultado = await repo
      .createQueryBuilder()
      .update(Dispositivo)
      .set({ estado: "vinculado", cliente: { id_cliente }, nombre })
      .where("id_dispositivo = :id_dispositivo", { id_dispositivo })
      .andWhere("estado = 'pendiente'")
      .execute();
    return (resultado.affected ?? 0) > 0;
  },

  actualizar(id_dispositivo: number, data: Partial<Dispositivo>) {
    return repo.update({ id_dispositivo }, data);
  },

  // Vuelve a pendiente: el token deja de servir y se borran sus datos para
  // que el próximo dueño no vea el historial del anterior
  desvincular(id_dispositivo: number) {
    return AppDataSource.transaction(async (m) => {
      await m.delete(LecturaCaudal, { dispositivo: { id_dispositivo } });
      await m.delete(Evento, { dispositivo: { id_dispositivo } });
      await m.update(Dispositivo, { id_dispositivo }, {
        estado: "pendiente",
        cliente: null,
        nombre: null,
        token_hash: null,
        limite_diario_l: null,
        valvula_modo: "auto",
        ultima_conexion: null,
      });
    });
  },

  async estado(id_dispositivo: number): Promise<EstadoDispositivoBD> {
    const [fila] = await AppDataSource.query(
      "SELECT estado_dispositivo($1) AS estado",
      [id_dispositivo]
    );
    return fila.estado;
  },
};
