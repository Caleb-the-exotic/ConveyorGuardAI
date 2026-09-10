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
  // Mapped to store sensor keys
  temperature:  number;  // °C  (DS18B20)
  vibration:    number;  // mm/s derived from MPU6050 + digital sensor
  load:         number;  // kg  (HX711)
  speed:        number;  // m/s (encoder)
  acoustic:     number;  // 0-100 sound level (microphone)
  tension:      number;  // cm  ultrasonic distance (belt sag proxy)
  alignment:    number;  // mm offset (IR sensor pair derived)

  // Extra telemetry
  health:       number;
  risk:         number;
  current:      number;  // A (ACS712)
  motor:        "ON" | "OFF";
  status:       string;
  ir_left:      number;
  ir_right:     number;
  acc_raw:      number;
  vib_digital:  number;
}

export interface ComPort {
  port: string;
  description: string;
}

const WS_URL   = "ws://127.0.0.1:8000/ws/arduino";
const REST_BASE = "http://127.0.0.1:8000";

export function useArduino() {
  const [connected, setConnected]           = useState(false);
  const [ports, setPorts]                   = useState<ComPort[]>([]);
  const [selectedPort, setSelectedPort]     = useState<string>("");
  const [arduinoReading, setArduinoReading] = useState<ArduinoReading | null>(null);

  const wsRef    = useRef<WebSocket | null>(null);
  const aliveRef = useRef(true);

  // ── REST helpers ──────────────────────────────────────────────────────────
  const refreshPorts = useCallback(async () => {
    try {
      const res  = await fetch(`${REST_BASE}/api/arduino/ports`);
      const data = await res.json();
      setPorts(data.ports ?? []);
      // Auto-select first port if nothing chosen yet
      if (!selectedPort && data.ports?.length > 0) {
        setSelectedPort(data.ports[0].port);
      }
    } catch {
      // backend might not be up yet — silent
    }
  }, [selectedPort]);

  // ── WebSocket ─────────────────────────────────────────────────────────────
  const openWS = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    const ws = new WebSocket(WS_URL);
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
      const res  = await fetch(`${REST_BASE}/api/arduino/connect`, {
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
      toast.error("Backend unreachable. Is the server running?");
    }
  }, [selectedPort, openWS]);

  const disconnect = useCallback(async () => {
    closeWS();
    try {
      await fetch(`${REST_BASE}/api/arduino/disconnect`, { method: "POST" });
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
