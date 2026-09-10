/**
 * ArduinoPanel.tsx
 * ────────────────
 * Arduino connection widget + extra live stats (Motor, Current, Health, Risk).
 * The 7 sensor readings (Vibration, Temperature, etc.) are shown in
 * SensorTelemetry (Live Sensor Telemetry section) via the global store.
 */

import { useEffect } from "react";
import {
  Usb,
  RefreshCw,
  Cpu,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { useArduino } from "@/lib/conveyor/useArduino";
import { useConveyor } from "@/lib/conveyor/store";
import { cn } from "@/lib/utils";

export function ArduinoPanel() {
  const { setArduinoData } = useConveyor();
  const {
    connected,
    ports,
    selectedPort,
    setSelectedPort,
    arduinoReading,
    connect,
    disconnect,
    refreshPorts,
  } = useArduino();

  // Push readings into the global store so SensorTelemetry renders them
  useEffect(() => {
    setArduinoData(arduinoReading);
  }, [arduinoReading, setArduinoData]);

  const r = arduinoReading;

  return (
    <div className="flex flex-col gap-3">
      {/* ── Connection bar ── */}
      <div className="tile rounded-md border border-border/60 p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="flex items-center gap-1.5 text-[0.5625rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            <Usb className="size-3" /> Arduino Minima
          </span>
          <span className={cn(
            "flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.5rem] font-bold uppercase tracking-wider border",
            connected
              ? "bg-normal/20 text-normal border-normal/30"
              : "bg-muted/30 text-muted-foreground border-border/40"
          )}>
            <span className={cn(
              "inline-block size-1.5 rounded-full",
              connected ? "bg-normal animate-pulse" : "bg-muted-foreground"
            )} />
            {connected ? "Connected" : "Disconnected"}
          </span>
        </div>

        {/* Port selector + controls */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <select
              value={selectedPort}
              onChange={(e) => setSelectedPort(e.target.value)}
              className="w-full cursor-pointer appearance-none rounded border border-border/60 bg-background px-2.5 py-1.5 pr-7 text-[0.6875rem] font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-info/50"
            >
              {ports.length === 0 ? (
                <option value="">No COM ports found</option>
              ) : (
                ports.map((p) => (
                  <option key={p.port} value={p.port}>
                    {p.port} — {p.description}
                  </option>
                ))
              )}
            </select>
            <Cpu className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 size-3 text-muted-foreground" />
          </div>

          <button
            onClick={refreshPorts}
            title="Refresh COM ports"
            className="rounded border border-border/60 bg-background p-1.5 text-muted-foreground transition-colors hover:border-info/50 hover:text-info"
          >
            <RefreshCw className="size-3.5" />
          </button>

          <button
            onClick={connected ? disconnect : () => connect()}
            disabled={!connected && ports.length === 0}
            className={cn(
              "rounded px-3 py-1.5 text-[0.625rem] font-bold uppercase tracking-wider transition-all",
              connected
                ? "bg-critical/20 text-critical border border-critical/30 hover:bg-critical/30"
                : "bg-info text-white hover:brightness-110 disabled:opacity-40"
            )}
          >
            {connected ? "Disconnect" : "Connect"}
          </button>
        </div>
      </div>

      {/* ── Live extra stats (only when receiving data) ── */}
      {r && (
        <>
          <div className="grid grid-cols-2 gap-2">
            {/* Motor state */}
            <div className="tile rounded-md border border-border/60 p-2.5">
              <div className="text-[0.5rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">Motor</div>
              <div className={cn(
                "mt-0.5 text-sm font-black",
                r.motor === "ON" ? "text-normal" : "text-muted-foreground"
              )}>
                {r.motor}
              </div>
            </div>

            {/* Current draw */}
            <div className="tile rounded-md border border-border/60 p-2.5">
              <div className="text-[0.5rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">Current</div>
              <div className="mt-0.5 tabular text-sm font-black text-foreground">
                {r.current.toFixed(2)}{" "}
                <span className="text-[0.5625rem] text-muted-foreground">A</span>
              </div>
            </div>

            {/* Belt Health */}
            <div className="tile rounded-md border border-border/60 p-2.5">
              <div className="text-[0.5rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">Belt Health</div>
              <div className={cn(
                "mt-0.5 tabular text-sm font-black",
                r.health >= 70 ? "text-normal" : r.health >= 40 ? "text-warning" : "text-critical"
              )}>
                {r.health.toFixed(1)}{" "}
                <span className="text-[0.5625rem] text-muted-foreground">%</span>
              </div>
            </div>

            {/* Failure Risk */}
            <div className="tile rounded-md border border-border/60 p-2.5">
              <div className="text-[0.5rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">Failure Risk</div>
              <div className={cn(
                "mt-0.5 tabular text-sm font-black",
                r.risk >= 70 ? "text-critical" : r.risk >= 35 ? "text-warning" : "text-normal"
              )}>
                {r.risk.toFixed(1)}{" "}
                <span className="text-[0.5625rem] text-muted-foreground">%</span>
              </div>
            </div>
          </div>

          {/* IR Alignment indicators */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "IR Left", val: r.ir_left },
              { label: "IR Right", val: r.ir_right },
            ].map(({ label, val }) => (
              <div key={label} className="tile rounded-md border border-border/60 p-2.5 flex items-center gap-2">
                {val === 1
                  ? <CheckCircle2 className="size-3.5 text-normal shrink-0" />
                  : <AlertTriangle className="size-3.5 text-critical animate-pulse shrink-0" />
                }
                <div>
                  <div className="text-[0.5rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
                  <div className={cn("text-[0.6875rem] font-bold", val === 1 ? "text-normal" : "text-critical")}>
                    {val === 1 ? "Clear" : "Object!"}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Arduino status label */}
          <div className={cn(
            "rounded-md px-3 py-2 text-center text-[0.625rem] font-bold uppercase tracking-wider border",
            r.status === "SYSTEM OK"
              ? "border-normal/30 bg-normal/10 text-normal"
              : r.status === "WARNING"
                ? "border-warning/30 bg-warning/10 text-warning"
                : "border-critical/30 bg-critical/10 text-critical"
          )}>
            {r.status}
          </div>
        </>
      )}
    </div>
  );
}
