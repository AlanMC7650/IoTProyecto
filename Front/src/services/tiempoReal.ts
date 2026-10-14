import { api } from "./api";
import type { MensajeTiempoReal } from "../types/api";

const REINTENTO_MS = 5000;

interface Opciones {
  onLectura: (mensaje: MensajeTiempoReal) => void;
  // Se llama al conectar (y al reconectar): conviene recargar el rango para
  // traer lo que llegó mientras la conexión estuvo cortada
  onConectado: () => void;
  onDesconectado: () => void;
}

// Abre el canal Server-Sent Events del Back (GET /api/stream). Se usa fetch y no
// EventSource porque EventSource no permite mandar la cabecera Authorization.
// Devuelve una función para cerrarlo.
export function escucharDispositivo(id_dispositivo: number, opciones: Opciones): () => void {
  let cerrado = false;
  let controlador: AbortController | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function conectar() {
    controlador = new AbortController();
    try {
      const token = localStorage.getItem("token");
      const base = api.defaults.baseURL ?? "/api";
      const respuesta = await fetch(`${base}/stream?dispositivo=${id_dispositivo}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "text/event-stream",
          "ngrok-skip-browser-warning": "1",
        },
        signal: controlador.signal,
      });
      if (!respuesta.ok || !respuesta.body) throw new Error(`HTTP ${respuesta.status}`);

      opciones.onConectado();
      const lector = respuesta.body.pipeThrough(new TextDecoderStream()).getReader();
      let pendiente = "";
      for (;;) {
        const { value, done } = await lector.read();
        if (done) break;
        pendiente += value;
        // Los mensajes SSE terminan con una línea en blanco
        let fin: number;
        while ((fin = pendiente.indexOf("\n\n")) >= 0) {
          const bloque = pendiente.slice(0, fin);
          pendiente = pendiente.slice(fin + 2);
          procesar(bloque);
        }
      }
    } catch {
      // Abortado por el usuario o conexión caída: se reintenta abajo
    }
    if (cerrado) return;
    opciones.onDesconectado();
    timer = setTimeout(conectar, REINTENTO_MS);
  }

  function procesar(bloque: string) {
    let evento = "message";
    const datos: string[] = [];
    for (const linea of bloque.split("\n")) {
      if (linea.startsWith("event:")) evento = linea.slice(6).trim();
      else if (linea.startsWith("data:")) datos.push(linea.slice(5).trim());
    }
    if (evento === "lectura" && datos.length > 0) {
      opciones.onLectura(JSON.parse(datos.join("\n")) as MensajeTiempoReal);
    }
  }

  void conectar();
  return () => {
    cerrado = true;
    clearTimeout(timer);
    controlador?.abort();
  };
}
