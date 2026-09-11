import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { FilaSerie } from "../../types/api";
import {
  AXIS_COLOR,
  COLOR_CALCULADO,
  COLOR_ERROR_ACCENT,
  COLOR_REAL,
  GRID_COLOR,
  TEXT_MUTED,
} from "./palette";

interface Props {
  filas: FilaSerie[];
  labelCalculado: string;
  labelReal: string;
}

const EPSILON = 1e-16;

// Une la convergencia (valor calculado vs. real) y el error absoluto en un
// solo gráfico con doble eje Y: eje izquierdo lineal para los valores, eje
// derecho logarítmico para el error, así se ve de un vistazo cómo se relaciona
// la caída del error con el punto en que la curva calculada alcanza al real.
export function ComparacionChart({ filas, labelCalculado, labelReal }: Props) {
  const data = filas.map((f) => {
    const errorReal = Number(f.error);
    return {
      iteracion: f.iteracion,
      calculado: Number(f.valor_calculado),
      real: Number(f.valor_real),
      error: errorReal > 0 ? errorReal : EPSILON,
      errorReal,
    };
  });

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 8, right: 16, left: 4, bottom: 4 }}>
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
        <XAxis
          dataKey="iteracion"
          stroke={AXIS_COLOR}
          tick={{ fill: TEXT_MUTED, fontSize: 12 }}
          label={{ value: "ID de la serie", position: "insideBottom", offset: -2, fill: TEXT_MUTED, fontSize: 12 }}
        />
        <YAxis
          yAxisId="valor"
          stroke={AXIS_COLOR}
          tick={{ fill: TEXT_MUTED, fontSize: 12 }}
          width={70}
          label={{ value: "Valor de la serie", angle: -90, position: "insideLeft", fill: TEXT_MUTED, fontSize: 12 }}
        />
        <YAxis
          yAxisId="error"
          orientation="right"
          scale="log"
          domain={["auto", "auto"]}
          allowDataOverflow
          stroke={AXIS_COLOR}
          tick={{ fill: TEXT_MUTED, fontSize: 12 }}
          width={70}
        />
        <Tooltip
          formatter={(value, name, props) => {
            if (name === "Error absoluto") return Number(props.payload.errorReal).toExponential(4);
            return Number(value).toFixed(10);
          }}
          labelFormatter={(v) => `Iteración ${v}`}
        />
        <Legend />
        <Line
          yAxisId="valor"
          type="monotone"
          dataKey="calculado"
          name={labelCalculado}
          stroke={COLOR_CALCULADO}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
        <Line
          yAxisId="valor"
          type="monotone"
          dataKey="real"
          name={labelReal}
          stroke={COLOR_REAL}
          strokeWidth={2}
          strokeDasharray="5 4"
          dot={false}
          isAnimationActive={false}
        />
        <Line
          yAxisId="error"
          type="monotone"
          dataKey="error"
          name="Error absoluto"
          stroke={COLOR_ERROR_ACCENT}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
