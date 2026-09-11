import type { Condition, SensorKey } from "./types";
import { SENSOR_THRESHOLDS, type SensorThresholdConfig } from "./thresholds";

export interface NormalizedScores {
  V: number | null;   // Vibration Score (0-100)
  T: number | null;   // Temperature Score (0-100)
  BT: number | null;  // Belt Tension Score (0-100)
  L: number | null;   // Load Score (0-100)
  S: number | null;   // Belt Speed Score (0-100)
  AC: number | null;  // Acoustic Condition Score (0-100)
  AL: number | null;  // Alignment Score (0-100)
}

export type ScoreClassification = "Excellent" | "Good" | "Fair" | "Poor" | "Critical";
export type WearClassification = "Very Low" | "Low" | "Moderate" | "High" | "Severe";

export interface CalculatedAspect {
  key: string;
  label: string;
  score: number | null;
  status: Condition;
  classification: string;
  detail: string;
}

export interface WearTrackingData {
  previousWearCondition: number | null;
  currentWearCondition: number | null;
  physicalWearPercentage: number | null;
  lastTimestamp: number | null;
  degradationRatePerHour: number | null;
}

/**
 * Normalizes a raw sensor measurement into a calibrated 0-100 condition score.
 * 100 = excellent / normal
 * 0   = critical / severely abnormal
 * Higher scores always represent better/healthier conditions.
 */
export function normalizeSensorValue(
  value: number | null | undefined,
  config: SensorThresholdConfig
): number | null {
  if (value === null || value === undefined || isNaN(value) || typeof value !== "number") {
    return null;
  }

  const { normalLimit, criticalLimit, direction } = config;

  let score: number;
  if (direction === "higher_is_worse") {
    // e.g. Vibration, Temperature, Acoustic, Alignment
    score = (100 * (criticalLimit - value)) / (criticalLimit - normalLimit);
  } else {
    // e.g. Belt Speed (where falling below target is bad)
    score = (100 * (value - criticalLimit)) / (normalLimit - criticalLimit);
  }

  // Always clamp to 0-100
  return Math.max(0, Math.min(100, Math.round(score * 10) / 10));
}

/**
 * Standard classification for 0-100 scores.
 */
export function classifyScore(score: number | null): {
  label: ScoreClassification;
  condition: Condition;
} {
  if (score === null || isNaN(score)) {
    return { label: "Fair", condition: "UNKNOWN" };
  }
  if (score >= 90) return { label: "Excellent", condition: "NORMAL" };
  if (score >= 75) return { label: "Good", condition: "NORMAL" };
  if (score >= 60) return { label: "Fair", condition: "WARNING" };
  if (score >= 40) return { label: "Poor", condition: "WARNING" };
  return { label: "Critical", condition: "CRITICAL" };
}

/**
 * Classification for Physical Belt Wear (0% = new, 100% = fully worn).
 */
export function classifyPhysicalWear(physicalWear: number | null): {
  label: WearClassification;
  condition: Condition;
} {
  if (physicalWear === null || isNaN(physicalWear)) {
    return { label: "Moderate", condition: "UNKNOWN" };
  }
  if (physicalWear <= 20) return { label: "Very Low", condition: "NORMAL" };
  if (physicalWear <= 40) return { label: "Low", condition: "NORMAL" };
  if (physicalWear <= 60) return { label: "Moderate", condition: "WARNING" };
  if (physicalWear <= 80) return { label: "High", condition: "WARNING" };
  return { label: "Severe", condition: "CRITICAL" };
}

/**
 * Normalizes all seven sensor inputs.
 */
export function normalizeAllSensors(
  rawValues: Partial<Record<SensorKey, number | null>>
): NormalizedScores {
  return {
    V: normalizeSensorValue(rawValues.vibration, SENSOR_THRESHOLDS.vibration),
    T: normalizeSensorValue(rawValues.temperature, SENSOR_THRESHOLDS.temperature),
    BT: normalizeSensorValue(rawValues.tension, SENSOR_THRESHOLDS.tension),
    L: normalizeSensorValue(rawValues.load, SENSOR_THRESHOLDS.load),
    S: normalizeSensorValue(rawValues.speed, SENSOR_THRESHOLDS.speed),
    AC: normalizeSensorValue(rawValues.acoustic, SENSOR_THRESHOLDS.acoustic),
    AL: normalizeSensorValue(rawValues.alignment, SENSOR_THRESHOLDS.alignment),
  };
}

/**
 * 2. Belt Health Calculation
 * BeltHealth = 0.20*V + 0.15*T + 0.15*BT + 0.10*L + 0.10*S + 0.15*AC + 0.15*AL
 */
export function calculateBeltHealth(scores: NormalizedScores): number | null {
  const { V, T, BT, L, S, AC, AL } = scores;
  if (
    V === null ||
    T === null ||
    BT === null ||
    L === null ||
    S === null ||
    AC === null ||
    AL === null
  ) {
    return null;
  }

  const result =
    0.20 * V +
    0.15 * T +
    0.15 * BT +
    0.10 * L +
    0.10 * S +
    0.15 * AC +
    0.15 * AL;

  return Math.max(0, Math.min(100, Math.round(result * 10) / 10));
}

/**
 * 3. Belt Wear Calculation
 * BeltWearCondition = 0.25*V + 0.25*BT + 0.20*L + 0.15*S + 0.15*AC
 * Remaining Belt Condition = BeltWearCondition
 * Physical Wear Percentage = 100 - BeltWearCondition
 */
export function calculateBeltWear(scores: NormalizedScores): {
  remainingCondition: number | null;
  physicalWearPercentage: number | null;
} {
  const { V, BT, L, S, AC } = scores;
  if (V === null || BT === null || L === null || S === null || AC === null) {
    return { remainingCondition: null, physicalWearPercentage: null };
  }

  const wearCondition =
    0.25 * V +
    0.25 * BT +
    0.20 * L +
    0.15 * S +
    0.15 * AC;

  const clampedCondition = Math.max(0, Math.min(100, Math.round(wearCondition * 10) / 10));
  const physicalWear = Math.max(0, Math.min(100, Math.round((100 - clampedCondition) * 10) / 10));

  return {
    remainingCondition: clampedCondition,
    physicalWearPercentage: physicalWear,
  };
}

/**
 * 4. Edge Condition Calculation
 * EdgeCondition = 0.40*AL + 0.25*V + 0.20*BT + 0.15*L
 */
export function calculateEdgeCondition(scores: NormalizedScores): number | null {
  const { AL, V, BT, L } = scores;
  if (AL === null || V === null || BT === null || L === null) {
    return null;
  }

  const result =
    0.40 * AL +
    0.25 * V +
    0.20 * BT +
    0.15 * L;

  return Math.max(0, Math.min(100, Math.round(result * 10) / 10));
}

/**
 * 5. Surface Condition Calculation
 * SurfaceCondition = 0.50*AI_Surface + 0.15*V + 0.10*T + 0.10*AC + 0.10*L + 0.05*S
 */
export function calculateSurfaceCondition(
  scores: NormalizedScores,
  aiSurface: number | null
): number | null {
  if (aiSurface === null || isNaN(aiSurface)) {
    return null;
  }

  const { V, T, AC, L, S } = scores;
  if (V === null || T === null || AC === null || L === null || S === null) {
    return null;
  }

  const result =
    0.50 * aiSurface +
    0.15 * V +
    0.10 * T +
    0.10 * AC +
    0.10 * L +
    0.05 * S;

  return Math.max(0, Math.min(100, Math.round(result * 10) / 10));
}

/**
 * 6. Splice Condition Calculation
 * Standard formula:
 * SpliceCondition = 0.30*AC + 0.25*V + 0.20*BT + 0.15*L + 0.10*T
 * Enhanced formula (when AI_Splice is available):
 * SpliceCondition = 0.25*AC + 0.20*V + 0.15*BT + 0.10*L + 0.05*T + 0.25*AI_Splice
 */
export function calculateSpliceCondition(
  scores: NormalizedScores,
  aiSplice: number | null
): number | null {
  const { AC, V, BT, L, T } = scores;
  if (AC === null || V === null || BT === null || L === null || T === null) {
    return null;
  }

  let result: number;
  if (aiSplice !== null && !isNaN(aiSplice)) {
    result =
      0.25 * AC +
      0.20 * V +
      0.15 * BT +
      0.10 * L +
      0.05 * T +
      0.25 * aiSplice;
  } else {
    result =
      0.30 * AC +
      0.25 * V +
      0.20 * BT +
      0.15 * L +
      0.10 * T;
  }

  return Math.max(0, Math.min(100, Math.round(result * 10) / 10));
}

/**
 * Calculates AI Surface & Splice scores from detected defects.
 * 100 = perfect surface / no defects
 * 0   = severe destructive defects
 */
export function deriveAIScores(
  hasEvaluated: boolean,
  detections: Array<{ label?: string; type?: string; confidence: number }>
): {
  aiSurface: number | null;
  aiSplice: number | null;
} {
  if (!hasEvaluated) {
    return { aiSurface: null, aiSplice: null };
  }

  if (detections.length === 0) {
    return { aiSurface: 100, aiSplice: 100 };
  }

  let surfacePenalty = 0;
  let splicePenalty = 0;
  let hasSpliceDefect = false;

  for (const d of detections) {
    const text = ((d.label || d.type || "")).toLowerCase();
    const conf = d.confidence || 0.8;

    if (text.includes("crack") || text.includes("tear") || text.includes("fracture") || text.includes("rupture")) {
      surfacePenalty += 35 * conf;
    } else if (text.includes("puncture") || text.includes("hole") || text.includes("gouge")) {
      surfacePenalty += 30 * conf;
    } else if (text.includes("edge") || text.includes("fray")) {
      surfacePenalty += 20 * conf;
    } else if (text.includes("wear") || text.includes("damage") || text.includes("scoring")) {
      surfacePenalty += 15 * conf;
    } else {
      surfacePenalty += 12 * conf;
    }

    if (text.includes("splice") || text.includes("joint")) {
      hasSpliceDefect = true;
      splicePenalty += 40 * conf;
    }
  }

  const aiSurface = Math.max(0, Math.min(100, Math.round(100 - surfacePenalty)));
  const aiSplice = hasSpliceDefect ? Math.max(0, Math.min(100, Math.round(100 - splicePenalty))) : null;

  return { aiSurface, aiSplice };
}

/**
 * Computes all 5 output values + Belt Alignment card dynamically.
 */
export function computeAllBeltAspects(params: {
  rawSensors: Partial<Record<SensorKey, number | null>>;
  hasAIEvaluated: boolean;
  aiDetections: Array<{ label?: string; type?: string; confidence: number }>;
}): {
  aspects: CalculatedAspect[];
  scores: NormalizedScores;
  beltHealthScore: number | null;
  physicalWearPercentage: number | null;
} {
  const scores = normalizeAllSensors(params.rawSensors);
  const { aiSurface, aiSplice } = deriveAIScores(params.hasAIEvaluated, params.aiDetections);

  // 1. Belt Health
  const beltHealth = calculateBeltHealth(scores);
  const healthClass = classifyScore(beltHealth);

  // 2. Belt Wear
  const { remainingCondition, physicalWearPercentage } = calculateBeltWear(scores);
  const wearClass = classifyPhysicalWear(physicalWearPercentage);

  // 3. Edge Condition
  const edgeScore = calculateEdgeCondition(scores);
  const edgeClass = classifyScore(edgeScore);

  // 4. Surface Condition
  const surfaceScore = calculateSurfaceCondition(scores, aiSurface);
  const surfaceClass = classifyScore(surfaceScore);

  // 5. Splice Condition
  const spliceScore = calculateSpliceCondition(scores, aiSplice);
  const spliceClass = classifyScore(spliceScore);

  // 6. Belt Alignment (from AL score)
  const alignmentScore = scores.AL;
  const alignmentClass = classifyScore(alignmentScore);

  const aspects: CalculatedAspect[] = [
    {
      key: "health",
      label: "Belt Health",
      score: beltHealth,
      status: beltHealth !== null ? healthClass.condition : "UNKNOWN",
      classification: beltHealth !== null ? healthClass.label : "Unknown",
      detail:
        beltHealth !== null
          ? `${Math.round(beltHealth)} / 100 · ${healthClass.label}`
          : "Awaiting live data",
    },
    {
      key: "wear",
      label: "Belt Wear",
      score: remainingCondition,
      status: remainingCondition !== null ? wearClass.condition : "UNKNOWN",
      classification: remainingCondition !== null ? `${wearClass.label} Wear` : "Unknown",
      detail:
        remainingCondition !== null && physicalWearPercentage !== null
          ? `${Math.round(remainingCondition)} / 100 · Wear ${Math.round(physicalWearPercentage)}% (${wearClass.label})`
          : "Awaiting live data",
    },
    {
      key: "edge",
      label: "Edge Condition",
      score: edgeScore,
      status: edgeScore !== null ? edgeClass.condition : "UNKNOWN",
      classification: edgeScore !== null ? edgeClass.label : "Unknown",
      detail:
        edgeScore !== null
          ? `${Math.round(edgeScore)} / 100 · ${edgeClass.label}`
          : "Awaiting live data",
    },
    {
      key: "surface",
      label: "Surface Condition",
      score: surfaceScore,
      status:
        aiSurface === null
          ? "UNKNOWN"
          : surfaceScore !== null
            ? surfaceClass.condition
            : "UNKNOWN",
      classification:
        aiSurface === null
          ? "Pending"
          : surfaceScore !== null
            ? surfaceClass.label
            : "Unknown",
      detail:
        aiSurface === null
          ? "Awaiting AI inspection"
          : surfaceScore !== null
            ? `${Math.round(surfaceScore)} / 100 · ${surfaceClass.label}`
            : "Awaiting sensor data",
    },
    {
      key: "splice",
      label: "Splice Condition",
      score: spliceScore,
      status: spliceScore !== null ? spliceClass.condition : "UNKNOWN",
      classification: spliceScore !== null ? spliceClass.label : "Unknown",
      detail:
        spliceScore !== null
          ? `${Math.round(spliceScore)} / 100 · ${spliceClass.label}`
          : "Awaiting live data",
    },
    {
      key: "alignment",
      label: "Belt Alignment",
      score: alignmentScore,
      status: alignmentScore !== null ? alignmentClass.condition : "UNKNOWN",
      classification: alignmentScore !== null ? alignmentClass.label : "Unknown",
      detail:
        alignmentScore !== null
          ? `${Math.round(alignmentScore)} / 100 · ${
              (params.rawSensors.alignment ?? 0) <= 5.0
                ? `Tracking ${params.rawSensors.alignment ?? 0} mm (Centered)`
                : (params.rawSensors.alignment ?? 0) >= 20.0
                  ? `Severe drift ${params.rawSensors.alignment ?? 0} mm (Off-Track)`
                  : `Drift ${params.rawSensors.alignment ?? 0} mm (Tracking Alert)`
            }`
          : "Awaiting live data",
    },
  ];

  return {
    aspects,
    scores,
    beltHealthScore: beltHealth,
    physicalWearPercentage,
  };
}
