/**
 * ArduinoPanel.tsx
 * ────────────────
 * Arduino connection widget + live hardware telemetry matching the new
 * Arduino UNO R4 Minima firmware (IR detection buzzer, Motor PWM, Potentiometer,
 * Current ACS712, Ultrasonic HC-SR04, DS18B20, MPU6050, HX711).
 * Health and Risk are completely removed on the Arduino board.
 */

import { useEffect } from "react";
import {
  Usb,
  RefreshCw,
  Cpu,
  AlertTriangle,
  CheckCircle2,
  Volume2,
  VolumeX,
  Gauge,
  Zap,
  Activity,
  Radio,
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

  // Push readings into global store so SensorTelemetry renders them
  useEffect(() => {
    setArduinoData(arduinoReading);
  }, [arduinoReading, setArduinoData]);

  const r = arduinoReading;
  const isNormal = r?.status === "NORMAL" || r?.status === "SYSTEM OK";
  const irDetected = Boolean(
    r?.ir_object_detected ||
    r?.ir_left === 0 ||
    r?.ir_right === 0 ||
    r?.ir_buzzer_active
  );

  return (
    <div className="flex flex-col gap-3">
      {/* ── Connection bar ── */}
      <div className="tile rounded-md border border-border/60 p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="flex items-center gap-1.5 text-[0.5625rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            <Usb className="size-3" /> Arduino UNO R4 Minima
          </span>
          <span
            className={cn(
              "flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.5rem] font-bold uppercase tracking-wider border",
              connected
                ? "bg-normal/20 text-normal border-normal/30"
                : "bg-muted/30 text-muted-foreground border-border/40"
            )}
          >
            <span
              className={cn(
                "inline-block size-1.5 rounded-full",
                connected ? "bg-normal animate-pulse" : "bg-muted-foreground"
              )}
            />
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
            className="rounded border border-border/60 bg-background p-1.5 text-muted-foreground transition-colors hover:border-info/50 hover:text-info cursor-pointer"
          >
            <RefreshCw className="size-3.5" />
          </button>

          <button
            onClick={connected ? disconnect : () => connect()}
            disabled={!connected && ports.length === 0}
            className={cn(
              "rounded px-3 py-1.5 text-[0.625rem] font-bold uppercase tracking-wider transition-all cursor-pointer",
              connected
                ? "bg-critical/20 text-critical border border-critical/30 hover:bg-critical/30"
                : "bg-info text-white hover:brightness-110 disabled:opacity-40"
            )}
          >
            {connected ? "Disconnect" : "Connect"}
          </button>
        </div>
      </div>

      {/* ── Live telemetry inputs (only when receiving data) ── */}
      {r && (
        <>
          {/* Arduino System Status banner */}
          <div
            className={cn(
              "rounded-md px-3 py-2 text-center text-[0.625rem] font-bold uppercase tracking-wider border flex items-center justify-between",
              isNormal
                ? "border-normal/30 bg-normal/10 text-normal"
                : "border-warning/40 bg-warning/15 text-warning"
            )}
          >
            <span className="flex items-center gap-1.5">
              <span
                className={cn(
                  "size-2 rounded-full",
                  isNormal ? "bg-normal shadow-sm shadow-normal" : "bg-warning animate-ping"
                )}
              />
              RGB LED: {isNormal ? "Green (Normal)" : "Yellow (Processing)"}
            </span>
            <span className="font-mono tracking-widest">{r.status}</span>
          </div>

          {/* Motor State + Potentiometer PWM */}
          <div className="grid grid-cols-2 gap-2">
            {/* Motor Push Button */}
            <div className="tile rounded-md border border-border/60 p-2.5">
              <div className="flex items-center justify-between text-[0.5rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                <span>Motor (Pin A3)</span>
                <span className="text-[0.5rem] font-normal text-muted-foreground">Button</span>
              </div>
              <div
                className={cn(
                  "mt-1 text-sm font-black flex items-center gap-1.5",
                  r.motor === "ON" ? "text-normal" : "text-muted-foreground"
                )}
              >
                <span
                  className={cn(
                    "size-2 rounded-full",
                    r.motor === "ON" ? "bg-normal animate-pulse" : "bg-muted-foreground/40"
                  )}
                />
                {r.motor}
              </div>
            </div>

            {/* Potentiometer Motor Speed */}
            <div className="tile rounded-md border border-border/60 p-2.5">
              <div className="flex items-center justify-between text-[0.5rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                <span>Speed PWM (Pin A2)</span>
                <Gauge className="size-3 text-muted-foreground" />
              </div>
              <div className="mt-1 tabular text-sm font-black text-foreground">
                {r.motor_pwm ?? (r.motor === "ON" ? 150 : 0)}{" "}
                <span className="text-[0.5625rem] text-muted-foreground font-normal">/ 255</span>
              </div>
            </div>

            {/* Current Sensor (ACS712) */}
            <div className="tile rounded-md border border-border/60 p-2.5">
              <div className="flex items-center justify-between text-[0.5rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                <span>Current (Pin A0)</span>
                <Zap className="size-3 text-warning" />
              </div>
              <div className="mt-1 tabular text-sm font-black text-foreground">
                {r.current.toFixed(2)}{" "}
                <span className="text-[0.5625rem] text-muted-foreground font-normal">A</span>
              </div>
            </div>

            {/* Ultrasonic Distance (HC-SR04) */}
            <div className="tile rounded-md border border-border/60 p-2.5">
              <div className="flex items-center justify-between text-[0.5rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                <span>Distance (HC-SR04)</span>
                <Radio className="size-3 text-info" />
              </div>
              <div className="mt-1 tabular text-sm font-black text-foreground">
                {(r.tension ?? r.dist_cm ?? 0).toFixed(1)}{" "}
                <span className="text-[0.5625rem] text-muted-foreground font-normal">cm</span>
              </div>
            </div>
          </div>

          {/* IR Sensors (Pins 4 & 5) */}
          <div className="grid grid-cols-2 gap-2">
            {[
              {
                label: "IR Left (Pin 4)",
                val: r.ir_left,
              },
              {
                label: "IR Right (Pin 5)",
                val: r.ir_right,
              },
            ].map(({ label, val }) => (
              <div
                key={label}
                className={cn(
                  "tile rounded-md border p-2.5 flex items-center gap-2",
                  val === 0 ? "border-critical/50 bg-critical/10" : "border-border/60"
                )}
              >
                {val === 1 ? (
                  <CheckCircle2 className="size-3.5 text-normal shrink-0" />
                ) : (
                  <AlertTriangle className="size-3.5 text-critical animate-pulse shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="text-[0.5rem] font-bold uppercase tracking-[0.14em] text-muted-foreground truncate">
                    {label}
                  </div>
                  <div
                    className={cn(
                      "text-[0.6875rem] font-bold truncate",
                      val === 1 ? "text-normal" : "text-critical"
                    )}
                  >
                    {val === 1 ? "Clear (OK)" : "Object Detected"}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Buzzer Alert Status (Pin 0) */}
          <div
            className={cn(
              "rounded-md p-2.5 text-xs border flex items-center justify-between transition-all",
              irDetected
                ? "border-critical/50 bg-critical/20 text-critical shadow-sm"
                : "border-border/60 bg-panel-raised text-muted-foreground"
            )}
          >
            <div className="flex items-center gap-2">
              {irDetected ? (
                <Volume2 className="size-4 text-critical animate-bounce shrink-0" />
              ) : (
                <VolumeX className="size-4 text-muted-foreground shrink-0" />
              )}
              <div>
                <div className="text-[0.5rem] font-bold uppercase tracking-[0.14em]">
                  Buzzer (Pin 0)
                </div>
                <div className="text-[0.6875rem] font-bold">
                  {irDetected ? "BUZZER ON (2s IR Detection Alert)" : "Buzzer Idle (IR Trigger Only)"}
                </div>
              </div>
            </div>
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[0.5625rem] font-bold uppercase tracking-wider",
                irDetected
                  ? "bg-critical text-white animate-pulse"
                  : "bg-muted/40 text-muted-foreground"
              )}
            >
              {irDetected ? "ACTIVE" : "STANDBY"}
            </span>
          </div>

          {/* Hardware Diagnostic Readiness (LCD Pages 5, 6, 7) */}
          <div className="rounded-md border border-border/60 bg-panel-raised p-2.5">
            <div className="text-[0.5rem] font-bold uppercase tracking-[0.14em] text-muted-foreground mb-1.5 flex items-center justify-between">
              <span>Hardware Sensors Readiness</span>
              <Activity className="size-3 text-muted-foreground" />
            </div>
            <div className="grid grid-cols-3 gap-1 text-center">
              {[
                { name: "MPU6050", ok: r.mpu_ok !== false },
                { name: "DS18B20", ok: r.temp_ok !== false },
                { name: "HX711", ok: r.load_ok !== false },
              ].map((hw) => (
                <div
                  key={hw.name}
                  className={cn(
                    "rounded px-1.5 py-1 text-[0.5625rem] font-bold uppercase border",
                    hw.ok
                      ? "border-normal/30 bg-normal/10 text-normal"
                      : "border-warning/40 bg-warning/15 text-warning"
                  )}
                >
                  <div className="truncate">{hw.name}</div>
                  <div className="text-[0.5rem] opacity-80">{hw.ok ? "OK" : "PROCESS"}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
