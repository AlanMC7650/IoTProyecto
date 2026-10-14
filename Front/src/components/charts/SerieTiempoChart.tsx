import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AXIS_COLOR, COLOR_LED, GRID_COLOR, TEXT_MUTED } from "./palette";
import { conCortes, etiquetaTooltip, formatoEje } from "./ejeTiempo";
import type { PuntoLectura } from "./ejeTiempo";

type Campo = "caudal" | "agua" | "valvula" | "ledBrillo";

interface Props {
  puntos: PuntoLectura[];
  campo: Campo;
  color: string;
  unidad: string;
  // area: línea con relleno · escalon: valores 0/1 (válvula) · barras: una barra por lectura coloreada por el estado del LED
  tipo: "area" | "escalon" | "barras";
  dominioY?: [number, number | "auto"];
  umbral?: { valor: number; etiqueta: string; color: string };
  formatoValor?: (valor: number) => string;
  alto?: number;
}

const ejeX = (puntos: PuntoLectura[]) => (
  <XAxis
    dataKey="t"
    type="number"
    scale="time"
    domain={["dataMin", "dataMax"]}
    tickFormatter={formatoEje(puntos)}
    minTickGap={48}
    stroke={AXIS_COLOR}
    tick={{ fill: TEXT_MUTED, fontSize: 11 }}
  />
);

export function SerieTiempoChart({
  puntos, campo, color, unidad, tipo, dominioY = [0, "auto"], umbral, formatoValor, alto = 200,
}: Props) {
  const datos = conCortes(puntos);
  const formato = formatoValor ?? ((v: number) => `${v.toFixed(2)} ${unidad}`);
  const ejeY = (
    <YAxis
      stroke={AXIS_COLOR}
      tick={{ fill: TEXT_MUTED, fontSize: 11 }}
      width={tipo === "escalon" ? 64 : 46}
      domain={dominioY}
      ticks={tipo === "escalon" ? [0, 1] : undefined}
      tickFormatter={tipo === "escalon" ? (v: number) => (v === 1 ? "abierta" : "cerrada") : undefined}
    />
  );
  const tooltip = (
    <Tooltip
      formatter={(valor) => (valor === null ? "—" : formato(Number(valor)))}
      labelFormatter={etiquetaTooltip}
    />
  );
  const margen = { top: 8, right: 12, left: 0, bottom: 2 };

  if (tipo === "barras") {
    return (
      <ResponsiveContainer width="100%" height={alto}>
        <BarChart data={datos} margin={margen} barCategoryGap={0}>
          <CartesianGrid stroke={GRID_COLOR} vertical={false} />
          {ejeX(puntos)}
          {ejeY}
          {tooltip}
          <Bar dataKey={campo} name="Brillo" isAnimationActive={false}>
            {datos.map((p) => (
              <Cell key={p.t} fill={COLOR_LED[p.ledEstado ?? "apagado"] ?? color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={alto}>
      <AreaChart data={datos} margin={margen}>
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
        {ejeX(puntos)}
        {ejeY}
        {tooltip}
        {umbral && (
          <ReferenceLine
            y={umbral.valor}
            stroke={umbral.color}
            strokeDasharray="5 4"
            label={{ value: umbral.etiqueta, fill: umbral.color, fontSize: 11, position: "insideTopLeft" }}
          />
        )}
        <Area
          type={tipo === "escalon" ? "stepAfter" : "monotone"}
          dataKey={campo}
          stroke={color}
          strokeWidth={2}
          fill={color}
          fillOpacity={0.12}
          dot={false}
          connectNulls={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
