import { Request, Response } from "express";
import { AdminService } from "../services/admin.service";

export const AdminController = {
  async listarUsuarios(_req: Request, res: Response) {
    res.json(await AdminService.listarUsuarios());
  },

  async dispositivosDeUsuario(req: Request, res: Response) {
    res.json(await AdminService.dispositivosDeUsuario(Number(req.params.id)));
  },

  async cambiarActivo(req: Request, res: Response) {
    const usuario = await AdminService.cambiarActivo(
      req.cliente!.id_cliente,
      Number(req.params.id),
      req.body?.activo
    );
    res.json(usuario);
  },
};
