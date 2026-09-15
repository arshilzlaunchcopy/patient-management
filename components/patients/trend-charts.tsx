"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDate, formatDayMonth } from "@/lib/dates";
import type { Visit } from "@/lib/types";
import { cardClass } from "@/components/ui/styles";

interface Point {
  date: string;
  label: string;
  hba1c: number | null;
  fbs: number | null;
  weight: number | null;
  sys: number | null;
  dia: number | null;
}

type Key = Exclude<keyof Point, "date" | "label">;

interface ChartSpec {
  id: string;
  title: string;
  lines: { key: Key; name: string; stroke: string }[];
  reference?: { y: number; label: string };
}

const ACCENT = "#0f766e";
const NEUTRAL = "#737373";

const CHARTS: ChartSpec[] = [
  {
    id: "hba1c",
    title: "HbA1c (%)",
    lines: [{ key: "hba1c", name: "HbA1c", stroke: ACCENT }],
    reference: { y: 7, label: "7%" },
  },
  {
    id: "fbs",
    title: "Fasting sugar (mmol/L)",
    lines: [{ key: "fbs", name: "FBS", stroke: ACCENT }],
  },
  {
    id: "weight",
    title: "Weight (kg)",
    lines: [{ key: "weight", name: "Weight", stroke: ACCENT }],
  },
  {
    id: "bp",
    title: "Blood pressure (mmHg)",
    lines: [
      { key: "sys", name: "Systolic", stroke: ACCENT },
      { key: "dia", name: "Diastolic", stroke: NEUTRAL },
    ],
  },
];

const num = (v: number | null) => (v === null ? null : Number(v));

/**
 * One small line chart per measurement, oldest to newest.
 * A chart is rendered only if at least one visit recorded that value.
 */
export function TrendCharts({ visits }: { visits: Visit[] }) {
  const points: Point[] = [...visits]
    .sort((a, b) => a.visit_date.localeCompare(b.visit_date))
    .map((v) => ({
      date: v.visit_date,
      label: formatDayMonth(v.visit_date),
      hba1c: num(v.hba1c),
      fbs: num(v.fbs),
      weight: num(v.weight_kg),
      sys: num(v.bp_systolic),
      dia: num(v.bp_diastolic),
    }));

  const charts = CHARTS.filter((c) =>
    points.some((p) => c.lines.some((l) => p[l.key] !== null)),
  );

  if (charts.length === 0) return null;

  return (
    <section className="mb-10">
      <h2 className="mb-3 text-lg font-semibold text-neutral-900">Trends</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {charts.map((c) => (
          <div key={c.id} className={`${cardClass} p-4`}>
            <h3 className="mb-2 text-sm font-medium text-neutral-700">
              {c.title}
            </h3>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={points}
                  margin={{ top: 8, right: 12, bottom: 0, left: -12 }}
                >
                  <CartesianGrid stroke="#e5e5e5" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12, fill: "#525252" }}
                    tickLine={false}
                    axisLine={{ stroke: "#d4d4d4" }}
                  />
                  <YAxis
                    domain={["auto", "auto"]}
                    tick={{ fontSize: 12, fill: "#525252" }}
                    tickLine={false}
                    axisLine={false}
                    width={44}
                  />
                  <Tooltip
                    labelFormatter={(_, payload) => {
                      const p = payload?.[0]?.payload as Point | undefined;
                      return p ? formatDate(p.date) : "";
                    }}
                    contentStyle={{
                      fontSize: 13,
                      borderRadius: 6,
                      borderColor: "#d4d4d4",
                    }}
                  />
                  {c.reference ? (
                    <ReferenceLine
                      y={c.reference.y}
                      stroke="#a3a3a3"
                      strokeDasharray="4 4"
                      label={{
                        value: c.reference.label,
                        position: "right",
                        fontSize: 11,
                        fill: "#737373",
                      }}
                    />
                  ) : null}
                  {c.lines.map((l) => (
                    <Line
                      key={l.key}
                      type="monotone"
                      dataKey={l.key}
                      name={l.name}
                      stroke={l.stroke}
                      strokeWidth={2}
                      dot={{ r: 3, strokeWidth: 0, fill: l.stroke }}
                      activeDot={{ r: 5 }}
                      connectNulls
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
