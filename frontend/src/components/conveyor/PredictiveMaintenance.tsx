import { Brain } from "lucide-react";
import { useConveyor } from "@/lib/conveyor/store";
import { cn } from "@/lib/utils";
import { Bar, Metric, Panel, StatusBadge, conditionClasses } from "./primitives";

export function PredictiveMaintenance() {
  const { prediction, activeScenario, selectedJoint } = useConveyor();
  const cond = activeScenario ? prediction.riskLevel : "UNKNOWN";

  return (
    <Panel
      bare
      id="predictive-maintenance"
      title="Predictive Maintenance"
      subtitle="Joint rupture prediction model"
      actions={
        <StatusBadge
          condition={cond}
          label={activeScenario ? `Risk ${prediction.riskLevel}` : "Awaiting data"}
          pulse={prediction.riskLevel === "CRITICAL"}
        />
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-x-8 gap-y-6 lg:grid-cols-4 lg:divide-x lg:divide-border/60 lg:[&>div:first-child]:pl-0 lg:[&>div:last-child]:pr-0 lg:[&>div]:px-8">
          <Metric
            flat
            label="Belt Health"
            value={prediction.beltHealth}
            unit="%"
            condition={cond}
            hint={activeScenario ? "Whole-belt integrity" : "Awaiting live data"}
          />
          <Metric
            flat
            label="Joint Health"
            value={prediction.jointHealth}
            unit="%"
            condition={cond}
            hint={activeScenario ? "Weakest splice" : "Awaiting live data"}
          />
          <Metric
            flat
            label="Failure Probability"
            value={
              prediction.failureProbability === null
                ? null
                : Math.round(prediction.failureProbability * 100)
            }
            unit="%"
            condition={cond}
            hint={activeScenario ? "Next 24 h" : "Awaiting prediction"}
          />
          <Metric
            flat
            label="Remaining Useful Life"
            value={prediction.rulHours}
            unit="h"
            condition={cond}
            hint={activeScenario ? "Before intervention" : "Awaiting prediction"}
          />
        </div>

        {prediction.beltHealth !== null ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="label-caps mb-1.5">Belt Health Index</div>
              <Bar value={prediction.beltHealth} condition={cond} />
            </div>
            <div>
              <div className="label-caps mb-1.5">Joint Health Index</div>
              <Bar value={prediction.jointHealth ?? 0} condition={cond} />
            </div>
          </div>
        ) : null}

        <div className="flex items-start gap-2 border-t border-border/60 pt-4">
          <Brain className={cn("mt-0.5 size-4 shrink-0", conditionClasses(cond).text)} aria-hidden />
          <div className="min-w-0">
            <div className="label-caps">Model Status</div>
            <p className="text-xs leading-relaxed text-foreground">{prediction.status}</p>
            {selectedJoint ? (
              <p className="mt-1 text-[0.6875rem] text-muted-foreground">
                Focused joint: {selectedJoint.label} · risk {selectedJoint.riskLevel}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </Panel>
  );
}
