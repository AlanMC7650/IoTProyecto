import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { SeriesApi } from "../services/series.service";
import { mensajeError } from "../services/errors";
import type { EjecucionResumen, FilaSerie, FuncionTaylor, TipoSerie } from "../types/api";
import { ConvergenciaChart } from "./charts/ConvergenciaChart";
import { ErrorChart } from "./charts/ErrorChart";
import { CrecimientoChart } from "./charts/CrecimientoChart";
import { HistorialCompletoChart } from "./charts/HistorialCompletoChart";
import { ComparacionChart } from "./charts/ComparacionChart";
import { ComparacionEscalableChart } from "./charts/ComparacionEscalableChart";
import { TodasLasSeriesChart } from "./charts/TodasLasSeriesChart";
import { exportarEjecucion } from "../utils/exportSerie";
import type { FormatoExport } from "../utils/exportSerie";

interface Config {
  tipo: TipoSerie;
  titulo: string;
  descripcion: string;
  labelCalculado: string;
  labelReal: string;
  soportaFuncionYX: boolean;
}

const CONFIGS: Record<TipoSerie, Config> = {
  leibniz: {
    tipo: "leibniz",
    titulo: "Serie de Leibniz",
    descripcion: "Aproximación de π por sumas parciales alternadas.",
    labelCalculado: "π aproximado",
    labelReal: "π real",
    soportaFuncionYX: false,
  },
  fibonacci: {
    tipo: "fibonacci",
    titulo: "Serie de Fibonacci",
    descripcion: "Razón F(n)/F(n-1) convergiendo al número áureo (φ).",
    labelCalculado: "F(n)/F(n-1)",
    labelReal: "φ (áureo)",
    soportaFuncionYX: false,
  },
  taylor: {
    tipo: "taylor",
    titulo: "Serie de Taylor",
    descripcion: "Expansión en serie de exponencial, seno o coseno.",
    labelCalculado: "Suma parcial",
    labelReal: "Valor real",
    soportaFuncionYX: true,
  },
};

export function SerieDashboard({ tipo }: { tipo: TipoSerie }) {
  const config = CONFIGS[tipo];

  const [ejecuciones, setEjecuciones] = useState<EjecucionResumen[]>([]);
  const [ejecucionActual, setEjecucionActual] = useState<string | null>(null);
  const [filas, setFilas] = useState<FilaSerie[]>([]);
  const [historialFibonacci, setHistorialFibonacci] = useState<FilaSerie[]>([]);

  const [iteraciones, setIteraciones] = useState("");
  const [funcion, setFuncion] = useState<FuncionTaylor | "">("");
  const [x, setX] = useState("");

  const [cargandoHistorial, setCargandoHistorial] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [eliminando, setEliminando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEjecuciones([]);
    setEjecucionActual(null);
    setFilas([]);
    setError(null);
    setCargandoHistorial(true);

    SeriesApi.listarEjecuciones(tipo)
      .then((data) => {
        setEjecuciones(data);
        if (data.length > 0) seleccionarEjecucion(data[0].id_ejecucion);
      })
      .catch((err) => setError(mensajeError(err, "No se pudo cargar el historial")))
      .finally(() => setCargandoHistorial(false));

    if (tipo === "fibonacci") {
      SeriesApi.listarMias("fibonacci")
        .then(setHistorialFibonacci)
        .catch(() => setHistorialFibonacci([]));
    } else {
      setHistorialFibonacci([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo]);

  async function seleccionarEjecucion(id_ejecucion: string) {
    setEjecucionActual(id_ejecucion);
    try {
      const data = await SeriesApi.listarPorEjecucion(tipo, id_ejecucion);
      setFilas(data);
    } catch (err) {
      setError(mensajeError(err, "No se pudo cargar la ejecución"));
    }
  }

  async function onGenerar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setGenerando(true);
    try {
      const resultado = await SeriesApi.generar(tipo, {
        iteraciones: iteraciones ? Number(iteraciones) : undefined,
        funcion: funcion || undefined,
        x: x ? Number(x) : undefined,
      });
      setFilas(resultado.filas);
      setEjecucionActual(resultado.id_ejecucion);
      const nueva: EjecucionResumen = {
        id_ejecucion: resultado.id_ejecucion,
        fecha_generacion: new Date().toISOString(),
        cantidad_iteraciones: String(resultado.iteraciones),
        funcion: resultado.funcion,
        x_valor: resultado.x !== undefined ? String(resultado.x) : undefined,
      };
      setEjecuciones((prev) => [nueva, ...prev]);
      if (tipo === "fibonacci") {
        setHistorialFibonacci((prev) => [...prev, ...resultado.filas]);
      }
    } catch (err) {
      setError(mensajeError(err, "No se pudo generar la serie"));
    } finally {
      setGenerando(false);
    }
  }

  async function onEliminar(id_ejecucion: string) {
    if (!window.confirm("¿Eliminar esta ejecución? Esta acción no se puede deshacer.")) return;

    setEliminando(id_ejecucion);
    setError(null);
    try {
      await SeriesApi.eliminarEjecucion(tipo, id_ejecucion);
      const restantes = ejecuciones.filter((ej) => ej.id_ejecucion !== id_ejecucion);
      setEjecuciones(restantes);
      if (tipo === "fibonacci") {
        setHistorialFibonacci((prev) => prev.filter((f) => f.id_ejecucion !== id_ejecucion));
      }

      if (id_ejecucion === ejecucionActual) {
        if (restantes.length > 0) {
          await seleccionarEjecucion(restantes[0].id_ejecucion);
        } else {
          setEjecucionActual(null);
          setFilas([]);
        }
      }
    } catch (err) {
      setError(mensajeError(err, "No se pudo eliminar la ejecución"));
    } finally {
      setEliminando(null);
    }
  }

  function onExportar(formato: FormatoExport) {
    if (!ejecucionActual) return;
    exportarEjecucion(tipo, ejecucionActual, filas, formato);
  }

  return (
    <section className="serie-dashboard">
      <header>
        <h2>{config.titulo}</h2>
        <p className="serie-descripcion">{config.descripcion}</p>
      </header>

      <form className="generar-form" onSubmit={onGenerar}>
        <label>
          Iteraciones
          <input
            type="number"
            min={1}
            placeholder="aleatorio"
            value={iteraciones}
            onChange={(e) => setIteraciones(e.target.value)}
          />
        </label>

        {config.soportaFuncionYX && (
          <>
            <label>
              Función
              <select value={funcion} onChange={(e) => setFuncion(e.target.value as FuncionTaylor | "")}>
                <option value="">aleatoria</option>
                <option value="exponencial">exponencial</option>
                <option value="seno">seno</option>
                <option value="coseno">coseno</option>
              </select>
            </label>
            <label>
              x (entre -2 y 2)
              <input
                type="number"
                step="any"
                min={-2}
                max={2}
                placeholder="aleatorio"
                value={x}
                onChange={(e) => setX(e.target.value)}
              />
            </label>
          </>
        )}

        <button type="submit" disabled={generando}>
          {generando ? "Generando..." : "Generar nueva ejecución"}
        </button>
      </form>

      {error && <p className="auth-error">{error}</p>}

      <div className="serie-body">
        <aside className="ejecuciones-list">
          <h3>Historial de ejecuciones</h3>
          {cargandoHistorial && <p>Cargando...</p>}
          {!cargandoHistorial && ejecuciones.length === 0 && (
            <p className="muted">Todavía no generaste ninguna ejecución.</p>
          )}
          <ul>
            {ejecuciones.map((ej) => (
              <li key={ej.id_ejecucion}>
                <button
                  className={ej.id_ejecucion === ejecucionActual ? "activa" : ""}
                  onClick={() => seleccionarEjecucion(ej.id_ejecucion)}
                >
                  {new Date(ej.fecha_generacion).toLocaleString()} ·{" "}
                  {ej.cantidad_iteraciones} iter.
                  {ej.funcion && ` · ${ej.funcion} x=${ej.x_valor}`}
                </button>
                <button
                  className="eliminar-btn"
                  aria-label="Eliminar ejecución"
                  title="Eliminar ejecución"
                  disabled={eliminando === ej.id_ejecucion}
                  onClick={() => onEliminar(ej.id_ejecucion)}
                >
                  {eliminando === ej.id_ejecucion ? "…" : "✕"}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="serie-charts">
          {filas.length === 0 ? (
            <p className="muted">Generá una ejecución para ver el gráfico.</p>
          ) : (
            <>
              <div className="exportar-bar">
                <span>Exportar ejecución:</span>
                <button type="button" onClick={() => onExportar("csv")}>CSV</button>
                <button type="button" onClick={() => onExportar("json")}>JSON</button>
                <button type="button" onClick={() => onExportar("txt")}>TXT</button>
              </div>
              <div className="chart-block">
                <h4 className="chart-title">Comparación completa</h4>
                <p className="chart-subtitle">Serie y error absoluto juntos (eje derecho en escala log)</p>
                <ComparacionChart
                  filas={filas}
                  labelCalculado={config.labelCalculado}
                  labelReal={config.labelReal}
                />
              </div>
              <div className="chart-block">
                <h4 className="chart-title">Convergencia</h4>
                <p className="chart-subtitle">Valor calculado frente al valor real</p>
                <ConvergenciaChart
                  filas={filas}
                  labelCalculado={config.labelCalculado}
                  labelReal={config.labelReal}
                />
              </div>
              <div className="chart-block">
                <h4 className="chart-title">Comparación escalable</h4>
                <p className="chart-subtitle">
                  {config.labelCalculado} vs. {config.labelReal} (líneas, con escala lineal/log/exponencial)
                </p>
                <ComparacionEscalableChart
                  filas={filas}
                  labelCalculado={config.labelCalculado}
                  labelReal={config.labelReal}
                />
              </div>
              <div className="chart-block">
                <h4 className="chart-title">Error absoluto por iteración</h4>
                <p className="chart-subtitle">Mientras menor sea el error, mayor es la aproximación</p>
                <ErrorChart filas={filas} />
              </div>
              {tipo === "fibonacci" && (
                <div className="chart-block">
                  <h4 className="chart-title">Crecimiento de F(n)</h4>
                  <p className="chart-subtitle">Visualización en escala logarítmica</p>
                  <CrecimientoChart filas={filas} />
                </div>
              )}
              {tipo === "fibonacci" && (
                <div className="chart-block">
                  <h4 className="chart-title">Historial completo (todas las ejecuciones)</h4>
                  <p className="chart-subtitle">
                    fibonacci_n de todas tus ejecuciones, una atrás de la otra (escala log)
                    {historialFibonacci.length > 300 ? " — muestra de 300 puntos" : ""}
                  </p>
                  <HistorialCompletoChart filas={historialFibonacci} />
                </div>
              )}
              <div className="chart-block">
                <h4 className="chart-title">Todas las series juntas</h4>
                <p className="chart-subtitle">
                  {config.labelCalculado}, {config.labelReal}, error absoluto
                  {tipo === "fibonacci" ? " y fibonacci_n" : ""} en un mismo gráfico (escala log)
                </p>
                <TodasLasSeriesChart
                  filas={filas}
                  tipo={tipo}
                  labelCalculado={config.labelCalculado}
                  labelReal={config.labelReal}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
