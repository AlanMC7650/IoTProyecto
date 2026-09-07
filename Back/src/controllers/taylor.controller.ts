import { Request, Response } from "express";
import { TaylorService } from "../services/taylor.service";

export const TaylorController = {
  async generar(req: Request, res: Response) {
    const resultado = await TaylorService.generar(
      req.cliente!.id_cliente,
      req.body
    );
    res.status(201).json(resultado);
  },

  async listarMias(req: Request, res: Response) {
    const filas = await TaylorService.listarPorCliente(
      req.cliente!.id_cliente
    );
    res.json(filas);
  },

  async listarPorEjecucion(req: Request, res: Response) {
    const filas = await TaylorService.listarPorEjecucion(
      String(req.params.id_ejecucion),
      req.cliente!.id_cliente
    );
    res.json(filas);
  },

  async listarEjecuciones(req: Request, res: Response) {
    const ejecuciones = await TaylorService.listarEjecuciones(
      req.cliente!.id_cliente
    );
    res.json(ejecuciones);
  },
};
