import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Condition } from "@/lib/conveyor/types";

export const conditionText: Record<Condition, string> = {
  NORMAL: "🟢 Normal",
  WARNING: "🟠 Warning",
  CRITICAL: "🔴 Critical",
  UNKNOWN: "⚪ Unknown",
};

export function conditionClasses(c: Condition) {
  switch (c) {
    case "NORMAL":
      return { text: "text-normal", bg: "bg-normal-soft", border: "border-normal/40" };
    case "WARNING":
      return { text: "text-warning", bg: "bg-warning-soft", border: "border-warning/40" };
    case "CRITICAL":
      return {
        text: "text-critical",
        bg: "bg-critical-soft",
        border: "border-critical/50",
      };
    default:
      return {
        text: "text-muted-foreground",
        bg: "bg-muted/40",
        border: "border-border",
      };
  }
}

export function StatusDot({
  condition,
  pulse = false,
  className,
}: {
  condition: Condition;
  pulse?: boolean;
  className?: string;
}) {
  const c = conditionClasses(condition);
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-2 shrink-0 rounded-full bg-current",
        c.text,
        pulse && "pulse-dot",
        className,
      )}
    />
  );
}

export function StatusBadge({
  condition,
  label,
  pulse,
}: {
  condition: Condition;
  label?: string;
  pulse?: boolean;
}) {
  const c = conditionClasses(condition);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.6875rem] font-semibold tracking-wider uppercase",
        c.text,
        c.bg,
        c.border,
      )}
    >
      <StatusDot condition={condition} pulse={pulse ?? false} />
      {label ?? condition}
    </span>
  );
}

export function Panel({
  id,
  title,
  subtitle,
  actions,
  children,
  className,
  bodyClassName,
  bare = false,
}: {
  id?: string;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  bare?: boolean;
}) {
  return (
    <section
      id={id}
      aria-label={title}
      className={cn("scroll-mt-28", bare ? "panel-bare" : "panel overflow-hidden", className)}
    >
      <header
        className={cn(
          "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3",
          bare
            ? "border-b border-border/60 px-0 pb-2"
            : "panel-head relative border-b border-border/70 px-3 py-2.5 sm:px-4",
        )}
      >
        {!bare ? (
          <span aria-hidden className="absolute inset-y-2.5 left-0 w-[2px] rounded-full bg-info" />
        ) : null}
        <div className={cn("min-w-0", bare ? "" : "pl-2.5")}>
          <h2
            className={cn(
              "truncate font-bold text-foreground uppercase",
              bare ? "text-[0.8125rem] tracking-[0.18em]" : "text-xs tracking-[0.14em]",
            )}
          >
            {title}
          </h2>
          {subtitle ? (
            <p className="truncate text-[0.6875rem] text-muted-foreground normal-case">{subtitle}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </header>
      <div className={cn(bare ? "pt-4" : "p-3 sm:p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex min-h-20 items-center justify-center px-4 py-6 text-center text-xs tracking-wide text-muted-foreground uppercase">
      {message}
    </div>
  );
}

export function Metric({
  label,
  value,
  unit,
  condition = "UNKNOWN",
  hint,
  flat = false,
}: {
  label: string;
  value: string | number | null;
  unit?: string;
  condition?: Condition;
  hint?: string;
  flat?: boolean;
}) {
  const c = conditionClasses(condition);
  return (
    <div className={cn("min-w-0", flat ? "metric-cell" : "tile tile-hover rounded-md p-3")}>
      <div className="label-caps truncate">{label}</div>
      <div
        className={cn(
          "tabular mt-1.5 flex items-baseline gap-1 font-bold tracking-tight",
          flat ? "text-[1.75rem] leading-none" : "text-2xl",
          c.text,
        )}
      >
        <span className="truncate">{value ?? "—"}</span>
        {unit && value !== null ? (
          <span className="text-xs font-medium text-muted-foreground">{unit}</span>
        ) : null}
      </div>
      <div className="mt-1.5 truncate text-[0.6875rem] text-muted-foreground normal-case">
        {hint ?? conditionText[condition]}
      </div>
    </div>
  );
}

export function Bar({ value, condition }: { value: number; condition: Condition }) {
  const c = conditionClasses(condition);
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary shadow-[0_1px_0_0_oklch(1_0_0/5%)_inset]">
      <div
        className={cn("h-full rounded-full bg-current transition-all duration-700", c.text)}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function getDefectStyle(label: string) {
  const l = label.toLowerCase();
  if (l.includes("conveyor belt") || l === "belt" || l.includes("belt surface")) {
    return {
      border: "border-emerald-500 bg-emerald-500/15",
      badge: "border-emerald-500 bg-emerald-600 text-white font-bold",
      text: "text-emerald-400 font-bold",
      severity: "NORMAL" as Condition,
    };
  }
  if (l.includes("crack") || l.includes("tear") || l.includes("fracture") || l.includes("fissure")) {
    return {
      border: "border-red-500 bg-red-500/10",
      badge: "border-red-500 bg-red-600 text-white font-bold",
      text: "text-red-500 font-bold",
      severity: "CRITICAL" as Condition,
    };
  }
  if (l.includes("puncture") || l.includes("hole") || l.includes("gouge") || l.includes("perforation")) {
    return {
      border: "border-amber-500 bg-amber-500/10",
      badge: "border-amber-500 bg-amber-500 text-black font-extrabold",
      text: "text-amber-500 font-bold",
      severity: "CRITICAL" as Condition,
    };
  }
  if (l.includes("patch") || l.includes("wear") || l.includes("abrasion") || l.includes("damage") || l.includes("anomaly") || l.includes("joint") || l.includes("splice") || l.includes("misalignment")) {
    return {
      border: "border-yellow-400 bg-yellow-400/10",
      badge: "border-yellow-400 bg-yellow-400 text-black font-extrabold",
      text: "text-yellow-400 font-bold",
      severity: "WARNING" as Condition,
    };
  }
  return {
    border: "border-cyan-400 bg-cyan-400/10",
    badge: "border-cyan-400 bg-cyan-500 text-white font-bold",
    text: "text-cyan-400 font-bold",
    severity: "INFO" as Condition,
  };
}

