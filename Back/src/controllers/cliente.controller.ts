import { Request, Response } from "express";
import { ClienteService } from "../services/cliente.service";

export const ClienteController = {
  async obtenerPerfil(req: Request, res: Response) {
    const cliente = await ClienteService.obtenerPorId(req.cliente!.id_cliente);
    res.json(cliente);
  },
};
