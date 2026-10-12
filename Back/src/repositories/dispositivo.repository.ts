import { AppDataSource } from "../config/data-source";
import { Dispositivo } from "../entities/Dispositivo";

const repo = AppDataSource.getRepository(Dispositivo);

export const DispositivoRepository = {
  crear(id_cliente: number, nombre: string, api_key_hash: string) {
    return repo.save(
      repo.create({ cliente: { id_cliente }, nombre, api_key_hash })
    );
  },

  listarPorCliente(id_cliente: number) {
    return repo.find({
      where: { cliente: { id_cliente } },
      order: { id_dispositivo: "ASC" },
    });
  },

  buscarPorIdYCliente(id_dispositivo: number, id_cliente: number) {
    return repo.findOne({
      where: { id_dispositivo, cliente: { id_cliente } },
    });
  },

  buscarPorApiKeyHash(api_key_hash: string) {
    return repo.findOne({ where: { api_key_hash } });
  },

  actualizar(id_dispositivo: number, data: Partial<Dispositivo>) {
    return repo.update({ id_dispositivo }, data);
  },

  marcarConexion(id_dispositivo: number) {
    return repo.update({ id_dispositivo }, { ultima_conexion: new Date() });
  },

  eliminar(id_dispositivo: number) {
    return repo.delete({ id_dispositivo });
  },
};
