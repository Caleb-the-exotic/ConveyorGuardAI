/**
 * useArduino.ts
 * ─────────────
 * React hook that manages the WebSocket connection to the Arduino serial
 * bridge at ws://127.0.0.1:8000/ws/arduino.
 *
 * Exposes:
 *   - arduinoReading   – latest parsed sensor object
 *   - connected        – WS is open
 *   - ports            – list of available COM ports
 *   - selectedPort     – currently chosen port string
 *   - setSelectedPort
 *   - connect()        – open serial + start WS
 *   - disconnect()
 *   - refreshPorts()
 *   - arduinoHealth    – Arduino-derived health/risk numbers
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";

export interface ArduinoReading {
  // Mapped to store sensor keys (null if sensor disconnected/failed)
  temperature:  number | null;  // °C (DS18B20)
  vibration:    number | null;  // mm/s derived from MPU6050 + digital sensor
  load:         number | null;  // kg (HX711)
  speed:        number;         // m/s (encoder)
  acoustic:     number;         // 0-100 sound level (microphone)
  tension:      number | null;  // cm ultrasonic distance (HC-SR04)
  current:      number;         // A (ACS712)
  alignment:    number;         // mm offset (IR sensor pair derived)

  // Potentiometer & Motor PWM Control
  pot_value?:   number;         // 0-1023 (Pin A2)
  motor_pwm?:   number;         // 80-255 PWM (Pin 10)
  motor:        "ON" | "OFF";   // Push button toggled (Pin A3)

  // IR Sensors & Buzzer (IR Detection Only Alert)
  ir_left:      number;         // 1=clear, 0=object (Pin 4)
  ir_right:     number;         // 1=clear, 0=object (Pin 5)
  ir_object_detected?: boolean; // Object detected on either
  ir_buzzer_active?:   boolean; // Buzzer active for 2 seconds (Pin 0)

  // Alignment diagnostics
  alignment_direction?: "CENTERED" | "LEFT" | "RIGHT" | "BILATERAL";
  alignment_status?: "NORMAL" | "WARNING" | "CRITICAL";
  alignment_signed_mm?: number;
  alignment_desc?: string;

  // Sensor diagnostic availability flags
  temp_ok?: boolean;
  load_ok?: boolean;
  dist_ok?: boolean;
  mpu_ok?: boolean;
  encoder_ok?: boolean;

  // Overall system status from Arduino ("NORMAL" or "PROCESSING")
  status:       string;

  // Auxiliary / Legacy fields
  health?:      number;
  risk?:        number;
  acc_raw?:     number;
  vib_digital?: number;
  dist_cm?:     number;
}

export interface ComPort {
  port: string;
  description: string;
}

// Connects to the local FastAPI server if available, falling back to Render.
// Since physical Arduino COM ports exist on the user's local PC, we probe localhost:8000 first.
const LOCAL_REST = "http://127.0.0.1:8000";
const LOCAL_WS   = "ws://127.0.0.1:8000/ws/arduino";
const REMOTE_REST = "https://conveyorguardai.onrender.com";
const REMOTE_WS   = "wss://conveyorguardai.onrender.com/ws/arduino";

export function useArduino() {
  const [connected, setConnected]           = useState(false);
  const [ports, setPorts]                   = useState<ComPort[]>([]);
  const [selectedPort, setSelectedPort]     = useState<string>("");
  const [arduinoReading, setArduinoReading] = useState<ArduinoReading | null>(null);
  const activeBaseRef = useRef<string>(LOCAL_REST);
  const activeWsRef   = useRef<string>(LOCAL_WS);

  const wsRef    = useRef<WebSocket | null>(null);
  const aliveRef = useRef(true);

  // ── REST helpers ──────────────────────────────────────────────────────────
  const refreshPorts = useCallback(async () => {
    // 1. Try local backend first (where USB COM ports actually reside)
    try {
      const res = await fetch(`${LOCAL_REST}/api/arduino/ports`, { signal: AbortSignal.timeout(1500) });
      if (res.ok) {
        const data = await res.json();
        activeBaseRef.current = LOCAL_REST;
        activeWsRef.current = LOCAL_WS;
        setPorts(data.ports ?? []);
        if (data.ports?.length > 0 && !selectedPort) {
          setSelectedPort(data.ports[0].port);
        }
        return;
      }
    } catch {
      // Local backend not reachable, fallback to remote
    }

    // 2. Fallback to remote backend
    try {
      const res  = await fetch(`${REMOTE_REST}/api/arduino/ports`, { signal: AbortSignal.timeout(3000) });
      const data = await res.json();
      activeBaseRef.current = REMOTE_REST;
      activeWsRef.current = REMOTE_WS;
      setPorts(data.ports ?? []);
      if (!selectedPort && data.ports?.length > 0) {
        setSelectedPort(data.ports[0].port);
      }
    } catch {
      // backend might not be up yet
    }
  }, [selectedPort]);

  // ── WebSocket ─────────────────────────────────────────────────────────────
  const openWS = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    const ws = new WebSocket(activeWsRef.current);
    wsRef.current = ws;

    ws.onopen  = () => setConnected(true);
    ws.onclose = () => { setConnected(false); };
    ws.onerror = () => { setConnected(false); };

    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        if (data.keepalive) return;          // ignore heartbeat pings
        setArduinoReading(data as ArduinoReading);
      } catch { /* ignore parse errors */ }
    };
  }, []);

  const closeWS = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
  }, []);

  // ── Public actions ────────────────────────────────────────────────────────
  const connect = useCallback(async (port?: string) => {
    const target = port ?? selectedPort;
    if (!target) {
      toast.error("Select a COM port first.");
      return;
    }
    try {
      const res  = await fetch(`${activeBaseRef.current}/api/arduino/connect`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ port: target, baud: 115200 }),
      });
      const data = await res.json();
      if (data.ok) {
        setSelectedPort(target);
        openWS();
        toast.success(`Arduino connected on ${target}`);
      } else {
        toast.error(`Connection failed: ${data.error ?? "Unknown error"}`);
      }
    } catch {
      toast.error("Backend unreachable. Please run the local backend (run_backend.ps1) so your USB port can be read.");
    }
  }, [selectedPort, openWS]);

  const disconnect = useCallback(async () => {
    closeWS();
    try {
      await fetch(`${activeBaseRef.current}/api/arduino/disconnect`, { method: "POST" });
    } catch { /* ignore */ }
    setArduinoReading(null);
    toast.info("Arduino disconnected.");
  }, [closeWS]);

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  useEffect(() => {
    aliveRef.current = true;
    refreshPorts();
    return () => {
      aliveRef.current = false;
      closeWS();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    connected,
    ports,
    selectedPort,
    setSelectedPort,
    arduinoReading,
    connect,
    disconnect,
    refreshPorts,
  };
}
