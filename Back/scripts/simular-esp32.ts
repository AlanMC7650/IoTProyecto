// Simula un ESP32 con el caudalímetro YF-S201: genera una lectura falsa por
// segundo y las envía en lote a POST /api/lecturas, igual que ESP32/main.py.
// Sirve para probar el Back y el Front sin hardware.
//
// Uso:
//   npm run simular -- <API_KEY> [SERVIDOR]
//   (o con variables de entorno API_KEY y SERVIDOR)

const API_KEY = process.argv[2] ?? process.env.API_KEY;
const SERVIDOR = (
  process.argv[3] ??
  process.env.SERVIDOR ??
  "http://localhost:3000"
).replace(/\/+$/, "");

const FACTOR_K = 7.5;
const PULSOS_POR_LITRO = 450;
const INTERVALO_ENVIO_S = 5;
const MAX_COLA = 600;
const MAX_LOTE = 100;

interface LecturaEnCola {
  t: number;
  caudal_lmin: number;
  volumen_l: number;
  pulsos: number;
}

if (!API_KEY) {
  console.error("Falta la clave API. Uso: npm run simular -- <API_KEY> [SERVIDOR]");
  process.exit(1);
}

const cola: LecturaEnCola[] = [];
let totalPulsos = 0;
let segundos = 0;
let enviando = false;

// Caudal objetivo en L/min: canilla que se abre y se cierra, con algo de ruido
function caudalSimulado(t: number): number {
  const ciclo = t % 90;
  if (ciclo >= 60) return 0;
  const base = 6 + 3 * Math.sin((t / 20) * Math.PI);
  return Math.max(0, base + (Math.random() - 0.5) * 0.8);
}

function medir() {
  segundos++;
  const pulsos = Math.round(caudalSimulado(segundos) * FACTOR_K);
  totalPulsos += pulsos;

  const caudal_lmin = pulsos / FACTOR_K;
  const volumen_l = totalPulsos / PULSOS_POR_LITRO;
  cola.push({ t: Date.now(), caudal_lmin, volumen_l, pulsos });
  if (cola.length > MAX_COLA) cola.splice(0, cola.length - MAX_COLA);

  console.log(
    "Caudal_Lmin:", caudal_lmin.toFixed(2),
    "Volumen_L:", volumen_l.toFixed(3)
  );

  if (segundos % INTERVALO_ENVIO_S === 0) void enviar();
}

async function enviar() {
  if (enviando) return;
  enviando = true;
  try {
    while (cola.length > 0) {
      const lote = cola.slice(0, MAX_LOTE);
      const ahora = Date.now();
      const respuesta = await fetch(`${SERVIDOR}/api/lecturas`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": API_KEY! },
        body: JSON.stringify({
          lecturas: lote.map((l) => ({
            caudal_lmin: Number(l.caudal_lmin.toFixed(3)),
            volumen_l: Number(l.volumen_l.toFixed(3)),
            pulsos: l.pulsos,
            ms_atras: ahora - l.t,
          })),
        }),
      });

      if (respuesta.status !== 201) {
        console.log(`Envío falló (${respuesta.status}): ${await respuesta.text()}`);
        return;
      }
      // Solo se saca de la cola lo que el servidor confirmó con 201
      cola.splice(0, lote.length);
      console.log(`Envío OK: ${lote.length} lecturas (quedan ${cola.length} en cola)`);
    }
  } catch (error) {
    console.log(`Envío falló, se reintenta en el próximo ciclo (${cola.length} en cola):`, (error as Error).message);
  } finally {
    enviando = false;
  }
}

console.log(`Simulando ESP32 -> ${SERVIDOR}/api/lecturas (Ctrl+C para cortar)`);
setInterval(medir, 1000);
