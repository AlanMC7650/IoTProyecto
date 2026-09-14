import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { FilaSerie } from "../../types/api";
import { AXIS_COLOR, COLOR_CALCULADO, COLOR_REAL, GRID_COLOR, TEXT_MUTED } from "./palette";

interface Props {
  filas: FilaSerie[];
  labelCalculado: string;
  labelReal: string;
}

type Escala = "linear" | "log" | "exponencial";

function formatoExponencial(valor: number): string {
  return valor.toExponential(2);
}

export function ComparacionEscalableChart({ filas, labelCalculado, labelReal }: Props) {
  const [escala, setEscala] = useState<Escala>("linear");

  const data = useMemo(
    () =>
      filas.map((f) => ({
        iteracion: f.iteracion,
        calculado: Number(f.valor_calculado),
        real: Number(f.valor_real),
      })),
    [filas]
  );

  const puedeUsarLog = useMemo(
    () => data.every((d) => d.calculado > 0 && d.real > 0),
    [data]
  );
  const escalaActiva: Escala = escala === "log" && !puedeUsarLog ? "linear" : escala;
  const esLog = escalaActiva === "log";
  const esExponencial = escalaActiva === "exponencial";

  return (
    <div>
      <div className="chart-scale-toggle" role="group" aria-label="Escala del gráfico">
        <button
          type="button"
          className={escalaActiva === "linear" ? "activa" : ""}
          onClick={() => setEscala("linear")}
        >
          Lineal
        </button>
        <button
          type="button"
          className={escalaActiva === "log" ? "activa" : ""}
          onClick={() => setEscala("log")}
          disabled={!puedeUsarLog}
          title={!puedeUsarLog ? "No disponible: hay valores negativos o en cero" : undefined}
        >
          Logarítmica
        </button>
        <button
          type="button"
          className={escalaActiva === "exponencial" ? "activa" : ""}
          onClick={() => setEscala("exponencial")}
        >
          Exponencial
        </button>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 8, right: 16, left: 4, bottom: 4 }}>
          <CartesianGrid stroke={GRID_COLOR} vertical={false} />
          <XAxis
            dataKey="iteracion"
            stroke={AXIS_COLOR}
            tick={{ fill: TEXT_MUTED, fontSize: 12 }}
            label={{ value: "ID de la serie", position: "insideBottom", offset: -2, fill: TEXT_MUTED, fontSize: 12 }}
          />
          <YAxis
            scale={esLog ? "log" : "linear"}
            domain={esLog ? ["auto", "auto"] : undefined}
            allowDataOverflow={esLog}
            stroke={AXIS_COLOR}
            tick={{ fill: TEXT_MUTED, fontSize: 12 }}
            tickFormatter={esExponencial ? (v: number) => formatoExponencial(v) : undefined}
            width={esExponencial ? 78 : 70}
            label={{ value: "Valor de la serie", angle: -90, position: "insideLeft", fill: TEXT_MUTED, fontSize: 12 }}
          />
          <Tooltip
            formatter={(value) => (esExponencial ? formatoExponencial(Number(value)) : Number(value).toFixed(10))}
            labelFormatter={(v) => `Iteración ${v}`}
          />
          <Legend />
          <Line type="monotone" dataKey="calculado" name={labelCalculado} stroke={COLOR_CALCULADO} strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="real" name={labelReal} stroke={COLOR_REAL} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}