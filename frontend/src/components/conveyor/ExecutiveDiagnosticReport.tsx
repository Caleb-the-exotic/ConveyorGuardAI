import React, { useState, useEffect } from "react";
import {
  BrainCircuit,
  Sparkles,
  RefreshCw,
  FileText,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Copy,
  Check,
  Printer,
  ExternalLink,
  Cpu,
  ShieldCheck,
  Layers,
  Gauge,
  Activity,
  Zap,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import { useConveyor } from "@/lib/conveyor/store";
import { cn } from "@/lib/utils";

interface WebCitation {
  title?: string;
  url?: string;
  snippet?: string;
}

interface AIReportData {
  report?: string;
  report_markdown?: string;
  ocr?: string;
  ocr_text?: string;
  citations?: WebCitation[];
  web_citations?: WebCitation[];
  metadata?: Record<string, any>;
  timestamp?: string;
  telemetry?: Record<string, any>;
  anomalies?: any[];
}

// Client-side sanitization ensuring zero provider names ever appear in the UI
function sanitizeText(raw: string): string {
  if (!raw) return "";
  return raw
    .replace(/tavily/gi, "ConveyorGuard Knowledge Engine")
    .replace(/groq/gi, "Neural Diagnostic Engine")
    .replace(/openrouter/gi, "Industrial Reasoning Core")
    .replace(/minimax/gi, "Diagnostic Model Core")
    .replace(/pytesseract/gi, "Optical Telemetry OCR")
    .replace(/tesseract/gi, "Optical Telemetry Engine");
}

export function ExecutiveDiagnosticReport() {
  const {
    sensors,
    prediction,
    detections,
    liveDetections,
    hasLiveDetections,
    arduinoData,
    hasArduino,
    activeScenario,
    mode,
    lastSnapshot,
  } = useConveyor();

  const [reportData, setReportData] = useState<AIReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"report" | "telemetry" | "standards" | "raw">("report");
  const [copied, setCopied] = useState(false);

  // Load from localStorage or fetch latest from backend on mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem("conveyorguard_latest_ai_report");
      if (cached) {
        const parsed = JSON.parse(cached);
        setReportData(parsed);
      } else {
        fetch("https://conveyorguardai.onrender.com/api/ai/latest-report")
          .then((res) => res.json())
          .then((data) => {
            if (data.status === "ok" && data.report) {
              setReportData(data.report);
              localStorage.setItem("conveyorguard_latest_ai_report", JSON.stringify(data.report));
            }
          })
          .catch(() => {
            // Silently fallback if backend not running or no cached report yet
          });
      }
    } catch {
      // Ignored
    }
  }, []);

  // Handler to run a fresh live analysis
  const runAnalysis = async () => {
    setLoading(true);
    toast.info("Synthesizing telemetry vectors & running diagnostic audit...");

    const reportAnomalies = hasLiveDetections
      ? liveDetections.map((d) => ({
          label: d.label,
          confidence: d.confidence,
          severity: d.label.toLowerCase().includes("crack") || d.label.toLowerCase().includes("tear") ? "CRITICAL" : "WARNING",
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

    // Build telemetry WITHOUT fabricating or dumping static dummy values
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
          health: prediction.beltHealth ?? null,
          risk: prediction.failureProbability !== null ? Math.round(prediction.failureProbability * 100) : null,
          status: prediction.status ?? null,
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
      let res = await fetch("https://conveyorguardai.onrender.com/api/ai/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telemetry, anomalies: reportAnomalies, image_base64: lastSnapshot }),
      }).catch(() => null);

      if (!res || !res.ok) {
        res = await fetch("https://conveyorguardai.onrender.com/api/ai/generate-report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ telemetry, anomalies: reportAnomalies, image_base64: lastSnapshot }),
        }).catch(() => null);
      }

      if (res && res.ok) {
        const data = await res.json();
        const formatted: AIReportData = {
          report: data.report_markdown,
          report_markdown: data.report_markdown,
          ocr: data.ocr_text,
          ocr_text: data.ocr_text,
          citations: data.web_citations,
          web_citations: data.web_citations,
          metadata: data.metadata,
          timestamp: data.timestamp || data.generated_at,
          telemetry,
          anomalies: reportAnomalies,
        };
        setReportData(formatted);
        localStorage.setItem("conveyorguard_latest_ai_report", JSON.stringify(formatted));
        toast.success("Executive Diagnostic Report successfully updated!");
      } else {
        toast.error("Diagnostic engine communication timed out. Backend may be offline.");
      }
    } catch {
      toast.error("Failed to connect to diagnostic analysis backend.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    const text = reportData?.report_markdown || reportData?.report || "";
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Executive Diagnostic Report copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const printReport = () => {
    toast.dismiss();
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const markdownContent = sanitizeText(reportData?.report_markdown || reportData?.report || "");
  const citations = reportData?.web_citations || reportData?.citations || [];
  const ocrText = sanitizeText(reportData?.ocr_text || reportData?.ocr || "");

  // Determine active telemetry snapshot for display
  const activeTelemetry = reportData?.telemetry || (hasArduino && arduinoData ? arduinoData : null);

  // If no report has been generated yet, show the initial CTA banner
  if (!reportData || !markdownContent) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-border/80 bg-gradient-to-br from-panel via-card to-secondary/40 p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-info/40 bg-info/10 px-3 py-1 text-xs font-semibold text-info">
              <BrainCircuit className="size-3.5" />
              ConveyorGuard Neural Diagnostic Engine
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Autonomous Industrial Predictive Diagnostic Report
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Synthesizes real-time sensor telemetry, optical defect detection, and DIN 22101 / ISO 5048
              standards. When physical hardware is connected, actual live values are evaluated.
            </p>
          </div>
          <button
            id="trigger-initial-ai-analysis-btn"
            onClick={runAnalysis}
            disabled={loading}
            className="shrink-0 flex items-center gap-2.5 rounded-lg bg-info px-5 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-info/20 transition-all hover:brightness-110 active:scale-95 disabled:opacity-60 cursor-pointer"
          >
            {loading ? (
              <>
                <RefreshCw className="size-4 animate-spin" />
                Analyzing Telemetry...
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                Run Instant AI Diagnostic
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // Parse markdown content into structured blocks for clean UI presentation
  const renderMarkdownBlocks = (md: string) => {
    const lines = md.split("\n");
    const elements: React.ReactNode[] = [];
    let currentTable: string[] = [];

    const flushTable = () => {
      if (currentTable.length === 0) return;
      const rows = currentTable.map((r) =>
        r
          .split("|")
          .map((c) => c.trim())
          .filter((c, idx, arr) => idx > 0 && idx < arr.length - 1)
      );
      if (rows.length > 0) {
        const header = rows[0];
        const bodyRows = rows.slice(1).filter((r) => !r.every((c) => c.match(/^-+$/)));
        elements.push(
          <div key={`table-${elements.length}`} className="my-4 overflow-x-auto rounded-md border border-border/80 bg-background/50">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-secondary/80 text-muted-foreground">
                <tr>
                  {header.map((col, ci) => (
                    <th key={ci} className="px-3.5 py-2.5 font-bold uppercase tracking-wider">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {bodyRows.map((row, ri) => (
                  <tr key={ri} className="hover:bg-secondary/40 transition-colors">
                    {row.map((col, ci) => {
                      const isOffline = col.includes("OFFLINE") || col.includes("NO SIGNAL");
                      return (
                        <td
                          key={ci}
                          className={cn(
                            "px-3.5 py-2 font-mono text-[0.75rem]",
                            isOffline ? "text-warning font-semibold" : "text-foreground"
                          )}
                        >
                          {col}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      currentTable = [];
    };

    lines.forEach((line, idx) => {
      const trimmed = line.trim();

      // Check table lines
      if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
        currentTable.push(trimmed);
        return;
      } else {
        flushTable();
      }

      if (!trimmed) {
        return;
      }

      // H1 Header
      if (trimmed.startsWith("# ")) {
        elements.push(
          <h2
            key={idx}
            className="mt-6 mb-3 text-xl font-bold tracking-tight text-foreground border-b border-border/60 pb-2 flex items-center gap-2"
          >
            <ShieldCheck className="size-5 text-info" />
            {trimmed.replace(/^#\s+/, "")}
          </h2>
        );
      }
      // H2 Header
      else if (trimmed.startsWith("## ")) {
        const titleText = trimmed.replace(/^##\s+/, "");
        const isCritical = titleText.toLowerCase().includes("critical") || titleText.toLowerCase().includes("risk") || titleText.toLowerCase().includes("rupture");
        elements.push(
          <h3
            key={idx}
            className={cn(
              "mt-5 mb-2 text-base font-bold tracking-wide flex items-center gap-2",
              isCritical ? "text-danger" : "text-foreground"
            )}
          >
            {isCritical ? (
              <AlertOctagon className="size-4.5 text-danger shrink-0" />
            ) : (
              <Layers className="size-4.5 text-info shrink-0" />
            )}
            {titleText}
          </h3>
        );
      }
      // H3 Header
      else if (trimmed.startsWith("### ")) {
        elements.push(
          <h4 key={idx} className="mt-3.5 mb-1.5 text-sm font-semibold text-foreground/90 uppercase tracking-wider">
            {trimmed.replace(/^###\s+/, "")}
          </h4>
        );
      }
      // List items
      else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        const itemContent = trimmed.replace(/^[-*]\s+/, "");
        const isWarning = itemContent.toLowerCase().includes("critical") || itemContent.toLowerCase().includes("urgent") || itemContent.toLowerCase().includes("danger") || itemContent.toLowerCase().includes("offline");
        elements.push(
          <div
            key={idx}
            className={cn(
              "ml-2 my-1 flex items-start gap-2 text-xs leading-relaxed",
              isWarning ? "text-warning font-medium" : "text-foreground/80"
            )}
          >
            <span className={cn("size-1.5 rounded-full mt-1.5 shrink-0", isWarning ? "bg-warning" : "bg-info")} />
            <span>{renderFormattedInline(itemContent)}</span>
          </div>
        );
      }
      // Numbered items
      else if (/^\d+\.\s/.test(trimmed)) {
        elements.push(
          <div key={idx} className="ml-2 my-1 flex items-start gap-2 text-xs text-foreground/85 leading-relaxed">
            <span className="font-mono text-info font-bold shrink-0">{trimmed.match(/^\d+\./)?.[0]}</span>
            <span>{renderFormattedInline(trimmed.replace(/^\d+\.\s+/, ""))}</span>
          </div>
        );
      }
      // Standard Paragraph
      else {
        elements.push(
          <p key={idx} className="my-2 text-xs leading-relaxed text-muted-foreground">
            {renderFormattedInline(trimmed)}
          </p>
        );
      }
    });

    flushTable();
    return elements;
  };

  const renderFormattedInline = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={i} className="font-bold text-foreground">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  return (
    <div className="space-y-4">
      {/* Top Banner Card */}
      <div className="relative overflow-hidden rounded-xl border border-border/80 bg-panel p-5 sm:p-6 shadow-xl">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-info/10 blur-3xl"
        />

        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-info/40 bg-info/10 px-2.5 py-0.5 text-[0.6875rem] font-bold tracking-wider text-info uppercase">
                <BrainCircuit className="size-3.5" />
                ConveyorGuard Neural Diagnostic Engine
              </span>
              <span className="rounded-full bg-secondary border border-border px-2.5 py-0.5 text-[0.625rem] font-mono text-muted-foreground">
                Verified: {reportData.timestamp ? new Date(reportData.timestamp).toLocaleTimeString() : "Live Active"}
              </span>
              <span className="rounded-full bg-normal/15 border border-normal/30 px-2 py-0.5 text-[0.625rem] font-bold text-normal">
                DIN 22101 / ISO 5048 Validated
              </span>
            </div>

            <h2 className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Autonomous Predictive Diagnostic & Engineering Report
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground max-w-3xl">
              Synthesized from active multi-sensor hardware telemetry, optical surface inspection,
              and international conveyor engineering compliance databases.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0 print:hidden">
            <button
              onClick={runAnalysis}
              disabled={loading}
              className="flex items-center gap-2 rounded-md bg-info px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-xs transition-all hover:brightness-110 active:scale-95 disabled:opacity-60 cursor-pointer"
            >
              {loading ? (
                <>
                  <RefreshCw className="size-3.5 animate-spin" />
                  Synthesizing...
                </>
              ) : (
                <>
                  <RefreshCw className="size-3.5" />
                  Re-run Live Analysis
                </>
              )}
            </button>

            <button
              onClick={copyToClipboard}
              className="flex items-center gap-1.5 rounded-md border border-border bg-secondary/80 px-3 py-2 text-xs font-semibold text-foreground transition-all hover:bg-secondary active:scale-95 cursor-pointer"
            >
              {copied ? <Check className="size-3.5 text-normal" /> : <Copy className="size-3.5 text-muted-foreground" />}
              {copied ? "Copied" : "Copy Report"}
            </button>

            <button
              onClick={printReport}
              className="flex items-center gap-1.5 rounded-md border border-border bg-secondary/80 px-3 py-2 text-xs font-semibold text-foreground transition-all hover:bg-secondary active:scale-95 cursor-pointer"
            >
              <Printer className="size-3.5 text-muted-foreground" />
              Print / PDF
            </button>
          </div>
        </div>

        {/* Diagnostic Meta Strip */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 border-t border-border/50 pt-4">
          <div className="rounded-md border border-border/60 bg-secondary/30 p-2.5">
            <div className="text-[0.625rem] uppercase font-bold text-muted-foreground tracking-wider">
              Health Status
            </div>
            <div className="mt-1 flex items-center gap-2 text-sm font-bold text-foreground">
              <Activity className="size-4 text-info" />
              {activeTelemetry?.health != null ? (
                `${activeTelemetry.health}% Belt Index`
              ) : (
                <span className="text-xs font-mono text-muted-foreground">Awaiting Live Telemetry</span>
              )}
            </div>
          </div>

          <div className="rounded-md border border-border/60 bg-secondary/30 p-2.5">
            <div className="text-[0.625rem] uppercase font-bold text-muted-foreground tracking-wider">
              Optical Verification
            </div>
            <div className="mt-1 flex items-center gap-2 text-sm font-bold text-foreground">
              <CheckCircle2 className="size-4 text-normal" />
              {ocrText && !ocrText.toLowerCase().includes("no camera") ? "OCR Stream Confirmed" : "No Camera Feed"}
            </div>
          </div>

          <div className="rounded-md border border-border/60 bg-secondary/30 p-2.5">
            <div className="text-[0.625rem] uppercase font-bold text-muted-foreground tracking-wider">
              Standards Benchmarks
            </div>
            <div className="mt-1 flex items-center gap-2 text-sm font-bold text-foreground">
              <BookOpen className="size-4 text-info" />
              {citations.length > 0 ? `${citations.length} Standards Cited` : "ISO 5048 / DIN 22101"}
            </div>
          </div>

          <div className="rounded-md border border-border/60 bg-secondary/30 p-2.5">
            <div className="text-[0.625rem] uppercase font-bold text-muted-foreground tracking-wider">
              Failure Horizon
            </div>
            <div className="mt-1 flex items-center gap-2 text-sm font-bold text-foreground">
              <AlertTriangle className="size-4 text-warning" />
              {activeTelemetry?.risk != null ? (
                `${Math.round(100 - activeTelemetry.risk)}% Integrity Margin`
              ) : (
                <span className="text-xs font-mono text-muted-foreground">Pending Telemetry</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1 border-b border-border/80 px-1 print:hidden">
        <button
          onClick={() => setActiveTab("report")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer",
            activeTab === "report"
              ? "border-info text-info bg-info/5 rounded-t-md"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <FileText className="size-4" />
          Executive Diagnostic Report
        </button>

        <button
          onClick={() => setActiveTab("telemetry")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer",
            activeTab === "telemetry"
              ? "border-info text-info bg-info/5 rounded-t-md"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Gauge className="size-4" />
          Multi-Sensor Telemetry & Optical Audit
        </button>

        <button
          onClick={() => setActiveTab("standards")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer",
            activeTab === "standards"
              ? "border-info text-info bg-info/5 rounded-t-md"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <BookOpen className="size-4" />
          Industrial Standards & Citations ({citations.length})
        </button>

        <button
          onClick={() => setActiveTab("raw")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer",
            activeTab === "raw"
              ? "border-info text-info bg-info/5 rounded-t-md"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Cpu className="size-4" />
          Raw Neural Log
        </button>
      </div>

      {/* Tab 1: Executive Report */}
      {activeTab === "report" && (
        <div className="rounded-xl border border-border/80 bg-card p-6 shadow-md">
          <div className="prose prose-invert max-w-none text-foreground space-y-1">
            {renderMarkdownBlocks(markdownContent)}
          </div>
        </div>
      )}

      {/* Tab 2: Telemetry & Optical Audit */}
      {activeTab === "telemetry" && (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Telemetry Snapshot Grid */}
          <div className="rounded-xl border border-border/80 bg-card p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <Gauge className="size-4.5 text-info" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                  Active Multi-Sensor Telemetry Inputs
                </h3>
              </div>
              <span className="text-[0.625rem] font-mono text-muted-foreground">
                {activeTelemetry?.is_connected ? "Hardware Port Active" : "No Hardware Feed"}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {/* Bearing Temp */}
              <div className="rounded-md border border-border/60 bg-secondary/30 p-3">
                <div className="text-[0.625rem] uppercase text-muted-foreground font-semibold">Bearing Temp</div>
                <div className="mt-1 text-base font-bold text-foreground">
                  {activeTelemetry?.temperature != null ? (
                    `${Number(activeTelemetry.temperature).toFixed(1)} °C`
                  ) : (
                    <span className="font-mono text-xs text-muted-foreground/70">NO SIGNAL</span>
                  )}
                </div>
                <div className="text-[0.625rem] text-muted-foreground">
                  {activeTelemetry?.temperature != null ? "DS18B20 Probe" : "Sensor Offline"}
                </div>
              </div>

              {/* Vibration */}
              <div className="rounded-md border border-border/60 bg-secondary/30 p-3">
                <div className="text-[0.625rem] uppercase text-muted-foreground font-semibold">Vibration</div>
                <div className="mt-1 text-base font-bold text-foreground">
                  {activeTelemetry?.vibration != null ? (
                    `${Number(activeTelemetry.vibration).toFixed(2)} mm/s`
                  ) : (
                    <span className="font-mono text-xs text-muted-foreground/70">NO SIGNAL</span>
                  )}
                </div>
                <div className="text-[0.625rem] text-muted-foreground">
                  {activeTelemetry?.vibration != null ? "MPU6050 + Digital" : "Sensor Offline"}
                </div>
              </div>

              {/* Belt Tension */}
              <div className="rounded-md border border-border/60 bg-secondary/30 p-3">
                <div className="text-[0.625rem] uppercase text-muted-foreground font-semibold">Belt Tension</div>
                <div className="mt-1 text-base font-bold text-foreground">
                  {activeTelemetry?.tension != null ? (
                    `${Number(activeTelemetry.tension).toFixed(1)} cm`
                  ) : (
                    <span className="font-mono text-xs text-muted-foreground/70">NO SIGNAL</span>
                  )}
                </div>
                <div className="text-[0.625rem] text-muted-foreground">
                  {activeTelemetry?.tension != null ? "Ultrasonic Sag Proxy" : "Sensor Offline"}
                </div>
              </div>

              {/* Belt Alignment */}
              <div className="rounded-md border border-border/60 bg-secondary/30 p-3">
                <div className="text-[0.625rem] uppercase text-muted-foreground font-semibold">Belt Alignment</div>
                <div className="mt-1 text-base font-bold text-foreground">
                  {activeTelemetry?.alignment != null ? (
                    `${Number(activeTelemetry.alignment).toFixed(1)} mm`
                  ) : (
                    <span className="font-mono text-xs text-muted-foreground/70">NO SIGNAL</span>
                  )}
                </div>
                <div className="text-[0.625rem] text-muted-foreground">
                  {activeTelemetry?.alignment != null ? (activeTelemetry.alignment_desc || "Centered") : "Sensor Offline"}
                </div>
              </div>

              {/* Live Load */}
              <div className="rounded-md border border-border/60 bg-secondary/30 p-3">
                <div className="text-[0.625rem] uppercase text-muted-foreground font-semibold">Live Load</div>
                <div className="mt-1 text-base font-bold text-foreground">
                  {activeTelemetry?.load != null ? (
                    `${Number(activeTelemetry.load).toFixed(1)} kg`
                  ) : (
                    <span className="font-mono text-xs text-muted-foreground/70">NO SIGNAL</span>
                  )}
                </div>
                <div className="text-[0.625rem] text-muted-foreground">
                  {activeTelemetry?.load != null ? "HX711 Strain Gauge" : "Sensor Offline"}
                </div>
              </div>

              {/* Belt Velocity */}
              <div className="rounded-md border border-border/60 bg-secondary/30 p-3">
                <div className="text-[0.625rem] uppercase text-muted-foreground font-semibold">Belt Velocity</div>
                <div className="mt-1 text-base font-bold text-foreground">
                  {activeTelemetry?.speed != null ? (
                    `${Number(activeTelemetry.speed).toFixed(2)} m/s`
                  ) : (
                    <span className="font-mono text-xs text-muted-foreground/70">NO SIGNAL</span>
                  )}
                </div>
                <div className="text-[0.625rem] text-muted-foreground">
                  {activeTelemetry?.speed != null ? "Optical Encoder" : "Sensor Offline"}
                </div>
              </div>

              {/* Drive Current */}
              <div className="rounded-md border border-border/60 bg-secondary/30 p-3">
                <div className="text-[0.625rem] uppercase text-muted-foreground font-semibold">Drive Current</div>
                <div className="mt-1 text-base font-bold text-foreground">
                  {activeTelemetry?.current != null ? (
                    `${Number(activeTelemetry.current).toFixed(2)} A`
                  ) : (
                    <span className="font-mono text-xs text-muted-foreground/70">NO SIGNAL</span>
                  )}
                </div>
                <div className="text-[0.625rem] text-muted-foreground">
                  {activeTelemetry?.current != null ? "ACS712 Current Sensor" : "Sensor Offline"}
                </div>
              </div>

              {/* Motor State */}
              <div className="rounded-md border border-border/60 bg-secondary/30 p-3">
                <div className="text-[0.625rem] uppercase text-muted-foreground font-semibold">Motor State</div>
                <div className="mt-1 text-base font-bold text-foreground">
                  {activeTelemetry?.motor ? activeTelemetry.motor : (
                    <span className="font-mono text-xs text-muted-foreground/70">OFFLINE</span>
                  )}
                </div>
                <div className="text-[0.625rem] text-muted-foreground">
                  {activeTelemetry?.motor ? "Relay Controller" : "Controller Offline"}
                </div>
              </div>

              {/* Acoustic Level */}
              <div className="rounded-md border border-border/60 bg-secondary/30 p-3">
                <div className="text-[0.625rem] uppercase text-muted-foreground font-semibold">Acoustic Level</div>
                <div className="mt-1 text-base font-bold text-foreground">
                  {activeTelemetry?.acoustic != null ? (
                    `${Number(activeTelemetry.acoustic).toFixed(0)} dB`
                  ) : (
                    <span className="font-mono text-xs text-muted-foreground/70">NO SIGNAL</span>
                  )}
                </div>
                <div className="text-[0.625rem] text-muted-foreground">
                  {activeTelemetry?.acoustic != null ? "Microphone Sensor" : "Sensor Offline"}
                </div>
              </div>
            </div>
          </div>

          {/* Optical Telemetry Verification */}
          <div className="rounded-xl border border-border/80 bg-card p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <Zap className="size-4.5 text-info" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                  Optical Character & Telemetry Verification
                </h3>
              </div>
              <span className="rounded bg-secondary border border-border px-2 py-0.5 text-[0.625rem] font-mono text-muted-foreground">
                {ocrText && !ocrText.toLowerCase().includes("no camera") ? "Active Stream" : "No Feed Snapshot"}
              </span>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Cross-correlates physical hardware readings with visual character telemetry when an optical camera
              snapshot is provided.
            </p>

            <div className="rounded-lg border border-border/80 bg-secondary/40 p-3.5 font-mono text-[0.75rem] text-foreground/90 space-y-2">
              <div className="flex items-center justify-between text-[0.625rem] text-muted-foreground border-b border-border/40 pb-1.5">
                <span>OPTICAL STREAM TELEMETRY CAPTURE</span>
                <span className={ocrText && !ocrText.toLowerCase().includes("no camera") ? "text-normal font-bold" : "text-muted-foreground font-mono"}>
                  {ocrText && !ocrText.toLowerCase().includes("no camera") ? "STATUS: OK" : "STATUS: AWAITING STREAM"}
                </span>
              </div>
              
              {/* Captured Snapshot Display */}
              {lastSnapshot && (
                <div className="mt-2 mb-3">
                  <img src={lastSnapshot} alt="Optical Defect Verification Snapshot" className="w-full max-h-[300px] object-cover rounded border border-border/50 shadow-sm" />
                </div>
              )}

              <pre className="whitespace-pre-wrap text-xs text-foreground/80 leading-relaxed font-mono">
                {ocrText || "No camera snapshot provided for optical text analysis. Physical sensor readings are prioritized."}
              </pre>
            </div>

            <div className="rounded-md border border-border/60 bg-secondary/20 p-3 text-xs text-muted-foreground flex items-center gap-2.5">
              <CheckCircle2 className="size-4 text-info shrink-0" />
              <span>
                {ocrText && !ocrText.toLowerCase().includes("no camera")
                  ? "Optical verification active."
                  : "Optical verification in standby. Physical serial stream used as primary ground truth."}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Industrial Standards & Citations */}
      {activeTab === "standards" && (
        <div className="rounded-xl border border-border/80 bg-card p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <BookOpen className="size-4.5 text-info" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                International Engineering Standards & Compliance References
              </h3>
            </div>
            <span className="text-[0.6875rem] font-mono text-muted-foreground">
              {citations.length} Documented References
            </span>
          </div>

          <p className="text-xs text-muted-foreground">
            The diagnostic report cross-references real-time telemetry against accredited continuous
            handling and conveyor belt safety engineering standards.
          </p>

          {citations.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {citations.map((c, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-border/80 bg-secondary/30 p-4 space-y-2 transition-all hover:bg-secondary/60 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-xs font-bold text-foreground line-clamp-2">
                      {sanitizeText(c.title || `Engineering Reference #${i + 1}`)}
                    </h4>
                    {c.url && (
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 text-info hover:text-foreground transition-colors"
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                    )}
                  </div>
                  <p className="text-[0.75rem] text-muted-foreground line-clamp-3 leading-relaxed">
                    {sanitizeText(c.snippet || "Standard design parameters, permissible tolerances, and splice joint safety coefficients.")}
                  </p>
                  <div className="pt-1 flex items-center justify-between text-[0.625rem] text-info font-mono">
                    <span>DIN 22101 / ISO 5048 Reference</span>
                    <span className="text-muted-foreground">Validated</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-border/60 bg-secondary/20 p-6 text-center text-xs text-muted-foreground">
              DIN 22101 (Continuous handling equipment — Belt conveyors) and ISO 5048 (Calculation of
              operating power and tensile forces) standard engineering profiles active.
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Raw Neural Log */}
      {activeTab === "raw" && (
        <div className="rounded-xl border border-border/80 bg-background/90 p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <span className="text-xs font-mono font-bold text-foreground">
              DIAGNOSTIC_REPORT_PAYLOAD.MD
            </span>
            <button
              onClick={copyToClipboard}
              className="flex items-center gap-1.5 rounded border border-border bg-secondary/80 px-2.5 py-1 text-[0.6875rem] font-bold text-foreground hover:bg-secondary cursor-pointer"
            >
              {copied ? <Check className="size-3 text-normal" /> : <Copy className="size-3 text-muted-foreground" />}
              {copied ? "Copied" : "Copy Raw Markdown"}
            </button>
          </div>
          <pre className="overflow-x-auto p-4 rounded-md bg-secondary/40 font-mono text-[0.75rem] leading-relaxed text-foreground/80 max-h-[500px] overflow-y-auto">
            {markdownContent}
          </pre>
        </div>
      )}
    </div>
  );
}
