import {
  Brush,
  CartesianGrid,
  ComposedChart,
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
  COLOR_ERROR_ACCENT,
  COLOR_REAL,
  GRID_COLOR,
  TEXT_MUTED,
} from "./palette";

type IdKey = "id_leibniz" | "id_fibonacci" | "id_taylor";

interface Props {
  filas: FilaSerie[];
  labelCalculado: string;
  labelReal?: string;
  idKey: IdKey;
  mostrarError?: boolean;
}

const EPSILON = 1e-16;

// Vista "global": junta todas las ejecuciones de un mismo tipo de serie y
// las ordena por el id autoincremental (idKey) en vez de por "iteracion",
// ya que "iteracion" se reinicia en cada ejecución.
export function ConvergenciaGlobalChart({
  filas,
  labelCalculado,
  labelReal,
  idKey,
  mostrarError = false,
}: Props) {
  const data = filas
    .filter((f) => f[idKey] !== undefined && f[idKey] !== null)
    .slice()
    .sort((a, b) => (Number(a[idKey]) ?? 0) - (Number(b[idKey]) ?? 0))
    .map((f) => {
      const errorReal = Number(f.error);
      return {
        id: Number(f[idKey]),
        calculado: Number(f.valor_calculado),
        real: Number(f.valor_real),
        error: errorReal > 0 ? errorReal : EPSILON,
        errorReal,
        iteracion: f.iteracion,
        id_ejecucion: f.id_ejecucion,
      };
    });

  if (data.length === 0) {
    return <p className="muted">Todavía no hay datos para graficar.</p>;
  }

  const ejeX = (
    <XAxis
      dataKey="id"
      stroke={AXIS_COLOR}
      tick={{ fill: TEXT_MUTED, fontSize: 12 }}
      label={{ value: idKey, position: "insideBottom", offset: -2, fill: TEXT_MUTED, fontSize: 12 }}
    />
  );

  const tooltip = (
    <Tooltip
      formatter={(value, name, props) => {
        if (name === "Error absoluto") return Number(props.payload.errorReal).toExponential(4);
        return Number(value).toFixed(10);
      }}
      labelFormatter={(v, payload) => {
        const fila = payload?.[0]?.payload;
        const iter = fila?.iteracion != null ? ` · iteración ${fila.iteracion}` : "";
        return `${idKey} ${v}${iter}`;
      }}
    />
  );

  const brush = (
    <Brush
      dataKey="id"
      height={24}
      stroke={BRUSH_STROKE}
      fill={BRUSH_FILL}
      travellerWidth={8}
    />
  );

  if (mostrarError) {
    return (
      <ResponsiveContainer width="100%" height={330}>
        <ComposedChart data={data} margin={{ top: 8, right: 16, left: 4, bottom: 4 }}>
          <CartesianGrid stroke={GRID_COLOR} vertical={false} />
          {ejeX}
          <YAxis
            yAxisId="valor"
            stroke={AXIS_COLOR}
            tick={{ fill: TEXT_MUTED, fontSize: 12 }}
            width={70}
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
          {tooltip}
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
          {labelReal && (
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
          )}
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
          {brush}
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={310}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 4, bottom: 4 }}>
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
        {ejeX}
        <YAxis
          stroke={AXIS_COLOR}
          tick={{ fill: TEXT_MUTED, fontSize: 12 }}
          width={70}
        />
        {tooltip}
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
        {brush}
      </LineChart>
    </ResponsiveContainer>
  );
}