import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { DispositivosApi } from "../services/dispositivos.service";
import { LecturasApi } from "../services/lecturas.service";
import { mensajeError } from "../services/errors";
import type { Dispositivo, LecturaCaudal, ResumenCaudal } from "../types/api";
import { CaudalChart } from "./charts/CaudalChart";
import { VolumenChart } from "./charts/VolumenChart";
import type { PuntoCaudal } from "./charts/ejeTiempo";
import { ClaveApi } from "./ClaveApi";
import { exportarLecturasCsv } from "../utils/exportLecturas";
import { aInputLocal, haceCuanto } from "../utils/tiempo";

type RangoId = "5m" | "1h" | "24h" | "personalizado";

const RANGOS: { id: Exclude<RangoId, "personalizado">; label: string; ms: number }[] = [
  { id: "5m", label: "5 min", ms: 5 * 60 * 1000 },
  { id: "1h", label: "1 h", ms: 60 * 60 * 1000 },
  { id: "24h", label: "24 h", ms: 24 * 60 * 60 * 1000 },
];

const POLL_MS = 2500;
// Cada tantos ciclos se vuelve a pedir el rango entero en vez de solo lo nuevo:
// así aparecen las lecturas que el ESP32 tenía en cola y llegan con hora vieja.
const CICLOS_RECARGA_COMPLETA = 12;

// Hasta 10 minutos se dibuja cada lectura (una por segundo). En rangos más
// largos el Back promedia por intervalos para no dibujar miles de puntos.
const SIN_AGRUPAR_HASTA_MS = 10 * 60 * 1000;
const MAX_PUNTOS = 800;
const INTERVALOS_S = [5, 10, 30, 60, 120, 300, 600, 1800, 3600, 7200, 21600, 86400];

function intervaloPara(duracionMs: number): number | undefined {
  if (duracionMs <= SIN_AGRUPAR_HASTA_MS) return undefined;
  const segundos = duracionMs / 1000;
  return INTERVALOS_S.find((i) => segundos / i <= MAX_PUNTOS) ?? INTERVALOS_S[INTERVALOS_S.length - 1];
}

function aPunto(lectura: LecturaCaudal): PuntoCaudal {
  return {
    t: new Date(lectura.fecha_medicion).getTime(),
    caudal: Number(lectura.caudal_lmin),
    volumen: Number(lectura.volumen_l),
  };
}

interface Props {
  dispositivo: Dispositivo;
  onActualizado: (dispositivo: Dispositivo) => void;
  onEliminado: (id_dispositivo: number) => void;
}

export function DispositivoDashboard({ dispositivo, onActualizado, onEliminado }: Props) {
  const { id_dispositivo } = dispositivo;

  const [rangoId, setRangoId] = useState<RangoId>("5m");
  const [desdeInput, setDesdeInput] = useState(() => aInputLocal(new Date(Date.now() - 60 * 60 * 1000)));
  const [hastaInput, setHastaInput] = useState(() => aInputLocal(new Date()));
  const [personalizado, setPersonalizado] = useState<{ desde: string; hasta: string } | null>(null);

  const [puntos, setPuntos] = useState<PuntoCaudal[]>([]);
  const [ultima, setUltima] = useState<LecturaCaudal | null>(null);
  const [resumen, setResumen] = useState<ResumenCaudal | null>(null);
  const [cargando, setCargando] = useState(true);
  const [exportando, setExportando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mostrarConfig, setMostrarConfig] = useState(false);
  const [nombre, setNombre] = useState(dispositivo.nombre);
  const [pulsosPorLitro, setPulsosPorLitro] = useState(String(Number(dispositivo.pulsos_por_litro)));
  const [guardando, setGuardando] = useState(false);
  const [claveNueva, setClaveNueva] = useState<string | null>(null);

  const rangoVivo = RANGOS.find((r) => r.id === rangoId);

  // Rango a consultar. En los rangos "en vivo" se recalcula en cada llamada.
  function ventanaActual(): { desde: Date; hasta: Date | null } | null {
    if (rangoVivo) return { desde: new Date(Date.now() - rangoVivo.ms), hasta: null };
    if (!personalizado) return null;
    return { desde: new Date(personalizado.desde), hasta: new Date(personalizado.hasta) };
  }

  useEffect(() => {
    let cancelado = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ciclos = 0;
    let ultimaT: number | null = null;
    let rangoFijoCargado = false;

    setPuntos([]);
    setResumen(null);
    setError(null);
    setCargando(true);

    async function ciclo() {
      try {
        const ventana = ventanaActual();
        const pedirLecturas = !!ventana && (ventana.hasta === null || !rangoFijoCargado);

        if (!ventana || !pedirLecturas) {
          const ult = await LecturasApi.ultima(id_dispositivo);
          if (cancelado) return;
          setUltima(ult);
        } else {
          const duracion = (ventana.hasta?.getTime() ?? Date.now()) - ventana.desde.getTime();
          const agrupar_s = intervaloPara(duracion);
          const completa = ultimaT === null || ciclos % CICLOS_RECARGA_COMPLETA === 0;
          const hasta = ventana.hasta?.toISOString();

          const [ult, lecturas, res] = await Promise.all([
            LecturasApi.ultima(id_dispositivo),
            LecturasApi.listar(id_dispositivo, {
              // Solo lo nuevo desde la última fecha recibida (salvo en la recarga completa)
              desde: (completa ? ventana.desde : new Date(ultimaT!)).toISOString(),
              hasta,
              agrupar_s,
            }),
            LecturasApi.resumen(id_dispositivo, { desde: ventana.desde.toISOString(), hasta }),
          ]);
          if (cancelado) return;

          const nuevos = lecturas.map(aPunto);
          const minimo = ventana.desde.getTime() - (agrupar_s ?? 0) * 1000;
          setPuntos((prev) => {
            if (completa) return nuevos;
            const corte = nuevos.length > 0 ? nuevos[0].t : Infinity;
            return [...prev.filter((p) => p.t >= minimo && p.t < corte), ...nuevos];
          });
          if (nuevos.length > 0) ultimaT = nuevos[nuevos.length - 1].t;

          setUltima(ult);
          setResumen(res);
          rangoFijoCargado = true;
        }
        setError(null);
      } catch (err) {
        if (cancelado) return;
        setError(mensajeError(err, "No se pudieron cargar las lecturas"));
      } finally {
        if (!cancelado) {
          ciclos++;
          setCargando(false);
          timer = setTimeout(ciclo, POLL_MS);
        }
      }
    }

    ciclo();
    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id_dispositivo, rangoId, personalizado]);

  function onAplicarPersonalizado(e: FormEvent) {
    e.preventDefault();
    const desde = new Date(desdeInput);
    const hasta = new Date(hastaInput);
    if (Number.isNaN(desde.getTime()) || Number.isNaN(hasta.getTime()) || desde >= hasta) {
      setError("El rango personalizado necesita una fecha “desde” anterior a “hasta”");
      return;
    }
    setPersonalizado({ desde: desde.toISOString(), hasta: hasta.toISOString() });
  }

  async function onExportar() {
    const ventana = ventanaActual();
    if (!ventana) return;

    setExportando(true);
    setError(null);
    try {
      const lecturas = await LecturasApi.listarTodas(
        id_dispositivo,
        ventana.desde.toISOString(),
        (ventana.hasta ?? new Date()).toISOString()
      );
      if (lecturas.length === 0) {
        setError("No hay lecturas en el rango para exportar");
        return;
      }
      exportarLecturasCsv(dispositivo.nombre, lecturas);
    } catch (err) {
      setError(mensajeError(err, "No se pudieron exportar las lecturas"));
    } finally {
      setExportando(false);
    }
  }

  async function onGuardar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    try {
      const actualizado = await DispositivosApi.actualizar(id_dispositivo, {
        nombre,
        pulsos_por_litro: Number(pulsosPorLitro),
      });
      onActualizado(actualizado);
    } catch (err) {
      setError(mensajeError(err, "No se pudo guardar el dispositivo"));
    } finally {
      setGuardando(false);
    }
  }

  async function onRegenerarClave() {
    if (!window.confirm("¿Regenerar la clave API? La clave actual deja de funcionar y vas a tener que actualizar el config.py del ESP32.")) return;

    setError(null);
    try {
      setClaveNueva(await DispositivosApi.regenerarClave(id_dispositivo));
    } catch (err) {
      setError(mensajeError(err, "No se pudo regenerar la clave"));
    }
  }

  async function onEliminar() {
    if (!window.confirm(`¿Eliminar “${dispositivo.nombre}” y todas sus lecturas? Esta acción no se puede deshacer.`)) return;

    setError(null);
    try {
      await DispositivosApi.eliminar(id_dispositivo);
      onEliminado(id_dispositivo);
    } catch (err) {
      setError(mensajeError(err, "No se pudo eliminar el dispositivo"));
    }
  }

  const enVivo = dispositivo.en_linea && ultima !== null;
  const faltaRango = rangoId === "personalizado" && !personalizado;

  return (
    <section className="serie-dashboard">
      <header className="dispositivo-header">
        <div>
          <h2>{dispositivo.nombre}</h2>
          <p className="serie-descripcion">Caudalímetro YF-S201 · {Number(dispositivo.pulsos_por_litro)} pulsos por litro</p>
        </div>
        <button type="button" className="btn-secundario" onClick={() => setMostrarConfig((v) => !v)}>
          {mostrarConfig ? "Cerrar configuración" : "Configuración"}
        </button>
      </header>

      {mostrarConfig && (
        <div className="panel">
          <form className="generar-form" onSubmit={onGuardar}>
            <label>
              Nombre
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={100} required />
            </label>
            <label>
              Pulsos por litro
              <input
                type="number"
                min={0.001}
                step="any"
                value={pulsosPorLitro}
                onChange={(e) => setPulsosPorLitro(e.target.value)}
                required
              />
            </label>
            <button type="submit" disabled={guardando}>{guardando ? "Guardando..." : "Guardar cambios"}</button>
          </form>

          {claveNueva && <ClaveApi apiKey={claveNueva} />}

          <div className="panel-acciones">
            <button type="button" className="btn-secundario" onClick={onRegenerarClave}>Regenerar clave API</button>
            <button type="button" className="btn-peligro" onClick={onEliminar}>Eliminar dispositivo</button>
          </div>
        </div>
      )}

      {error && <p className="auth-error">{error}</p>}

      <div className="tarjetas">
        <div className="tarjeta">
          <span className="tarjeta-titulo">Caudal actual</span>
          <strong>{enVivo ? Number(ultima.caudal_lmin).toFixed(2) : "—"} <small>L/min</small></strong>
          <span className="tarjeta-detalle">
            {enVivo
              ? "Lectura en vivo"
              : ultima
                ? `Última lectura: ${Number(ultima.caudal_lmin).toFixed(2)} L/min, ${haceCuanto(ultima.fecha_medicion)}`
                : "Sin lecturas todavía"}
          </span>
        </div>
        <div className="tarjeta">
          <span className="tarjeta-titulo">Volumen acumulado</span>
          <strong>{ultima ? Number(ultima.volumen_l).toFixed(3) : "—"} <small>L</small></strong>
          <span className="tarjeta-detalle">Desde que se encendió el ESP32</span>
        </div>
        <div className="tarjeta">
          <span className="tarjeta-titulo">Consumo en el rango</span>
          <strong>{resumen ? resumen.litros_consumidos.toFixed(3) : "—"} <small>L</small></strong>
          <span className="tarjeta-detalle">
            {resumen
              ? `Promedio ${resumen.caudal_promedio.toFixed(2)} · máximo ${resumen.caudal_maximo.toFixed(2)} L/min`
              : "Elegí un rango"}
          </span>
        </div>
        <div className="tarjeta">
          <span className="tarjeta-titulo">Estado</span>
          <strong className="tarjeta-estado">
            <span className={`punto-estado ${dispositivo.en_linea ? "en-linea" : ""}`} />
            {dispositivo.en_linea ? "En línea" : "Desconectado"}
          </strong>
          <span className="tarjeta-detalle">
            {dispositivo.ultima_conexion
              ? `Último envío ${haceCuanto(dispositivo.ultima_conexion)}`
              : "Todavía no envió datos"}
          </span>
        </div>
      </div>

      <div className="serie-charts">
        <div className="exportar-bar">
          <span>Rango:</span>
          {RANGOS.map((r) => (
            <button
              key={r.id}
              type="button"
              className={r.id === rangoId ? "activa" : ""}
              onClick={() => setRangoId(r.id)}
            >
              {r.label}
            </button>
          ))}
          <button
            type="button"
            className={rangoId === "personalizado" ? "activa" : ""}
            onClick={() => setRangoId("personalizado")}
          >
            Personalizado
          </button>
          <button
            type="button"
            className="exportar-csv"
            disabled={exportando || faltaRango}
            onClick={onExportar}
          >
            {exportando ? "Exportando..." : "Exportar CSV"}
          </button>
        </div>

        {rangoId === "personalizado" && (
          <form className="generar-form rango-form" onSubmit={onAplicarPersonalizado}>
            <label>
              Desde
              <input type="datetime-local" value={desdeInput} onChange={(e) => setDesdeInput(e.target.value)} required />
            </label>
            <label>
              Hasta
              <input type="datetime-local" value={hastaInput} onChange={(e) => setHastaInput(e.target.value)} required />
            </label>
            <button type="submit">Ver rango</button>
          </form>
        )}

        {faltaRango ? (
          <p className="muted">Elegí las fechas y tocá “Ver rango”.</p>
        ) : cargando ? (
          <p className="muted">Cargando...</p>
        ) : puntos.length === 0 ? (
          <p className="muted">
            No hay lecturas en este rango.
            {!dispositivo.ultima_conexion && " Cuando el ESP32 empiece a enviar datos, la gráfica se actualiza sola."}
          </p>
        ) : (
          <>
            <div className="chart-block">
              <h4 className="chart-title">Caudal en el tiempo</h4>
              <p className="chart-subtitle">
                {rangoVivo ? "Litros por minuto, se actualiza solo cada pocos segundos" : "Litros por minuto en el rango elegido"}
              </p>
              <CaudalChart puntos={puntos} />
            </div>
            <div className="chart-block">
              <h4 className="chart-title">Volumen acumulado</h4>
              <p className="chart-subtitle">Litros contados por el ESP32 (vuelve a 0 si se reinicia)</p>
              <VolumenChart puntos={puntos} />
            </div>
          </>
        )}
      </div>
    </section>
  );
}
