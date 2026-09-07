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
import type { SensorKey } from "@/lib/conveyor/types";
import { EmptyState, Panel, conditionClasses } from "./primitives";

const RANGES = [
  { key: "live", label: "Live", ms: 45_000 },
  { key: "1m", label: "1 Min", ms: 60_000 },
  { key: "5m", label: "5 Min", ms: 300_000 },
  { key: "15m", label: "15 Min", ms: 900_000 },
] as const;

type RangeKey = (typeof RANGES)[number]["key"];

export function SensorChart() {
  const { sensors, highlightedSensor, highlightSensor, activeScenario } = useConveyor();
  const [tab, setTab] = useState<SensorKey>("vibration");
  const [range, setRange] = useState<RangeKey>("live");

  useEffect(() => {
    if (highlightedSensor) setTab(highlightedSensor);
  }, [highlightedSensor]);

  const sensor = sensors.find((s) => s.key === tab)!;
  const rangeMs = RANGES.find((r) => r.key === range)!.ms;

  const data = useMemo(() => {
    const cutoff = Date.now() - rangeMs;
    const points = sensor.history.filter((p) => p.t >= cutoff);
    const step = range === "15m" ? 3 : range === "5m" ? 2 : 1;
    return points
      .filter((_, i) => i % step === 0)
      .map((p) => ({
        time: new Date(p.t).toLocaleTimeString([], { minute: "2-digit", second: "2-digit" }),
        value: p.value,
      }));
  }, [sensor.history, rangeMs, range]);

  const c = conditionClasses(sensor.status);

  return (
    <Panel
      bare
      id="sensor-chart"
      title="Real-Time Sensor Monitor"
      subtitle={
        activeScenario
          ? `${sensor.name} — rolling ${RANGES.find((r) => r.key === range)!.label.toLowerCase()} window`
          : "No live sensor data"
      }
      actions={
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
      }
    >
      <div
        role="tablist"
        aria-label="Sensor channel"
        className="-mx-1 mb-3 flex gap-1 overflow-x-auto px-1 pb-1"
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
              "min-h-9 shrink-0 rounded-sm border px-3 text-[0.6875rem] font-bold tracking-[0.12em] uppercase transition-colors",
              tab === s.key
                ? "border-info bg-info-soft text-info"
                : "border-border bg-panel-raised text-muted-foreground hover:text-foreground",
            )}
          >
            {s.name}
          </button>
        ))}
      </div>

      {data.length < 2 ? (
        <EmptyState message="No live sensor data" />
      ) : (
        <div className="h-56 w-full sm:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -12 }}>
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
                unit={` ${sensor.unit}`}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  fontSize: 12,
                }}
                labelStyle={{ color: "var(--muted-foreground)" }}
                formatter={(v: number) => [`${v} ${sensor.unit}`, sensor.name]}
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
    </Panel>
  );
}
