import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { EstadoDispositivo, LecturaCaudal, ModoValvula, ResumenCaudal } from "../types/api";
import type { PuntoLectura } from "./charts/ejeTiempo";
import { SerieTiempoChart } from "./charts/SerieTiempoChart";
import { COLOR_AGUA, COLOR_CAUDAL, COLOR_LED, COLOR_UMBRAL, COLOR_VALVULA } from "./charts/palette";
import { aguaPct, UMBRAL_FUGA_PCT } from "../utils/agua";


const TEXTO_LED: Record<string, string> = {
  apagado: "Apagado",
  verde: "Verde",
  amarillo: "Amarillo",
  rojo: "Rojo",
  limite: "Rojo (respiración)",
  fuga: "Rojo / azul parpadeando",
  vinculando: "Azul parpadeando",
};

const SIGNIFICADO_LED: Record<string, string> = {
  apagado: "No está pasando agua",
  verde: "Caudal bajo (hasta 4 L/min)",
  amarillo: "Caudal medio (4 a 8 L/min)",
  rojo: "Caudal alto: pasa mucha agua",
  limite: "Se alcanzó el límite diario",
  fuga: "Hay agua en el piso",
  vinculando: "Esperando que lo vinculen",
};

const TEXTO_MOTIVO: Record<string, string> = {
  fuga: "Cerrada por una fuga sin confirmar",
  manual: "Cerrada manualmente desde el dashboard",
  limite: "Cerrada: se alcanzó el límite diario",
};

interface Comun {
  ultima: LecturaCaudal | null;
  enVivo: boolean;
  puntos: PuntoLectura[];
  sinDatos: ReactNode;
}

function Grafica({ puntos, sinDatos, children }: { puntos: PuntoLectura[]; sinDatos: ReactNode; children: ReactNode }) {
  return <div className="panel-grafica">{puntos.length === 0 ? <p className="muted">{sinDatos}</p> : children}</div>;
}

// --- Sensor de flujo YF-S201 ----------------------------------------------

export function PanelFlujo({
  ultima, enVivo, puntos, sinDatos, estado, resumen, onGuardarLimite,
}: Comun & {
  estado: EstadoDispositivo | null;
  resumen: ResumenCaudal | null;
  // Sin esta función el panel es de solo lectura (superadmin mirando a otro usuario)
  onGuardarLimite?: (litros: number | null) => Promise<void>;
}) {
  const [editando, setEditando] = useState(false);
  const [limite, setLimite] = useState("");
  const limiteActual = estado?.limite_diario_l ?? null;
  const consumo = estado?.consumo_hoy_l ?? 0;
  const porcentaje = limiteActual ? Math.min(100, (consumo / limiteActual) * 100) : 0;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await onGuardarLimite?.(limite.trim() === "" ? null : Number(limite));
    setEditando(false);
  }

  return (
    <section className="panel-componente">
      <header>
        <h3>Sensor de flujo YF-S201</h3>
        <p>Caudal y consumo del día</p>
      </header>
      <div className="panel-indicadores">
        <div className="valor-grande" style={{ color: COLOR_CAUDAL }}>
          {enVivo && ultima ? Number(ultima.caudal_lmin).toFixed(1) : "—"} <small>L/min</small>
        </div>
        <div className="panel-limite">
          <span>
            Hoy: <strong>{consumo.toFixed(1)} L</strong>
            {limiteActual ? ` de ${limiteActual} L` : " · sin límite diario"}
          </span>
          {limiteActual !== null && (
            <div className="barra"><div style={{ width: `${porcentaje}%`, background: porcentaje >= 100 ? COLOR_UMBRAL : COLOR_CAUDAL }} /></div>
          )}
          {!onGuardarLimite ? null : editando ? (
            <form className="limite-form" onSubmit={onSubmit}>
              <input type="number" min={0.1} step="any" value={limite} onChange={(e) => setLimite(e.target.value)} placeholder="Litros (vacío = sin límite)" autoFocus />
              <button type="submit">Guardar</button>
              <button type="button" className="btn-link" onClick={() => setEditando(false)}>Cancelar</button>
            </form>
          ) : (
            <button type="button" className="btn-link" onClick={() => { setLimite(limiteActual ? String(limiteActual) : ""); setEditando(true); }}>
              {limiteActual ? "Cambiar límite diario" : "Definir límite diario"}
            </button>
          )}
        </div>
      </div>
      <p className="panel-detalle">
        {resumen
          ? `En el rango: ${resumen.litros_consumidos.toFixed(1)} L · máximo ${resumen.caudal_maximo.toFixed(1)} L/min`
          : " "}
        {ultima && ` · Volumen desde que se encendió: ${Number(ultima.volumen_l).toFixed(1)} L`}
      </p>
      <Grafica puntos={puntos} sinDatos={sinDatos}>
        <SerieTiempoChart puntos={puntos} campo="caudal" tipo="area" color={COLOR_CAUDAL} unidad="L/min" />
      </Grafica>
    </section>
  );
}

// --- Sensor de agua T1592 --------------------------------------------------

export function PanelAgua({
  ultima, enVivo, puntos, sinDatos, estado, onConfirmarFuga,
}: Comun & { estado: EstadoDispositivo | null; onConfirmarFuga?: () => Promise<void> }) {
  const pct = enVivo ? aguaPct(ultima?.nivel_agua) : null;
  const pendientes = estado?.fugas_pendientes ?? 0;
  const mojado = pct !== null && pct >= UMBRAL_FUGA_PCT;
  const texto = pct === null ? "Sin datos" : mojado ? "FUGA" : pct > 10 ? "HÚMEDO" : "SECO";
  const color = pct === null ? "var(--text-muted)" : mojado ? COLOR_UMBRAL : pct > 10 ? "#F4A300" : "#2CA02C";

  return (
    <section className="panel-componente">
      <header>
        <h3>Sensor de agua T1592</h3>
        <p>Detección de agua en el piso, bajo la instalación</p>
      </header>
      <div className="panel-indicadores">
        <div className="medidor" style={{ ["--pct" as string]: `${pct ?? 0}`, ["--color" as string]: color }}>
          <div className="medidor-arco" />
          <div className="medidor-umbral" style={{ transform: `rotate(${(UMBRAL_FUGA_PCT / 100) * 180 - 90}deg)` }} />
          <strong>{pct === null ? "—" : `${pct} %`}</strong>
        </div>
        <div>
          <div className="estado-texto" style={{ color }}>{texto}</div>
          <span className="panel-detalle">Umbral de fuga: {UMBRAL_FUGA_PCT} %</span>
          {pendientes > 0 && (
            <div className="alerta-fuga">
              <span>Fuga sin confirmar: la válvula sigue cerrada.</span>
              {onConfirmarFuga && <button type="button" onClick={onConfirmarFuga}>Ya revisé la fuga</button>}
            </div>
          )}
        </div>
      </div>
      <Grafica puntos={puntos} sinDatos={sinDatos}>
        <SerieTiempoChart
          puntos={puntos} campo="agua" tipo="area" color={COLOR_AGUA} unidad="%" dominioY={[0, 100]}
          umbral={{ valor: UMBRAL_FUGA_PCT, etiqueta: "umbral de fuga", color: COLOR_UMBRAL }}
          formatoValor={(v) => `${Math.round(v)} % mojado`}
        />
      </Grafica>
    </section>
  );
}

// --- Electroválvula --------------------------------------------------------

export function PanelValvula({
  ultima, enVivo, puntos, sinDatos, estado, resumen, onModo,
}: Comun & {
  estado: EstadoDispositivo | null;
  resumen: ResumenCaudal | null;
  onModo?: (modo: ModoValvula) => Promise<void>;
}) {
  // Lo que reportó el ESP32 en su última lectura; si no está en línea, lo que debería hacer
  const abierta = enVivo && ultima?.valvula_abierta !== null && ultima?.valvula_abierta !== undefined
    ? ultima.valvula_abierta
    : estado ? estado.valvula === "abrir" : null;
  const modo = estado?.modo ?? "auto";
  const motivo = estado?.motivo ? TEXTO_MOTIVO[estado.motivo] : abierta === false ? "Cerrada por el ESP32 (fuga detectada localmente)" : null;
  // La orden ya está guardada pero el ESP32 todavía no la aplicó (la recibe en su próximo envío)
  const esperandoEsp32 = enVivo && estado !== null && abierta !== null && (
    (estado.valvula === "cerrar" && abierta) || (estado.valvula === "abrir" && !abierta && !ultima?.fuga)
  );

  return (
    <section className="panel-componente">
      <header>
        <h3>Electroválvula <span className="etiqueta-actuador">actuador</span></h3>
        <p>Estado, control y historial</p>
      </header>
      <div className="panel-indicadores">
        <div className={`pastilla ${abierta === null ? "" : abierta ? "abierta" : "cerrada"}`}>
          {abierta === null ? "SIN DATOS" : abierta ? "ABIERTA" : "CERRADA"}
        </div>
        <div className="valvula-info">
          <span className="panel-detalle">{motivo ?? (modo === "abierta" ? "Abierta manualmente" : "Modo automático")}</span>
          {onModo && <div className="botones-modo">
            {(["abierta", "cerrada", "auto"] as ModoValvula[]).map((m) => (
              <button key={m} type="button" className={m === modo ? "activa" : ""} onClick={() => onModo(m)}>
                {m === "abierta" ? "Abrir" : m === "cerrada" ? "Cerrar" : "Automático"}
              </button>
            ))}
          </div>}
        </div>
      </div>
      <p className="panel-detalle">
        {resumen ? `En el rango estuvo cerrada ${resumen.minutos_valvula_cerrada} min` : " "}
        {esperandoEsp32 && ` · Orden enviada: ${estado?.valvula}. El ESP32 la aplica en su próximo envío (unos 5 s)`}
        {!enVivo && " · La orden llega al ESP32 cuando vuelva a conectarse"}
      </p>
      <Grafica puntos={puntos} sinDatos={sinDatos}>
        <SerieTiempoChart
          puntos={puntos} campo="valvula" tipo="escalon" color={COLOR_VALVULA} unidad="" dominioY={[0, 1]}
          formatoValor={(v) => (v >= 0.5 ? "abierta" : "cerrada")}
        />
      </Grafica>
    </section>
  );
}

// --- LED RGB ---------------------------------------------------------------

export function PanelLed({ ultima, enVivo, puntos, sinDatos }: Comun) {
  const estadoLed = enVivo ? ultima?.led_estado ?? "apagado" : "apagado";
  const brillo = enVivo ? ultima?.led_brillo ?? 0 : 0;
  const color = COLOR_LED[estadoLed] ?? COLOR_LED.apagado;
  const parpadea = estadoLed === "fuga" || estadoLed === "vinculando" || estadoLed === "limite";

  return (
    <section className="panel-componente">
      <header>
        <h3>LED RGB <span className="etiqueta-actuador">actuador</span></h3>
        <p>Gemelo digital: el mismo color y brillo que el LED físico</p>
      </header>
      <div className="panel-indicadores">
        <div
          className={`led-virtual ${parpadea ? "parpadea" : ""} ${estadoLed === "fuga" ? "fuga" : ""}`}
          style={{ ["--color" as string]: color, ["--brillo" as string]: `${Math.max(brillo, estadoLed === "apagado" ? 0 : 20) / 100}` }}
        />
        <div>
          <div className="estado-texto" style={{ color: estadoLed === "apagado" ? "var(--text-muted)" : color }}>
            {enVivo ? `${TEXTO_LED[estadoLed] ?? estadoLed} · ${brillo} %` : "Sin datos"}
          </div>
          <span className="panel-detalle">{enVivo ? SIGNIFICADO_LED[estadoLed] : "El dispositivo no está enviando datos"}</span>
          <div className="leyenda-led">
            {(["verde", "amarillo", "rojo", "fuga"] as const).map((e) => (
              <span key={e}><i style={{ background: COLOR_LED[e] }} />{e === "fuga" ? "fuga" : e}</span>
            ))}
          </div>
        </div>
      </div>
      <Grafica puntos={puntos} sinDatos={sinDatos}>
        <SerieTiempoChart
          puntos={puntos} campo="ledBrillo" tipo="barras" color={COLOR_LED.verde} unidad="%" dominioY={[0, 100]}
          formatoValor={(v) => `${Math.round(v)} % de brillo`}
        />
      </Grafica>
    </section>
  );
}
