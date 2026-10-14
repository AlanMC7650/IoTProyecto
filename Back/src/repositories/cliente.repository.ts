import { AppDataSource } from "../config/data-source";
import { Cliente } from "../entities/Cliente";

const repo = AppDataSource.getRepository(Cliente);

export const ClienteRepository = {
  crear(data: Partial<Cliente>) {
    return repo.save(repo.create(data));
  },

  buscarPorId(id_cliente: number) {
    return repo.findOne({ where: { id_cliente } });
  },

  buscarPorIdentificador(identificador: string) {
    return repo.findOne({ where: { identificador } });
  },

  buscarPorEmail(email: string) {
    return repo.findOne({ where: { email } });
  },

  actualizar(id_cliente: number, data: Partial<Cliente>) {
    return repo.update({ id_cliente }, data);
  },

  buscarPorEmailConPassword(email: string) {
    return repo
      .createQueryBuilder("cliente")
      .addSelect("cliente.password_hash")
      .where("cliente.email = :email", { email })
      .getOne();
  },
};
