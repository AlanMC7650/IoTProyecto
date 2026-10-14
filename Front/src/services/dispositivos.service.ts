import { api } from "./api";
import type {
  ActualizarDispositivoPayload,
  Dispositivo,
  EstadoDispositivo,
  Evento,
  ModoValvula,
} from "../types/api";

export const DispositivosApi = {
  // codigo: los 6 caracteres que muestra el ESP32 mientras espera ser vinculado
  async vincular(codigo: string, nombre: string): Promise<Dispositivo> {
    const { data } = await api.post<Dispositivo>("/dispositivos/vincular", { codigo, nombre });
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

  async estado(id_dispositivo: number): Promise<EstadoDispositivo> {
    const { data } = await api.get<EstadoDispositivo>(`/dispositivos/${id_dispositivo}/estado`);
    return data;
  },

  async cambiarValvula(id_dispositivo: number, modo: ModoValvula): Promise<EstadoDispositivo> {
    const { data } = await api.post<EstadoDispositivo>(`/dispositivos/${id_dispositivo}/valvula`, { modo });
    return data;
  },

  async eventos(id_dispositivo: number, limite = 20): Promise<Evento[]> {
    const { data } = await api.get<Evento[]>(`/dispositivos/${id_dispositivo}/eventos`, { params: { limite } });
    return data;
  },

  async atenderFugas(id_dispositivo: number): Promise<EstadoDispositivo> {
    const { data } = await api.post<EstadoDispositivo>(`/dispositivos/${id_dispositivo}/eventos/atender-fugas`);
    return data;
  },

  async desvincular(id_dispositivo: number): Promise<void> {
    await api.delete(`/dispositivos/${id_dispositivo}`);
  },
};
