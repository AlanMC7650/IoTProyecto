import { Request, Response } from "express";
import { DispositivoService } from "../services/dispositivo.service";

export const DispositivoController = {
  async vincular(req: Request, res: Response) {
    const dispositivo = await DispositivoService.vincular(
      req.cliente!.id_cliente,
      req.body
    );
    res.status(201).json(dispositivo);
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

  async cambiarValvula(req: Request, res: Response) {
    const estado = await DispositivoService.cambiarValvula(
      Number(req.params.id),
      req.cliente!.id_cliente,
      req.body
    );
    res.json(estado);
  },

  async estado(req: Request, res: Response) {
    const estado = await DispositivoService.estado(
      Number(req.params.id),
      req.cliente!
    );
    res.json(estado);
  },

  async eventos(req: Request, res: Response) {
    const eventos = await DispositivoService.eventos(
      Number(req.params.id),
      req.cliente!,
      req.query.limite as string | undefined
    );
    res.json(eventos);
  },

  async atenderFugas(req: Request, res: Response) {
    const estado = await DispositivoService.atenderFugas(
      Number(req.params.id),
      req.cliente!.id_cliente
    );
    res.json(estado);
  },

  async desvincular(req: Request, res: Response) {
    await DispositivoService.desvincular(
      Number(req.params.id),
      req.cliente!.id_cliente
    );
    res.status(204).send();
  },
};
