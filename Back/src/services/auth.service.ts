import bcrypt from "bcrypt";
import { ClienteRepository } from "../repositories/cliente.repository";
import { AppError } from "../utils/AppError";
import { firmarToken } from "../utils/jwt";
import { LoginDTO, RegistroDTO } from "../dtos/auth.dto";
import { Cliente } from "../entities/Cliente";

const SALT_ROUNDS = 10;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sinPassword(cliente: Cliente) {
  const { password_hash, ...resto } = cliente;
  return resto;
}

export const AuthService = {
  async registrar(data: RegistroDTO) {
    if (
      !data?.nombre?.trim() ||
      !data?.identificador?.trim() ||
      !data?.email?.trim() ||
      !data?.password
    ) {
      throw new AppError(
        "nombre, identificador, email y password son obligatorios",
        400
      );
    }

    const email = data.email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(email)) {
      throw new AppError("email inválido", 400);
    }

    if (data.password.length < 6) {
      throw new AppError("password debe tener al menos 6 caracteres", 400);
    }

    const identificador = data.identificador.trim();

    const [porIdentificador, porEmail] = await Promise.all([
      ClienteRepository.buscarPorIdentificador(identificador),
      ClienteRepository.buscarPorEmail(email),
    ]);
    if (porIdentificador) {
      throw new AppError("Ya existe un cliente con ese identificador", 409);
    }
    if (porEmail) {
      throw new AppError("Ya existe un cliente con ese email", 409);
    }

    const password_hash = await bcrypt.hash(data.password, SALT_ROUNDS);
    const cliente = await ClienteRepository.crear({
      nombre: data.nombre.trim(),
      identificador,
      email,
      password_hash,
    });

    const token = firmarToken({
      id_cliente: cliente.id_cliente,
      identificador: cliente.identificador,
    });

    return { cliente: sinPassword(cliente), token };
  },

  async login(data: LoginDTO) {
    if (!data?.email?.trim() || !data?.password) {
      throw new AppError("email y password son obligatorios", 400);
    }

    const email = data.email.trim().toLowerCase();
    const cliente = await ClienteRepository.buscarPorEmailConPassword(email);
    if (!cliente) {
      throw new AppError("Credenciales inválidas", 401);
    }

    const passwordValida = await bcrypt.compare(
      data.password,
      cliente.password_hash
    );
    if (!passwordValida) {
      throw new AppError("Credenciales inválidas", 401);
    }

    const token = firmarToken({
      id_cliente: cliente.id_cliente,
      identificador: cliente.identificador,
    });

    return { cliente: sinPassword(cliente), token };
  },
};
