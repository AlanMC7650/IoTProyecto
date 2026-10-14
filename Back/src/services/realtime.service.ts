import { Client } from "pg";
import { Response } from "express";
import { opcionesConexion } from "../config/data-source";

// Tiempo real: la función registrar_lecturas de la BD hace
// pg_notify('nueva_lectura', ...) cada vez que el ESP32 envía datos. Acá se
// escucha ese canal con una conexión propia y se reenvía cada aviso, por
// Server-Sent Events, a los navegadores que miran ese dispositivo.
// Cada pestaña abierta es una sola petición HTTP, lo que importa con ngrok
// (el plan gratuito permite 20 000 peticiones por mes).

const CANAL = "nueva_lectura";
const REINTENTO_MS = 5000;
const LATIDO_MS = 20_000;

const suscriptores = new Map<number, Set<Response>>();
let cliente: Client | null = null;

function enviar(res: Response, evento: string, datos: unknown) {
  res.write(`event: ${evento}\ndata: ${JSON.stringify(datos)}\n\n`);
}

async function conectar() {
  const nuevo = new Client(opcionesConexion());
  nuevo.on("notification", (mensaje) => {
    if (mensaje.channel !== CANAL || !mensaje.payload) return;
    try {
      const datos = JSON.parse(mensaje.payload) as { id_dispositivo: number };
      for (const res of suscriptores.get(datos.id_dispositivo) ?? []) {
        enviar(res, "lectura", datos);
      }
    } catch (error) {
      console.error("Aviso de lectura con formato inesperado:", error);
    }
  });
  nuevo.on("error", (error) => {
    console.error("Se cortó la escucha de lecturas en tiempo real:", error.message);
    reconectar(nuevo);
  });
  nuevo.on("end", () => reconectar(nuevo));

  try {
    await nuevo.connect();
    await nuevo.query(`LISTEN ${CANAL}`);
    cliente = nuevo;
    console.log("Escuchando lecturas en tiempo real (LISTEN nueva_lectura)");
  } catch (error) {
    console.error("No se pudo escuchar lecturas en tiempo real:", (error as Error).message);
    reconectar(nuevo);
  }
}

function reconectar(anterior: Client) {
  if (cliente !== anterior && cliente !== null) return;
  cliente = null;
  anterior.removeAllListeners();
  anterior.end().catch(() => undefined);
  setTimeout(conectar, REINTENTO_MS);
}

export const RealtimeService = {
  iniciar() {
    void conectar();
    // Comentario SSE periódico: mantiene viva la conexión a través de ngrok y proxies
    setInterval(() => {
      for (const conjunto of suscriptores.values()) {
        for (const res of conjunto) res.write(": latido\n\n");
      }
    }, LATIDO_MS).unref();
  },

  suscribir(id_dispositivo: number, res: Response) {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    enviar(res, "conectado", { id_dispositivo });

    const conjunto = suscriptores.get(id_dispositivo) ?? new Set<Response>();
    conjunto.add(res);
    suscriptores.set(id_dispositivo, conjunto);

    res.on("close", () => {
      conjunto.delete(res);
      if (conjunto.size === 0) suscriptores.delete(id_dispositivo);
    });
  },
};
