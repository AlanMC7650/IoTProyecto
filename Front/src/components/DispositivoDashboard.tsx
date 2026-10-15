import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { DispositivosApi } from "../services/dispositivos.service";
import { LecturasApi } from "../services/lecturas.service";
import { escucharDispositivo } from "../services/tiempoReal";
import { mensajeError } from "../services/errors";
import type {
  Dispositivo,
  EstadoDispositivo,
  Evento,
  LecturaCaudal,
  ModoValvula,
  ResumenCaudal,
} from "../types/api";
import type { PuntoLectura } from "./charts/ejeTiempo";
import { PanelAgua, PanelFlujo, PanelLed, PanelValvula } from "./PanelesComponentes";
import { aguaPct } from "../utils/agua";
import { exportarLecturasCsv } from "../utils/exportLecturas";
import { aInputLocal, haceCuanto } from "../utils/tiempo";

type RangoId = "10m" | "1h" | "24h" | "personalizado";

const RANGOS: { id: Exclude<RangoId, "personalizado">; label: string; ms: number }[] = [
  { id: "10m", label: "10 min", ms: 10 * 60 * 1000 },
  { id: "1h", label: "1 h", ms: 60 * 60 * 1000 },
  { id: "24h", label: "24 h", ms: 24 * 60 * 60 * 1000 },
];

// El ESP32 mide cada 2 s pero manda su cola cada ~6 s, y un envío (o dos) puede
// fallar: en línea si la última lectura tiene menos de 30 s
const MS_EN_LINEA = 30_000;
// Resumen y eventos se refrescan cada minuto (cada pedido pasa por ngrok)
const REFRESCO_RESUMEN_MS = 60_000;
// Segundos entre lecturas del ESP32, para sumar el tiempo con la válvula cerrada
const SEGUNDOS_POR_LECTURA = 2;
// El sensor de agua T1592 todavía no está instalado: su panel queda oculto.
// Poner en true cuando se conecte.
const MOSTRAR_SENSOR_AGUA = false;

// Suma una lectura del tiempo real al resumen del rango, así se actualiza al
// instante sin pedirle nada al Back. Cada minuto se vuelve a pedir el resumen
// exacto, que además descuenta las lecturas que salieron del rango.
function sumarLectura(r: ResumenCaudal, l: LecturaCaudal, pulsosPorLitro: number): ResumenCaudal {
  const caudal = Number(l.caudal_lmin);
  const cantidad = r.cantidad_lecturas + 1;
  const segundos_cerrada = r.segundos_valvula_cerrada + (l.valvula_abierta === false ? SEGUNDOS_POR_LECTURA : 0);
  return {
    ...r,
    cantidad_lecturas: cantidad,
    caudal_promedio: (r.caudal_promedio * r.cantidad_lecturas + caudal) / cantidad,
    caudal_maximo: Math.max(r.caudal_maximo, caudal),
    litros_consumidos: r.litros_consumidos + Number(l.pulsos) / pulsosPorLitro,
    nivel_agua_maximo: l.nivel_agua === null ? r.nivel_agua_maximo : Math.max(r.nivel_agua_maximo ?? 0, l.nivel_agua),
    lecturas_con_fuga: r.lecturas_con_fuga + (l.fuga ? 1 : 0),
    segundos_valvula_cerrada: segundos_cerrada,
    minutos_valvula_cerrada: Math.round(segundos_cerrada / 60),
  };
}

// Hasta 15 minutos se dibuja cada lectura (una cada 2 s). En rangos más
// largos el Back promedia por intervalos para no dibujar miles de puntos.
const SIN_AGRUPAR_HASTA_MS = 15 * 60 * 1000;
const MAX_PUNTOS = 450;
const INTERVALOS_S = [5, 10, 30, 60, 120, 300, 600, 1800, 3600, 7200, 21600, 86400];

const TEXTO_EVENTO: Record<Evento["tipo"], string> = {
  FUGA: "Fuga",
  LIMITE: "Límite",
  FLUJO_CONTINUO: "Flujo continuo",
  VALVULA: "Válvula",
};

function intervaloPara(duracionMs: number): number | undefined {
  if (duracionMs <= SIN_AGRUPAR_HASTA_MS) return undefined;
  const segundos = duracionMs / 1000;
  return INTERVALOS_S.find((i) => segundos / i <= MAX_PUNTOS) ?? INTERVALOS_S[INTERVALOS_S.length - 1];
}

function aPunto(l: LecturaCaudal): PuntoLectura {
  return {
    t: new Date(l.fecha_medicion).getTime(),
    caudal: Number(l.caudal_lmin),
    volumen: Number(l.volumen_l),
    agua: aguaPct(l.nivel_agua),
    valvula: l.valvula_abierta === null ? null : l.valvula_abierta ? 1 : 0,
    ledBrillo: l.led_brillo,
    ledEstado: l.led_estado,
  };
}

interface Props {
  dispositivo: Dispositivo;
  onActualizado?: (dispositivo: Dispositivo) => void;
  onDesvinculado?: (id_dispositivo: number) => void;
  // El superadmin mirando el dispositivo de otro usuario: ve y exporta, pero no
  // cambia la válvula, el límite ni la configuración
  soloLectura?: boolean;
}

export function DispositivoDashboard({ dispositivo, onActualizado, onDesvinculado, soloLectura = false }: Props) {
  const { id_dispositivo } = dispositivo;

  const [rangoId, setRangoId] = useState<RangoId>("10m");
  const [desdeInput, setDesdeInput] = useState(() => aInputLocal(new Date(Date.now() - 60 * 60 * 1000)));
  const [hastaInput, setHastaInput] = useState(() => aInputLocal(new Date()));
  const [personalizado, setPersonalizado] = useState<{ desde: string; hasta: string } | null>(null);

  const [puntos, setPuntos] = useState<PuntoLectura[]>([]);
  const [ultima, setUltima] = useState<LecturaCaudal | null>(null);
  const [estado, setEstado] = useState<EstadoDispositivo | null>(null);
  const [resumen, setResumen] = useState<ResumenCaudal | null>(null);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [conectado, setConectado] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [exportando, setExportando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());

  const [mostrarConfig, setMostrarConfig] = useState(false);
  const [nombre, setNombre] = useState(dispositivo.nombre);
  const [pulsosPorLitro, setPulsosPorLitro] = useState(String(Number(dispositivo.pulsos_por_litro)));
  const [guardando, setGuardando] = useState(false);

  const rangoVivo = RANGOS.find((r) => r.id === rangoId);
  // La conexión de tiempo real vive mientras se mira el dispositivo; el rango
  // elegido se lee desde acá para saber si una lectura nueva entra en la gráfica.
  const rangoVivoRef = useRef(rangoVivo);
  rangoVivoRef.current = rangoVivo;
  const recargarRef = useRef<() => void>(() => undefined);
  const pulsosPorLitroRef = useRef(Number(dispositivo.pulsos_por_litro));
  pulsosPorLitroRef.current = Number(dispositivo.pulsos_por_litro);

  function ventanaActual(): { desde: Date; hasta: Date | null } | null {
    if (rangoVivo) return { desde: new Date(Date.now() - rangoVivo.ms), hasta: null };
    if (!personalizado) return null;
    return { desde: new Date(personalizado.desde), hasta: new Date(personalizado.hasta) };
  }

  async function cargarResumenYEventos() {
    const ventana = ventanaActual();
    const [res, evs, est] = await Promise.all([
      ventana
        ? LecturasApi.resumen(id_dispositivo, { desde: ventana.desde.toISOString(), hasta: ventana.hasta?.toISOString() })
        : Promise.resolve(null),
      DispositivosApi.eventos(id_dispositivo, 10),
      DispositivosApi.estado(id_dispositivo),
    ]);
    setResumen(res);
    setEventos(evs);
    setEstado(est);
  }

  // Carga completa del rango (al entrar, al cambiar de rango y al reconectar)
  async function recargar() {
    setError(null);
    try {
      const ventana = ventanaActual();
      const [ult] = await Promise.all([
        LecturasApi.ultima(id_dispositivo),
        cargarResumenYEventos(),
        (async () => {
          if (!ventana) return setPuntos([]);
          const duracion = (ventana.hasta?.getTime() ?? Date.now()) - ventana.desde.getTime();
          const lecturas = await LecturasApi.listar(id_dispositivo, {
            desde: ventana.desde.toISOString(),
            hasta: ventana.hasta?.toISOString(),
            agrupar_s: intervaloPara(duracion),
          });
          setPuntos(lecturas.map(aPunto));
        })(),
      ]);
      setUltima(ult);
    } catch (err) {
      setError(mensajeError(err, "No se pudieron cargar las lecturas"));
    } finally {
      setCargando(false);
    }
  }
  recargarRef.current = recargar;

  useEffect(() => {
    setCargando(true);
    setPuntos([]);
    void recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id_dispositivo, rangoId, personalizado]);

  // Tiempo real: cada lectura que el ESP32 envía a Supabase llega por SSE
  useEffect(() => {
    let primera = true;
    const cerrar = escucharDispositivo(id_dispositivo, {
      onConectado: () => {
        setConectado(true);
        // Al reconectar se recarga para traer lo que llegó mientras estuvo cortado
        if (!primera) recargarRef.current();
        primera = false;
      },
      onDesconectado: () => setConectado(false),
      onLectura: ({ lectura, estado: nuevoEstado }) => {
        setUltima(lectura);
        setEstado((anterior) => {
          // Una fuga nueva, un límite o un cambio de motivo: refrescar la lista de eventos
          if (anterior?.motivo !== nuevoEstado.motivo || anterior?.fugas_pendientes !== nuevoEstado.fugas_pendientes) {
            DispositivosApi.eventos(id_dispositivo, 10).then(setEventos).catch(() => undefined);
          }
          return nuevoEstado;
        });
        const rango = rangoVivoRef.current;
        if (!rango) return;
        setResumen((r) => (r ? sumarLectura(r, lectura, pulsosPorLitroRef.current) : r));
        const punto = aPunto(lectura);
        setPuntos((prev) => {
          const minimo = Date.now() - rango.ms;
          return [...prev.filter((p) => p.t >= minimo && p.t < punto.t), punto];
        });
      },
    });
    return cerrar;
  }, [id_dispositivo]);

  // Reloj para "en línea" y para refrescar el resumen sin recargar todo
  useEffect(() => {
    const reloj = setInterval(() => setAhora(Date.now()), 1000);
    const resumenTimer = setInterval(() => {
      if (document.visibilityState === "visible") cargarResumenYEventos().catch(() => undefined);
    }, REFRESCO_RESUMEN_MS);
    return () => {
      clearInterval(reloj);
      clearInterval(resumenTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id_dispositivo, rangoId, personalizado]);

  async function accion(fn: () => Promise<void>, mensaje: string) {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(mensajeError(err, mensaje));
    }
  }

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
    await accion(async () => {
      const lecturas = await LecturasApi.listarTodas(
        id_dispositivo,
        ventana.desde.toISOString(),
        (ventana.hasta ?? new Date()).toISOString()
      );
      if (lecturas.length === 0) throw new Error();
      exportarLecturasCsv(dispositivo.nombre, lecturas);
    }, "No hay lecturas en el rango para exportar");
    setExportando(false);
  }

  async function onGuardar(e: FormEvent) {
    e.preventDefault();
    setGuardando(true);
    await accion(async () => {
      onActualizado?.(await DispositivosApi.actualizar(id_dispositivo, {
        nombre,
        pulsos_por_litro: Number(pulsosPorLitro),
      }));
    }, "No se pudo guardar el dispositivo");
    setGuardando(false);
  }

  const onGuardarLimite = (litros: number | null) =>
    accion(async () => {
      onActualizado?.(await DispositivosApi.actualizar(id_dispositivo, { limite_diario_l: litros }));
      setEstado(await DispositivosApi.estado(id_dispositivo));
    }, "No se pudo guardar el límite");

  const onModo = (modo: ModoValvula) =>
    accion(async () => {
      setEstado(await DispositivosApi.cambiarValvula(id_dispositivo, modo));
      setEventos(await DispositivosApi.eventos(id_dispositivo, 10));
    }, "No se pudo cambiar la válvula");

  const onConfirmarFuga = () =>
    accion(async () => {
      setEstado(await DispositivosApi.atenderFugas(id_dispositivo));
      setEventos(await DispositivosApi.eventos(id_dispositivo, 10));
    }, "No se pudo confirmar la fuga");

  async function onDesvincular() {
    if (!window.confirm(`¿Desvincular “${dispositivo.nombre}”? Se borran todas sus lecturas y eventos. El ESP32 vuelve a mostrar su código para vincularlo de nuevo.`)) return;
    await accion(async () => {
      await DispositivosApi.desvincular(id_dispositivo);
      onDesvinculado?.(id_dispositivo);
    }, "No se pudo desvincular el dispositivo");
  }

  const ultimaT = ultima ? new Date(ultima.fecha_medicion).getTime() : 0;
  const enVivo = ultima !== null && ahora - ultimaT < MS_EN_LINEA;
  const faltaRango = rangoId === "personalizado" && !personalizado;
  const sinDatos = faltaRango
    ? "Elegí las fechas y tocá “Ver rango”."
    : cargando
      ? "Cargando..."
      : ultima
        ? "No hay lecturas en este rango."
        : "Todavía no llegaron lecturas. Cuando el ESP32 empiece a enviar, la gráfica se actualiza sola.";
  const comun = { ultima, enVivo, puntos, sinDatos };

  return (
    <section className="serie-dashboard">
      <header className="dispositivo-header">
        <div>
          <h2>{dispositivo.nombre}</h2>
          <p className="serie-descripcion">
            <span className={`punto-estado ${enVivo ? "en-linea" : ""}`} />{" "}
            {enVivo ? "En línea" : ultima ? `Desconectado · última lectura ${haceCuanto(ultima.fecha_medicion)}` : "Todavía no envió datos"}
            {" · "}
            {conectado ? "Tiempo real activo" : "Reconectando tiempo real…"}
          </p>
        </div>
        {soloLectura ? (
          <span className="etiqueta-solo-lectura">Vista de administrador · solo lectura</span>
        ) : (
          <button type="button" className="btn-secundario" onClick={() => setMostrarConfig((v) => !v)}>
            {mostrarConfig ? "Cerrar configuración" : "Configuración"}
          </button>
        )}
      </header>

      {mostrarConfig && !soloLectura && (
        <div className="panel">
          <form className="generar-form" onSubmit={onGuardar}>
            <label>
              Nombre
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={100} required />
            </label>
            <label>
              Pulsos por litro
              <input type="number" min={0.001} step="any" value={pulsosPorLitro} onChange={(e) => setPulsosPorLitro(e.target.value)} required />
            </label>
            <button type="submit" disabled={guardando}>{guardando ? "Guardando..." : "Guardar cambios"}</button>
          </form>
          <div className="panel-acciones">
            <button type="button" className="btn-peligro" onClick={onDesvincular}>Desvincular dispositivo</button>
          </div>
        </div>
      )}

      {error && <p className="auth-error">{error}</p>}

      <div className="exportar-bar">
        <span>Rango:</span>
        {RANGOS.map((r) => (
          <button key={r.id} type="button" className={r.id === rangoId ? "activa" : ""} onClick={() => setRangoId(r.id)}>
            {r.label}
          </button>
        ))}
        <button type="button" className={rangoId === "personalizado" ? "activa" : ""} onClick={() => setRangoId("personalizado")}>
          Personalizado
        </button>
        <button type="button" className="exportar-csv" disabled={exportando || faltaRango} onClick={onExportar}>
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

      <div className="paneles">
        <PanelFlujo {...comun} estado={estado} resumen={resumen} onGuardarLimite={soloLectura ? undefined : onGuardarLimite} />
        {MOSTRAR_SENSOR_AGUA && (
          <PanelAgua {...comun} estado={estado} onConfirmarFuga={soloLectura ? undefined : onConfirmarFuga} />
        )}
        <PanelValvula {...comun} estado={estado} resumen={resumen} onModo={soloLectura ? undefined : onModo} />
        <PanelLed {...comun} />
      </div>

      <section className="panel eventos">
        <h3>Eventos recientes</h3>
        {eventos.length === 0 ? (
          <p className="muted">Sin eventos: no hubo fugas, límites alcanzados ni cambios de válvula.</p>
        ) : (
          <ul>
            {eventos.map((ev) => (
              <li key={ev.id_evento}>
                <span className={`evento-tipo ${ev.tipo.toLowerCase()}`}>{TEXTO_EVENTO[ev.tipo]}</span>
                <span>{ev.detalle}</span>
                <span className="muted">
                  {haceCuanto(ev.fecha)}
                  {ev.tipo === "FUGA" && (ev.atendido ? " · confirmada" : " · sin confirmar")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
