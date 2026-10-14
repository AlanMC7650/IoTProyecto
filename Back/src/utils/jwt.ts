import jwt from "jsonwebtoken";
import { Rol } from "../entities/Cliente";

export interface TokenPayload {
  id_cliente: number;
  identificador: string;
  rol: Rol;
}

const JWT_SECRET = process.env.JWT_SECRET as string;
const JWT_EXPIRES_IN = "8h";

export function firmarToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verificarToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}
