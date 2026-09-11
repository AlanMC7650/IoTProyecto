import {
  Bar,
  BarChart,
  Brush,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { FilaSerie } from "../../types/api";
import {
  AXIS_COLOR,
  BRUSH_FILL,
  BRUSH_STROKE,
  COLOR_CRECIMIENTO,
  GRID_COLOR,
  TEXT_MUTED,
} from "./palette";

interface Props {
  filas: FilaSerie[];
}

// Escala lineal: muestra el crecimiento exponencial real de Fibonacci
// (las primeras iteraciones quedan chicas frente a las últimas, "hockey stick").
export function CrecimientoChart({ filas }: Props) {
  const data = filas
    .slice()
    .sort((a, b) => (a.id_fibonacci ?? 0) - (b.id_fibonacci ?? 0))
    .map((f) => ({
      id_fibonacci: f.id_fibonacci ?? 0,
      fibonacci_n: Number(f.fibonacci_n ?? 0),
    }));

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 4, bottom: 4 }}>
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
        <XAxis
          dataKey="id_fibonacci"
          stroke={AXIS_COLOR}
          tick={{ fill: TEXT_MUTED, fontSize: 12 }}
          label={{ value: "id_fibonacci", position: "insideBottom", offset: -2, fill: TEXT_MUTED, fontSize: 12 }}
        />
        <YAxis
          stroke={AXIS_COLOR}
          tick={{ fill: TEXT_MUTED, fontSize: 12 }}
          width={70}
        />
        <Tooltip labelFormatter={(v) => `id_fibonacci ${v}`} />
        <Bar
          dataKey="fibonacci_n"
          name="F(n)"
          fill={COLOR_CRECIMIENTO}
          isAnimationActive={false}
        />
        <Brush
          dataKey="id_fibonacci"
          height={24}
          stroke={BRUSH_STROKE}
          fill={BRUSH_FILL}
          travellerWidth={8}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
