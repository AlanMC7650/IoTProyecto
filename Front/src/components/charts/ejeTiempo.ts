export interface PuntoCaudal {
  // Fecha de la medición en milisegundos (epoch)
  t: number;
  caudal: number | null;
  volumen: number | null;
}

const UN_DIA_MS = 24 * 60 * 60 * 1000;
const HUECO_MINIMO_MS = 10_000;

// Si entre dos puntos pasó mucho más tiempo que lo habitual (el dispositivo
// estuvo desconectado) se intercala un punto vacío para que la línea se corte
// en vez de unir los dos extremos como si hubiera habido lecturas.
export function conCortes(puntos: PuntoCaudal[]): PuntoCaudal[] {
  if (puntos.length < 3) return puntos;

  const pasos = puntos.slice(1).map((p, i) => p.t - puntos[i].t).sort((a, b) => a - b);
  const pasoHabitual = pasos[Math.floor(pasos.length / 2)];
  const hueco = Math.max(pasoHabitual * 4, HUECO_MINIMO_MS);

  const resultado: PuntoCaudal[] = [];
  puntos.forEach((p, i) => {
    if (i > 0 && p.t - puntos[i - 1].t > hueco) {
      resultado.push({ t: (p.t + puntos[i - 1].t) / 2, caudal: null, volumen: null });
    }
    resultado.push(p);
  });
  return resultado;
}

// Formato de las marcas del eje X según cuánto tiempo abarcan los datos
export function formatoEje(puntos: PuntoCaudal[]): (t: number) => string {
  const duracion = puntos.length > 1 ? puntos[puntos.length - 1].t - puntos[0].t : 0;

  if (duracion > UN_DIA_MS) {
    return (t) =>
      new Date(t).toLocaleString([], { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  }
  if (duracion > 15 * 60 * 1000) {
    return (t) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return (t) => new Date(t).toLocaleTimeString();
}

export function etiquetaTooltip(t: unknown): string {
  return new Date(Number(t)).toLocaleString();
}
