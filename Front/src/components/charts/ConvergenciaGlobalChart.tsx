import {
  Brush,
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
import {
  AXIS_COLOR,
  BRUSH_FILL,
  BRUSH_STROKE,
  COLOR_CALCULADO,
  GRID_COLOR,
  TEXT_MUTED,
} from "./palette";

type IdKey = "id_leibniz" | "id_fibonacci" | "id_taylor";

interface Props {
  filas: FilaSerie[];
  labelCalculado: string;
  idKey: IdKey;
}

// Vista "global": junta todas las ejecuciones de un mismo tipo de serie y
// las ordena por el id autoincremental (idKey) en vez de por "iteracion",
// ya que "iteracion" se reinicia en cada ejecución.
export function ConvergenciaGlobalChart({ filas, labelCalculado, idKey }: Props) {
  const data = filas
    .filter((f) => f[idKey] !== undefined && f[idKey] !== null)
    .slice()
    .sort((a, b) => (Number(a[idKey]) ?? 0) - (Number(b[idKey]) ?? 0))
    .map((f) => ({
      id: Number(f[idKey]),
      calculado: Number(f.valor_calculado),
      id_ejecucion: f.id_ejecucion,
    }));

  if (data.length === 0) {
    return <p className="muted">Todavía no hay datos para graficar.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={310}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 4, bottom: 4 }}>
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
        <XAxis
          dataKey="id"
          stroke={AXIS_COLOR}
          tick={{ fill: TEXT_MUTED, fontSize: 12 }}
          label={{ value: idKey, position: "insideBottom", offset: -2, fill: TEXT_MUTED, fontSize: 12 }}
        />
        <YAxis
          stroke={AXIS_COLOR}
          tick={{ fill: TEXT_MUTED, fontSize: 12 }}
          width={70}
        />
        <Tooltip
          formatter={(value) => Number(value).toFixed(10)}
          labelFormatter={(v) => `${idKey} ${v}`}
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
        <Brush
          dataKey="id"
          height={24}
          stroke={BRUSH_STROKE}
          fill={BRUSH_FILL}
          travellerWidth={8}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}