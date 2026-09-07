import { ClipboardList, Plus, Wrench } from "lucide-react";
import { useConveyor } from "@/lib/conveyor/store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { MaintenanceTask } from "@/lib/conveyor/types";
import { EmptyState, Panel } from "./primitives";

function priorityTone(p: MaintenanceTask["priority"]) {
  switch (p) {
    case "CRITICAL":
      return "border-critical/50 bg-critical-soft text-critical";
    case "HIGH":
      return "border-warning/50 bg-warning-soft text-warning";
    case "MEDIUM":
      return "border-info/40 bg-info-soft text-info";
    default:
      return "border-border bg-secondary text-muted-foreground";
  }
}

export function MaintenanceActions() {
  const { tasks, joints, selectJoint, setWorkOrderOpen } = useConveyor();

  return (
    <Panel
      id="maintenance-actions"
      title="Maintenance Actions"
      subtitle={
        tasks.length > 0 ? `${tasks.length} task${tasks.length > 1 ? "s" : ""} in queue` : "No tasks queued"
      }
      actions={
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setWorkOrderOpen(true)}
          className="min-h-9 text-[0.625rem] font-bold tracking-[0.14em] uppercase"
        >
          <Plus className="size-3.5" aria-hidden /> New Work Order
        </Button>
      }
    >
      {tasks.length === 0 ? (
        <EmptyState message="No maintenance tasks scheduled" />
      ) : (
        <ul className="space-y-2">
          {tasks.map((t) => {
            const joint = joints.find((j) => j.id === t.jointId);
            return (
              <li
                key={t.id}
                className="min-w-0 tile rounded-md p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <Wrench className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="truncate text-sm font-bold text-foreground">{t.issue}</span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-sm border px-2 py-0.5 text-[0.625rem] font-bold tracking-[0.14em] uppercase",
                      priorityTone(t.priority),
                    )}
                  >
                    {t.priority}
                  </span>
                </div>
                <div className="mt-1.5 grid gap-x-4 gap-y-0.5 text-[0.6875rem] text-muted-foreground sm:grid-cols-2">
                  <span className="truncate">Technician: {t.technician}</span>
                  <span className="truncate">Scheduled: {t.scheduledAt}</span>
                  <span className="truncate">Status: {t.status}</span>
                  <span className="truncate">
                    Source: {t.simulated ? "Simulated schedule" : "Created work order"}
                  </span>
                </div>
                {t.notes ? (
                  <p className="mt-1.5 rounded-sm border border-border bg-background/40 p-2 text-[0.6875rem] leading-relaxed text-foreground">
                    {t.notes}
                  </p>
                ) : null}
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[0.625rem] font-bold tracking-[0.14em] text-muted-foreground uppercase">
                    <ClipboardList className="size-3.5" aria-hidden /> {t.jointId}
                  </span>
                  {joint ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => selectJoint(joint.id)}
                      className="min-h-9 text-[0.625rem] font-bold tracking-[0.14em] uppercase"
                    >
                      Focus {joint.label}
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
