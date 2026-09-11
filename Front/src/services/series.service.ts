import { api } from "./api";
import type {
  EjecucionResumen,
  FilaSerie,
  GenerarPayload,
  GenerarResultado,
  TipoSerie,
} from "../types/api";

interface FilaCruda extends Omit<FilaSerie, "valor_calculado"> {
  valor_calculado?: string;
  razon_calculada?: string;
}

function normalizarFila(fila: FilaCruda): FilaSerie {
  return {
    ...fila,
    valor_calculado: fila.valor_calculado ?? fila.razon_calculada ?? "0",
  };
}

export const SeriesApi = {
  async generar(tipo: TipoSerie, payload: GenerarPayload): Promise<GenerarResultado> {
    const { data } = await api.post<{
      id_ejecucion: string;
      iteraciones: number;
      funcion?: GenerarResultado["funcion"];
      x?: number;
      filas: FilaCruda[];
    }>(`/series/${tipo}/generar`, payload);
    return { ...data, filas: data.filas.map(normalizarFila) };
  },

  async listarMias(tipo: TipoSerie): Promise<FilaSerie[]> {
    const { data } = await api.get<FilaCruda[]>(`/series/${tipo}/mias`);
    return data.map(normalizarFila);
  },

  async listarEjecuciones(tipo: TipoSerie): Promise<EjecucionResumen[]> {
    const { data } = await api.get<EjecucionResumen[]>(
      `/series/${tipo}/mias/ejecuciones`
    );
    return data;
  },

  async listarPorEjecucion(tipo: TipoSerie, id_ejecucion: string): Promise<FilaSerie[]> {
    const { data } = await api.get<FilaCruda[]>(
      `/series/${tipo}/ejecucion/${id_ejecucion}`
    );
    return data.map(normalizarFila);
  },

  async eliminarEjecucion(tipo: TipoSerie, id_ejecucion: string): Promise<void> {
    await api.delete(`/series/${tipo}/ejecucion/${id_ejecucion}`);
  },
};
