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
import { useConveyor } from "@/lib/conveyor/store";
import { EmptyState, Panel, StatusBadge } from "./primitives";

export function CurrentDegradation() {
  const { prediction, activeScenario } = useConveyor();
  const data = prediction.degradation.map((d) => ({
    ...d,
    label: d.t === 0 ? "now" : d.t < 0 ? `${d.t}h` : `+${d.t}h`,
  }));

  return (
    <Panel
      bare
      id="degradation"
      title="Current Degradation"
      subtitle="Belt health trend — measured history and model forecast"
      actions={
        <StatusBadge
          condition={activeScenario ? prediction.riskLevel : "UNKNOWN"}
          label={activeScenario ? "Trend Active" : "Awaiting data"}
        />
      }
    >
      {data.length === 0 ? (
        <EmptyState message="Awaiting degradation data" />
      ) : (
        <>
          <div className="h-56 w-full sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 6, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--border)" }}
                  interval="preserveStartEnd"
                  minTickGap={16}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--border)" }}
                  width={44}
                  unit="%"
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--panel)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "var(--muted-foreground)" }}
                  formatter={(v: number | string, name: string) => [
                    `${v}%`,
                    name === "current" ? "Measured" : "Predicted",
                  ]}
                />
                <ReferenceLine x="now" stroke="var(--info)" strokeDasharray="4 4" />
                <Line
                  type="monotone"
                  dataKey="current"
                  stroke="var(--info)"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="predicted"
                  stroke="var(--critical)"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-[0.6875rem] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-5 bg-info" aria-hidden /> Measured belt health
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="h-0.5 w-5 bg-critical"
                style={{ maskImage: "repeating-linear-gradient(90deg,#000 0 5px,transparent 5px 9px)" }}
                aria-hidden
              />
              Predicted degradation
            </span>
          </div>
        </>
      )}
    </Panel>
  );
}
