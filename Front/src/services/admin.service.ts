import { api } from "./api";
import type { UsuarioAdmin } from "../types/api";

export const AdminApi = {
  async usuarios(): Promise<UsuarioAdmin[]> {
    const { data } = await api.get<UsuarioAdmin[]>("/admin/usuarios");
    return data;
  },

  async cambiarActivo(id_cliente: number, activo: boolean): Promise<void> {
    await api.patch(`/admin/usuarios/${id_cliente}`, { activo });
  },
};
