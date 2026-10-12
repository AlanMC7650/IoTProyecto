import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AXIS_COLOR, COLOR_VOLUMEN, GRID_COLOR, TEXT_MUTED } from "./palette";
import { conCortes, etiquetaTooltip, formatoEje } from "./ejeTiempo";
import type { PuntoCaudal } from "./ejeTiempo";

export function VolumenChart({ puntos }: { puntos: PuntoCaudal[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={conCortes(puntos)} margin={{ top: 8, right: 16, left: 4, bottom: 4 }}>
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
          domain={["auto", "auto"]}
          label={{ value: "L", angle: -90, position: "insideLeft", fill: TEXT_MUTED, fontSize: 12 }}
        />
        <Tooltip
          formatter={(value) => `${Number(value).toFixed(3)} L`}
          labelFormatter={etiquetaTooltip}
        />
        <Area
          type="monotone"
          dataKey="volumen"
          name="Volumen acumulado"
          stroke={COLOR_VOLUMEN}
          strokeWidth={2}
          fill={COLOR_VOLUMEN}
          fillOpacity={0.18}
          connectNulls={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
