import type {
  Alert,
  BeltAspect,
  Condition,
  Detection,
  Joint,
  MaintenanceTask,
  Prediction,
  Scenario,
  SensorKey,
} from "./types";

export const SENSOR_META: {
  key: SensorKey;
  name: string;
  unit: string;
}[] = [
  { key: "vibration", name: "Vibration", unit: "mm/s" },
  { key: "temperature", name: "Temperature", unit: "°C" },
  { key: "tension", name: "Belt Tension", unit: "kN" },
  { key: "load", name: "Load", unit: "t/h" },
  { key: "speed", name: "Belt Speed", unit: "m/s" },
  { key: "acoustic", name: "Acoustic Condition", unit: "dB" },
  { key: "alignment", name: "Alignment", unit: "mm" },
];

type Band = { base: number; jitter: number; status: Condition };

const PROFILES: Record<Scenario, Record<SensorKey, Band>> = {
  NORMAL: {
    vibration: { base: 2.1, jitter: 0.35, status: "NORMAL" },
    temperature: { base: 46, jitter: 1.6, status: "NORMAL" },
    tension: { base: 58, jitter: 1.8, status: "NORMAL" },
    load: { base: 1420, jitter: 55, status: "NORMAL" },
    speed: { base: 3.4, jitter: 0.06, status: "NORMAL" },
    acoustic: { base: 71, jitter: 1.4, status: "NORMAL" },
    alignment: { base: 2.0, jitter: 0.6, status: "NORMAL" },
  },
  WARNING: {
    vibration: { base: 5.4, jitter: 0.8, status: "WARNING" },
    temperature: { base: 62, jitter: 2.4, status: "WARNING" },
    tension: { base: 73, jitter: 3.2, status: "WARNING" },
    load: { base: 1610, jitter: 80, status: "NORMAL" },
    speed: { base: 3.3, jitter: 0.12, status: "NORMAL" },
    acoustic: { base: 82, jitter: 2.2, status: "WARNING" },
    alignment: { base: 7.5, jitter: 1.2, status: "WARNING" },
  },
  CRITICAL: {
    vibration: { base: 9.8, jitter: 1.4, status: "CRITICAL" },
    temperature: { base: 81, jitter: 3.2, status: "CRITICAL" },
    tension: { base: 92, jitter: 4.5, status: "CRITICAL" },
    load: { base: 1735, jitter: 110, status: "WARNING" },
    speed: { base: 3.0, jitter: 0.22, status: "WARNING" },
    acoustic: { base: 94, jitter: 3.0, status: "CRITICAL" },
    alignment: { base: 14.2, jitter: 1.8, status: "CRITICAL" },
  },
};

export function sensorSample(scenario: Scenario, key: SensorKey, phase: number) {
  const p = PROFILES[scenario][key];
  const wave = Math.sin(phase / 2.1 + key.length) * p.jitter * 0.6;
  const noise = (Math.random() - 0.5) * p.jitter;
  const decimals = key === "load" ? 0 : key === "speed" ? 2 : 1;
  return {
    value: Number((p.base + wave + noise).toFixed(decimals)),
    status: p.status,
  };
}

export const JOINT_POSITIONS = [12, 30, 48, 66, 84];

export function buildJoints(scenario: Scenario | null): Joint[] {
  return JOINT_POSITIONS.map((position, i) => {
    const id = `J-0${i + 1}`;
    const label = `Joint 0${i + 1}`;
    if (!scenario) {
      return {
        id,
        label,
        position,
        condition: "UNKNOWN" as Condition,
        healthScore: null,
        failureProbability: null,
        rulHours: null,
        issues: [],
        inspectionStatus: "Awaiting AI inspection",
        riskLevel: "UNKNOWN" as Condition,
        recommendation: null,
      };
    }

    let condition: Condition = "NORMAL";
    if (scenario === "WARNING" && i === 3) condition = "WARNING";
    if (scenario === "WARNING" && i === 1) condition = "WARNING";
    if (scenario === "CRITICAL" && i === 3) condition = "CRITICAL";
    if (scenario === "CRITICAL" && (i === 1 || i === 4)) condition = "WARNING";

    const health =
      condition === "CRITICAL" ? 24 + i : condition === "WARNING" ? 61 + i : 92 - i;
    const prob =
      condition === "CRITICAL" ? 0.87 : condition === "WARNING" ? 0.34 : 0.05 + i * 0.01;
    const rul = condition === "CRITICAL" ? 18 : condition === "WARNING" ? 340 : 2100 - i * 40;

    const issues =
      condition === "CRITICAL"
        ? ["Splice degradation", "Belt tear at joint edge", "Elevated vibration signature"]
        : condition === "WARNING"
          ? ["Early splice wear", "Minor edge fraying"]
          : [];

    return {
      id,
      label,
      position,
      condition,
      healthScore: health,
      failureProbability: Number(prob.toFixed(2)),
      rulHours: rul,
      issues,
      inspectionStatus: "AI inspected (simulated)",
      riskLevel: condition,
      recommendation:
        condition === "CRITICAL"
          ? "Stop belt at next scheduled window. Inspect affected splice and verify joint integrity before resuming full load."
          : condition === "WARNING"
            ? "Schedule splice inspection within 72 hours and monitor vibration trend."
            : "No action required. Continue routine monitoring.",
    };
  });
}

export function buildBeltAspects(scenario: Scenario | null): BeltAspect[] {
  const def = (key: string, label: string, status: Condition, detail: string) => ({
    key,
    label,
    status,
    detail,
  });
  if (!scenario)
    return [
      def("health", "Belt Health", "UNKNOWN", "Awaiting live data"),
      def("alignment", "Belt Alignment", "UNKNOWN", "Awaiting live data"),
      def("wear", "Belt Wear", "UNKNOWN", "Awaiting live data"),
      def("edge", "Edge Condition", "UNKNOWN", "Awaiting live data"),
      def("surface", "Surface Condition", "UNKNOWN", "Awaiting AI inspection"),
      def("splice", "Splice Condition", "UNKNOWN", "Awaiting AI inspection"),
    ];

  if (scenario === "NORMAL")
    return [
      def("health", "Belt Health", "NORMAL", "94% structural integrity"),
      def("alignment", "Belt Alignment", "NORMAL", "Tracking within 2 mm"),
      def("wear", "Belt Wear", "NORMAL", "Cover wear 12% of allowance"),
      def("edge", "Edge Condition", "NORMAL", "No fraying detected"),
      def("surface", "Surface Condition", "NORMAL", "No surface defects detected"),
      def("splice", "Splice Condition", "NORMAL", "All 5 splices nominal"),
    ];

  if (scenario === "WARNING")
    return [
      def("health", "Belt Health", "WARNING", "71% structural integrity"),
      def("alignment", "Belt Alignment", "WARNING", "Drift 7.5 mm toward drive side"),
      def("wear", "Belt Wear", "WARNING", "Cover wear 38% of allowance"),
      def("edge", "Edge Condition", "WARNING", "Minor fraying near Joint 02"),
      def("surface", "Surface Condition", "NORMAL", "Surface intact"),
      def("splice", "Splice Condition", "WARNING", "Early wear on Joint 04 splice"),
    ];

  return [
    def("health", "Belt Health", "CRITICAL", "38% structural integrity"),
    def("alignment", "Belt Alignment", "CRITICAL", "Drift 14.2 mm — off-track risk"),
    def("wear", "Belt Wear", "CRITICAL", "Cover wear 76% of allowance"),
    def("edge", "Edge Condition", "CRITICAL", "Edge tear propagating at Joint 04"),
    def("surface", "Surface Condition", "WARNING", "Longitudinal scoring detected"),
    def("splice", "Splice Condition", "CRITICAL", "Joint 04 splice separating"),
  ];
}

export function buildDetections(scenario: Scenario | null): Detection[] {
  if (!scenario) return [];
  const now = new Date();
  const stamp = (mins: number) =>
    new Date(now.getTime() - mins * 60000).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

  if (scenario === "NORMAL")
    return [
      {
        id: "d1",
        type: "Belt Wear",
        confidence: 0.42,
        severity: "NORMAL",
        location: "Belt span 18 m",
        jointId: "J-02",
        detectedAt: stamp(6),
        box: { x: 18, y: 46, w: 16, h: 18 },
      },
    ];

  if (scenario === "WARNING")
    return [
      {
        id: "d1",
        type: "Splice Degradation",
        confidence: 0.78,
        severity: "WARNING",
        location: "Belt span 42 m",
        jointId: "J-04",
        detectedAt: stamp(2),
        box: { x: 54, y: 40, w: 22, h: 24 },
      },
      {
        id: "d2",
        type: "Edge Damage",
        confidence: 0.64,
        severity: "WARNING",
        location: "Belt span 21 m",
        jointId: "J-02",
        detectedAt: stamp(9),
        box: { x: 20, y: 66, w: 18, h: 12 },
      },
    ];

  return [
    {
      id: "d1",
      type: "Tear",
      confidence: 0.96,
      severity: "CRITICAL",
      location: "Belt span 42 m",
      jointId: "J-04",
      detectedAt: stamp(1),
      box: { x: 52, y: 36, w: 26, h: 30 },
    },
    {
      id: "d2",
      type: "Splice Degradation",
      confidence: 0.91,
      severity: "CRITICAL",
      location: "Belt span 43 m",
      jointId: "J-04",
      detectedAt: stamp(3),
      box: { x: 58, y: 60, w: 18, h: 16 },
    },
    {
      id: "d3",
      type: "Misalignment",
      confidence: 0.83,
      severity: "WARNING",
      location: "Belt span 60 m",
      jointId: "J-05",
      detectedAt: stamp(7),
      box: { x: 76, y: 24, w: 16, h: 20 },
    },
    {
      id: "d4",
      type: "Edge Damage",
      confidence: 0.72,
      severity: "WARNING",
      location: "Belt span 22 m",
      jointId: "J-02",
      detectedAt: stamp(12),
      box: { x: 18, y: 68, w: 15, h: 14 },
    },
  ];
}

export function buildAlerts(scenario: Scenario | null): Alert[] {
  if (!scenario) return [];
  const t = (mins: number) =>
    new Date(Date.now() - mins * 60000).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

  if (scenario === "NORMAL") return [];

  if (scenario === "WARNING")
    return [
      {
        id: "a1",
        severity: "WARNING",
        title: "Abnormal vibration",
        section: "Belt span 40–46 m",
        jointId: "J-04",
        sensorKey: "vibration",
        detectionId: "d1",
        condition: "Vibration 5.4 mm/s exceeds nominal band (< 4.0 mm/s)",
        timestamp: t(4),
        status: "ACTIVE",
      },
      {
        id: "a2",
        severity: "WARNING",
        title: "Belt misalignment",
        section: "Belt span 18–24 m",
        jointId: "J-02",
        sensorKey: "alignment",
        detectionId: "d2",
        condition: "Tracking drift 7.5 mm toward drive side",
        timestamp: t(11),
        status: "ACTIVE",
      },
    ];

  return [
    {
      id: "a1",
      severity: "CRITICAL",
      title: "Joint degradation — imminent rupture risk",
      section: "Belt span 40–46 m",
      jointId: "J-04",
      sensorKey: "tension",
      detectionId: "d1",
      condition: "Splice separation detected with 96% confidence, tension 92 kN",
      timestamp: t(1),
      status: "ACTIVE",
    },
    {
      id: "a2",
      severity: "WARNING",
      title: "Abnormal vibration",
      section: "Drive pulley / belt span 0–12 m",
      jointId: "J-01",
      sensorKey: "vibration",
      detectionId: null,
      condition: "Vibration 9.8 mm/s — sustained above critical threshold",
      timestamp: t(5),
      status: "ACTIVE",
    },
    {
      id: "a3",
      severity: "WARNING",
      title: "Belt misalignment",
      section: "Belt span 56–64 m",
      jointId: "J-05",
      sensorKey: "alignment",
      detectionId: "d3",
      condition: "Tracking drift 14.2 mm — off-track risk",
      timestamp: t(9),
      status: "ACTIVE",
    },
    {
      id: "a4",
      severity: "NORMAL",
      title: "Temperature abnormality",
      section: "Drive pulley bearing",
      jointId: "J-01",
      sensorKey: "temperature",
      detectionId: null,
      condition: "Bearing temperature 81 °C, rising 4 °C/hr",
      timestamp: t(14),
      status: "ACTIVE",
    },
  ];
}

export function buildTasks(scenario: Scenario | null): MaintenanceTask[] {
  if (!scenario || scenario === "NORMAL") return [];
  const day = (h: number) =>
    new Date(Date.now() + h * 3600000).toLocaleString([], {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  if (scenario === "WARNING")
    return [
      {
        id: "t1",
        jointId: "J-04",
        issue: "Early splice wear — verify vulcanised joint",
        priority: "MEDIUM",
        technician: "R. Mahato",
        scheduledAt: day(30),
        status: "SCHEDULED",
        simulated: true,
      },
    ];

  return [
    {
      id: "t1",
      jointId: "J-04",
      issue: "Splice separation — emergency joint repair",
      priority: "CRITICAL",
      technician: "R. Mahato",
      scheduledAt: day(3),
      status: "IN PROGRESS",
      simulated: true,
    },
    {
      id: "t2",
      jointId: "J-05",
      issue: "Belt tracking correction at idler frame 42",
      priority: "HIGH",
      technician: "S. Kujur",
      scheduledAt: day(10),
      status: "PENDING",
      simulated: true,
    },
  ];
}

export function buildPrediction(scenario: Scenario | null): Prediction {
  if (!scenario)
    return {
      beltHealth: null,
      jointHealth: null,
      failureProbability: null,
      rulHours: null,
      riskLevel: "UNKNOWN",
      status: "Awaiting sufficient inspection and sensor data.",
      factors: [],
      recommendation: null,
      degradation: [],
    };

  const cfg = {
    NORMAL: {
      beltHealth: 94,
      jointHealth: 91,
      failureProbability: 0.04,
      rulHours: 2100,
      riskLevel: "NORMAL" as Condition,
      status: "Model converged — belt operating within nominal envelope.",
      factors: [
        { label: "Abnormal vibration", contribution: 8, status: "NORMAL" as Condition },
        { label: "High belt tension", contribution: 6, status: "NORMAL" as Condition },
        { label: "Temperature rise", contribution: 5, status: "NORMAL" as Condition },
        { label: "Splice wear", contribution: 11, status: "NORMAL" as Condition },
      ],
      recommendation:
        "No maintenance required. Continue routine monitoring of all five splices.",
      decay: 0.02,
    },
    WARNING: {
      beltHealth: 71,
      jointHealth: 64,
      failureProbability: 0.34,
      rulHours: 340,
      riskLevel: "WARNING" as Condition,
      status: "Degradation trend detected — early-stage joint deterioration.",
      factors: [
        { label: "Splice wear", contribution: 62, status: "WARNING" as Condition },
        { label: "Abnormal vibration", contribution: 48, status: "WARNING" as Condition },
        { label: "Misalignment", contribution: 41, status: "WARNING" as Condition },
        { label: "High belt tension", contribution: 33, status: "WARNING" as Condition },
        { label: "Temperature rise", contribution: 27, status: "NORMAL" as Condition },
        { label: "Acoustic anomaly", contribution: 22, status: "NORMAL" as Condition },
      ],
      recommendation:
        "Inspect affected splice and verify joint integrity. Correct belt tracking at idler frame 18 within 72 hours.",
      decay: 0.35,
    },
    CRITICAL: {
      beltHealth: 38,
      jointHealth: 24,
      failureProbability: 0.87,
      rulHours: 18,
      riskLevel: "CRITICAL" as Condition,
      status: "Imminent joint rupture predicted on Joint 04.",
      factors: [
        { label: "Splice wear", contribution: 94, status: "CRITICAL" as Condition },
        { label: "Edge damage", contribution: 88, status: "CRITICAL" as Condition },
        { label: "Abnormal vibration", contribution: 81, status: "CRITICAL" as Condition },
        { label: "High belt tension", contribution: 76, status: "CRITICAL" as Condition },
        { label: "Misalignment", contribution: 69, status: "WARNING" as Condition },
        { label: "Acoustic anomaly", contribution: 58, status: "WARNING" as Condition },
        { label: "Temperature rise", contribution: 47, status: "WARNING" as Condition },
      ],
      recommendation:
        "IMMEDIATE ACTION: stop belt at the next safe window, isolate the drive, and replace the Joint 04 splice. Do not resume full load until joint integrity is verified.",
      decay: 1.6,
    },
  }[scenario];

  const degradation = Array.from({ length: 24 }, (_, i) => {
    const past = i <= 11;
    const base = cfg.beltHealth + (11 - Math.min(i, 11)) * cfg.decay;
    return {
      t: i - 11,
      current: past ? Number(base.toFixed(1)) : null,
      predicted:
        i >= 11
          ? Number((cfg.beltHealth - (i - 11) * cfg.decay * 1.9).toFixed(1))
          : null,
    };
  });

  return { ...cfg, degradation };
}
