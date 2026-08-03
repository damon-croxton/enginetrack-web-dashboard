import {
  isHealthDataAvailable,
  requestAuthorization,
  queryWorkoutSamples,
  queryStatisticsForQuantity,
  WorkoutActivityType,
} from '@kingstinct/react-native-healthkit';

/**
 * A workout reduced to what the web app's classifier needs. Mirrors `RawWorkout`
 * in src/utils/workoutClassifier.ts — the shell deliberately does no
 * categorisation of its own, so device sync and export.xml import stay in step.
 */
export interface RawWorkout {
  dateStr: string;
  durationMin: number;
  totalDistanceKm: number;
  avgHR: number;
  maxHR: number;
  activities: { durSec: number; distKm: number; avgHr: number }[];
}

export interface NativeHealthPayload {
  workouts: RawWorkout[];
  restingHRSamples: number[];
  maxHR: number;
}

const HEART_RATE = 'HKQuantityTypeIdentifierHeartRate';
const RESTING_HEART_RATE = 'HKQuantityTypeIdentifierRestingHeartRate';
const DISTANCE = 'HKQuantityTypeIdentifierDistanceWalkingRunning';

/** Matches the resting-HR averaging window the XML parser uses. */
const RESTING_HR_WINDOW_DAYS = 90;

/** How far back to pull workouts. */
const WORKOUT_HISTORY_DAYS = 365 * 3;

type Progress = (percent: number, text: string) => void;

/** Local "YYYY-MM-DD" — must be local, not UTC, or workouts shift a day. */
function toLocalDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

/** Converts a HealthKit distance quantity to km, whatever unit it arrives in. */
function toKm(value: number | undefined, unit: string | undefined): number {
  if (!value || !Number.isFinite(value)) return 0;
  switch ((unit ?? 'm').toLowerCase()) {
    case 'km':
      return value;
    case 'mi':
    case 'mile':
    case 'miles':
      return value * 1.60934;
    default:
      return value / 1000;
  }
}

export async function requestHealthKitAccess(): Promise<void> {
  if (!isHealthDataAvailable()) {
    throw new Error('Apple Health is not available on this device.');
  }

  // Read-only: EngineTrack analyses workouts, it never writes them back.
  await requestAuthorization({
    read: [
      'HKWorkoutTypeIdentifier',
      HEART_RATE,
      RESTING_HEART_RATE,
      DISTANCE,
    ],
  } as never);
}

/**
 * Queries running workouts plus the heart-rate context the dashboard's HRR
 * metrics depend on.
 *
 * HealthKit grants permission per type without telling us which were denied, so
 * missing statistics are treated as absent data rather than as an error.
 */
export async function fetchHealthData(onProgress?: Progress): Promise<NativeHealthPayload> {
  onProgress?.(15, 'Requesting Apple Health permissions...');
  await requestHealthKitAccess();

  onProgress?.(35, 'Querying running workouts...');

  const since = daysAgo(WORKOUT_HISTORY_DAYS);
  const samples = await queryWorkoutSamples({
    limit: 0,
    ascending: true,
    filter: {
      workoutActivityType: WorkoutActivityType.running,
      startDate: since,
    },
  } as never);

  const workouts: RawWorkout[] = [];
  let overallMaxHR = 0;

  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];

    if (i % 10 === 0) {
      const pct = 35 + Math.round((i / Math.max(1, samples.length)) * 45);
      onProgress?.(pct, `Reading workout ${i + 1} of ${samples.length}...`);
    }

    const start = new Date(sample.startDate);
    const end = new Date(sample.endDate);
    const durationMin = sample.duration?.quantity
      ? sample.duration.quantity / 60
      : (end.getTime() - start.getTime()) / 60000;

    const hrStats = await safeStatistic(sample, HEART_RATE);
    const avgHR = hrStats?.averageQuantity?.quantity ?? 0;
    const maxHR = hrStats?.maximumQuantity?.quantity ?? 0;
    if (maxHR > overallMaxHR) overallMaxHR = maxHR;

    const totalDistanceKm =
      toKm(sample.totalDistance?.quantity, sample.totalDistance?.unit) ||
      toKm(
        (await safeStatistic(sample, DISTANCE))?.sumQuantity?.quantity,
        'm'
      );

    workouts.push({
      dateStr: toLocalDateStr(start),
      durationMin,
      totalDistanceKm,
      avgHR,
      maxHR,
      activities: await readActivities(sample),
    });
  }

  onProgress?.(85, 'Reading resting heart rate...');
  const restingHRSamples = await fetchRestingHeartRates();

  return { workouts, restingHRSamples, maxHR: overallMaxHR };
}

/**
 * Per-bout distance and heart rate for an interval workout.
 *
 * HKWorkoutActivity carries only timing, so each bout's statistics come from a
 * time-bounded query over the workout's own window.
 */
async function readActivities(sample: any): Promise<RawWorkout['activities']> {
  const activities = sample.activities ?? [];
  if (activities.length === 0) return [];

  const out: RawWorkout['activities'] = [];

  for (const activity of activities) {
    const start = new Date(activity.startDate);
    const end = new Date(activity.endDate);
    const durSec = activity.duration || (end.getTime() - start.getTime()) / 1000;
    if (durSec <= 0) continue;

    const [hr, dist] = await Promise.all([
      safeQuantityStatistic(HEART_RATE, start, end),
      safeQuantityStatistic(DISTANCE, start, end),
    ]);

    out.push({
      durSec,
      distKm: toKm(dist?.sumQuantity?.quantity, 'm'),
      avgHr: hr?.averageQuantity?.quantity ?? 0,
    });
  }

  return out;
}

async function fetchRestingHeartRates(): Promise<number[]> {
  const stats = await safeQuantityStatistic(
    RESTING_HEART_RATE,
    daysAgo(RESTING_HR_WINDOW_DAYS),
    new Date()
  );
  const average = stats?.averageQuantity?.quantity;
  return average && Number.isFinite(average) ? [average] : [];
}

async function safeStatistic(sample: any, type: string): Promise<any | undefined> {
  try {
    return await sample.getStatistic(type);
  } catch {
    return undefined;
  }
}

async function safeQuantityStatistic(
  type: string,
  from: Date,
  to: Date
): Promise<any | undefined> {
  try {
    return await queryStatisticsForQuantity(
      type as never,
      ['average', 'maximum', 'sum'] as never,
      { filter: { startDate: from, endDate: to } } as never
    );
  } catch {
    return undefined;
  }
}
