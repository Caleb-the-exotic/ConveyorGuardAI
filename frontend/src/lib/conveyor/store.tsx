import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import type {
  Alert,
  Condition,
  Detection,
  Joint,
  MaintenanceTask,
  Mode,
  Scenario,
  Sensor,
  SensorKey,
} from "./types";
import type { ArduinoReading } from "./useArduino";
import {
  SENSOR_META,
  buildAlerts,
  buildBeltAspects,
  buildDetections,
  buildJoints,
  buildPrediction,
  buildTasks,
  sensorSample,
} from "./simulation";

const MAX_POINTS = 400;

function emptySensors(): Sensor[] {
  return SENSOR_META.map((m) => ({
    ...m,
    value: null,
    status: "UNKNOWN" as Condition,
    history: [],
  }));
}

function scrollToId(id: string, block: ScrollLogicalPosition = "center") {
  if (typeof document === "undefined") return;
  requestAnimationFrame(() => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block });
  });
}

interface Ctx {
  mode: Mode;
  scenario: Scenario;
  activeScenario: Scenario | null;
  setMode: (m: Mode) => void;
  setScenario: (s: Scenario) => void;
  sensors: Sensor[];
  joints: Joint[];
  selectedJointId: string | null;
  selectJoint: (id: string | null) => void;
  selectedJoint: Joint | null;
  detections: Detection[];
  activeDetectionId: string | null;
  focusDetection: (id: string) => void;
  alerts: Alert[];
  activeAlertId: string | null;
  focusAlert: (alert: Alert) => void;
  acknowledgeAlert: (id: string) => void;
  highlightedSensor: SensorKey | null;
  highlightSensor: (key: SensorKey | null) => void;
  tasks: MaintenanceTask[];
  addTask: (task: Omit<MaintenanceTask, "id" | "simulated">) => void;
  beltAspects: ReturnType<typeof buildBeltAspects>;
  prediction: ReturnType<typeof buildPrediction>;
  overallCondition: Condition;
  workOrderOpen: boolean;
  setWorkOrderOpen: (v: boolean) => void;
  // Arduino live data
  arduinoData: ArduinoReading | null;
  setArduinoData: (r: ArduinoReading | null) => void;
}

const ConveyorContext = createContext<Ctx | null>(null);

export function ConveyorProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>("LIVE");
  const [scenario, setScenarioState] = useState<Scenario>("NORMAL");
  const [sensors, setSensors] = useState<Sensor[]>(emptySensors);
  const [selectedJointId, setSelectedJointId] = useState<string | null>(null);
  const [activeDetectionId, setActiveDetectionId] = useState<string | null>(null);
  const [activeAlertId, setActiveAlertId] = useState<string | null>(null);
  const [highlightedSensor, setHighlightedSensor] = useState<SensorKey | null>(null);
  const [extraTasks, setExtraTasks] = useState<MaintenanceTask[]>([]);
  const [acknowledged, setAcknowledged] = useState<string[]>([]);
  const [workOrderOpen, setWorkOrderOpen] = useState(false);
  const [arduinoData, setArduinoDataState] = useState<ArduinoReading | null>(null);
  const phase = useRef(0);

  const activeScenario = mode === "SIMULATION" ? scenario : null;

  useEffect(() => {
    setSensors(emptySensors());
    phase.current = 0;
    setActiveDetectionId(null);
    setActiveAlertId(null);
    setHighlightedSensor(null);
    setAcknowledged([]);
  }, [mode, scenario]);

  useEffect(() => {
    if (mode !== "SIMULATION") return;
    const tick = () => {
      phase.current += 1;
      const now = Date.now();
      setSensors((prev) =>
        prev.map((s) => {
          const { value, status } = sensorSample(scenario, s.key, phase.current);
          const history = [...s.history, { t: now, value }].slice(-MAX_POINTS);
          return { ...s, value, status, history };
        }),
      );
    };
    tick();
    const id = setInterval(tick, 1200);
    return () => clearInterval(id);
  }, [mode, scenario]);

  // ── Arduino live sensor injection ─────────────────────────────────────────
  useEffect(() => {
    if (mode !== "LIVE" || !arduinoData) return;

    const now = Date.now();

    // Derive condition for each sensor key from Arduino values
    function deriveCondition(key: SensorKey, val: number): Condition {
      switch (key) {
        case "temperature":
          return val >= 60 ? "CRITICAL" : val >= 45 ? "WARNING" : "NORMAL";
        case "vibration":
          return val >= 6.0 ? "CRITICAL" : val >= 3.0 ? "WARNING" : "NORMAL";
        case "load":
          return val >= 2.0 ? "CRITICAL" : val >= 1.5 ? "WARNING" : "NORMAL";
        case "speed":
          // 0 speed when motor should be running = critical
          return val === 0 ? "UNKNOWN" : val < 0.05 ? "CRITICAL" : "NORMAL";
        case "acoustic":
          return val >= 75 ? "CRITICAL" : val >= 60 ? "WARNING" : "NORMAL";
        case "tension":
          // Distance (belt sag): too low or too high = fault
          return val < 5 || val > 35 ? "CRITICAL" : val < 10 || val > 25 ? "WARNING" : "NORMAL";
        case "alignment":
          return val >= 12 ? "CRITICAL" : val >= 5 ? "WARNING" : "NORMAL";
        default:
          return "NORMAL";
      }
    }

    const keyMap: Record<SensorKey, number> = {
      temperature: arduinoData.temperature,
      vibration:   arduinoData.vibration,
      load:        arduinoData.load,
      speed:       arduinoData.speed,
      acoustic:    arduinoData.acoustic,
      tension:     arduinoData.tension,
      alignment:   arduinoData.alignment,
    };

    setSensors((prev) =>
      prev.map((s) => {
        const raw = keyMap[s.key];
        if (raw === undefined) return s;
        const value = raw;
        const status = deriveCondition(s.key, value);
        const history = [...s.history, { t: now, value }].slice(-MAX_POINTS);
        return { ...s, value, status, history };
      }),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arduinoData]);

  const setArduinoData = useCallback((r: ArduinoReading | null) => {
    setArduinoDataState(r);
  }, []);

  const joints = useMemo(() => buildJoints(activeScenario), [activeScenario]);
  const detections = useMemo(() => buildDetections(activeScenario), [activeScenario]);
  const rawAlerts = useMemo(() => buildAlerts(activeScenario), [activeScenario]);
  const beltAspects = useMemo(() => buildBeltAspects(activeScenario), [activeScenario]);
  const prediction = useMemo(() => buildPrediction(activeScenario), [activeScenario]);
  const simTasks = useMemo(() => buildTasks(activeScenario), [activeScenario]);

  const alerts = useMemo(
    () =>
      rawAlerts.map((a) =>
        acknowledged.includes(a.id) ? { ...a, status: "ACKNOWLEDGED" as const } : a,
      ),
    [rawAlerts, acknowledged],
  );

  const tasks = useMemo(() => [...extraTasks, ...simTasks], [extraTasks, simTasks]);

  const selectedJoint = useMemo(
    () => joints.find((j) => j.id === selectedJointId) ?? null,
    [joints, selectedJointId],
  );

  const overallCondition: Condition = activeScenario ?? "UNKNOWN";

  const selectJoint = useCallback(
    (id: string | null) => {
      setSelectedJointId(id);
      setActiveAlertId(null);
      const detection = id ? detections.find((d) => d.jointId === id) : undefined;
      setActiveDetectionId(detection?.id ?? null);
      setHighlightedSensor(null);
    },
    [detections],
  );

  const focusDetection = useCallback(
    (id: string) => {
      setActiveDetectionId(id);
      const d = detections.find((x) => x.id === id);
      if (d) setSelectedJointId(d.jointId);
      scrollToId("ai-vision", "start");
    },
    [detections],
  );

  const focusAlert = useCallback((alert: Alert) => {
    setActiveAlertId(alert.id);
    setSelectedJointId(alert.jointId);
    setHighlightedSensor(alert.sensorKey);
    setActiveDetectionId(alert.detectionId);
    scrollToId("selected-joint", "start");
  }, []);

  const acknowledgeAlert = useCallback((id: string) => {
    setAcknowledged((prev) => (prev.includes(id) ? prev : [...prev, id]));
    toast.success("Alert acknowledged");
  }, []);

  const highlightSensor = useCallback((key: SensorKey | null) => {
    setHighlightedSensor(key);
  }, []);

  const addTask = useCallback((task: Omit<MaintenanceTask, "id" | "simulated">) => {
    setExtraTasks((prev) => [{ ...task, id: `wo-${Date.now()}`, simulated: false }, ...prev]);
  }, []);

  const setMode = useCallback((m: Mode) => {
    setModeState(m);
    toast.info(
      m === "SIMULATION"
        ? "Simulation mode enabled — readings are generated demonstration data"
        : "Live data source selected — awaiting field telemetry",
    );
  }, []);

  const setScenario = useCallback((s: Scenario) => {
    setScenarioState(s);
    toast.info(`Simulated belt condition set to ${s}`);
  }, []);

  const value: Ctx = {
    mode,
    scenario,
    activeScenario,
    setMode,
    setScenario,
    sensors,
    joints,
    selectedJointId,
    selectJoint,
    selectedJoint,
    detections,
    activeDetectionId,
    focusDetection,
    alerts,
    activeAlertId,
    focusAlert,
    acknowledgeAlert,
    highlightedSensor,
    highlightSensor,
    tasks,
    addTask,
    beltAspects,
    prediction,
    overallCondition,
    workOrderOpen,
    setWorkOrderOpen,
    arduinoData,
    setArduinoData,
  };

  return <ConveyorContext.Provider value={value}>{children}</ConveyorContext.Provider>;
}

export function useConveyor() {
  const ctx = useContext(ConveyorContext);
  if (!ctx) throw new Error("useConveyor must be used within ConveyorProvider");
  return ctx;
}
