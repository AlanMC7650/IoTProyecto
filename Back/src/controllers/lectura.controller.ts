import { Request, Response } from "express";
import { LecturaService } from "../services/lectura.service";
import { RangoLecturasDTO } from "../dtos/lectura.dto";

export const LecturaController = {
  // Lo llama el ESP32 (autenticado con X-API-Key)
  async registrar(req: Request, res: Response) {
    const resultado = await LecturaService.registrar(
      req.dispositivo!,
      req.body
    );
    res.status(201).json(resultado);
  },

  async ultima(req: Request, res: Response) {
    const lectura = await LecturaService.ultima(
      Number(req.params.id),
      req.cliente!.id_cliente
    );
    res.json(lectura);
  },

  async listar(req: Request, res: Response) {
    const lecturas = await LecturaService.listar(
      Number(req.params.id),
      req.cliente!.id_cliente,
      req.query as RangoLecturasDTO
    );
    res.json(lecturas);
  },

  async resumen(req: Request, res: Response) {
    const resumen = await LecturaService.resumen(
      Number(req.params.id),
      req.cliente!.id_cliente,
      req.query as RangoLecturasDTO
    );
    res.json(resumen);
  },
};
