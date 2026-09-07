import { useConveyor } from "@/lib/conveyor/store";
import type { Alert, MaintenanceTask, Sensor } from "@/lib/conveyor/types";
import { Metric, Panel, StatusBadge } from "./primitives";

function generateReport(data: {
  riskLevel: string;
  beltHealth: number | null;
  jointHealth: number | null;
  failureProbability: number | null;
  status: string;
  sensors: Sensor[];
  alerts: Alert[];
  tasks: MaintenanceTask[];
  mode: string;
  scenario: string | null;
}): string {
  const now = new Date();
  const ts = now.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

  const line = (char = "-", len = 60) => char.repeat(len);

  const pct = (v: number | null) => (v === null ? "N/A" : `${v}%`);
  const failPct =
    data.failureProbability === null
      ? "N/A"
      : `${Math.round(data.failureProbability * 100)}%`;

  const sensorRows = data.sensors
    .map(
      (s) =>
        `  ${s.name.padEnd(28)} ${(s.value !== null ? `${s.value} ${s.unit}` : "N/A").padEnd(14)} [${s.status}]`,
    )
    .join("\n");

  const alertRows =
    data.alerts.length === 0
      ? "  No active alerts."
      : data.alerts
          .map(
            (a) =>
              `  [${a.severity.toUpperCase()}] ${a.title} — ${a.status}`,
          )
          .join("\n");

  const taskRows =
    data.tasks.length === 0
      ? "  No maintenance tasks."
      : data.tasks
          .map((t) => `  [${t.priority}] ${t.issue} — ${t.status}`)
          .join("\n");

  return `
${line("=", 60)}
  CONVEYORGUARD AI — BELT HEALTH ANALYSIS REPORT
${line("=", 60)}
  Generated   : ${ts}
  Belt        : Iron Ore Primary Transport Line
  Mode        : ${data.mode}${data.scenario ? ` / Scenario: ${data.scenario}` : ""}

${line()}
  HEALTH SUMMARY
${line()}
  Overall Belt Health   : ${pct(data.beltHealth)}
  Joint Health          : ${pct(data.jointHealth)}
  Failure Risk (24h)    : ${failPct}
  Risk Level            : ${data.riskLevel}
  Prediction Status     : ${data.status}

${line()}
  SENSOR TELEMETRY
${line()}
${sensorRows || "  No sensor data available."}

${line()}
  ACTIVE ALERTS
${line()}
${alertRows}

${line()}
  MAINTENANCE TASKS
${line()}
${taskRows}

${line()}
  RECOMMENDATIONS
${line()}
${
  data.riskLevel === "CRITICAL"
    ? "  ⚠ IMMEDIATE ACTION REQUIRED:\n  - Halt belt operation and perform emergency inspection.\n  - Check all joints for structural failure.\n  - Contact maintenance team immediately."
    : data.riskLevel === "WARNING"
      ? "  ⚠ CAUTION:\n  - Schedule inspection within 24 hours.\n  - Monitor sensor readings closely.\n  - Prepare maintenance crew on standby."
      : data.riskLevel === "NORMAL"
        ? "  ✓ System operating within normal parameters.\n  - Continue routine monitoring.\n  - Next scheduled inspection as per maintenance plan."
        : "  - No live data available. Start simulation or connect live feed."
}

${line("=", 60)}
  END OF REPORT — ConveyorGuard AI v1.0
${line("=", 60)}
`.trimStart();
}

export function ConveyorHealth() {
  const { prediction, activeScenario, sensors, alerts, tasks, mode, scenario } =
    useConveyor();

  function handleStartAnalysis() {
    const report = generateReport({
      riskLevel: prediction.riskLevel,
      beltHealth: prediction.beltHealth,
      jointHealth: prediction.jointHealth,
      failureProbability: prediction.failureProbability,
      status: prediction.status,
      sensors,
      alerts,
      tasks,
      mode,
      scenario: activeScenario,
    });

    const blob = new Blob([report], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const now = new Date();
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
    a.href = url;
    a.download = `conveyor_analysis_${stamp}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Panel
      bare
      title="Conveyor Health"
      subtitle="Monitoring one belt — Iron Ore Primary Transport Line"
      actions={
        <StatusBadge
          condition={prediction.riskLevel}
          label={activeScenario ? `Risk ${prediction.riskLevel}` : "Awaiting data"}
          pulse={prediction.riskLevel === "CRITICAL"}
        />
      }
    >
      <div className="grid grid-cols-2 gap-6">
        <Metric
          flat
          label="Overall Belt Health"
          value={prediction.beltHealth}
          unit="%"
          condition={activeScenario ? prediction.riskLevel : "UNKNOWN"}
          hint={activeScenario ? "Structural integrity index" : "Awaiting live data"}
        />
        <Metric
          flat
          label="Joint Health"
          value={prediction.jointHealth}
          unit="%"
          condition={activeScenario ? prediction.riskLevel : "UNKNOWN"}
          hint={activeScenario ? "Weakest of 5 splices" : "Awaiting live data"}
        />
        <Metric
          flat
          label="Failure Risk"
          value={
            prediction.failureProbability === null
              ? null
              : `${Math.round(prediction.failureProbability * 100)}`
          }
          unit="%"
          condition={activeScenario ? prediction.riskLevel : "UNKNOWN"}
          hint={activeScenario ? "Next 24 h probability" : "Awaiting prediction"}
        />
        <Metric
          flat
          label="Prediction Status"
          value={activeScenario ? prediction.riskLevel : "IDLE"}
          condition={activeScenario ? prediction.riskLevel : "UNKNOWN"}
          hint={prediction.status}
        />
      </div>

      {/* Start Analysis button */}
      <div className="mt-6 flex justify-end border-t border-border/50 pt-4">
        <button
          id="start-analysis-btn"
          onClick={handleStartAnalysis}
          className="flex items-center gap-2 rounded-md bg-info px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white transition-all duration-200 hover:brightness-110 active:scale-95"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="size-4"
          >
            <path
              fillRule="evenodd"
              d="M10 3a.75.75 0 01.75.75v8.69l2.22-2.22a.75.75 0 111.06 1.06l-3.5 3.5a.75.75 0 01-1.06 0l-3.5-3.5a.75.75 0 111.06-1.06l2.22 2.22V3.75A.75.75 0 0110 3z"
              clipRule="evenodd"
            />
            <path d="M3 13a.75.75 0 000 1.5h14a.75.75 0 000-1.5H3z" />
          </svg>
          Start Analysis
        </button>
      </div>
    </Panel>
  );
}
