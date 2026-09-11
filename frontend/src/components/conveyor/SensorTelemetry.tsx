import {
  Activity,
  AudioLines,
  Gauge,
  MoveHorizontal,
  Thermometer,
  Timer,
  Weight,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useConveyor } from "@/lib/conveyor/store";
import { cn } from "@/lib/utils";
import type { SensorKey, SensorReading } from "@/lib/conveyor/types";
import { EmptyState, Panel, conditionClasses } from "./primitives";

const ICONS: Record<SensorKey, typeof Activity> = {
  vibration: Activity,
  temperature: Thermometer,
  tension: Gauge,
  load: Weight,
  speed: Timer,
  acoustic: AudioLines,
  current: Zap,
  alignment: MoveHorizontal,
};

const RANGES = [
  { key: "live", label: "Live", ms: 45_000 },
  { key: "1m",   label: "1 Min",  ms: 60_000 },
  { key: "5m",   label: "5 Min",  ms: 300_000 },
  { key: "15m",  label: "15 Min", ms: 900_000 },
] as const;
type RangeKey = (typeof RANGES)[number]["key"];

function Sparkline({ data, className }: { data: SensorReading[]; className?: string }) {
  const points = data.slice(-24);
  if (points.length < 2) return null;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * 100;
      const y = 26 - ((p.value - min) / span) * 22 - 2;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox="0 0 100 26"
      preserveAspectRatio="none"
      className={cn("h-7 w-full", className)}
      aria-hidden
    >
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function SensorTelemetry() {
  const { sensors, highlightedSensor, highlightSensor, activeScenario, arduinoData } = useConveyor();

  // Chart state
  const [tab, setTab] = useState<SensorKey>("vibration");
  const [range, setRange] = useState<RangeKey>("live");

  useEffect(() => {
    if (highlightedSensor) setTab(highlightedSensor);
  }, [highlightedSensor]);

  const chartSensor = sensors.find((s) => s.key === tab)!;
  const rangeMs = RANGES.find((r) => r.key === range)!.ms;

  const chartData = useMemo(() => {
    const cutoff = Date.now() - rangeMs;
    const points = chartSensor.history.filter((p) => p.t >= cutoff);
    const step = range === "15m" ? 3 : range === "5m" ? 2 : 1;
    return points
      .filter((_, i) => i % step === 0)
      .map((p) => ({
        time: new Date(p.t).toLocaleTimeString([], { minute: "2-digit", second: "2-digit" }),
        value: p.value,
      }));
  }, [chartSensor.history, rangeMs, range]);

  const c = conditionClasses(chartSensor.status);

  return (
    <Panel
      bare
      id="telemetry"
      title="Live Sensor Telemetry"
      subtitle={
        arduinoData
          ? "Live Arduino sensor data streaming"
          : activeScenario
            ? "Streaming simulated field readings"
            : "Awaiting live data"
      }
    >
      {/* Sensor card grid */}
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {sensors.map((s) => {
          const Icon = ICONS[s.key];
          const sc = conditionClasses(s.status);
          const highlighted = highlightedSensor === s.key;
          const live = s.value !== null;
          return (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => {
                  highlightSensor(highlighted ? null : s.key);
                  setTab(s.key);
                }}
                aria-pressed={highlighted}
                className={cn(
                  "w-full min-w-0 rounded-sm border bg-panel-raised p-3 text-left transition-colors",
                  highlighted ? "border-info ring-1 ring-info/50" : sc.border,
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <Icon className={cn("size-4 shrink-0", sc.text)} aria-hidden />
                    <span className="label-caps truncate">{s.name}</span>
                  </span>
                  <span
                    className={cn(
                      "flex shrink-0 items-center gap-1 text-[0.5625rem] font-bold tracking-wider uppercase",
                      live ? "text-normal" : "text-muted-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        live ? "bg-normal pulse-dot" : "bg-muted-foreground",
                      )}
                    />
                    {live ? "Live" : "Idle"}
                  </span>
                </div>

                {live ? (
                  <>
                    <div className={cn("tabular mt-1.5 flex items-baseline gap-1", sc.text)}>
                      <span className="text-2xl font-bold">{s.value}</span>
                      <span className="text-xs font-medium text-muted-foreground">{s.unit}</span>
                    </div>
                    <div className={cn("mt-1", sc.text)}>
                      <Sparkline data={s.history} />
                    </div>
                    <div className={cn("text-[0.6875rem] font-semibold tracking-wider uppercase", sc.text)}>
                      {s.status}
                    </div>
                  </>
                ) : (
                  <p className="mt-3 text-[0.6875rem] tracking-wider text-muted-foreground uppercase">
                    Awaiting live data
                  </p>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {/* Historical Chart with time-range controls */}
      <div className="mt-6 rounded-md border border-border/60 bg-panel-raised p-4">
        {/* Header row: sensor tabs + range buttons */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div
            role="tablist"
            aria-label="Sensor channel"
            className="-mx-1 flex flex-wrap gap-1 px-1"
          >
            {sensors.map((s) => (
              <button
                key={s.key}
                role="tab"
                type="button"
                aria-selected={tab === s.key}
                onClick={() => {
                  setTab(s.key);
                  highlightSensor(s.key);
                }}
                className={cn(
                  "min-h-8 shrink-0 rounded-sm border px-2.5 text-[0.6875rem] font-bold tracking-[0.12em] uppercase transition-colors",
                  tab === s.key
                    ? "border-info bg-info-soft text-info"
                    : "border-border bg-panel-raised text-muted-foreground hover:text-foreground",
                )}
              >
                {s.name}
              </button>
            ))}
          </div>

          {/* Time-range toggles */}
          <div role="group" aria-label="Time range" className="flex rounded-sm border border-border bg-background p-0.5">
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setRange(r.key)}
                aria-pressed={range === r.key}
                className={cn(
                  "min-h-8 rounded-sm px-2 text-[0.625rem] font-bold tracking-[0.12em] uppercase transition-colors",
                  range === r.key ? "bg-info-soft text-info" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Subtitle */}
        <p className="mb-3 text-[0.6875rem] text-muted-foreground">
          {arduinoData || activeScenario
            ? `${chartSensor.name} — rolling ${RANGES.find((r) => r.key === range)!.label.toLowerCase()} window`
            : "No live sensor data"}
        </p>

        {chartData.length < 2 ? (
          <EmptyState message="No live sensor data" />
        ) : (
          <div className="h-56 w-full sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 6, right: 8, bottom: 0, left: -12 }}>
                <defs>
                  <linearGradient id="sensorFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="currentColor" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--grid)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  stroke="var(--border)"
                  minTickGap={28}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  stroke="var(--border)"
                  width={44}
                  domain={["auto", "auto"]}
                  unit={` ${chartSensor.unit}`}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "var(--muted-foreground)" }}
                  formatter={(v: number) => [`${v} ${chartSensor.unit}`, chartSensor.name]}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  className={c.text}
                  stroke="currentColor"
                  strokeWidth={2}
                  fill="url(#sensorFill)"
                  isAnimationActive={false}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </Panel>
  );
}
