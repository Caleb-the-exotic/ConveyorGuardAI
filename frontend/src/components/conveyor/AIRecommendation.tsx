import { ClipboardList, Lightbulb } from "lucide-react";
import { useConveyor } from "@/lib/conveyor/store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState, Panel, StatusBadge, conditionClasses } from "./primitives";

export function AIRecommendation() {
  const { prediction, selectedJoint, activeScenario, setWorkOrderOpen } = useConveyor();
  const cond = activeScenario ? prediction.riskLevel : "UNKNOWN";
  const recommendation = selectedJoint?.recommendation ?? prediction.recommendation;

  return (
    <Panel
      id="ai-recommendation"
      title="AI Recommendation"
      subtitle={
        selectedJoint ? `Action for ${selectedJoint.label}` : "Action for the monitored belt"
      }
      actions={<StatusBadge condition={cond} pulse={cond === "CRITICAL"} />}
    >
      <div className="space-y-3">
        {!recommendation ? (
          <EmptyState message="Awaiting AI recommendation" />
        ) : (
          <div
            className={cn(
              "flex items-start gap-2 rounded-sm border p-3",
              conditionClasses(cond).border,
              conditionClasses(cond).bg,
            )}
          >
            <Lightbulb
              className={cn("mt-0.5 size-4 shrink-0", conditionClasses(cond).text)}
              aria-hidden
            />
            <p className="text-xs leading-relaxed text-foreground">{recommendation}</p>
          </div>
        )}

        <Button
          type="button"
          onClick={() => setWorkOrderOpen(true)}
          className="min-h-11 w-full text-[0.6875rem] font-bold tracking-[0.14em] uppercase"
        >
          <ClipboardList className="size-4" aria-hidden />
          Create Maintenance Work Order
        </Button>
      </div>
    </Panel>
  );
}
