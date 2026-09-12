import { createFileRoute, Link } from "@tanstack/react-router";
import { BrainCircuit, Sparkles, Activity, ShieldCheck, Cpu, ArrowRight, ClipboardList } from "lucide-react";
import { useConveyor } from "@/lib/conveyor/store";
import { PredictiveMaintenance } from "@/components/conveyor/PredictiveMaintenance";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/conveyor/primitives";
import { ExecutiveDiagnosticReport } from "@/components/conveyor/ExecutiveDiagnosticReport";

const title = "AI Intelligence & Diagnostics — ConveyorGuard AI";
const description =
  "Deep-dive AI defect detection, splice failure risk forecasting, neural reasoning explanations and automated maintenance recommendations.";

export const Route = createFileRoute("/ai-insights")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
    ],
  }),
  component: AIInsightsPage,
});

function AIInsightsPage() {
  const { prediction, detections, overallCondition, mode, setWorkOrderOpen } = useConveyor();

  return (
    <main className="mx-auto w-full max-w-[1800px] space-y-6 px-3 py-4 sm:px-6 sm:py-6">
      {/* AI Intelligence Header Banner */}
      <div className="relative overflow-hidden rounded-lg border border-border/80 bg-panel p-6 shadow-xl">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 size-80 rounded-full bg-info/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-20 -left-20 size-80 rounded-full bg-normal/10 blur-3xl"
        />

        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="grid size-10 place-items-center rounded-lg border border-info/40 bg-info-soft text-info shadow-[0_0_20px_-6px_var(--info)]">
                <BrainCircuit className="size-5" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[0.6875rem] font-bold tracking-[0.2em] text-info uppercase">
                    AI Diagnostic Engine & Neural Forecasting
                  </span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[0.625rem] font-medium tracking-wide text-muted-foreground uppercase">
                    Model v4.8 RUL & Vision
                  </span>
                </div>
                <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  AI Intelligence & Predictive Analytics
                </h1>
              </div>
            </div>
            <p className="mt-2.5 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              Real-time computer vision inference, splice-joint stress neural network predictions,
              physics-informed remaining useful life (RUL) estimation, and explainable decision
              auditing.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-3 print:hidden">
            <div className="flex items-center gap-2 rounded-md border border-border bg-secondary/80 px-3 py-2">
              <Cpu className="size-4 text-info" />
              <div className="text-left">
                <div className="text-[0.625rem] text-muted-foreground uppercase">Inference Status</div>
                <div className="text-xs font-bold text-foreground">Active · 24ms Latency</div>
              </div>
            </div>

            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-md bg-secondary border border-border px-4 py-2.5 text-xs font-bold tracking-wider text-foreground uppercase shadow transition-all hover:bg-card hover:text-info"
            >
              <Activity className="size-4" />
              Live Monitor
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Live Executive AI Diagnostic & Compliance Report */}
      <ExecutiveDiagnosticReport />



      {/* Predictive Maintenance & RUL Breakdown */}
      <PredictiveMaintenance />

      {/* Action Recommendation */}
      <div className="flex justify-end pt-2">
        <Button
          type="button"
          onClick={() => setWorkOrderOpen(true)}
          className="min-h-11 w-full sm:w-auto text-[0.6875rem] font-bold tracking-[0.14em] uppercase"
        >
          <ClipboardList className="size-4 mr-2" aria-hidden />
          Create Maintenance Work Order
        </Button>
      </div>
    </main>
  );
}
