import { Zone2Run, Norwegian4x4Session } from '../types';

export interface UserPhysiologyParams {
  restingHR: number; // default 55 bpm
  maxHR: number;     // default 188 bpm
  weightKg: number;  // default 70 kg
}

export const DEFAULT_PHYSIOLOGY: UserPhysiologyParams = {
  restingHR: 55,
  maxHR: 188,
  weightKg: 70,
};

/**
 * Converts "YYYY-MM-DD" to Unix timestamp in milliseconds for Recharts linear time scale
 */
export function getTimestamp(dateStr: string): number {
  return new Date(dateStr + 'T00:00:00').getTime();
}

/**
 * Standard Linear Aerobic Power Index (Baseline): (eW / HR) * 1000
 */
export function calculateBaselineAPI(run: Zone2Run): number {
  return run.Aerobic_Power_Index;
}

/**
 * Non-Linear Active Cardiac Effort Index (Motivational Curve):
 * Accounts for resting HR baseline and non-linear heart rate acceleration.
 * Formula: eW / (Avg_HR - restingHR)^0.65 * 100
 */
export function calculateNonLinearAPI(run: Zone2Run, restingHR = DEFAULT_PHYSIOLOGY.restingHR): number {
  const netHR = Math.max(10, run.Avg_HR - restingHR);
  const exponentHR = Math.pow(netHR, 0.65);
  return Number(((run.Avg_eW_wkg / exponentHR) * 100).toFixed(2));
}

/**
 * Efficiency Factor (EF - Exercise Physiology Standard):
 * Speed (km/h) / Heart Rate (BPM) * 100
 */
export function calculateEfficiencyFactor(run: Zone2Run): number {
  if (run.Avg_HR <= 0) return 0;
  return Number(((run.Avg_Speed_kmh / run.Avg_HR) * 100).toFixed(2));
}

/**
 * Gold-Standard Heart Rate Reserve (HRR) Aerobic Power Index (Scientific):
 * eW / %HRR where %HRR = (Avg_HR - restingHR) / (maxHR - restingHR)
 */
export function calculateHRRAerobicIndex(
  run: Zone2Run,
  restingHR = DEFAULT_PHYSIOLOGY.restingHR,
  maxHR = DEFAULT_PHYSIOLOGY.maxHR
): number {
  const hrReserveTotal = maxHR - restingHR;
  const hrReserveUsed = Math.max(5, run.Avg_HR - restingHR);
  const percentHRR = hrReserveUsed / hrReserveTotal;
  return Number(((run.Avg_eW_wkg / percentHRR) * 10).toFixed(2));
}

/**
 * Generic HRR Index calculation for any run given speed and heart rate
 */
export function calculateGenericHRRAerobicIndex(
  speedKmh: number,
  avgHR: number,
  restingHR = DEFAULT_PHYSIOLOGY.restingHR,
  maxHR = DEFAULT_PHYSIOLOGY.maxHR
): number {
  if (speedKmh <= 0 || avgHR <= 0) return 0;
  const eW_wkg = speedKmh * 0.2917;
  const hrReserveTotal = Math.max(30, maxHR - restingHR);
  const hrReserveUsed = Math.max(5, avgHR - restingHR);
  const percentHRR = hrReserveUsed / hrReserveTotal;
  return Number(((eW_wkg / percentHRR) * 10).toFixed(2));
}

/**
 * Norwegian 4x4 Work Interval Efficiency:
 * Active Work Speed (km/h) / Avg Work HR * 100
 */
export function calculate4x4WorkEfficiency(session: Norwegian4x4Session): number {
  if (session.Avg_Work_HR <= 0) return 0;
  return Number(((session.Avg_Speed_kmh / session.Avg_Work_HR) * 100).toFixed(2));
}

/**
 * Scientific 4x4 Work Output Power Score:
 * Total Active Work Distance (km) * Peak Interval Speed (km/h)
 */
export function calculate4x4WorkPowerScore(session: Norwegian4x4Session): number {
  return Number((session.Total_Work_Distance_km * session.Peak_Interval_Speed).toFixed(2));
}

/**
 * Estimate VO2max from Peak 4x4 Speed and Zone 2 Sustained Speed
 * Uses ACSM Running Equation: VO2 = 3.5 + (0.2 * speed_m_min) + (0.9 * speed_m_min * grade)
 */
export function estimateVO2Max(
  peak4x4SpeedKmh: number,
  avgZone2SpeedKmh: number
): number {
  if (peak4x4SpeedKmh <= 0) return 35;
  const speedMetersPerMin = (peak4x4SpeedKmh * 1000) / 60;
  // ACSM running VO2 at flat surface
  const vo2Peak = 3.5 + 0.2 * speedMetersPerMin;
  // Adjustment factor based on sustained Zone 2 velocity ratio
  const z2Bonus = avgZone2SpeedKmh > 0 ? (avgZone2SpeedKmh / peak4x4SpeedKmh) * 3 : 1;
  return Number((vo2Peak + z2Bonus).toFixed(1));
}

/**
 * Calculates Banister TRIMP (Training Impulse) score for a workout
 */
export function calculateTRIMP(
  durationMin: number,
  avgHR: number,
  restingHR = DEFAULT_PHYSIOLOGY.restingHR,
  maxHR = DEFAULT_PHYSIOLOGY.maxHR,
  isMale = true
): number {
  if (durationMin <= 0 || avgHR <= restingHR) return 0;
  const hrR = (avgHR - restingHR) / (maxHR - restingHR);
  const b = isMale ? 1.92 : 1.67;
  return Number((durationMin * hrR * 0.64 * Math.exp(b * hrR)).toFixed(1));
}
