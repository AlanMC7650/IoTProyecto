// "hace 5 s", "hace 3 min", "hace 2 h", "hace 4 días"
export function haceCuanto(fecha: string | Date): string {
  const segundos = Math.max(0, Math.round((Date.now() - new Date(fecha).getTime()) / 1000));
  if (segundos < 60) return `hace ${segundos} s`;

  const minutos = Math.round(segundos / 60);
  if (minutos < 60) return `hace ${minutos} min`;

  const horas = Math.round(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;

  const dias = Math.round(horas / 24);
  return `hace ${dias} ${dias === 1 ? "día" : "días"}`;
}

// Valor para un <input type="datetime-local"> en hora local
export function aInputLocal(fecha: Date): string {
  const local = new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
