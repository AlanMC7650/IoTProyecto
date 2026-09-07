import { Request, Response } from "express";
import { AuthService } from "../services/auth.service";

export const AuthController = {
  async registrar(req: Request, res: Response) {
    const resultado = await AuthService.registrar(req.body);
    res.status(201).json(resultado);
  },

  async login(req: Request, res: Response) {
    const resultado = await AuthService.login(req.body);
    res.json(resultado);
  },
};
