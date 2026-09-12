import { createFileRoute, Link } from "@tanstack/react-router";
import {
  FlaskConical,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Flame,
  Gauge,
  Layers,
  Play,
  RotateCcw,
  Sparkles,
  Zap,
  ArrowRight,
  ShieldAlert,
  Cpu,
  Eye,
  Radio,
} from "lucide-react";
import { useConveyor } from "@/lib/conveyor/store";
import { cn } from "@/lib/utils";
import type { Scenario, Condition } from "@/lib/conveyor/types";
import { Button } from "@/components/ui/button";
import { StatusDot, StatusBadge } from "@/components/conveyor/primitives";
import { ConveyorDigitalTwin } from "@/components/conveyor/ConveyorDigitalTwin";
import { toast } from "sonner";

const SCENARIOS: {
  id: Scenario;
  title: string;
  badge: string;
  condition: Condition;
  desc: string;
  symptoms: string[];
  metrics: { label: string; value: string; status: Condition }[];
}[] = [
  {
    id: "NORMAL",
    title: "Nominal Baseline",
    badge: "Optimal Operation",
    condition: "NORMAL",
    desc: "Steady-state operational conditions with balanced splice tension, minimal mechanical vibration, and normal thermal equilibrium across all five vulcanized joints.",
    symptoms: [
      "All 5 splice joints integrity > 94%",
      "Motor & pulley bearings running at optimal 38°C",
      "Vibration RMS amplitude stable at 1.4 mm/s",
      "AI vision confidence: Zero surface defect indications",
    ],
    metrics: [
      { label: "Rupture Risk", value: "< 0.8%", status: "NORMAL" },
      { label: "Est. Remaining Life", value: "> 4,200 hrs", status: "NORMAL" },
      { label: "Splice Health Avg", value: "98.2%", status: "NORMAL" },
    ],
  },
  {
    id: "WARNING",
    title: "Splice Fatigue & Friction",
    badge: "Early Degradation",
    condition: "WARNING",
    desc: "Elevated micro-slip and frictional heating detected at Splice Joint #2. Harmonic vibration anomalies indicate localized rubber delamination and steel cord fatigue.",
    symptoms: [
      "Splice #2 surface micro-cracking and cord shear stress",
      "Tail pulley bearing temperature rise to 58.4°C",
      "Edge flutter and mild belt tracking offset (4.2 mm)",
      "AI vision flagged longitudinal cover wear pattern",
    ],
    metrics: [
      { label: "Rupture Risk", value: "34.5%", status: "WARNING" },
      { label: "Est. Remaining Life", value: "~ 72 hrs", status: "WARNING" },
      { label: "Splice Health Avg", value: "68.4%", status: "WARNING" },
    ],
  },
  {
    id: "CRITICAL",
    title: "Imminent Splice Rupture",
    badge: "Emergency Hazard",
    condition: "CRITICAL",
    desc: "Severe structural rupture hazard on Splice Joint #3. Multiple internal steel cords parted with thermal runaway on drive snub pulley. Emergency maintenance intervention required immediately.",
    symptoms: [
      "Splice Joint #3 steel cord separation (82% rupture index)",
      "Drive pulley thermal surge exceeding 81.2°C threshold",
      "Excessive vibration spike (8.9 mm/s peak velocity)",
      "Vision detection: 140mm longitudinal tear initiating at Joint 3",
    ],
    metrics: [
      { label: "Rupture Risk", value: "92.4%", status: "CRITICAL" },
      { label: "Est. Remaining Life", value: "< 6 hrs", status: "CRITICAL" },
      { label: "Splice Health Avg", value: "31.0%", status: "CRITICAL" },
    ],
  },
];

export const Route = createFileRoute("/simulation")({
  head: () => ({
    meta: [
      { title: "Simulation Lab — ConveyorGuard AI" },
      {
        name: "description",
        content: "Interactive conveyor belt simulation lab and failure scenario injection studio.",
      },
    ],
  }),
  component: SimulationPage,
});

function SimulationPage() {
  const {
    mode,
    setMode,
    scenario,
    setScenario,
    sensors,
    joints,
    alerts,
    prediction,
    overallCondition,
    selectedJointId,
    selectJoint,
  } = useConveyor();

  const activeScenarioData =
    SCENARIOS.find((s) => s.id === scenario) ?? (SCENARIOS[0] as (typeof SCENARIOS)[number]);

  const handleTriggerAnomaly = (anomalyName: string) => {
    if (mode !== "SIMULATION") {
      setMode("SIMULATION");
    }
    toast.warning(`Simulated Anomaly Injected: ${anomalyName}`, {
      description: "Telemetry and AI vision modules are now rendering the simulated anomaly.",
    });
  };

  return (
    <main className="mx-auto w-full max-w-[1800px] space-y-6 px-3 py-4 sm:px-6 sm:py-6">
      {/* Top Banner / Header Area */}
      <div className="relative overflow-hidden rounded-lg border border-border/80 bg-panel p-6 shadow-xl">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 size-80 rounded-full bg-warning/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-20 -left-20 size-80 rounded-full bg-info/10 blur-3xl"
        />

        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="grid size-10 place-items-center rounded-lg border border-warning/40 bg-warning-soft text-warning shadow-[0_0_20px_-6px_var(--warning)]">
                <FlaskConical className="size-5" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[0.6875rem] font-bold tracking-[0.2em] text-warning uppercase">
                    Simulation & Stress Testing Lab
                  </span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[0.625rem] font-medium tracking-wide text-muted-foreground uppercase">
                    v2.4 Synthetic Engine
                  </span>
                </div>
                <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  Belt Failure Scenario Simulator
                </h1>
              </div>
            </div>
            <p className="mt-2.5 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              Configure operational conditions, simulate joint degradation, test AI anomaly
              detection algorithms, and preview automated predictive work order generation without
              endangering physical plant equipment.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-xs font-bold tracking-wider text-primary-foreground uppercase shadow transition-all hover:bg-primary/90"
            >
              <Activity className="size-4" />
              View in Live Dashboard
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Mode Switcher Bar */}
      <section
        aria-label="Simulation Engine Control"
        className="rounded-lg border border-border/80 bg-panel p-5"
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-md border border-border bg-secondary text-foreground">
              <Cpu className="size-4 text-info" />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
                Telemetry Pipeline Source
              </h2>
              <p className="text-xs text-muted-foreground">
                {mode === "SIMULATION"
                  ? "Currently broadcasting high-frequency synthetic conveyor telemetry"
                  : "Currently connected to physical field sensors and PLC feed"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-md border border-border bg-secondary/80 p-1.5">
            <button
              type="button"
              onClick={() => setMode("LIVE")}
              aria-pressed={mode === "LIVE"}
              className={cn(
                "inline-flex min-h-10 items-center gap-2 rounded-md px-4 text-xs font-bold tracking-wider uppercase transition-all",
                mode === "LIVE"
                  ? "bg-info text-info-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Activity className="size-4" />
              Live Telemetry
            </button>
            <button
              type="button"
              onClick={() => setMode("SIMULATION")}
              aria-pressed={mode === "SIMULATION"}
              className={cn(
                "inline-flex min-h-10 items-center gap-2 rounded-md px-4 text-xs font-bold tracking-wider uppercase transition-all",
                mode === "SIMULATION"
                  ? "bg-warning text-background font-black shadow-[0_0_16px_-4px_var(--warning)]"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <FlaskConical className="size-4" />
              Simulation Active
            </button>
          </div>
        </div>
      </section>

      {/* Scenario Selector Cards */}
      <section aria-label="Scenario Library" className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="size-4 text-info" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
              Preset Belt Scenarios
            </h2>
          </div>
          <span className="text-xs text-muted-foreground">
            Click a scenario card to activate dynamic synthetic data
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {SCENARIOS.map((sc) => {
            const isSelected = scenario === sc.id && mode === "SIMULATION";
            const borderTone =
              sc.condition === "NORMAL"
                ? "hover:border-normal/60"
                : sc.condition === "WARNING"
                  ? "hover:border-warning/60"
                  : "hover:border-critical/60";

            const activeTone =
              sc.condition === "NORMAL"
                ? "border-normal bg-normal/5 ring-1 ring-normal/40 shadow-[0_0_24px_-10px_var(--normal)]"
                : sc.condition === "WARNING"
                  ? "border-warning bg-warning/5 ring-1 ring-warning/40 shadow-[0_0_24px_-10px_var(--warning)]"
                  : "border-critical bg-critical/5 ring-1 ring-critical/40 shadow-[0_0_24px_-10px_var(--critical)]";

            return (
              <div
                key={sc.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (mode !== "SIMULATION") setMode("SIMULATION");
                  setScenario(sc.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    if (mode !== "SIMULATION") setMode("SIMULATION");
                    setScenario(sc.id);
                  }
                }}
                className={cn(
                  "cursor-pointer rounded-lg border bg-panel p-5 transition-all",
                  isSelected ? activeTone : `border-border/80 ${borderTone}`,
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StatusDot condition={sc.condition} pulse={isSelected} />
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                      {sc.title}
                    </span>
                  </div>
                  <StatusBadge condition={sc.condition} label={sc.badge} />
                </div>

                <p className="mt-3.5 text-xs leading-relaxed text-muted-foreground">{sc.desc}</p>

                <div className="mt-4 space-y-2 border-t border-border/50 pt-3">
                  <div className="text-[0.6875rem] font-bold tracking-wider text-foreground/80 uppercase">
                    Key Indicators
                  </div>
                  <ul className="space-y-1.5 text-[0.6875rem] text-muted-foreground">
                    {sc.symptoms.slice(0, 2).map((sym, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="mt-1 size-1 shrink-0 rounded-full bg-foreground/40" />
                        <span>{sym}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border/50 pt-3 text-center">
                  {sc.metrics.map((m, idx) => (
                    <div key={idx} className="rounded bg-secondary/50 p-1.5">
                      <div className="text-[0.625rem] text-muted-foreground uppercase">
                        {m.label}
                      </div>
                      <div className="tabular text-xs font-bold text-foreground">{m.value}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-1">
                  <Button
                    size="sm"
                    variant={isSelected ? "default" : "outline"}
                    className="w-full text-xs font-bold uppercase tracking-wider"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (mode !== "SIMULATION") setMode("SIMULATION");
                      setScenario(sc.id);
                    }}
                  >
                    {isSelected ? (
                      <>
                        <CheckCircle2 className="size-3.5" />
                        Active Scenario
                      </>
                    ) : (
                      <>
                        <Play className="size-3.5" />
                        Load Scenario
                      </>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Real-time Synthetic Telemetry Stream Preview */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Active Scenario Details & Failure Injection */}
        <section
          aria-label="Active Simulation Diagnostics"
          className="space-y-4 rounded-lg border border-border/80 bg-panel p-5 lg:col-span-2"
        >
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="size-4 text-warning" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
                Active Scenario Breakdown: {activeScenarioData.title}
              </h2>
            </div>
            <StatusBadge condition={overallCondition} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <h3 className="text-xs font-bold tracking-wider text-foreground uppercase">
                Observed Physical Symptoms
              </h3>
              <div className="space-y-2 rounded-md border border-border bg-secondary/40 p-3">
                {activeScenarioData.symptoms.map((symptom, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-foreground/90">
                    <StatusDot
                      condition={activeScenarioData.condition}
                      className="mt-1 shrink-0"
                    />
                    <span>{symptom}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-bold tracking-wider text-foreground uppercase">
                Synthetic Anomaly Injector
              </h3>
              <div className="space-y-2 rounded-md border border-border bg-secondary/40 p-3">
                <p className="text-[0.6875rem] text-muted-foreground">
                  Simulate instantaneous acute mechanical faults on the running belt:
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="justify-start text-[0.6875rem] font-semibold tracking-wider uppercase text-warning hover:bg-warning-soft hover:text-warning"
                    onClick={() => handleTriggerAnomaly("Snub Pulley Thermal Runaway")}
                  >
                    <Flame className="size-3.5 shrink-0" />
                    Pulley Surge
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="justify-start text-[0.6875rem] font-semibold tracking-wider uppercase text-critical hover:bg-critical-soft hover:text-critical"
                    onClick={() => handleTriggerAnomaly("Joint #3 Steel Cord Delamination")}
                  >
                    <Zap className="size-3.5 shrink-0" />
                    Cord Delam
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="justify-start text-[0.6875rem] font-semibold tracking-wider uppercase text-info hover:bg-info-soft hover:text-info"
                    onClick={() => handleTriggerAnomaly("Vision Camera Cover Rip")}
                  >
                    <Eye className="size-3.5 shrink-0" />
                    Longitudinal Rip
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="justify-start text-[0.6875rem] font-semibold tracking-wider uppercase text-foreground hover:bg-secondary"
                    onClick={() => {
                      setScenario("NORMAL");
                      toast.success("Simulation parameters normalized.");
                    }}
                  >
                    <RotateCcw className="size-3.5 shrink-0" />
                    Reset Baseline
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* 3D Conveyor Digital Twin CAD Assembly Viewer */}
          <div className="space-y-2 border-t border-border/50 pt-3">
            <ConveyorDigitalTwin
              scenario={scenario}
              condition={activeScenarioData.condition}
              selectedJointId={selectedJointId}
              onSelectJoint={selectJoint}
            />
          </div>
        </section>

        {/* Live Simulation Sensor Telemetry Stream */}
        <section
          aria-label="Generated Sensor Readings"
          className="space-y-4 rounded-lg border border-border/80 bg-panel p-5"
        >
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <Radio className="size-4 text-info" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
                Synthetic Telemetry
              </h2>
            </div>
            <span className="tabular text-[0.6875rem] font-medium text-muted-foreground">
              {sensors.length} channels
            </span>
          </div>

          <div className="space-y-2.5">
            {sensors.map((sensor) => (
              <div
                key={sensor.key}
                className="flex items-center justify-between rounded-md border border-border/60 bg-secondary/30 px-3 py-2"
              >
                <div>
                  <div className="text-xs font-bold text-foreground">{sensor.name}</div>
                  <div className="tabular text-[0.625rem] text-muted-foreground uppercase">
                    ID: {sensor.key}
                  </div>
                </div>
                <div className="text-right">
                  <div className="tabular text-xs font-bold text-foreground">
                    {sensor.value !== null ? `${sensor.value} ${sensor.unit}` : "—"}
                  </div>
                  <StatusBadge condition={sensor.status} />
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-md border border-border bg-secondary/40 p-3 text-center">
            <div className="text-[0.6875rem] text-muted-foreground">
              {alerts.length} active alert{alerts.length === 1 ? "" : "s"} generated by scenario
            </div>
            <div className="mt-2">
              <Link
                to="/"
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-secondary px-3 py-2 text-xs font-bold uppercase tracking-wider text-foreground hover:bg-card hover:text-info"
              >
                Inspect Telemetry on Main Dashboard
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
