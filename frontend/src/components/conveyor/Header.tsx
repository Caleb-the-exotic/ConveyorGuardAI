import { Link } from "@tanstack/react-router";
import { Bell, CircleUser, Factory, FlaskConical, Home, BrainCircuit } from "lucide-react";
import { useConveyor } from "@/lib/conveyor/store";
import { useAuth } from "@/lib/authContext";
import { StatusDot } from "./primitives";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Header() {
  const { mode, alerts } = useConveyor();
  const { user, openAuthModal } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-panel-raised/85 backdrop-blur-xl shadow-[0_1px_0_0_oklch(1_0_0/5%)_inset,0_8px_24px_-16px_oklch(0_0_0/80%)]">
      <div className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6 sm:py-3.5">
        {/* Brand / Logo */}
        <Link to="/" className="flex min-w-0 items-center gap-3 transition-opacity hover:opacity-90">
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
        </Link>

        {/* Navigation Links */}
        <nav aria-label="Main Navigation" className="flex items-center gap-1.5 rounded-lg border border-border/70 bg-secondary/40 p-1">
          <Link
            to="/"
            activeOptions={{ exact: true }}
            className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground transition-all hover:bg-secondary hover:text-foreground"
            activeProps={{
              className: "border border-info/40 bg-info-soft text-info shadow-sm hover:text-info",
            }}
          >
            <Home className="size-3.5" />
            <span>Home</span>
          </Link>

          <Link
            to="/simulation"
            className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground transition-all hover:bg-secondary hover:text-foreground"
            activeProps={{
              className: "border border-warning/40 bg-warning-soft text-warning shadow-sm hover:text-warning",
            }}
          >
            <FlaskConical className="size-3.5" />
            <span>Simulation</span>
          </Link>

          <Link
            to="/ai-insights"
            className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground transition-all hover:bg-secondary hover:text-foreground"
            activeProps={{
              className: "border border-info/40 bg-info-soft text-info shadow-sm hover:text-info",
            }}
          >
            <BrainCircuit className="size-3.5" />
            <span>AI Insights</span>
          </Link>
        </nav>

        {/* Right Action Icons & Status */}
        <div className="flex shrink-0 items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-normal/40 bg-normal-soft px-2.5 py-1.5 text-xs font-semibold tracking-wider text-normal uppercase">
            <StatusDot condition="NORMAL" pulse />
            Live System
          </span>

          <Popover>
            <PopoverTrigger asChild>
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
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0 overflow-hidden border-border/80 bg-panel/95 backdrop-blur-xl shadow-2xl">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-secondary/20">
                <h3 className="font-bold text-sm tracking-tight">Notification History</h3>
                <span className="text-xs text-muted-foreground">{alerts.length} Total</span>
              </div>
              <div className="max-h-[300px] overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                {alerts.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    {alerts.map((alert) => (
                      <div key={alert.id} className="flex flex-col gap-1 rounded-md p-3 hover:bg-secondary/40 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <span className={cn(
                            "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wider",
                            alert.severity === "CRITICAL" ? "bg-critical/20 text-critical border border-critical/30" : 
                            alert.severity === "WARNING" ? "bg-warning/20 text-warning border border-warning/30" : 
                            "bg-normal/20 text-normal border border-normal/30"
                          )}>
                            {alert.severity}
                          </span>
                          <span className="text-[0.65rem] text-muted-foreground font-mono truncate">{alert.timestamp}</span>
                        </div>
                        <p className="text-xs font-semibold text-foreground leading-tight mt-1">{alert.title}</p>
                        <p className="text-[0.65rem] text-muted-foreground truncate">{alert.condition}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 text-center">
                    <Bell className="size-8 text-muted-foreground/30 mb-2" />
                    <p className="text-xs text-muted-foreground">No notifications yet</p>
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>

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
