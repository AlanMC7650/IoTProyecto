import { Request, Response } from "express";
import { LecturaService } from "../services/lectura.service";
import { RangoLecturasDTO } from "../dtos/lectura.dto";

export const LecturaController = {
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
