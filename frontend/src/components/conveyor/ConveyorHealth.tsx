import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useConveyor } from "@/lib/conveyor/store";
import type { Alert, MaintenanceTask, Sensor } from "@/lib/conveyor/types";
import { Metric, Panel, StatusBadge, getDefectStyle } from "./primitives";
import { ArduinoPanel } from "./ArduinoPanel";
import { AlertTriangle, CheckCircle2, ChevronDown, RefreshCw, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function ConveyorHealth() {
  const navigate = useNavigate();
  const {
    prediction,
    activeScenario,
    sensors,
    alerts,
    tasks,
    mode,
    scenario,
    arduinoData,
    liveDetections,
    detections,
  } = useConveyor();

  const hasLiveDetections = liveDetections.length > 0;
  const anomaliesCount = hasLiveDetections ? liveDetections.length : detections.length;

  const [isDropdownOpen, setIsDropdownOpen] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Auto-expand dropdown when new anomalies are detected
  useEffect(() => {
    if (liveDetections.length > 0) {
      setIsDropdownOpen(true);
    }
  }, [liveDetections]);

  async function handleStartAnalysis() {
    setIsAnalyzing(true);
    toast.info("Generating AI Predictive Diagnostics & Compliance Report...");

    const reportAnomalies = hasLiveDetections
      ? liveDetections.map((d) => ({
          label: d.label,
          confidence: d.confidence,
          severity: getDefectStyle(d.label).severity,
          details: `X=${Math.round(d.x)}% Y=${Math.round(d.y)}%`,
        }))
      : detections.map((d) => ({
          label: d.type,
          confidence: d.confidence,
          severity: d.severity,
          details: `${d.location} (Joint ${d.jointId})`,
        }));

    const sensorMap: Record<string, number | null> = {};
    for (const s of sensors) {
      sensorMap[s.key] = s.value;
    }

    const hasLiveSensors = hasArduino && arduinoData;

    const telemetry = hasLiveSensors
      ? {
          is_connected: true,
          temperature: arduinoData.temperature ?? null,
          vibration: arduinoData.vibration ?? null,
          load: arduinoData.load ?? null,
          speed: arduinoData.speed ?? null,
          acoustic: arduinoData.acoustic ?? null,
          tension: arduinoData.tension ?? null,
          alignment: arduinoData.alignment ?? null,
          alignment_desc: arduinoData.alignment_desc || (arduinoData.alignment != null ? (arduinoData.alignment <= 5 ? "Centered (Tracking nominal)" : "Misaligned") : null),
          ir_left: arduinoData.ir_left ?? null,
          ir_right: arduinoData.ir_right ?? null,
          motor: arduinoData.motor ?? null,
          current: arduinoData.current ?? null,
          health: arduinoData.health ?? null,
          risk: arduinoData.risk ?? null,
          status: arduinoData.status ?? null,
        }
      : mode === "SIMULATION"
      ? {
          is_connected: true,
          mode: "SIMULATION",
          temperature: sensorMap["temperature"] ?? null,
          vibration: sensorMap["vibration"] ?? null,
          load: sensorMap["load"] ?? null,
          speed: sensorMap["speed"] ?? null,
          acoustic: sensorMap["acoustic"] ?? null,
          tension: sensorMap["tension"] ?? null,
          alignment: sensorMap["alignment"] ?? null,
          alignment_desc: (sensorMap["alignment"] ?? 0) <= 5.0 ? "Centered (Tracking nominal)" : "Drift Alert",
          ir_left: 1,
          ir_right: 1,
          motor: "ON",
          current: null,
          health: prediction.beltHealth ?? null,
          risk: prediction.failureProbability !== null ? Math.round(prediction.failureProbability * 100) : null,
          status: prediction.status ?? "SIMULATED",
        }
      : {
          is_connected: false,
          temperature: null,
          vibration: null,
          load: null,
          speed: null,
          acoustic: null,
          tension: null,
          alignment: null,
          alignment_desc: null,
          ir_left: null,
          ir_right: null,
          motor: null,
          current: null,
          health: null,
          risk: null,
          status: "DISCONNECTED / NO INPUT DATA",
        };

    try {
      let res: Response | null = null;
      try {
        res = await fetch("https://conveyorguardai.onrender.com/api/ai/generate-report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            telemetry,
            anomalies: reportAnomalies,
          }),
        });
      } catch {
        res = await fetch("https://conveyorguardai.onrender.com/api/ai/generate-report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            telemetry,
            anomalies: reportAnomalies,
          }),
        });
      }

      if (res && res.ok) {
        const reportData = await res.json();
        if (typeof window !== "undefined") {
          localStorage.setItem("conveyorguard_latest_ai_report", JSON.stringify(reportData));
        }
        toast.success("AI Predictive Insights & Diagnostic Report generated!");
        navigate({ to: "/ai-insights" });
      } else {
        toast.error("Failed to generate report from backend service.");
      }
    } catch (err) {
      console.error("Analysis generation error:", err);
      toast.error("Could not reach backend analysis server.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  // Display AI-derived belt health and risk; Arduino provides raw sensor telemetry & status
  const hasArduino = arduinoData !== null;
  const displayHealth     = prediction.beltHealth;
  const displayRisk       = prediction.failureProbability !== null ? Math.round(prediction.failureProbability * 100) : null;
  const displayCondition  = hasArduino
    ? (arduinoData.status === "NORMAL" ? "NORMAL" : "WARNING") as "CRITICAL" | "WARNING" | "NORMAL" | "UNKNOWN"
    : (prediction.beltHealth !== null ? prediction.riskLevel : (activeScenario ? prediction.riskLevel : "UNKNOWN"));

  return (
    <Panel
      bare
      title="Conveyor Health"
      subtitle={
        hasArduino
          ? `Live — Arduino UNO R4 (${arduinoData.status})`
          : prediction.beltHealth !== null
            ? (activeScenario ? "Simulation mode active" : "Real-time telemetry analysis")
            : "Awaiting data source"
      }
      actions={
        <StatusBadge
          condition={displayCondition}
          label={
            hasArduino
              ? `Arduino ${arduinoData.status}`
              : prediction.beltHealth !== null
                ? `Risk ${prediction.riskLevel}`
                : "Awaiting data"
          }
          pulse={displayCondition === "CRITICAL"}
        />
      }
    >
      <div className="grid grid-cols-1 gap-4">
        {/* Summary metrics */}
        <Metric
          flat
          label="Overall Belt Health"
          value={displayHealth !== null ? Math.round(displayHealth as number) : null}
          unit="%"
          condition={prediction.beltHealth !== null ? prediction.riskLevel : displayCondition}
          hint={hasArduino ? "AI Sensor Synthesis" : prediction.beltHealth !== null ? "Structural integrity index" : "Awaiting live data"}
        />
        <Metric
          flat
          label="Failure Risk"
          value={displayRisk !== null ? Math.round(displayRisk as number) : null}
          unit="%"
          condition={prediction.beltHealth !== null ? prediction.riskLevel : displayCondition}
          hint={hasArduino ? "AI Forecast (Next 24 h)" : activeScenario ? "Next 24 h probability" : "Awaiting prediction"}
        />

        {/* Arduino sensor panel */}
        <div className="border-t border-border/40 pt-3">
          <div className="mb-2 text-[0.5rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Arduino Sensor Feed
          </div>
          <ArduinoPanel />
        </div>
      </div>

      {/* Start Analysis button */}
      <div className="mt-6 flex justify-end border-t border-border/50 pt-4">
        <button
          id="start-analysis-btn"
          disabled={isAnalyzing}
          onClick={handleStartAnalysis}
          className="flex items-center gap-2 rounded-md bg-info px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white transition-all duration-200 hover:brightness-110 active:scale-95 shadow-xs cursor-pointer disabled:opacity-60"
        >
          {isAnalyzing ? (
            <>
              <RefreshCw className="size-4 animate-spin" />
              Generating Report...
            </>
          ) : (
            <>
              <Sparkles className="size-4" />
              Start Analysis
            </>
          )}
        </button>
      </div>

      {/* Detected Conveyor Anomalies Dropdown */}
      <div className="mt-4 overflow-hidden rounded-md border border-border/80 bg-background/80 shadow-xs">
        {/* Dropdown Header / Trigger Button */}
        <button
          type="button"
          id="detected-anomalies-dropdown-trigger"
          onClick={() => setIsDropdownOpen((prev) => !prev)}
          className="flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-secondary/60 focus:outline-none cursor-pointer"
          aria-expanded={isDropdownOpen}
        >
          <div className="flex items-center gap-2">
            {anomaliesCount > 0 ? (
              <AlertTriangle className="size-4 text-warning shrink-0 animate-pulse" />
            ) : (
              <CheckCircle2 className="size-4 text-normal shrink-0" />
            )}
            <span className="text-xs font-bold uppercase tracking-wider text-foreground">
              Detected Conveyor Anomalies ({anomaliesCount})
            </span>
          </div>

          <div className="flex items-center gap-2">
            {anomaliesCount > 0 ? (
              <span className="rounded bg-warning/20 border border-warning/40 px-2 py-0.5 text-[0.625rem] font-bold text-warning">
                {anomaliesCount} {anomaliesCount === 1 ? "Defect" : "Defects"}
              </span>
            ) : (
              <span className="rounded bg-normal/15 border border-normal/30 px-2 py-0.5 text-[0.625rem] font-bold text-normal">
                Nominal
              </span>
            )}
            <ChevronDown
              className={cn(
                "size-4 text-muted-foreground transition-transform duration-200",
                isDropdownOpen && "rotate-180"
              )}
            />
          </div>
        </button>

        {/* Collapsible Dropdown Content */}
        {isDropdownOpen && (
          <div className="border-t border-border/60 p-2.5 space-y-2 bg-secondary/20 max-h-[320px] overflow-y-auto">
            {hasLiveDetections ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[0.625rem] text-muted-foreground font-mono px-0.5">
                  <span>Roboflow Defect Model</span>
                  <span>Precision NMS Active</span>
                </div>
                {liveDetections.map((defect, i) => {
                  const style = getDefectStyle(defect.label);
                  return (
                    <div
                      key={i}
                      className={cn(
                        "flex items-center justify-between rounded border p-2 bg-card/90 transition-all hover:bg-card shadow-xs",
                        style.border
                      )}
                    >
                      <div className="flex flex-col">
                        <span className={cn("text-xs font-bold", style.text)}>
                          {defect.label}
                        </span>
                        <span className="text-[0.625rem] text-muted-foreground">
                          Coordinates: X={Math.round(defect.x)}% Y={Math.round(defect.y)}% · W={Math.round(defect.w)}% H={Math.round(defect.h)}%
                        </span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className={cn("rounded px-1.5 py-0.5 text-[0.5625rem] font-bold shadow-xs", style.badge)}>
                          {Math.round(defect.confidence * 100)}%
                        </span>
                        <span className="text-[0.5625rem] uppercase font-bold text-muted-foreground mt-0.5">
                          {style.severity}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : detections.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[0.625rem] text-muted-foreground font-mono px-0.5">
                  <span>Simulated Inspection</span>
                  <span>Scenario Telemetry</span>
                </div>
                {detections.map((defect) => {
                  const style = getDefectStyle(defect.type);
                  return (
                    <div
                      key={defect.id}
                      className={cn(
                        "flex items-center justify-between rounded border p-2 bg-card/90 transition-all hover:bg-card shadow-xs",
                        style.border
                      )}
                    >
                      <div className="flex flex-col">
                        <span className={cn("text-xs font-bold", style.text)}>
                          {defect.type}
                        </span>
                        <span className="text-[0.625rem] text-muted-foreground">
                          {defect.location} · Joint {defect.jointId} ({defect.detectedAt})
                        </span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className={cn("rounded px-1.5 py-0.5 text-[0.5625rem] font-bold shadow-xs", style.badge)}>
                          {Math.round(defect.confidence * 100)}%
                        </span>
                        <span className="text-[0.5625rem] uppercase font-bold text-muted-foreground mt-0.5">
                          {defect.severity}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded border border-border/60 bg-card/50 p-2.5 text-xs text-muted-foreground">
                <CheckCircle2 className="size-4 text-normal shrink-0" />
                <span>No active anomalies detected across the conveyor surface.</span>
              </div>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}

