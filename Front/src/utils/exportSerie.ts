import type { FilaSerie, TipoSerie } from "../types/api";

export type FormatoExport = "csv" | "json" | "txt";

interface Columna {
  encabezado: string;
  valor: (f: FilaSerie) => string;
}

function columnasPara(tipo: TipoSerie): Columna[] {
  const columnas: Columna[] = [{ encabezado: "iteracion", valor: (f) => String(f.iteracion) }];

  if (tipo === "taylor") {
    columnas.push(
      { encabezado: "funcion", valor: (f) => f.funcion ?? "" },
      { encabezado: "x", valor: (f) => f.x_valor ?? "" }
    );
  }
  if (tipo === "fibonacci") {
    columnas.push({ encabezado: "fibonacci_n", valor: (f) => f.fibonacci_n ?? "" });
  }

  columnas.push(
    { encabezado: "valor_calculado", valor: (f) => f.valor_calculado },
    { encabezado: "valor_real", valor: (f) => f.valor_real },
    { encabezado: "error", valor: (f) => f.error }
  );

  return columnas;
}

function descargarArchivo(contenido: string, nombreArchivo: string, mimeType: string) {
  const blob = new Blob([contenido], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportarEjecucion(
  tipo: TipoSerie,
  id_ejecucion: string,
  filas: FilaSerie[],
  formato: FormatoExport
) {
  const columnas = columnasPara(tipo);
  const nombreBase = `${tipo}-${id_ejecucion.slice(0, 8)}`;

  if (formato === "json") {
    const filasLimpias = filas.map((f) => ({
      ...Object.fromEntries(columnas.map((c) => [c.encabezado, c.valor(f)])),
      iteracion: f.iteracion,
    }));
    const contenido = JSON.stringify({ tipo, id_ejecucion, filas: filasLimpias }, null, 2);
    descargarArchivo(contenido, `${nombreBase}.json`, "application/json");
    return;
  }

  if (formato === "csv") {
    const encabezado = columnas.map((c) => c.encabezado).join(",");
    const filasTexto = filas.map((f) => columnas.map((c) => c.valor(f)).join(","));
    descargarArchivo([encabezado, ...filasTexto].join("\n"), `${nombreBase}.csv`, "text/csv");
    return;
  }

  const encabezado = columnas.map((c) => c.encabezado).join("\t");
  const filasTexto = filas.map((f) => columnas.map((c) => c.valor(f)).join("\t"));
  const contenido = [
    `Serie: ${tipo}`,
    `Ejecución: ${id_ejecucion}`,
    `Filas: ${filas.length}`,
    "",
    encabezado,
    ...filasTexto,
  ].join("\n");
  descargarArchivo(contenido, `${nombreBase}.txt`, "text/plain");
}
