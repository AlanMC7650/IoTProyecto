import {
  Brush,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { FilaSerie } from "../../types/api";
import { AXIS_COLOR, BRUSH_FILL, BRUSH_STROKE, COLOR_ERROR, GRID_COLOR, TEXT_MUTED } from "./palette";

interface Props {
  filas: FilaSerie[];
}

// El error decae varios órdenes de magnitud en pocas iteraciones (más
// pronunciado en Taylor por su convergencia factorial). En escala lineal
// la curva se aplasta contra el cero y el resto del gráfico queda vacío;
// escala logarítmica es la que muestra la caída real. Los errores en 0
// exacto (no representables en log) se pisan a un epsilon para poder graficarlos.
const EPSILON = 1e-16;

export function ErrorChart({ filas }: Props) {
  const data = filas.map((f) => {
    const errorReal = Number(f.error);
    return {
      iteracion: f.iteracion,
      error: errorReal > 0 ? errorReal : EPSILON,
      errorReal,
    };
  });

  return (
    <ResponsiveContainer width="100%" height={250}>
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
        <Tooltip
          formatter={(_value, _name, props) => Number(props.payload.errorReal).toExponential(4)}
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
        <Brush
          dataKey="iteracion"
          height={24}
          stroke={BRUSH_STROKE}
          fill={BRUSH_FILL}
          travellerWidth={8}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
