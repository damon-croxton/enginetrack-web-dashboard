import { Zone2Run, Norwegian4x4Session, MiscRun } from '../types';
import { ParsedAppleHealthData } from './appleHealthParser';
import {
  classifyWorkout,
  createClassifiedWorkouts,
  sortClassified,
  RawWorkout,
} from './workoutClassifier';

export interface HealthKitSyncStatus {
  isAvailable: boolean;
  isAuthorized: boolean;
  lastSyncedAt?: string;
  restingHR?: number;
  maxHR?: number;
}

/**
 * Payload the native shell returns for a sync. Workouts arrive unclassified so
 * the same rules apply here as to an export.xml import.
 */
export interface NativeHealthPayload {
  workouts: RawWorkout[];
  /** Daily resting HR samples, already limited to a recent window by the shell. */
  restingHRSamples: number[];
  /** Highest heart rate observed across the queried period, 0 if unknown. */
  maxHR: number;
}

/**
 * Injected by the Expo shell (mobile/src/injected.ts). Absent in a browser.
 */
interface NativeHealthKitBridge {
  sync(onProgress?: (percent: number, text: string) => void): Promise<NativeHealthPayload>;
}

declare global {
  interface Window {
    nativeHealthKit?: NativeHealthKitBridge;
  }
}

/**
 * True only when a real native HealthKit bridge is present. In a browser this
 * is always false — Safari and Chrome cannot reach HealthKit — and the UI must
 * present the sample-data path as sample data rather than a device sync.
 */
export function isHealthKitSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return typeof window.nativeHealthKit?.sync === 'function';
}

/**
 * Pulls running workouts from Apple Health via the native bridge, then runs them
 * through the shared classifier so a device sync and a file import agree.
 *
 * Throws if called without a bridge — callers should gate on
 * `isHealthKitSupported()` and fall back to `loadDemoWorkouts`.
 */
export async function syncHealthKit(
  onProgress?: (percent: number, text: string) => void
): Promise<ParsedAppleHealthData> {
  const bridge = window.nativeHealthKit;
  if (!bridge) {
    throw new Error('HealthKit is not available in this environment.');
  }

  const payload = await bridge.sync(onProgress);

  onProgress?.(90, 'Classifying workouts...');

  const classified = createClassifiedWorkouts();
  for (const workout of payload.workouts) {
    classifyWorkout(workout, classified, 'healthkit');
  }
  sortClassified(classified);

  const restingHRDetected = payload.restingHRSamples.length > 0;
  const detectedRestingHR = restingHRDetected
    ? Math.round(
        payload.restingHRSamples.reduce((a, b) => a + b, 0) / payload.restingHRSamples.length
      )
    : 52;

  const observedMax = Math.max(payload.maxHR, classified.observedPeakHR);
  const maxHRDetected = observedMax > 150;

  onProgress?.(100, `Synced ${classified.accepted} running workouts from Apple Health.`);

  return {
    zone2Runs: classified.zone2Runs,
    norwegianSessions: classified.norwegianSessions,
    miscRuns: classified.miscRuns,
    totalWorkoutsFound: classified.accepted,
    runningWorkoutsFound: classified.accepted,
    rejectedSessions: classified.rejectedSessions,
    detectedRestingHR,
    detectedMaxHR: maxHRDetected ? Math.round(observedMax) : 188,
    restingHRDetected,
    maxHRDetected,
    source: 'healthkit',
    diagnostics: {
      runningWorkoutsSeen: 0,
      workoutsWithActivities: 0,
      activitiesSeen: 0,
      activitiesMissingHR: 0,
      activitiesMissingDistance: 0,
    },
  };
}

/** "YYYY-MM-DD" for a date N days before today, so demo data never goes stale. */
function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

/**
 * Loads sample workouts for browser/preview use.
 *
 * This is NOT a HealthKit query - it returns fixed, invented workouts so the
 * dashboard can be exercised without an iPhone. Real device sync arrives via the
 * native bridge; until then every record here is tagged `Source: 'demo'` and the
 * UI must present it as sample data.
 */
export async function loadDemoWorkouts(
  onProgress?: (percent: number, text: string) => void
): Promise<ParsedAppleHealthData> {
  onProgress?.(20, 'Loading sample Zone 2 runs...');
  await new Promise((r) => setTimeout(r, 200));

  onProgress?.(60, 'Loading sample interval sessions...');
  await new Promise((r) => setTimeout(r, 200));

  onProgress?.(100, 'Sample workouts loaded.');

  const zone2Runs: Zone2Run[] = [
    {
      Source: 'demo',
      Date_Str: daysAgo(2),
      Total_Distance_km: 7.2,
      Duration_min: 44.5,
      Avg_Speed_kmh: 9.7,
      Avg_HR: 134,
      // eW and API follow the same formulas the XML parser applies to real
      // workouts (speed x 0.2917, then (eW / HR) x 1000), so sample and
      // imported runs sit on one scale.
      Avg_eW_wkg: 2.83,
      Aerobic_Power_Index: 21.1,
    },
    {
      Source: 'demo',
      Date_Str: daysAgo(6),
      Total_Distance_km: 8.5,
      Duration_min: 52.0,
      Avg_Speed_kmh: 9.8,
      Avg_HR: 136,
      Avg_eW_wkg: 2.86,
      Aerobic_Power_Index: 21.0,
    },
  ];

  const norwegianSessions: Norwegian4x4Session[] = [
    {
      Source: 'demo',
      Date_Str: daysAgo(8),
      Total_Work_Intervals: 4,
      Avg_Speed_kmh: 11.4,
      Avg_Work_HR: 178,
      Total_Work_Distance_km: 3.8,
      Peak_Interval_Speed: 15.2,
      Peak_Interval_HR: 184,
      Splits: [
        { Step: 'Interval 1', Duration_Str: '4m 0s', Distance_km: 0.95, Avg_Speed_kmh: 14.3, Avg_HR: 174 },
        { Step: 'Interval 2', Duration_Str: '4m 0s', Distance_km: 0.95, Avg_Speed_kmh: 14.5, Avg_HR: 178 },
        { Step: 'Interval 3', Duration_Str: '4m 0s', Distance_km: 0.95, Avg_Speed_kmh: 14.8, Avg_HR: 181 },
        { Step: 'Interval 4', Duration_Str: '4m 0s', Distance_km: 0.95, Avg_Speed_kmh: 15.2, Avg_HR: 184 },
      ],
    },
  ];

  const miscRuns: MiscRun[] = [
    {
      Source: 'demo',
      Date_Str: daysAgo(10),
      Workout_Type: '5K Effort',
      Total_Distance_km: 5.0,
      Duration_min: 21.8,
      Avg_Speed_kmh: 13.8,
      Avg_HR: 172,
      Notes: 'Sample data — not from your device',
    },
  ];

  return {
    totalWorkoutsFound: 4,
    runningWorkoutsFound: 4,
    zone2Runs,
    norwegianSessions,
    miscRuns,
    isCdaFile: false,
    rejectedSessions: 0,
    detectedRestingHR: 52,
    detectedMaxHR: 188,
    // Sample physiology figures are invented, not detected.
    restingHRDetected: false,
    maxHRDetected: false,
    source: 'demo',
    diagnostics: {
      runningWorkoutsSeen: 0,
      workoutsWithActivities: 0,
      activitiesSeen: 0,
      activitiesMissingHR: 0,
      activitiesMissingDistance: 0,
    },
  };
}
