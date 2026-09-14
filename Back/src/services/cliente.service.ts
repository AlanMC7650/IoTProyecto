import { ClienteRepository } from "../repositories/cliente.repository";
import { AppError } from "../utils/AppError";

export const ClienteService = {
  async obtenerPorId(id_cliente: number) {
    if (!Number.isInteger(id_cliente) || id_cliente <= 0) {
      throw new AppError("id_cliente inválido", 400);
    }

    const cliente = await ClienteRepository.buscarPorId(id_cliente);
    if (!cliente) {
      throw new AppError("Cliente no encontrado", 404);
    }
    return cliente;
  },
};
