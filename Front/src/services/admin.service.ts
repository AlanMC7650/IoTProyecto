import { api } from "./api";
import type { DispositivosDeUsuario, UsuarioAdmin } from "../types/api";

export const AdminApi = {
  async usuarios(): Promise<UsuarioAdmin[]> {
    const { data } = await api.get<UsuarioAdmin[]>("/admin/usuarios");
    return data;
  },

  async dispositivosDeUsuario(id_cliente: number): Promise<DispositivosDeUsuario> {
    const { data } = await api.get<DispositivosDeUsuario>(`/admin/usuarios/${id_cliente}/dispositivos`);
    return data;
  },

  async cambiarActivo(id_cliente: number, activo: boolean): Promise<void> {
    await api.patch(`/admin/usuarios/${id_cliente}`, { activo });
  },
};
