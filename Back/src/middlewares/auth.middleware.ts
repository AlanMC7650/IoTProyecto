import { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/AppError";
import { TokenPayload, verificarToken } from "../utils/jwt";

declare global {
  namespace Express {
    interface Request {
      cliente?: TokenPayload;
    }
  }
}

export function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new AppError("Token no provisto", 401);
  }

  const token = header.slice("Bearer ".length);
  try {
    req.cliente = verificarToken(token);
  } catch {
    throw new AppError("Token inválido o expirado", 401);
  }

  next();
}
