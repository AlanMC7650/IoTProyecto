// Mismo umbral que ESP32/main.py (1500 de 4095)
export const UMBRAL_FUGA_PCT = Math.round((1500 / 4095) * 100);

// Lectura del T1592 (0 a 4095) en % de la escala: 0 seco, 100 totalmente mojado
export function aguaPct(nivel: number | null | undefined): number | null {
  return nivel === null || nivel === undefined ? null : Math.round((nivel / 4095) * 100);
}
