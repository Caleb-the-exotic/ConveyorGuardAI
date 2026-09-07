import { useConveyor } from "@/lib/conveyor/store";
import { cn } from "@/lib/utils";
import { EmptyState, Panel, conditionClasses } from "./primitives";

export function AIExplanation() {
  const { prediction } = useConveyor();
  const factors = [...prediction.factors].sort((a, b) => b.contribution - a.contribution);

  return (
    <Panel
      bare
      id="ai-explanation"
      title="AI Explanation"
      subtitle="Why the model predicts this risk level"
    >
      {factors.length === 0 ? (
        <EmptyState message="Awaiting prediction factors" />
      ) : (
        <ul className="space-y-2.5">
          {factors.map((f) => {
            const c = conditionClasses(f.status);
            return (
              <li key={f.label} className="min-w-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-xs font-semibold text-foreground">{f.label}</span>
                  <span className={cn("tabular shrink-0 text-xs font-bold", c.text)}>
                    {f.contribution}%
                  </span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    role="meter"
                    aria-label={`${f.label} contribution`}
                    aria-valuenow={f.contribution}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className={cn("h-full rounded-full bg-current transition-all duration-700", c.text)}
                    style={{ width: `${Math.max(0, Math.min(100, f.contribution))}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
