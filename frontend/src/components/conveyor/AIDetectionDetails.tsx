import { ScanSearch } from "lucide-react";
import { useConveyor } from "@/lib/conveyor/store";
import { cn } from "@/lib/utils";
import { EmptyState, Panel, StatusBadge, conditionClasses } from "./primitives";

export function AIDetectionDetails() {
  const { detections, activeDetectionId, focusDetection, joints } = useConveyor();

  return (
    <Panel
      id="ai-detections"
      title="AI Detection Details"
      subtitle={
        detections.length > 0
          ? `${detections.length} defect${detections.length > 1 ? "s" : ""} detected — select to focus camera`
          : "No defects detected"
      }
      actions={
        <span className="inline-flex items-center gap-1.5 text-[0.625rem] font-bold tracking-[0.14em] text-muted-foreground uppercase">
          <ScanSearch className="size-3.5" aria-hidden /> Vision Model
        </span>
      }
    >
      {detections.length === 0 ? (
        <EmptyState message="Awaiting AI inspection" />
      ) : (
        <ul className="space-y-2">
          {detections.map((d) => {
            const isActive = d.id === activeDetectionId;
            const c = conditionClasses(d.severity);
            const joint = joints.find((j) => j.id === d.jointId);
            return (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => focusDetection(d.id)}
                  aria-pressed={isActive}
                  className={cn(
                    "w-full min-w-0 rounded-sm border bg-panel-raised p-3 text-left transition-colors",
                    isActive ? "border-info ring-1 ring-info" : "border-border hover:border-info/60",
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className={cn("truncate text-sm font-bold", c.text)}>{d.type}</span>
                      <StatusBadge condition={d.severity} />
                    </span>
                    <span className="tabular text-xs font-bold text-foreground">
                      {Math.round(d.confidence * 100)}%
                    </span>
                  </div>
                  <div className="mt-1.5 grid gap-x-4 gap-y-0.5 text-[0.6875rem] text-muted-foreground sm:grid-cols-2">
                    <span className="truncate">Location: {d.location}</span>
                    <span className="truncate">
                      Joint: {joint ? `${joint.label} · ${d.jointId}` : d.jointId}
                    </span>
                    <span className="truncate">Detected: {d.detectedAt}</span>
                    <span className="truncate">
                      {isActive ? "Focused in camera view" : "Click to focus camera"}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
