// Simula un ESP32 de AquaControl para probar sin hardware. Hace lo mismo que
// ESP32/main.py: se anuncia en Supabase con su MAC, muestra el código para
// vincularlo desde el dashboard y, una vez vinculado, arma cada 5 s una
// lectura con el caudal, el sensor de agua, la válvula y el LED y la envía
// (si un envío falla, queda en la cola para el siguiente).
//
// Uso:
//   npm run simular                    (MAC fija de prueba)
//   npm run simular -- --fuga          (simula agua en el piso al minuto de empezar)
//   npm run simular -- --mac 02:00:00:00:00:02
//
// Necesita en Back/.env:
//   SUPABASE_ANON_KEY  clave pública del proyecto (Supabase -> Project Settings -> API Keys)
//   SUPABASE_URL       opcional; si falta se arma con el id del proyecto que está en DB_USER

import "dotenv/config";
import fs from "fs";
import path from "path";

const args = process.argv.slice(2);
const posMac = args.indexOf("--mac");
const MAC = (posMac >= 0 && args[posMac + 1] ? args[posMac + 1] : "02:00:00:00:00:01").toUpperCase();
const SIMULAR_FUGA = args.includes("--fuga");

const proyecto = process.env.DB_USER?.split(".")[1];
const SUPABASE_URL = (process.env.SUPABASE_URL || (proyecto ? `https://${proyecto}.supabase.co` : "")).replace(/\/+$/, "");
const ANON = process.env.SUPABASE_ANON_KEY;

const FACTOR_K = 7.5;
const PULSOS_POR_LITRO = 450;
const INTERVALO_LECTURA_S = 5;   // como ESP32/main.py: una lectura cada 5 s
const INTERVALO_ENVIO_S = 5;     // que se envía apenas se arma
const MAX_COLA = 120;
const MAX_LOTE = 20;
const UMBRAL_FUGA = 1500;
const ARCHIVO = path.join(__dirname, "..", ".simulador.json");

if (!SUPABASE_URL || !ANON) {
  console.error("Falta SUPABASE_ANON_KEY (y SUPABASE_URL si DB_USER no es de Supabase) en Back/.env");
  process.exit(1);
}

// El token se guarda en un archivo, como el token.json del ESP32
function leerToken(): string | null {
  try {
    const datos = JSON.parse(fs.readFileSync(ARCHIVO, "utf8"));
    return datos[MAC] ?? null;
  } catch {
    return null;
  }
}

function guardarToken(token: string | null) {
  let datos: Record<string, string> = {};
  try { datos = JSON.parse(fs.readFileSync(ARCHIVO, "utf8")); } catch { /* primera vez */ }
  if (token) datos[MAC] = token; else delete datos[MAC];
  fs.writeFileSync(ARCHIVO, JSON.stringify(datos, null, 2));
}

async function rpc(funcion: string, cuerpo: unknown) {
  const respuesta = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${funcion}`, {
    method: "POST",
    headers: { apikey: ANON!, "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
  const texto = await respuesta.text();
  return { ok: respuesta.ok, status: respuesta.status, datos: texto ? JSON.parse(texto) : null };
}

let token = leerToken();
let segundos = 0;
let totalPulsos = 0;
let valvulaAbierta = false;
let fugaLocal = false;
let pulsosIntervalo = 0;
let nivel = 0;

// Caudal en L/min: una canilla que se abre y se cierra, con algo de ruido
function caudalDeseado(t: number): number {
  const ciclo = t % 90;
  if (ciclo >= 60) return 0;
  const base = 6 + 3 * Math.sin((t / 20) * Math.PI);
  return Math.max(0, base + (Math.random() - 0.5) * 0.8);
}

function nivelAgua(t: number): number {
  if (SIMULAR_FUGA && t >= 60 && t < 90) return 3000 + Math.round(Math.random() * 200);
  return 150 + Math.round(Math.random() * 60);
}

function led(caudal: number): { led_estado: string; led_brillo: number } {
  if (!token) return { led_estado: "vinculando", led_brillo: 100 };
  if (fugaLocal) return { led_estado: "fuga", led_brillo: 100 };
  if (caudal < 0.1) return { led_estado: "apagado", led_brillo: 0 };
  const brillo = Math.round(15 + 85 * Math.min(caudal / 8, 1));
  return { led_estado: caudal > 8 ? "rojo" : caudal > 4 ? "amarillo" : "verde", led_brillo: brillo };
}

interface LecturaEnCola {
  t: number;
  datos: Record<string, unknown>;
}

const cola: LecturaEnCola[] = [];
let enviando = false;

async function enviar() {
  if (enviando) return;
  enviando = true;
  try {
    if (!token) {
      const r = await rpc("anunciar_dispositivo", { p_mac: MAC });
      if (!r.ok) return console.log(`Anuncio rechazado (${r.status}):`, r.datos?.message ?? r.datos);
      if (r.datos.token) {
        token = r.datos.token;
        guardarToken(token);
        console.log(`Vinculado como "${r.datos.nombre}". Empiezo a enviar lecturas.`);
      } else if (r.datos.estado === "pendiente") {
        console.log(`Esperando vinculación. Código: ${r.datos.codigo}  (Agregar dispositivo en el dashboard)`);
      } else {
        console.log("El dispositivo figura vinculado pero este simulador no tiene su token: desvinculalo desde el dashboard.");
      }
      return;
    }
    if (cola.length === 0) return;

    // Toda la cola en un solo envío, como el ESP32: cada lectura dice hace cuánto se midió
    const lote = cola.slice(0, MAX_LOTE);
    const ahora = Date.now();
    const r = await rpc("registrar_lecturas", {
      p_token: token,
      p_lecturas: lote.map((l) => ({ ...l.datos, ms_atras: ahora - l.t })),
    });
    if (!r.ok) {
      const mensaje = String(r.datos?.message ?? "");
      console.log(`Envío rechazado (${r.status}): ${mensaje}`);
      if (mensaje.includes("token")) {
        token = null;
        guardarToken(null);
        cola.length = 0;
        console.log("Token inválido: vuelvo a anunciarme");
      }
      return;
    }
    cola.splice(0, lote.length);   // solo se borra lo que Supabase confirmó

    const estado = r.datos;
    // La fuga local se libera cuando el usuario la confirma en el dashboard y el piso está seco
    if (fugaLocal && estado.fugas_pendientes === 0 && nivel < UMBRAL_FUGA) fugaLocal = false;
    valvulaAbierta = !fugaLocal && estado.valvula === "abrir";
    const ultima = lote[lote.length - 1].datos;
    console.log(
      `Envío OK · ${lote.length} lecturas · ${ultima.caudal_lmin} L/min · agua ${ultima.nivel_agua} · LED ${ultima.led_estado} ${ultima.led_brillo}% · ` +
      `válvula ${valvulaAbierta ? "abierta" : `cerrada (${estado.motivo ?? "local"})`} · hoy ${estado.consumo_hoy_l} L`
    );
  } catch (error) {
    console.log(`Sin conexión con Supabase, se reintenta (${cola.length} en cola):`, (error as Error).message);
  } finally {
    enviando = false;
  }
}

function ciclo() {
  segundos++;
  // Con la válvula cerrada no pasa agua
  const pulsos = valvulaAbierta ? Math.round(caudalDeseado(segundos) * FACTOR_K) : 0;
  pulsosIntervalo += pulsos;
  totalPulsos += pulsos;
  nivel = nivelAgua(segundos);
  if (nivel >= UMBRAL_FUGA && !fugaLocal) {
    fugaLocal = true;
    valvulaAbierta = false;
    console.log("ALERTA: agua en el piso, se cierra la válvula");
  }

  // Lectura cada INTERVALO_LECTURA_S: se arma y se agrega a la cola
  if (token && segundos % INTERVALO_LECTURA_S === 0) {
    const caudal = pulsosIntervalo / INTERVALO_LECTURA_S / FACTOR_K;
    cola.push({
      t: Date.now(),
      datos: {
        caudal_lmin: Number(caudal.toFixed(3)),
        volumen_l: Number((totalPulsos / PULSOS_POR_LITRO).toFixed(3)),
        pulsos: pulsosIntervalo,
        nivel_agua: nivel,
        fuga: nivel >= UMBRAL_FUGA,
        valvula_abierta: valvulaAbierta,
        ...led(caudal),
      },
    });
    if (cola.length > MAX_COLA) cola.splice(0, cola.length - MAX_COLA);
  }
  if (segundos % INTERVALO_LECTURA_S === 0) pulsosIntervalo = 0;

  // Envío cada INTERVALO_ENVIO_S: la cola entera en un solo POST
  if (segundos % INTERVALO_ENVIO_S === 0) void enviar();
}

console.log(`Simulando ESP32 ${MAC} -> ${SUPABASE_URL} (Ctrl+C para cortar)`);
setInterval(ciclo, 1000);
