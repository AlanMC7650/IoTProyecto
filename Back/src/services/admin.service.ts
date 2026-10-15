import { AppDataSource } from "../config/data-source";
import { ClienteRepository } from "../repositories/cliente.repository";
import { DispositivoService } from "./dispositivo.service";
import { AppError } from "../utils/AppError";

interface FilaUsuario {
  id_cliente: number;
  nombre: string;
  identificador: string;
  email: string;
  rol: string;
  activo: boolean;
  fecha_registro: Date;
  dispositivos: string;
  ultima_conexion: Date | null;
}

export const AdminService = {
  // Usuarios registrados con cuántos dispositivos tienen y cuándo enviaron datos por última vez
  async listarUsuarios() {
    const filas: FilaUsuario[] = await AppDataSource.query(`
      SELECT c.id_cliente, c.nombre, c.identificador, c.email, c.rol, c.activo, c.fecha_registro,
             COUNT(d.id_dispositivo) AS dispositivos,
             MAX(d.ultima_conexion) AS ultima_conexion
        FROM cliente c
        LEFT JOIN dispositivo d ON d.id_cliente = c.id_cliente AND d.estado = 'vinculado'
       GROUP BY c.id_cliente
       ORDER BY c.fecha_registro DESC`);
    return filas.map((f) => ({ ...f, dispositivos: Number(f.dispositivos) }));
  },

  // Dispositivos de un usuario, para que el superadmin vea sus dashboards
  async dispositivosDeUsuario(id_cliente: number) {
    if (!Number.isInteger(id_cliente) || id_cliente <= 0) {
      throw new AppError("id de usuario inválido", 400);
    }
    const cliente = await ClienteRepository.buscarPorId(id_cliente);
    if (!cliente) {
      throw new AppError("Usuario no encontrado", 404);
    }
    return {
      usuario: { id_cliente: cliente.id_cliente, nombre: cliente.nombre, email: cliente.email },
      dispositivos: await DispositivoService.listar(id_cliente),
    };
  },

  async cambiarActivo(id_admin: number, id_cliente: number, activo: unknown) {
    if (!Number.isInteger(id_cliente) || id_cliente <= 0) {
      throw new AppError("id de usuario inválido", 400);
    }
    if (typeof activo !== "boolean") {
      throw new AppError("activo debe ser true o false", 400);
    }
    if (id_cliente === id_admin) {
      throw new AppError("No podés suspender tu propia cuenta", 400);
    }

    const cliente = await ClienteRepository.buscarPorId(id_cliente);
    if (!cliente) {
      throw new AppError("Usuario no encontrado", 404);
    }
    if (cliente.rol === "admin") {
      throw new AppError("No se puede suspender a otro administrador", 400);
    }

    await ClienteRepository.actualizar(id_cliente, { activo });
    return { ...cliente, activo };
  },
};
