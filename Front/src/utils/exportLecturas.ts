import type { LecturaCaudal } from "../types/api";

function descargarArchivo(contenido: string, nombreArchivo: string, mimeType: string) {
  const blob = new Blob([contenido], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportarLecturasCsv(nombreDispositivo: string, lecturas: LecturaCaudal[]) {
  const encabezado =
    "fecha_medicion,caudal_lmin,volumen_l,pulsos,nivel_agua,fuga,valvula_abierta,led_estado,led_brillo";
  const filas = lecturas.map((l) =>
    [
      l.fecha_medicion, l.caudal_lmin, l.volumen_l, l.pulsos, l.nivel_agua ?? "",
      l.fuga, l.valvula_abierta ?? "", l.led_estado ?? "", l.led_brillo ?? "",
    ].join(",")
  );

  const nombreLimpio = nombreDispositivo.trim().replace(/[^\w-]+/g, "_") || "dispositivo";
  const fecha = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  descargarArchivo(
    [encabezado, ...filas].join("\n"),
    `aquacontrol-${nombreLimpio}-${fecha}.csv`,
    "text/csv"
  );
}
