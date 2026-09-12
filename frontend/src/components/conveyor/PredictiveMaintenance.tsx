import { Brain } from "lucide-react";
import { useConveyor } from "@/lib/conveyor/store";
import { cn } from "@/lib/utils";
import { Bar, Metric, Panel, StatusBadge, conditionClasses } from "./primitives";

export function PredictiveMaintenance() {
  const { prediction, activeScenario, selectedJoint, liveDetections, overallCondition, mode } = useConveyor();
  const cond = activeScenario ? prediction.riskLevel : "UNKNOWN";

  const failRisk = prediction.failureProbability !== null ? Math.round(prediction.failureProbability * 100) : null;
  let riskLabel = "Awaiting Data";
  if (failRisk !== null) {
    if (failRisk <= 20) riskLabel = "Very Low";
    else if (failRisk <= 40) riskLabel = "Low";
    else if (failRisk <= 60) riskLabel = "Moderate";
    else if (failRisk <= 80) riskLabel = "High";
    else riskLabel = "Critical";
  }

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
      <div className="space-y-6">
        {/* AI Summary & Maintenance KPIs */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="tile rounded-md p-4">
            <div className="label-caps">Estimated Failure Risk Score</div>
            <div className="tabular mt-2 text-2xl font-extrabold text-foreground">
              {failRisk !== null ? `${failRisk} / 100` : "Awaiting Data"}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{riskLabel}</div>
          </div>

          <div className="tile rounded-md p-4">
            <div className="label-caps">Est. Remaining Life (RUL)</div>
            <div className="tabular mt-2 text-2xl font-extrabold text-foreground">
              {prediction.rulHours !== null ? `${prediction.rulHours} hrs` : "Awaiting Data"}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">Based on current belt tension & wear</div>
          </div>

          <div className="tile rounded-md p-4">
            <div className="label-caps">Vision Detections</div>
            <div className="tabular mt-2 text-2xl font-extrabold text-foreground">
              {liveDetections.length} Flagged
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {liveDetections.filter((d) => d.severity === "CRITICAL").length} critical defects
            </div>
          </div>

          <div className="tile rounded-md p-4">
            <div className="label-caps">Overall AI Health Assessment</div>
            <div className="mt-2 flex items-center gap-2">
              <StatusBadge condition={overallCondition} />
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {mode === "SIMULATION" ? "Simulated Scenario Active" : "Operational Telemetry"}
            </div>
          </div>
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

      </div>
    </Panel>
  );
}
