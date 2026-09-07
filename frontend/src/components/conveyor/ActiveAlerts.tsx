import { BellRing, Check } from "lucide-react";
import { useConveyor } from "@/lib/conveyor/store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState, Panel, StatusBadge, conditionClasses } from "./primitives";

export function ActiveAlerts() {
  const { alerts, activeAlertId, focusAlert, acknowledgeAlert, activeScenario } = useConveyor();
  const active = alerts.filter((a) => a.status === "ACTIVE");

  return (
    <Panel
      id="active-alerts"
      title="Active Alerts"
      subtitle={
        activeScenario
          ? `${active.length} active · ${alerts.length - active.length} acknowledged`
          : "No alert data"
      }
      actions={
        <span className="inline-flex items-center gap-1.5 text-[0.625rem] font-bold tracking-[0.14em] text-muted-foreground uppercase">
          <BellRing className="size-3.5" aria-hidden /> Alert Monitor
        </span>
      }
    >
      {alerts.length === 0 ? (
        <EmptyState message={activeScenario ? "No active alerts" : "Awaiting live data"} />
      ) : (
        <ul className="space-y-2">
          {alerts.map((a) => {
            const isActive = a.id === activeAlertId;
            const c = conditionClasses(a.severity);
            const acked = a.status === "ACKNOWLEDGED";
            return (
              <li
                key={a.id}
                className={cn(
                  "min-w-0 rounded-sm border bg-panel-raised transition-colors",
                  isActive ? "border-info ring-1 ring-info" : "border-border",
                  acked && "opacity-60",
                )}
              >
                <button
                  type="button"
                  onClick={() => focusAlert(a)}
                  aria-pressed={isActive}
                  className="w-full min-w-0 p-3 text-left"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className={cn("truncate text-sm font-bold", c.text)}>{a.title}</span>
                      <StatusBadge condition={a.severity} pulse={a.severity === "CRITICAL" && !acked} />
                    </span>
                    <span className="tabular shrink-0 text-[0.6875rem] text-muted-foreground">
                      {a.timestamp}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-foreground">{a.condition}</p>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[0.6875rem] text-muted-foreground">
                    <span className="truncate">Section: {a.section}</span>
                    <span className="truncate">Joint: {a.jointId}</span>
                    {a.sensorKey ? <span className="truncate">Sensor: {a.sensorKey}</span> : null}
                    {a.detectionId ? <span className="truncate">Detection: {a.detectionId}</span> : null}
                  </div>
                </button>
                <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-1.5">
                  <span
                    className={cn(
                      "text-[0.625rem] font-bold tracking-[0.14em] uppercase",
                      acked ? "text-muted-foreground" : c.text,
                    )}
                  >
                    {a.status}
                  </span>
                  {!acked ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => acknowledgeAlert(a.id)}
                      className="min-h-9 text-[0.625rem] font-bold tracking-[0.14em] uppercase"
                    >
                      <Check className="size-3.5" aria-hidden /> Acknowledge
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
