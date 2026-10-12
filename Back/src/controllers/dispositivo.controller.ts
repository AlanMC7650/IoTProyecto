import { Request, Response } from "express";
import { DispositivoService } from "../services/dispositivo.service";

export const DispositivoController = {
  async crear(req: Request, res: Response) {
    const resultado = await DispositivoService.crear(
      req.cliente!.id_cliente,
      req.body
    );
    res.status(201).json(resultado);
  },

  async listar(req: Request, res: Response) {
    const dispositivos = await DispositivoService.listar(
      req.cliente!.id_cliente
    );
    res.json(dispositivos);
  },

  async actualizar(req: Request, res: Response) {
    const dispositivo = await DispositivoService.actualizar(
      Number(req.params.id),
      req.cliente!.id_cliente,
      req.body
    );
    res.json(dispositivo);
  },

  async regenerarClave(req: Request, res: Response) {
    const resultado = await DispositivoService.regenerarClave(
      Number(req.params.id),
      req.cliente!.id_cliente
    );
    res.json(resultado);
  },

  async eliminar(req: Request, res: Response) {
    await DispositivoService.eliminar(
      Number(req.params.id),
      req.cliente!.id_cliente
    );
    res.status(204).send();
  },
};
