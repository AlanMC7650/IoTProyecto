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
import { AXIS_COLOR, COLOR_ERROR, GRID_COLOR, TEXT_MUTED } from "./palette";

interface Props {
  filas: FilaSerie[];
}

export function ErrorChart({ filas }: Props) {
  const data = filas.map((f) => ({
    iteracion: f.iteracion,
    error: Number(f.error),
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
        <YAxis stroke={AXIS_COLOR} tick={{ fill: TEXT_MUTED, fontSize: 12 }} width={70} />
        <Tooltip
          formatter={(value) => Number(value).toExponential(4)}
          labelFormatter={(v) => `Iteración ${v}`}
        />
        <Line
          type="monotone"
          dataKey="error"
          name="Error absoluto"
          stroke={COLOR_ERROR}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
