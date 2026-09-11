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

export function ConvergenciaChart({ filas, labelCalculado, labelReal }: Props) {
  const data = filas.map((f) => ({
    iteracion: f.iteracion,
    calculado: Number(f.valor_calculado),
    real: Number(f.valor_real),
  }));

  return (
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
          stroke={AXIS_COLOR}
          tick={{ fill: TEXT_MUTED, fontSize: 12 }}
          width={70}
          label={{ value: "Valor de la serie", angle: -90, position: "insideLeft", fill: TEXT_MUTED, fontSize: 12 }}
        />
        <Tooltip
          formatter={(value) => Number(value).toFixed(10)}
          labelFormatter={(v) => `Iteración ${v}`}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="calculado"
          name={labelCalculado}
          stroke={COLOR_CALCULADO}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="real"
          name={labelReal}
          stroke={COLOR_REAL}
          strokeWidth={2}
          strokeDasharray="5 4"
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
