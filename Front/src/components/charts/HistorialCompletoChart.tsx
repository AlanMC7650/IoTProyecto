import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { FilaSerie } from "../../types/api";
import { AXIS_COLOR, COLOR_FIBONACCI_N, GRID_COLOR, TEXT_MUTED } from "./palette";

interface Props {
  filas: FilaSerie[];
}

const MAX_BARRAS = 300;

function muestrear<T>(items: T[], maxItems: number): T[] {
  if (items.length <= maxItems) return items;

  const paso = (items.length - 1) / (maxItems - 1);
  const indices = new Set<number>();
  for (let i = 0; i < maxItems; i++) indices.add(Math.round(i * paso));
  return items.filter((_, i) => indices.has(i));
}

export function HistorialCompletoChart({ filas }: Props) {
  const data = useMemo(() => {
    const muestreadas = muestrear(filas, MAX_BARRAS);
    return muestreadas.map((f, i) => ({
      posicion: i + 1,
      id_ejecucion: f.id_ejecucion,
      fibonacci_n: Number(f.fibonacci_n ?? 0),
    }));
  }, [filas]);

  if (filas.length === 0) {
    return <p className="muted">Todavía no hay historial de Fibonacci para graficar.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 4, bottom: 4 }}>
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
        <XAxis
          dataKey="posicion"
          stroke={AXIS_COLOR}
          tick={{ fill: TEXT_MUTED, fontSize: 12 }}
          label={{ value: "ID de la serie (todas las ejecuciones)", position: "insideBottom", offset: -2, fill: TEXT_MUTED, fontSize: 12 }}
        />
        <YAxis
          scale="log"
          domain={["auto", "auto"]}
          allowDataOverflow
          stroke={AXIS_COLOR}
          tick={{ fill: TEXT_MUTED, fontSize: 12 }}
          width={70}
          label={{ value: "Valor de la serie", angle: -90, position: "insideLeft", fill: TEXT_MUTED, fontSize: 12 }}
        />
        <Tooltip
          formatter={(value) => Number(value).toLocaleString("es")}
          labelFormatter={(_v, payload) => {
            const id = payload?.[0]?.payload?.id_ejecucion as string | undefined;
            return id ? `Ejecución ${id.slice(0, 8)}…` : "";
          }}
        />
        <Bar dataKey="fibonacci_n" name="F(n)" fill={COLOR_FIBONACCI_N} radius={[2, 2, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}