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
// Canal propio para comprobar que la escucha sigue viva (ver revisarConexion)
const CANAL_CONTROL = "aquacontrol_control";
const REINTENTO_MS = 5000;
const LATIDO_MS = 20_000;
const REVISION_MS = 30_000;
const ESPERA_CONTROL_MS = 10_000;

const suscriptores = new Map<number, Set<Response>>();
let cliente: Client | null = null;
let controlPendiente: (() => void) | null = null;

function enviar(res: Response, evento: string, datos: unknown) {
  res.write(`event: ${evento}\ndata: ${JSON.stringify(datos)}\n\n`);
}

async function conectar() {
  // keepAlive: el sistema operativo detecta antes una conexión muerta
  const nuevo = new Client({ ...opcionesConexion(), keepAlive: true });
  nuevo.on("notification", (mensaje) => {
    if (mensaje.channel === CANAL_CONTROL) {
      controlPendiente?.();
      return;
    }
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
    await nuevo.query(`LISTEN ${CANAL_CONTROL}`);
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

// La red o el pooler de Supabase pueden cerrar la conexión de escucha sin
// avisar: no hay evento de error, simplemente dejan de llegar los avisos y el
// dashboard ya no se actualiza solo. Cada 30 s se manda un aviso a uno mismo
// por un canal de control; si no vuelve en 10 s, se reconecta.
async function revisarConexion() {
  const actual = cliente;
  if (!actual || controlPendiente) return;

  const volvio = new Promise<boolean>((resolver) => {
    const timer = setTimeout(() => resolver(false), ESPERA_CONTROL_MS);
    controlPendiente = () => {
      clearTimeout(timer);
      resolver(true);
    };
  });

  try {
    await actual.query(`SELECT pg_notify('${CANAL_CONTROL}', '')`);
  } catch {
    // Si la consulta falla, la espera de abajo termina en false
  }
  const ok = await volvio;
  controlPendiente = null;
  if (!ok && cliente === actual) {
    console.error("La escucha de lecturas en tiempo real dejó de responder: reconectando");
    reconectar(actual);
  }
}

export const RealtimeService = {
  iniciar() {
    void conectar();
    setInterval(() => void revisarConexion(), REVISION_MS).unref();
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
