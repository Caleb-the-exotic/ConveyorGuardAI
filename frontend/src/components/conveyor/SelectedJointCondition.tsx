import { AlertTriangle } from "lucide-react";
import { useConveyor } from "@/lib/conveyor/store";
import { cn } from "@/lib/utils";
import { Bar, EmptyState, Metric, Panel, StatusBadge, conditionClasses } from "./primitives";

export function SelectedJointCondition() {
  const { selectedJoint, activeScenario } = useConveyor();

  return (
    <Panel
      bare
      id="selected-joint"
      title="Selected Joint Condition"
      subtitle="Joint rupture prevention — primary failure mode"
      actions={
        selectedJoint ? (
          <StatusBadge
            condition={selectedJoint.condition}
            pulse={selectedJoint.condition === "CRITICAL"}
          />
        ) : null
      }
    >
      {!selectedJoint ? (
        <EmptyState message="Select a belt joint to inspect its condition." />
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <div className="label-caps">Joint Identifier</div>
              <div className="tabular text-2xl font-bold text-foreground">
                {selectedJoint.label} · {selectedJoint.id}
              </div>
            </div>
            <div className="text-right">
              <div className="label-caps">Risk Level</div>
              <div
                className={cn(
                  "text-sm font-bold tracking-[0.14em] uppercase",
                  conditionClasses(selectedJoint.riskLevel).text,
                )}
              >
                {selectedJoint.riskLevel}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-5 border-t border-border/60 pt-4 lg:grid-cols-4">
            <Metric
              flat
              label="Health Score"
              value={selectedJoint.healthScore}
              unit="%"
              condition={selectedJoint.condition}
              hint={activeScenario ? "Splice integrity index" : "Awaiting live data"}
            />
            <Metric
              flat
              label="Failure Probability"
              value={
                selectedJoint.failureProbability === null
                  ? null
                  : Math.round(selectedJoint.failureProbability * 100)
              }
              unit="%"
              condition={selectedJoint.condition}
              hint={activeScenario ? "Next 24 h" : "Awaiting prediction"}
            />
            <Metric
              flat
              label="Remaining Useful Life"
              value={selectedJoint.rulHours}
              unit="h"
              condition={selectedJoint.condition}
              hint={activeScenario ? "Before intervention required" : "Awaiting prediction"}
            />
            <Metric
              flat
              label="Inspection Status"
              value={selectedJoint.inspectionStatus}
              condition={selectedJoint.condition}
              hint={activeScenario ? "AI vision pipeline" : "No inspection data"}
            />
          </div>

          {selectedJoint.healthScore !== null ? (
            <div className="border-t border-border/60 pt-4">
              <div className="label-caps mb-2">Joint Health</div>
              <Bar value={selectedJoint.healthScore} condition={selectedJoint.condition} />
            </div>
          ) : null}

          <div className="border-t border-border/60 pt-4">
            <div className="label-caps mb-2">Detected Issues</div>
            {selectedJoint.issues.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {activeScenario ? "No issues detected on this joint." : "Awaiting inspection data."}
              </p>
            ) : (
              <ul className="space-y-2">
                {selectedJoint.issues.map((issue) => (
                  <li key={issue} className="flex items-start gap-2 text-xs leading-relaxed">
                    <AlertTriangle
                      className={cn(
                        "mt-0.5 size-3.5 shrink-0",
                        conditionClasses(selectedJoint.condition).text,
                      )}
                      aria-hidden
                    />
                    <span className="text-foreground">{issue}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-border/60 pt-4">
            <div className="label-caps mb-2">AI Recommendation</div>
            <p className="border-l-2 border-info pl-3 text-xs leading-relaxed text-foreground">
              {selectedJoint.recommendation ?? "Awaiting inspection data."}
            </p>
          </div>
        </div>
      )}
    </Panel>
  );
}
