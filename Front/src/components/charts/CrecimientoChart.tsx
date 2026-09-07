import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { FilaSerie } from "../../types/api";
import { AXIS_COLOR, COLOR_CRECIMIENTO, GRID_COLOR, TEXT_MUTED } from "./palette";

interface Props {
  filas: FilaSerie[];
}

// Fibonacci crudo crece exponencial: en escala lineal las primeras iteraciones
// se aplastan contra el eje. Escala logarítmica es la que realmente muestra la forma.
export function CrecimientoChart({ filas }: Props) {
  const data = filas.map((f) => ({
    iteracion: f.iteracion,
    fibonacci_n: Number(f.fibonacci_n ?? 0),
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 4, bottom: 4 }}>
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
        <XAxis
          dataKey="iteracion"
          stroke={AXIS_COLOR}
          tick={{ fill: TEXT_MUTED, fontSize: 12 }}
          label={{ value: "Iteración", position: "insideBottom", offset: -2, fill: TEXT_MUTED, fontSize: 12 }}
        />
        <YAxis
          scale="log"
          domain={["auto", "auto"]}
          allowDataOverflow
          stroke={AXIS_COLOR}
          tick={{ fill: TEXT_MUTED, fontSize: 12 }}
          width={70}
        />
        <Tooltip labelFormatter={(v) => `Iteración ${v}`} />
        <Line
          type="monotone"
          dataKey="fibonacci_n"
          name="F(n) (escala log)"
          stroke={COLOR_CRECIMIENTO}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
