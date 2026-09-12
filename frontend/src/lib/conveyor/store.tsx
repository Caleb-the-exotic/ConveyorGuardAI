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
  BeltAspect,
  Condition,
  Detection,
  Joint,
  LiveDetection,
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
import {
  computeAllBeltAspects,
  type NormalizedScores,
  type WearTrackingData,
} from "./calculator";

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
  addAlert: (alert: Omit<Alert, "id" | "timestamp">) => void;
  highlightedSensor: SensorKey | null;
  highlightSensor: (key: SensorKey | null) => void;
  tasks: MaintenanceTask[];
  addTask: (task: Omit<MaintenanceTask, "id" | "simulated">) => void;
  beltAspects: BeltAspect[];
  prediction: ReturnType<typeof buildPrediction>;
  overallCondition: Condition;
  workOrderOpen: boolean;
  setWorkOrderOpen: (v: boolean) => void;
  // Arduino live data
  arduinoData: ArduinoReading | null;
  setArduinoData: (r: ArduinoReading | null) => void;
  // AI Vision Live Detections
  liveDetections: LiveDetection[];
  setLiveDetections: (d: LiveDetection[]) => void;
  // Calculated output engine & wear tracking
  calculatedScores: NormalizedScores;
  hasAIEvaluated: boolean;
  setHasAIEvaluated: (v: boolean) => void;
  lastSnapshot: string | null;
  setLastSnapshot: (v: string | null) => void;
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
  const [extraAlerts, setExtraAlerts] = useState<Alert[]>([]);
  const [acknowledged, setAcknowledged] = useState<string[]>([]);
  const [workOrderOpen, setWorkOrderOpen] = useState(false);
  const [arduinoData, setArduinoDataState] = useState<ArduinoReading | null>(null);
  const [liveDetections, setLiveDetectionsState] = useState<LiveDetection[]>([]);
  const [hasAIEvaluated, setHasAIEvaluated] = useState(false);
  const [lastSnapshot, setLastSnapshot] = useState<string | null>(null);
  const [wearTracking, setWearTracking] = useState<WearTrackingData>({
    previousWearCondition: null,
    currentWearCondition: null,
    physicalWearPercentage: null,
    lastTimestamp: null,
    degradationRatePerHour: null,
  });
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
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [mode, scenario]);

  // Handle Arduino live sensor updates
  useEffect(() => {
    if (!arduinoData) return;

    const now = Date.now();

    function deriveCondition(key: SensorKey, val: number): Condition {
      switch (key) {
        case "temperature":
          return val >= 60 ? "CRITICAL" : val >= 45 ? "WARNING" : "NORMAL";
        case "vibration":
          return val >= 7.0 ? "CRITICAL" : val >= 4.0 ? "WARNING" : "NORMAL";
        case "load":
          return val <= 10.0
            ? (val >= 2.0 ? "CRITICAL" : val >= 1.5 ? "WARNING" : "NORMAL")
            : (val >= 1800 ? "CRITICAL" : val >= 1550 ? "WARNING" : "NORMAL");
        case "speed":
          return arduinoData?.motor === "ON" && val < 0.05
            ? "CRITICAL"
            : val < 1.8 ? "WARNING" : "NORMAL";
        case "acoustic":
          return val >= 75 ? "CRITICAL" : val >= 60 ? "WARNING" : "NORMAL";
        case "current":
          return val >= 4.5 ? "CRITICAL" : val >= 2.5 ? "WARNING" : "NORMAL";
        case "tension":
          return val < 5 || val > 35 ? "CRITICAL" : val < 10 || val > 25 ? "WARNING" : "NORMAL";
        case "alignment":
          return val >= 20 ? "CRITICAL" : val >= 10 ? "WARNING" : "NORMAL";
        default:
          return "NORMAL";
      }
    }

    const keyMap: Partial<Record<SensorKey, number | null>> = {
      temperature: arduinoData.temperature,
      vibration:   arduinoData.vibration,
      load:        arduinoData.load,
      speed:       arduinoData.speed,
      acoustic:    arduinoData.acoustic,
      tension:     arduinoData.tension,
      current:     arduinoData.current,
      alignment:   arduinoData.alignment,
    };

    setSensors((prev) =>
      prev.map((s) => {
        const raw = keyMap[s.key];
        if (raw === undefined) return s;
        if (raw === null || isNaN(raw)) {
          return { ...s, value: null, status: "UNKNOWN" as Condition };
        }
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

  // Map raw sensors dynamically for the calculation engine
  const rawSensors = useMemo(() => {
    const map: Partial<Record<SensorKey, number | null>> = {};
    for (const s of sensors) {
      map[s.key] = s.value;
    }
    return map;
  }, [sensors]);

  const joints = useMemo(() => buildJoints(activeScenario), [activeScenario]);
  const detections = useMemo(() => buildDetections(activeScenario), [activeScenario]);
  const rawAlerts = useMemo(() => buildAlerts(activeScenario), [activeScenario]);
  const rawPrediction = useMemo(() => buildPrediction(activeScenario), [activeScenario]);
  const simTasks = useMemo(() => buildTasks(activeScenario), [activeScenario]);

  // Compute calculated aspects dynamically from the 7 sensors + AI inspection
  const calculatedData = useMemo(() => {
    const hasAnySensors = sensors.some((s) => s.value !== null && !isNaN(s.value));

    // When no live or simulation data exists at all
    if (!hasAnySensors && !activeScenario) {
      return {
        aspects: buildBeltAspects(null),
        scores: { V: null, T: null, BT: null, L: null, S: null, AC: null, AL: null },
        beltHealthScore: null,
        physicalWearPercentage: null,
      };
    }

    const aiDetections = liveDetections.length > 0 ? liveDetections : detections;
    const isAIActive = hasAIEvaluated || liveDetections.length > 0 || activeScenario !== null;

    return computeAllBeltAspects({
      rawSensors,
      hasAIEvaluated: isAIActive,
      aiDetections,
    });
  }, [sensors, rawSensors, liveDetections, detections, hasAIEvaluated, activeScenario]);

  const beltAspects = calculatedData.aspects;
  const calculatedScores = calculatedData.scores;

  // Track physical wear degradation over time (Section 10)
  useEffect(() => {
    const currentWear = calculatedData.physicalWearPercentage;
    if (currentWear === null) return;

    setWearTracking((prev) => {
      const now = Date.now();
      if (prev.currentWearCondition === null) {
        return {
          previousWearCondition: currentWear,
          currentWearCondition: currentWear,
          physicalWearPercentage: currentWear,
          lastTimestamp: now,
          degradationRatePerHour: 0.05, // Baseline continuous operational rate
        };
      }

      const dtHours = prev.lastTimestamp ? (now - prev.lastTimestamp) / 3600000 : 0;
      let rate = prev.degradationRatePerHour;
      if (dtHours > 0.001) {
        const delta = Math.abs(currentWear - (prev.previousWearCondition ?? currentWear));
        const instantaneousRate = delta / dtHours;
        rate = prev.degradationRatePerHour !== null
          ? prev.degradationRatePerHour * 0.95 + instantaneousRate * 0.05
          : instantaneousRate;
      }

      return {
        previousWearCondition: prev.currentWearCondition,
        currentWearCondition: currentWear,
        physicalWearPercentage: currentWear,
        lastTimestamp: now,
        degradationRatePerHour: rate,
      };
    });
  }, [calculatedData.physicalWearPercentage]);

  // Synchronize prediction with calculated belt health when available
  const prediction = useMemo(() => {
    if (calculatedData.beltHealthScore !== null) {
      const getAspect = (k: string) => calculatedData.aspects.find(a => a.key === k)?.score ?? 100;
      const bh = getAspect("health");
      const bw = getAspect("wear");
      const ec = getAspect("edge");
      const sc = getAspect("surface");
      const sp = getAspect("splice");

      let failRisk =
        0.25 * (100 - bh) +
        0.20 * (100 - bw) +
        0.15 * (100 - ec) +
        0.15 * (100 - sc) +
        0.25 * (100 - sp);
      
      failRisk = Math.max(0, Math.min(100, Math.round(failRisk)));

      const failProb = failRisk / 100;

      const riskLevel: Condition = bh >= 75 ? "NORMAL" : bh >= 40 ? "WARNING" : "CRITICAL";
      return {
        ...rawPrediction,
        beltHealth: bh,
        failureProbability: failProb,
        riskLevel,
      };
    }
    return rawPrediction;
  }, [rawPrediction, calculatedData.beltHealthScore, calculatedData.aspects]);

  const alerts = useMemo(
    () => [
      ...extraAlerts.map((a) => (acknowledged.includes(a.id) ? { ...a, status: "ACKNOWLEDGED" as const } : a)),
      ...rawAlerts.map((a) => (acknowledged.includes(a.id) ? { ...a, status: "ACKNOWLEDGED" as const } : a)),
    ],
    [extraAlerts, rawAlerts, acknowledged],
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
    setAcknowledged((prev) => [...prev, id]);
    toast.success("Alert acknowledged");
  }, []);

  const addAlert = useCallback((alertData: Omit<Alert, "id" | "timestamp">) => {
    const newAlert: Alert = {
      ...alertData,
      id: `alert-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
    setExtraAlerts((prev) => [newAlert, ...prev]);
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

  const setLiveDetections = useCallback((d: LiveDetection[]) => {
    setLiveDetectionsState(d);
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
    addAlert,
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
    liveDetections,
    setLiveDetections,
    calculatedScores,
    wearTracking,
    hasAIEvaluated,
    setHasAIEvaluated,
    lastSnapshot,
    setLastSnapshot,
  };

  return <ConveyorContext.Provider value={value}>{children}</ConveyorContext.Provider>;
}

export function useConveyor() {
  const ctx = useContext(ConveyorContext);
  if (!ctx) throw new Error("useConveyor must be used within ConveyorProvider");
  return ctx;
}
