import { NextFunction, Request, Response } from "express";
import { Dispositivo } from "../entities/Dispositivo";
import { DispositivoRepository } from "../repositories/dispositivo.repository";
import { AppError } from "../utils/AppError";
import { hashApiKey } from "../utils/apiKey";

declare global {
  namespace Express {
    interface Request {
      dispositivo?: Dispositivo;
    }
  }
}

export async function deviceAuthMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  const apiKey = req.header("X-API-Key")?.trim();
  if (!apiKey) {
    throw new AppError("Clave API no provista", 401);
  }

  const dispositivo = await DispositivoRepository.buscarPorApiKeyHash(
    hashApiKey(apiKey)
  );
  if (!dispositivo) {
    throw new AppError("Clave API inválida", 401);
  }

  req.dispositivo = dispositivo;
  next();
}
