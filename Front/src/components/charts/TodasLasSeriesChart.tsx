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
import type { FilaSerie, TipoSerie } from "../../types/api";
import {
  AXIS_COLOR,
  COLOR_CALCULADO,
  COLOR_ERROR_ACCENT,
  COLOR_FIBONACCI_N,
  COLOR_REAL,
  GRID_COLOR,
  TEXT_MUTED,
} from "./palette";

interface Props {
  filas: FilaSerie[];
  tipo: TipoSerie;
  labelCalculado: string;
  labelReal: string;
}

const EPSILON = 1e-16;

export function TodasLasSeriesChart({ filas, tipo, labelCalculado, labelReal }: Props) {
  const data = filas.map((f) => {
    const errorReal = Number(f.error);
    return {
      iteracion: f.iteracion,
      calculado: Number(f.valor_calculado),
      real: Number(f.valor_real),
      error: errorReal > 0 ? errorReal : EPSILON,
      errorReal,
      fibonacci_n: f.fibonacci_n !== undefined ? Number(f.fibonacci_n) : undefined,
    };
  });

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 4, bottom: 4 }}>
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
        <XAxis
          dataKey="iteracion"
          stroke={AXIS_COLOR}
          tick={{ fill: TEXT_MUTED, fontSize: 12 }}
          label={{ value: "ID de la serie", position: "insideBottom", offset: -2, fill: TEXT_MUTED, fontSize: 12 }}
        />
        <YAxis
          scale="log"
          domain={["auto", "auto"]}
          allowDataOverflow
          stroke={AXIS_COLOR}
          tick={{ fill: TEXT_MUTED, fontSize: 12 }}
          width={70}
          label={{ value: "Valor de la serie (escala log)", angle: -90, position: "insideLeft", fill: TEXT_MUTED, fontSize: 12 }}
        />
        <Tooltip
          formatter={(value, name, props) => {
            if (name === "Error absoluto") return Number(props.payload.errorReal).toExponential(4);
            return Number(value).toLocaleString("es", { maximumFractionDigits: 10 });
          }}
          labelFormatter={(v) => `Iteración ${v}`}
        />
        <Legend />
        <Line type="monotone" dataKey="calculado" name={labelCalculado} stroke={COLOR_CALCULADO} strokeWidth={2} dot={false} isAnimationActive={false} />
        <Line type="monotone" dataKey="real" name={labelReal} stroke={COLOR_REAL} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
        <Line type="monotone" dataKey="error" name="Error absoluto" stroke={COLOR_ERROR_ACCENT} strokeWidth={2} dot={false} isAnimationActive={false} />
        {tipo === "fibonacci" && (
          <Line type="monotone" dataKey="fibonacci_n" name="fibonacci_n" stroke={COLOR_FIBONACCI_N} strokeWidth={2} dot={false} isAnimationActive={false} />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}