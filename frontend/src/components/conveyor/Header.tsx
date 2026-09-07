import { Bell, CircleUser, Factory } from "lucide-react";
import { useConveyor } from "@/lib/conveyor/store";
import { useAuth } from "@/lib/authContext";
import { StatusDot } from "./primitives";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

export function Header() {
  const { mode, alerts } = useConveyor();
  const { user, openAuthModal } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-panel-raised/85 backdrop-blur-xl shadow-[0_1px_0_0_oklch(1_0_0/5%)_inset,0_8px_24px_-16px_oklch(0_0_0/80%)]">
      <div className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6 sm:py-3.5">
        {/* Brand / Logo */}
        {/* Brand / Logo (non-link) */}
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-info/40 bg-info-soft text-info shadow-[0_0_20px_-6px_var(--info)]">
            <Factory className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-base font-extrabold tracking-[0.08em] text-foreground uppercase sm:text-lg">
              ConveyorGuard AI
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              Real-Time Conveyor Health Monitoring
            </p>
          </div>
        </div>

        {/* Right Action Icons & Status */}
        <div className="flex shrink-0 items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-normal/40 bg-normal-soft px-2.5 py-1.5 text-xs font-semibold tracking-wider text-normal uppercase">
            <StatusDot condition="NORMAL" pulse />
            Live System
          </span>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Notifications: ${alerts.length} active alerts`}
                className="relative min-h-10 min-w-10 rounded-md"
              >
                <Bell className="size-4" aria-hidden />
                {alerts.length > 0 ? (
                  <span className="tabular absolute top-1 right-1 grid size-4 place-items-center rounded-full bg-critical text-[0.5625rem] font-bold text-background">
                    {alerts.length}
                  </span>
                ) : null}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{alerts.length} active alerts</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={openAuthModal}
                aria-label={user ? `Signed in as ${user.name}` : "Operator Google Sign In"}
                className="relative min-h-10 min-w-10 rounded-md p-0.5 hover:bg-secondary/70 transition-colors"
              >
                {user ? (
                  <div className="relative">
                    <span className="grid size-7 place-items-center rounded-full bg-info/25 text-xs font-black text-info border border-info/60 shadow-sm">
                      {user.email ? user.email.charAt(0).toUpperCase() : user.name ? user.name.charAt(0).toUpperCase() : "U"}
                    </span>
                    <span className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full border border-background bg-normal" />
                  </div>
                ) : (
                  <CircleUser className="size-4" aria-hidden />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {user ? `${user.name} (${user.role})` : "Login with Google (Control Room Operator)"}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {mode === "SIMULATION" ? (
        <div className="flex items-center justify-center gap-2 border-t border-warning/30 bg-warning-soft px-4 py-1.5 text-center text-xs font-semibold tracking-wider text-warning uppercase">
          <span>Simulation Mode Active — values shown are generated demonstration data</span>
        </div>
      ) : null}
    </header>
  );
}
