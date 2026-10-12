import { api } from "./api";
import type { LecturaCaudal, RangoLecturas, ResumenCaudal } from "../types/api";

const LIMITE_MAXIMO = 5000;

export const LecturasApi = {
  async ultima(id_dispositivo: number): Promise<LecturaCaudal | null> {
    const { data } = await api.get<LecturaCaudal | null>(
      `/dispositivos/${id_dispositivo}/ultima`
    );
    return data;
  },

  async listar(id_dispositivo: number, rango: RangoLecturas = {}): Promise<LecturaCaudal[]> {
    const { data } = await api.get<LecturaCaudal[]>(
      `/dispositivos/${id_dispositivo}/lecturas`,
      { params: rango }
    );
    return data;
  },

  // Trae todas las lecturas sin agrupar del rango, paginando de a LIMITE_MAXIMO
  // (el Back no devuelve más que eso por pedido). Se usa para exportar.
  async listarTodas(id_dispositivo: number, desde: string, hasta: string): Promise<LecturaCaudal[]> {
    const todas: LecturaCaudal[] = [];
    let cursor = desde;

    for (;;) {
      const pagina = await this.listar(id_dispositivo, {
        desde: cursor,
        hasta,
        limite: LIMITE_MAXIMO,
      });
      todas.push(...pagina);
      if (pagina.length < LIMITE_MAXIMO) return todas;

      const ultima = new Date(pagina[pagina.length - 1].fecha_medicion).getTime();
      cursor = new Date(ultima + 1).toISOString();
    }
  },

  async resumen(id_dispositivo: number, rango: RangoLecturas = {}): Promise<ResumenCaudal> {
    const { data } = await api.get<ResumenCaudal>(
      `/dispositivos/${id_dispositivo}/resumen`,
      { params: rango }
    );
    return data;
  },
};
