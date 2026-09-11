import { ArrowDown, ArrowRight, BrainCircuit } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function Hero() {
  return (
    <section
      aria-label="Overview"
      className="relative flex min-h-[calc(100svh-4.5rem)] flex-col justify-between overflow-hidden bg-transparent px-4 py-8 sm:px-8 sm:py-12"
    >
      {/* Ambient background glows */}
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-16 size-[36rem] rounded-full bg-info/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -right-16 size-[36rem] rounded-full bg-warning/5 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[40rem] rounded-full bg-normal/5 blur-3xl"
      />

      {/* Main content grid */}
      <div className="relative z-10 grid items-center gap-12 lg:grid-cols-12">
        {/* Left: Headline & CTAs */}
        <div className="flex flex-col items-start lg:col-span-7 xl:col-span-7">
          <h2 className="max-w-3xl text-4xl font-extrabold leading-[1.08] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Catch a splice failure
            <span className="block text-info"> before the belt tears</span>
          </h2>

          <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            ConveyorGuard AI continuously inspects the conveyor line end to end — synchronizing multi-axis vibration,
            thermal signatures, joint tension and high-frame-rate computer vision across all vulcanized splice
            joints to forecast rupture risks 24 hours ahead of catastrophic downtime.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Button
              type="button"
              size="lg"
              onClick={() => scrollTo("ai-vision-section")}
              className="min-h-12 px-6 text-xs font-bold tracking-[0.16em] uppercase shadow-lg shadow-primary/20"
            >
              Inspect the belt
              <ArrowRight className="size-4" aria-hidden />
            </Button>

            <Link
              to="/ai-insights"
              className="inline-flex min-h-12 items-center gap-2 rounded-md border border-info/50 bg-info-soft/30 px-6 text-xs font-bold tracking-[0.16em] uppercase text-info hover:bg-info-soft/60 hover:text-white transition-all shadow-md cursor-pointer active:scale-95"
            >
              <BrainCircuit className="size-4 text-info" />
              AI Predictive Insights
            </Link>
          </div>
        </div>

        {/* Right: Orangish Outline Conveyor Belt AI Schematic Graphic */}
        <div className="relative flex items-center justify-center lg:col-span-5 xl:col-span-5">
          <div className="relative w-full max-w-lg overflow-hidden rounded-xl">
            <img
              src="/conveyor-belt-outline.jpg"
              alt="AI-generated schematic diagram with orangish outline of industrial conveyor belt system"
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </div>

      {/* Bottom scroll link */}
      <div className="relative flex items-center justify-end pt-4 text-xs text-muted-foreground">
        <button
          type="button"
          onClick={() => scrollTo("ai-vision-section")}
          className="flex items-center gap-1.5 font-semibold text-foreground hover:text-info uppercase tracking-wider transition-colors cursor-pointer"
        >
          <span>Scroll to Live Monitor</span>
          <ArrowDown className="size-3.5 animate-bounce" />
        </button>
      </div>
    </section>
  );
}
