import { useConveyor } from "@/lib/conveyor/store";
import { cn } from "@/lib/utils";
import type { Condition } from "@/lib/conveyor/types";
import { Panel, StatusBadge, conditionClasses } from "./primitives";

function jointTone(c: Condition) {
  switch (c) {
    case "NORMAL":
      return "border-normal/60 bg-normal-soft text-normal";
    case "WARNING":
      return "border-warning/60 bg-warning-soft text-warning";
    case "CRITICAL":
      return "border-critical/70 bg-critical-soft text-critical";
    default:
      return "border-border bg-secondary text-muted-foreground";
  }
}

export function LiveConveyorMonitor() {
  const { joints, selectedJointId, selectJoint, activeScenario, prediction } = useConveyor();

  return (
    <Panel
      bare
      id="conveyor"
      title="Live Conveyor Monitor"
      subtitle="Motor → Drive pulley → Belt → Rollers → 5 splice joints → Tail pulley · select a joint to inspect"
      actions={
        <StatusBadge
          condition={activeScenario ? prediction.riskLevel : "UNKNOWN"}
          label={activeScenario ? `Belt ${prediction.riskLevel}` : "Awaiting data"}
          pulse={prediction.riskLevel === "CRITICAL"}
        />
      }
      bodyClassName="pt-8 pb-10"
    >
      <div className="overflow-x-auto pb-1">
        <div className="min-w-[640px]">
          {/* machine row */}
          <div className="relative flex items-stretch gap-1.5">
            {/* motor */}
            <div className="flex w-20 shrink-0 flex-col items-center justify-end gap-1 sm:w-24">
              <div className="relative h-14 w-full rounded-sm border border-steel bg-steel-dark">
                <div className="hatch absolute inset-1.5 rounded-[2px] opacity-70" />
                <div className="absolute inset-x-2 bottom-1.5 h-1.5 rounded-full bg-info/70" />
                <div className="absolute top-1 right-1 size-2 rounded-full bg-normal pulse-dot" />
              </div>
              <span className="label-caps">Motor</span>
            </div>

            {/* drive pulley */}
            <div className="flex w-14 shrink-0 flex-col items-center justify-end gap-1">
              <div className="grid h-14 place-items-center">
                <span className="grid size-11 place-items-center rounded-full border-2 border-steel bg-steel-dark">
                  <span className="size-5 animate-spin rounded-full border-2 border-info/70 border-t-transparent [animation-duration:2.4s]" />
                </span>
              </div>
              <span className="label-caps text-center leading-tight">Drive<br />Pulley</span>
            </div>

            {/* belt span */}
            <div className="relative min-w-0 flex-1">
              <div className="relative h-14">
                {/* belt */}
                <div className="belt-surface absolute inset-x-0 top-3 h-8 border-y border-steel" />
                {/* joints */}
                {joints.map((j) => {
                  const selected = j.id === selectedJointId;
                  return (
                    <button
                      key={j.id}
                      type="button"
                      onClick={() => selectJoint(j.id)}
                      aria-pressed={selected}
                      aria-label={`${j.label} — condition ${j.condition}`}
                      title={`${j.label} — ${j.condition}`}
                      style={{ left: `${j.position}%` }}
                      className={cn(
                        "absolute top-0.5 -translate-x-1/2 rounded-sm border px-1.5 py-1 text-[0.5625rem] font-bold tracking-wider uppercase transition-all duration-200",
                        selected
                          ? "z-10 scale-115 border-info bg-info-soft text-info shadow-[0_0_0_3px_var(--info-soft)]"
                          : cn(jointTone(j.condition), "hover:scale-108 hover:border-info/70"),
                      )}
                    >
                      <span className="flex flex-col items-center gap-0.5">
                        <span
                          className={cn(
                            "size-1.5 rounded-full bg-current",
                            j.condition === "CRITICAL" && "pulse-dot",
                          )}
                        />
                        J{j.id.slice(-2)}
                      </span>
                      <span className="sr-only">{j.condition}</span>
                    </button>
                  );
                })}
              </div>
              {/* rollers */}
              <div className="mt-2 flex items-center justify-between px-1">
                {Array.from({ length: 14 }).map((_, i) => (
                  <span
                    key={i}
                    className="size-3 rounded-full border border-steel bg-steel-dark"
                    aria-hidden
                  >
                    <span className="block size-full animate-spin rounded-full border-t border-info/40 [animation-duration:1.8s]" />
                  </span>
                ))}
              </div>
              <div className="mt-2 text-center">
                <span className="label-caps">Conveyor Belt &amp; Rollers</span>
              </div>
            </div>

            {/* tail pulley */}
            <div className="flex w-14 shrink-0 flex-col items-center justify-end gap-1">
              <div className="grid h-14 place-items-center">
                <span className="grid size-11 place-items-center rounded-full border-2 border-steel bg-steel-dark">
                  <span className="size-5 animate-spin rounded-full border-2 border-muted-foreground/60 border-t-transparent [animation-duration:2.4s]" />
                </span>
              </div>
              <span className="label-caps text-center leading-tight">Tail<br />Pulley</span>
            </div>
          </div>
        </div>
      </div>

      {/* joint status strip — borderless, selection happens on the belt above */}
      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border/60 pt-3">
        {joints.map((j) => {
          const selected = j.id === selectedJointId;
          const c = conditionClasses(j.condition);
          return (
            <button
              key={j.id}
              type="button"
              onClick={() => selectJoint(j.id)}
              aria-pressed={selected}
              className="group flex min-h-9 items-center gap-2 text-left transition-colors"
            >
              <span className={cn("size-1.5 shrink-0 rounded-full bg-current", c.text)} aria-hidden />
              <span
                className={cn(
                  "text-xs font-semibold transition-colors",
                  selected ? "text-info" : "text-foreground group-hover:text-info-hover",
                )}
              >
                {j.label}
              </span>
              <span className={cn("text-[0.6875rem] font-semibold uppercase", c.text)}>
                {j.condition}
              </span>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}
