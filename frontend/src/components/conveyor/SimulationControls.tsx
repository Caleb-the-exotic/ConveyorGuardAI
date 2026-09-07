import { Activity, FlaskConical } from "lucide-react";
import { useConveyor } from "@/lib/conveyor/store";
import { cn } from "@/lib/utils";
import type { Scenario } from "@/lib/conveyor/types";

const SCENARIOS: Scenario[] = ["NORMAL", "WARNING", "CRITICAL"];

export function SimulationControls() {
  const { mode, setMode, scenario, setScenario } = useConveyor();

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border/60 pb-3">
      <div className="label-caps">Data Source</div>
      <div
        role="group"
        aria-label="Data source"
        className="flex gap-1"
      >
        <button
          type="button"
          onClick={() => setMode("LIVE")}
          aria-pressed={mode === "LIVE"}
          className={cn(
            "inline-flex min-h-9 items-center gap-1.5 rounded-sm px-3 text-[0.6875rem] font-bold tracking-[0.14em] uppercase transition-colors",
            mode === "LIVE"
              ? "bg-info-soft text-info"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Activity className="size-3.5" aria-hidden /> Live
        </button>
        <button
          type="button"
          onClick={() => setMode("SIMULATION")}
          aria-pressed={mode === "SIMULATION"}
          className={cn(
            "inline-flex min-h-9 items-center gap-1.5 rounded-sm px-3 text-[0.6875rem] font-bold tracking-[0.14em] uppercase transition-colors",
            mode === "SIMULATION"
              ? "bg-warning-soft text-warning"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <FlaskConical className="size-3.5" aria-hidden /> Simulation
        </button>
      </div>

      {mode === "SIMULATION" ? (
        <>
          <div className="label-caps ml-auto">Belt Condition Scenario</div>
          <div role="group" aria-label="Simulated belt condition" className="flex gap-1">
            {SCENARIOS.map((s) => {
              const active = scenario === s;
              const tone =
                s === "NORMAL"
                  ? "bg-normal-soft text-normal"
                  : s === "WARNING"
                    ? "bg-warning-soft text-warning"
                    : "bg-critical-soft text-critical";
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScenario(s)}
                  aria-pressed={active}
                  className={cn(
                    "min-h-9 rounded-sm px-3 text-[0.6875rem] font-bold tracking-[0.14em] uppercase transition-colors",
                    active ? tone : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <p className="ml-auto text-[0.6875rem] text-muted-foreground">
          Live data source connected — awaiting telemetry from field devices.
        </p>
      )}
    </div>
  );
}
