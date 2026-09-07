import { createFileRoute } from "@tanstack/react-router";
import { Hero } from "@/components/conveyor/Hero";
import { AIVision } from "@/components/conveyor/AIVision";
import { ConveyorHealth } from "@/components/conveyor/ConveyorHealth";
import { BeltCondition } from "@/components/conveyor/BeltCondition";
import { SensorTelemetry } from "@/components/conveyor/SensorTelemetry";

const title = "ConveyorGuard AI — Live Conveyor Health Dashboard";
const description =
  "Real-time conveyor belt monitoring with AI vision defect detection, sensor telemetry, alerts and maintenance work orders.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="mx-auto w-full max-w-[1800px] space-y-6 px-3 py-4 sm:px-6 sm:py-6">
      <h1 className="sr-only">ConveyorGuard AI — conveyor belt health monitoring dashboard</h1>

      {/* Hero section covering full display height without outer container box */}
      <Hero />

      {/* Combined AI Vision (left 50%) and Conveyor Health (right 50%) */}
      <div id="ai-vision-section" className="grid items-start gap-6 lg:grid-cols-12">
        <div className="lg:col-span-6 xl:col-span-6">
          <AIVision />
        </div>
        <div className="lg:col-span-6 xl:col-span-6">
          <ConveyorHealth />
        </div>
      </div>

      {/* Belt Condition */}
      <BeltCondition />

      {/* Live Sensor Telemetry (includes time-range controls) */}
      <SensorTelemetry />
    </main>
  );
}
