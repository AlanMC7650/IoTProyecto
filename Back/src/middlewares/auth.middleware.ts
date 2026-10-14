import { NextFunction, Request, Response } from "express";
import { ClienteRepository } from "../repositories/cliente.repository";
import { AppError } from "../utils/AppError";
import { TokenPayload, verificarToken } from "../utils/jwt";

declare global {
  namespace Express {
    interface Request {
      cliente?: TokenPayload;
    }
  }
}

export async function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new AppError("Token no provisto", 401);
  }

  let payload: TokenPayload;
  try {
    payload = verificarToken(header.slice("Bearer ".length));
  } catch {
    throw new AppError("Token inválido o expirado", 401);
  }

  // El rol y el estado se leen de la BD en cada petición: si el superadmin
  // suspende una cuenta, deja de funcionar aunque su token no haya vencido.
  const cliente = await ClienteRepository.buscarPorId(payload.id_cliente);
  if (!cliente) {
    throw new AppError("Token inválido o expirado", 401);
  }
  if (!cliente.activo) {
    throw new AppError("Tu cuenta está suspendida", 403);
  }

  req.cliente = {
    id_cliente: cliente.id_cliente,
    identificador: cliente.identificador,
    rol: cliente.rol,
  };
  next();
}

// Va después de authMiddleware
export function soloAdmin(req: Request, _res: Response, next: NextFunction) {
  if (req.cliente?.rol !== "admin") {
    throw new AppError("Acceso denegado: se necesita el rol de administrador", 403);
  }
  next();
}
