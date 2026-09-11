import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { SeriesApi } from "../services/series.service";
import { mensajeError } from "../services/errors";
import type { EjecucionResumen, FilaSerie, FuncionTaylor, TipoSerie } from "../types/api";
import { ConvergenciaChart } from "./charts/ConvergenciaChart";
import { ErrorChart } from "./charts/ErrorChart";
import { CrecimientoChart } from "./charts/CrecimientoChart";

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

  const [iteraciones, setIteraciones] = useState("");
  const [funcion, setFuncion] = useState<FuncionTaylor | "">("");
  const [x, setX] = useState("");

  const [cargandoHistorial, setCargandoHistorial] = useState(true);
  const [generando, setGenerando] = useState(false);
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
    } catch (err) {
      setError(mensajeError(err, "No se pudo generar la serie"));
    } finally {
      setGenerando(false);
    }
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
              x
              <input
                type="number"
                step="any"
                placeholder="aleatorio"
                value={x}
                onChange={(e) => setX(e.target.value)}
              />
            </label>
          </>
        )}

        <button type="submit" disabled={generando}>
          {generando ? "Generando..." : "Generar nueva corrida"}
        </button>
      </form>

      {error && <p className="auth-error">{error}</p>}

      <div className="serie-body">
        <aside className="ejecuciones-list">
          <h3>Historial de corridas</h3>
          {cargandoHistorial && <p>Cargando...</p>}
          {!cargandoHistorial && ejecuciones.length === 0 && (
            <p className="muted">Todavía no generaste ninguna corrida.</p>
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
              </li>
            ))}
          </ul>
        </aside>

        <div className="serie-charts">
          {filas.length === 0 ? (
            <p className="muted">Generá una corrida para ver el gráfico.</p>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>
    </section>
  );
}
