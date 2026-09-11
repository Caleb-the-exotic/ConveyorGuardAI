import { useConveyor } from "@/lib/conveyor/store";
import { cn } from "@/lib/utils";
import { Panel, StatusBadge, conditionClasses } from "./primitives";

export function BeltCondition() {
  const { beltAspects, activeScenario, prediction } = useConveyor();

  return (
    <Panel
      bare
      id="belt-condition"
      title="Belt Condition"
      subtitle="Single belt — structural and surface assessment"
      actions={
        <StatusBadge
          condition={prediction.beltHealth !== null ? prediction.riskLevel : (activeScenario ? prediction.riskLevel : "UNKNOWN")}
          label={prediction.beltHealth !== null ? prediction.riskLevel : (activeScenario ? prediction.riskLevel : "Unknown")}
        />
      }
    >
      <ul className="grid gap-x-8 gap-y-6 sm:grid-cols-2 xl:grid-cols-3">
        {beltAspects.map((a) => {
          const c = conditionClasses(a.status);
          const displayBadge = a.classification ? a.classification : a.status;
          const barWidth =
            a.score !== null && a.score !== undefined
              ? `${Math.max(0, Math.min(100, Math.round(a.score)))}%`
              : a.status === "NORMAL"
                ? "92%"
                : a.status === "WARNING"
                  ? "58%"
                  : a.status === "CRITICAL"
                    ? "26%"
                    : "0%";

          return (
            <li
              key={a.key}
              className={cn("min-w-0 border-l-2 pl-3", c.border)}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="label-caps truncate">{a.label}</span>
                <span
                  className={cn(
                    "shrink-0 text-[0.6875rem] font-bold tracking-wider uppercase",
                    c.text,
                  )}
                >
                  {displayBadge}
                </span>
              </div>
              <p className="mt-1.5 truncate text-xs text-foreground font-medium">{a.detail}</p>
              <div className={cn("mt-2 h-1 w-full rounded-full", c.bg)}>
                <div
                  className={cn("h-full rounded-full bg-current transition-all duration-500", c.text)}
                  style={{ width: barWidth }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
