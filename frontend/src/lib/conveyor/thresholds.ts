import type { SensorKey } from "./types";

export interface SensorThresholdConfig {
  key: SensorKey;
  name: string;
  unit: string;
  normalLimit: number;
  criticalLimit: number;
  direction: "higher_is_worse" | "lower_is_worse";
  description: string;
}

/**
 * Centralized Industrial Engineering Limits for Conveyor Parameters.
 * Configured in one central file to allow replacement with site-specific mine limits.
 */
export const SENSOR_THRESHOLDS: Record<SensorKey, SensorThresholdConfig> = {
  vibration: {
    key: "vibration",
    name: "Vibration",
    unit: "mm/s",
    normalLimit: 2.1,      // Baseline ISO 10816 acceptable vibration
    criticalLimit: 9.5,    // Destructive harmonic structural threshold
    direction: "higher_is_worse",
    description: "Peak bearing & idler velocity vibration",
  },
  temperature: {
    key: "temperature",
    name: "Temperature",
    unit: "°C",
    normalLimit: 45.0,     // Nominal operational bearing/pulley temperature
    criticalLimit: 85.0,   // Critical thermal runaway / belt vulcanization damage
    direction: "higher_is_worse",
    description: "Drive pulley and idler bearing thermal telemetry (DS18B20)",
  },
  tension: {
    key: "tension",
    name: "Distance (Ultrasonic)",
    unit: "cm",
    normalLimit: 15.0,     // Nominal clearance distance
    criticalLimit: 35.0,   // Severe belt displacement or chute overflow
    direction: "higher_is_worse",
    description: "HC-SR04 ultrasonic clearance distance",
  },
  load: {
    key: "load",
    name: "Load Cell",
    unit: "kg",
    normalLimit: 2.5,      // Nominal bed load
    criticalLimit: 5.0,    // Overload threshold
    direction: "higher_is_worse",
    description: "HX711 dual-channel precision load cell",
  },
  speed: {
    key: "speed",
    name: "Belt Speed",
    unit: "m/s",
    normalLimit: 3.5,      // Rated continuous operating velocity
    criticalLimit: 0.5,    // Critical slippage / drive pulley stall
    direction: "lower_is_worse",
    description: "Optical pulse encoder tachometer",
  },
  acoustic: {
    key: "acoustic",
    name: "Sound Level",
    unit: "dB",
    normalLimit: 60.0,     // Baseline operational acoustic signature
    criticalLimit: 85.0,   // Friction screech & bearing noise
    direction: "higher_is_worse",
    description: "Analog acoustic decibel transducer",
  },
  current: {
    key: "current",
    name: "Current Draw",
    unit: "A",
    normalLimit: 1.5,      // Nominal continuous motor current
    criticalLimit: 4.5,    // Motor stall / electrical overload
    direction: "higher_is_worse",
    description: "ACS712 hall-effect motor current sensor",
  },
  alignment: {
    key: "alignment",
    name: "IR Tracking",
    unit: "mm",
    normalLimit: 3.0,      // Nominal lateral tracking corridor (centered <= 3mm)
    criticalLimit: 20.0,   // Severe edge scrub & structural frame rub (tripped >= 14.5mm)
    direction: "higher_is_worse",
    description: "Dual IR optical edge sensors",
  },
};
