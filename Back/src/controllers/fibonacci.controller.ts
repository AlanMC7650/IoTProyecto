import { Request, Response } from "express";
import { FibonacciService } from "../services/fibonacci.service";

export const FibonacciController = {
  async generar(req: Request, res: Response) {
    const resultado = await FibonacciService.generar(
      req.cliente!.id_cliente,
      req.body
    );
    res.status(201).json(resultado);
  },

  async listarMias(req: Request, res: Response) {
    const filas = await FibonacciService.listarPorCliente(
      req.cliente!.id_cliente
    );
    res.json(filas);
  },

  async listarPorEjecucion(req: Request, res: Response) {
    const filas = await FibonacciService.listarPorEjecucion(
      String(req.params.id_ejecucion),
      req.cliente!.id_cliente
    );
    res.json(filas);
  },

  async listarEjecuciones(req: Request, res: Response) {
    const ejecuciones = await FibonacciService.listarEjecuciones(
      req.cliente!.id_cliente
    );
    res.json(ejecuciones);
  },
};
