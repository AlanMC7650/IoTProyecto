import { Request, Response } from "express";
import { LeibnizService } from "../services/leibniz.service";

export const LeibnizController = {
  async generar(req: Request, res: Response) {
    const resultado = await LeibnizService.generar(
      req.cliente!.id_cliente,
      req.body
    );
    res.status(201).json(resultado);
  },

  async listarMias(req: Request, res: Response) {
    const filas = await LeibnizService.listarPorCliente(
      req.cliente!.id_cliente
    );
    res.json(filas);
  },

  async listarPorEjecucion(req: Request, res: Response) {
    const filas = await LeibnizService.listarPorEjecucion(
      String(req.params.id_ejecucion),
      req.cliente!.id_cliente
    );
    res.json(filas);
  },

  async listarEjecuciones(req: Request, res: Response) {
    const ejecuciones = await LeibnizService.listarEjecuciones(
      req.cliente!.id_cliente
    );
    res.json(ejecuciones);
  },
};
