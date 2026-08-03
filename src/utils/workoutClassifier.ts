import { Zone2Run, Norwegian4x4Session, IntervalSplit, MiscRun, DataSource } from '../types';

/**
 * A running workout reduced to the fields classification needs, independent of
 * where it came from.
 *
 * Both ingestion paths produce this shape — the streaming export.xml parser and
 * the native HealthKit bridge — so a workout is categorised identically however
 * it reached the app.
 */
export interface RawWorkout {
  /** "YYYY-MM-DD" local date the workout started. */
  dateStr: string;
  durationMin: number;
  totalDistanceKm: number;
  /** 0 when the workout carried no heart rate data. */
  avgHR: number;
  /** True peak HR for the workout, 0 when unavailable. */
  maxHR?: number;
  /** Sub-activities (interval bouts), empty for a continuous run. */
  activities: { durSec: number; distKm: number; avgHr: number }[];
}

export interface ClassifiedWorkouts {
  zone2Runs: Zone2Run[];
  norwegianSessions: Norwegian4x4Session[];
  miscRuns: MiscRun[];
  /** Workouts that produced a usable record. */
  accepted: number;
  /** Interval sessions excluded because no bout landed in the work window. */
  rejectedSessions: number;
  /** Highest per-workout peak HR seen. */
  observedPeakHR: number;
}

/**
 * A Norwegian 4x4 work bout is four minutes. Anything outside this window means
 * the session was executed wrong, and is deliberately excluded rather than
 * being averaged into the results.
 */
export const WORK_INTERVAL_MIN_SEC = 235;
export const WORK_INTERVAL_MAX_SEC = 245;

/** Running economy constant: km/h -> watts per kg. */
export const EW_PER_KMH = 0.2917;

/** Above this average HR a run is not aerobic base work. */
const ZONE2_MAX_AVG_HR = 158;
const ZONE2_MAX_SPEED_KMH = 11.5;
const ZONE2_MIN_DISTANCE_KM = 2.5;

export function createClassifiedWorkouts(): ClassifiedWorkouts {
  return {
    zone2Runs: [],
    norwegianSessions: [],
    miscRuns: [],
    accepted: 0,
    rejectedSessions: 0,
    observedPeakHR: 0,
  };
}

/**
 * Categorises one workout as a Norwegian 4x4 session, a Zone 2 run, or a misc
 * run, appending the result to `into`.
 *
 * @param extraIntervalDates Dates forced to be treated as interval sessions.
 */
export function classifyWorkout(
  workout: RawWorkout,
  into: ClassifiedWorkouts,
  source: DataSource,
  extraIntervalDates?: ReadonlySet<string>
): void {
  const { dateStr, durationMin, totalDistanceKm, avgHR, activities } = workout;

  if (workout.maxHR && workout.maxHR > into.observedPeakHR) {
    into.observedPeakHR = workout.maxHR;
  }

  const isIntervalSession =
    activities.length > 2 || avgHR > 160 || Boolean(extraIntervalDates?.has(dateStr));

  if (isIntervalSession && activities.length > 0) {
    classifyIntervalSession(workout, into, source);
    return;
  }

  classifyContinuousRun(workout, into, source);

  function classifyContinuousRun(w: RawWorkout, acc: ClassifiedWorkouts, src: DataSource) {
    if (w.totalDistanceKm <= 0 || w.durationMin <= 0) return;

    const speedKmh = totalDistanceKm / (durationMin / 60);
    const ewWkg = speedKmh * EW_PER_KMH;
    const api = avgHR > 0 ? (ewWkg / avgHR) * 1000 : 0;

    const isZone2 =
      totalDistanceKm >= ZONE2_MIN_DISTANCE_KM &&
      ((avgHR > 0 && avgHR <= ZONE2_MAX_AVG_HR) || (avgHR === 0 && speedKmh <= ZONE2_MAX_SPEED_KMH));

    if (isZone2) {
      acc.zone2Runs.push({
        Source: src,
        Date_Str: dateStr,
        Total_Distance_km: Number(totalDistanceKm.toFixed(1)),
        Duration_min: Number(durationMin.toFixed(1)),
        Avg_Speed_kmh: Number(speedKmh.toFixed(1)),
        Avg_HR: Number(avgHR.toFixed(1)),
        Avg_eW_wkg: Number(ewWkg.toFixed(2)),
        Aerobic_Power_Index: Number(api.toFixed(1)),
      });
    } else {
      acc.miscRuns.push({
        Source: src,
        Date_Str: dateStr,
        Total_Distance_km: Number(totalDistanceKm.toFixed(1)),
        Duration_min: Number(durationMin.toFixed(1)),
        Avg_Speed_kmh: Number(speedKmh.toFixed(1)),
        Avg_HR: Number(avgHR.toFixed(1)),
        Workout_Type: describeEffort(totalDistanceKm, avgHR, speedKmh),
        Notes: `${sourceLabel(src)} (${totalDistanceKm.toFixed(1)} km at ${speedKmh.toFixed(1)} km/h)`,
      });
    }

    acc.accepted++;
  }
}

function classifyIntervalSession(
  workout: RawWorkout,
  acc: ClassifiedWorkouts,
  source: DataSource
): void {
  const splits: IntervalSplit[] = [];
  let totalWorkDist = 0;
  let totalWorkSec = 0;
  let weightedHRSum = 0;
  let peakSpeed = 0;
  let peakHR = 0;

  for (const act of workout.activities) {
    if (act.durSec < WORK_INTERVAL_MIN_SEC || act.durSec > WORK_INTERVAL_MAX_SEC) continue;

    const speedKmh = act.distKm > 0 ? act.distKm / (act.durSec / 3600) : 0;
    const durMin = Math.floor(act.durSec / 60);
    const durSec = Math.floor(act.durSec % 60);

    splits.push({
      Step: `Interval ${splits.length + 1}`,
      Duration_Str: `${durMin}m ${durSec}s`,
      Distance_km: Number(act.distKm.toFixed(2)),
      Avg_Speed_kmh: Number(speedKmh.toFixed(1)),
      Avg_HR: Number(act.avgHr.toFixed(1)),
    });

    totalWorkDist += act.distKm;
    totalWorkSec += act.durSec;
    weightedHRSum += act.avgHr * act.durSec;
    if (speedKmh > peakSpeed) peakSpeed = speedKmh;
    if (act.avgHr > peakHR) peakHR = act.avgHr;
  }

  if (splits.length === 0) {
    // Excluding this is intentional — the session was executed wrong. Counting
    // it keeps the import summary honest about what was left out.
    acc.rejectedSessions++;
    return;
  }

  const avgWorkHR = totalWorkSec > 0 ? weightedHRSum / totalWorkSec : workout.avgHR;
  const avgWorkSpeed = totalWorkSec > 0 ? totalWorkDist / (totalWorkSec / 3600) : 0;

  acc.norwegianSessions.push({
    Source: source,
    Date_Str: workout.dateStr,
    Total_Work_Intervals: splits.length,
    Avg_Speed_kmh: Number(avgWorkSpeed.toFixed(1)),
    Avg_Work_HR: Number(avgWorkHR.toFixed(1)),
    Total_Work_Distance_km: Number(totalWorkDist.toFixed(2)),
    Peak_Interval_Speed: Number(peakSpeed.toFixed(1)),
    Peak_Interval_HR: Number(peakHR.toFixed(1)),
    Splits: splits,
  });

  if (peakHR > acc.observedPeakHR) acc.observedPeakHR = peakHR;
  acc.accepted++;
}

function describeEffort(distanceKm: number, avgHR: number, speedKmh: number): string {
  if (distanceKm >= 4.5 && distanceKm <= 5.5 && (avgHR >= 165 || speedKmh >= 12.0)) {
    return '5K Effort';
  }
  if (avgHR >= 160 || speedKmh >= 11.5) return 'Tempo / Threshold';
  if (distanceKm < ZONE2_MIN_DISTANCE_KM) return 'Short Run / Shakeout';
  return 'General Run';
}

function sourceLabel(source: DataSource): string {
  if (source === 'healthkit') return 'Synced from Apple Health';
  if (source === 'demo') return 'Sample data';
  return 'Extracted from Apple Health';
}

/** Sorts every collection chronologically, in place. */
export function sortClassified(acc: ClassifiedWorkouts): void {
  const byDate = (a: { Date_Str: string }, b: { Date_Str: string }) =>
    new Date(a.Date_Str).getTime() - new Date(b.Date_Str).getTime();
  acc.zone2Runs.sort(byDate);
  acc.norwegianSessions.sort(byDate);
  acc.miscRuns.sort(byDate);
}
