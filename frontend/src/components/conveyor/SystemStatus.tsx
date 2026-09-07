import { Brain, Camera, Cpu, ShieldAlert } from "lucide-react";
import { Panel, StatusDot } from "./primitives";

const ITEMS = [
  { label: "Sensor Monitoring", icon: Cpu },
  { label: "AI Vision", icon: Camera },
  { label: "Predictive AI", icon: Brain },
  { label: "Alert Monitoring", icon: ShieldAlert },
];

export function SystemStatus() {
  return (
    <Panel
      bare
      title="System Status" subtitle="Subsystem availability">
      <ul className="grid grid-cols-2 gap-x-8 gap-y-5 lg:grid-cols-4">
        {ITEMS.map(({ label, icon: Icon }) => (
          <li
            key={label}
            className="flex min-w-0 items-center gap-2.5 border-l-2 border-border/60 pl-3"
          >
            <Icon className="size-4 shrink-0 text-info" aria-hidden />
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold text-foreground">{label}</div>
              <div className="flex items-center gap-1.5 text-[0.6875rem] font-semibold tracking-wider text-normal uppercase">
                <StatusDot condition="NORMAL" pulse />
                Active
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
