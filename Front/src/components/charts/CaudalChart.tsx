import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AXIS_COLOR, COLOR_CAUDAL, GRID_COLOR, TEXT_MUTED } from "./palette";
import { conCortes, etiquetaTooltip, formatoEje } from "./ejeTiempo";
import type { PuntoCaudal } from "./ejeTiempo";

export function CaudalChart({ puntos }: { puntos: PuntoCaudal[] }) {
  return (
    <ResponsiveContainer width="100%" height={310}>
      <LineChart data={conCortes(puntos)} margin={{ top: 8, right: 16, left: 4, bottom: 4 }}>
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
        <XAxis
          dataKey="t"
          type="number"
          scale="time"
          domain={["dataMin", "dataMax"]}
          tickFormatter={formatoEje(puntos)}
          minTickGap={48}
          stroke={AXIS_COLOR}
          tick={{ fill: TEXT_MUTED, fontSize: 12 }}
        />
        <YAxis
          stroke={AXIS_COLOR}
          tick={{ fill: TEXT_MUTED, fontSize: 12 }}
          width={70}
          domain={[0, "auto"]}
          label={{ value: "L/min", angle: -90, position: "insideLeft", fill: TEXT_MUTED, fontSize: 12 }}
        />
        <Tooltip
          formatter={(value) => `${Number(value).toFixed(2)} L/min`}
          labelFormatter={etiquetaTooltip}
        />
        <Line
          type="monotone"
          dataKey="caudal"
          name="Caudal"
          stroke={COLOR_CAUDAL}
          strokeWidth={2}
          dot={false}
          connectNulls={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
