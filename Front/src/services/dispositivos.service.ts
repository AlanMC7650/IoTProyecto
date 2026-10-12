import { api } from "./api";
import type {
  ActualizarDispositivoPayload,
  Dispositivo,
  DispositivoCreado,
} from "../types/api";

export const DispositivosApi = {
  async crear(nombre: string): Promise<DispositivoCreado> {
    const { data } = await api.post<DispositivoCreado>("/dispositivos", { nombre });
    return data;
  },

  async listar(): Promise<Dispositivo[]> {
    const { data } = await api.get<Dispositivo[]>("/dispositivos");
    return data;
  },

  async actualizar(
    id_dispositivo: number,
    payload: ActualizarDispositivoPayload
  ): Promise<Dispositivo> {
    const { data } = await api.patch<Dispositivo>(
      `/dispositivos/${id_dispositivo}`,
      payload
    );
    return data;
  },

  async regenerarClave(id_dispositivo: number): Promise<string> {
    const { data } = await api.post<{ api_key: string }>(
      `/dispositivos/${id_dispositivo}/regenerar-clave`
    );
    return data.api_key;
  },

  async eliminar(id_dispositivo: number): Promise<void> {
    await api.delete(`/dispositivos/${id_dispositivo}`);
  },
};
