export type Condition = "NORMAL" | "WARNING" | "CRITICAL" | "UNKNOWN";
export type Mode = "LIVE" | "SIMULATION";
export type Scenario = "NORMAL" | "WARNING" | "CRITICAL";

export type SensorKey =
  | "vibration"
  | "temperature"
  | "tension"
  | "load"
  | "speed"
  | "acoustic"
  | "current"
  | "alignment";

export interface SensorReading {
  t: number;
  value: number;
}

export interface Sensor {
  key: SensorKey;
  name: string;
  unit: string;
  value: number | null;
  status: Condition;
  history: SensorReading[];
}

export interface Joint {
  id: string;
  label: string;
  position: number; // 0..100 along belt
  condition: Condition;
  healthScore: number | null;
  failureProbability: number | null;
  rulHours: number | null;
  issues: string[];
  inspectionStatus: string;
  riskLevel: Condition;
  recommendation: string | null;
}

export type DefectType =
  | "Crack"
  | "Tear"
  | "Edge Damage"
  | "Belt Wear"
  | "Splice Degradation"
  | "Belt Rupture"
  | "Misalignment"
  | "Foreign Object";

export interface Detection {
  id: string;
  type: DefectType;
  confidence: number;
  severity: Condition;
  location: string;
  jointId: string;
  detectedAt: string;
  box: { x: number; y: number; w: number; h: number }; // % of frame
}

export interface LiveDetection {
  label: string;
  confidence: number;
  x: number;
  y: number;
  w: number;
  h: number;
  box_raw?: number[];
}

export interface Alert {
  id: string;
  severity: Condition;
  title: string;
  section: string;
  jointId: string;
  sensorKey: SensorKey | null;
  detectionId: string | null;
  condition: string;
  timestamp: string;
  status: "ACTIVE" | "ACKNOWLEDGED";
}

export interface MaintenanceTask {
  id: string;
  jointId: string;
  issue: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  technician: string;
  scheduledAt: string;
  status: "PENDING" | "SCHEDULED" | "IN PROGRESS";
  simulated: boolean;
  notes?: string;
}

export interface BeltAspect {
  key: string;
  label: string;
  status: Condition;
  detail: string;
  score?: number | null;
  classification?: string;
}

export interface PredictionFactor {
  label: string;
  contribution: number; // 0..100
  status: Condition;
}

export interface Prediction {
  beltHealth: number | null;
  jointHealth: number | null;
  failureProbability: number | null;
  rulHours: number | null;
  riskLevel: Condition;
  status: string;
  factors: PredictionFactor[];
  recommendation: string | null;
  degradation: { t: number; current: number | null; predicted: number | null }[];
}
