import JSZip from 'jszip';
import { Zone2Run, Norwegian4x4Session, IntervalSplit, MiscRun, DataSource } from '../types';

export interface ParsedAppleHealthData {
  zone2Runs: Zone2Run[];
  norwegianSessions: Norwegian4x4Session[];
  miscRuns: MiscRun[];
  totalWorkoutsFound: number;
  runningWorkoutsFound: number;
  isCdaFile?: boolean;
  detectedRestingHR?: number;
  detectedMaxHR?: number;
  /** Interval sessions excluded because no work bout landed in the 3m55s-4m05s window. */
  rejectedSessions: number;
  /** True when resting HR came from Health records rather than the fallback default. */
  restingHRDetected: boolean;
  /** True when max HR came from workout maxima rather than the fallback default. */
  maxHRDetected: boolean;
  /** Origin of this dataset. 'demo' means the figures are invented. */
  source: DataSource;
}

/** Apple Health record type carrying the daily resting heart rate figure. */
const RESTING_HR_TYPE = 'HKQuantityTypeIdentifierRestingHeartRate';

/** Only average resting HR over recent samples so it tracks current fitness. */
const RESTING_HR_WINDOW_DAYS = 90;

const TARGET_4X4_DATES = new Set([
  '2026-03-14', '2026-03-19', '2026-03-28', '2026-04-09',
  '2026-04-20', '2026-05-01', '2026-05-08', '2026-07-05',
  '2025-12-22', '2025-11-18'
]);

/**
 * High-performance, streaming parser for Apple Health export.xml or export.zip.
 * Emulates Python's ET.iterparse using chunked Streams and TextDecoder.
 * Maintains buffer size < 50KB at all times to prevent 'Invalid string length' or memory crashes on 1GB+ XML files.
 */
export async function parseAppleHealthFile(
  file: File,
  onProgress?: (progressPercent: number, statusText: string) => void
): Promise<ParsedAppleHealthData> {
  if (file.name.toLowerCase().includes('cda')) {
    return {
      zone2Runs: [],
      norwegianSessions: [],
      miscRuns: [],
      totalWorkoutsFound: 0,
      runningWorkoutsFound: 0,
      isCdaFile: true,
      rejectedSessions: 0,
      restingHRDetected: false,
      maxHRDetected: false,
      source: 'export',
    };
  }

  const zone2Runs: Zone2Run[] = [];
  const norwegianSessions: Norwegian4x4Session[] = [];
  const miscRuns: MiscRun[] = [];
  let runningWorkoutsFound = 0;
  let rejectedSessions = 0;
  const restingHRSamples: { dateMs: number; value: number }[] = [];
  let observedMaxHR = 0;
  // Peak HR taken from WorkoutStatistics maxima - a true max, unlike averages.
  let observedPeakHR = 0;

  onProgress?.(5, 'Opening Apple Health stream...');

  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let totalBytes = file.size;

  if (file.name.endsWith('.zip')) {
    onProgress?.(10, 'Extracting export.xml from ZIP archive...');
    try {
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(file);

      const xmlZipFile =
        zipContent.file('apple_health_export/export.xml') ||
        zipContent.file('export.xml') ||
        Object.values(zipContent.files).find(
          (f) => f.name.endsWith('export.xml') && !f.name.toLowerCase().includes('cda')
        );

      if (!xmlZipFile) {
        throw new Error('Could not find "export.xml" inside the selected ZIP archive.');
      }

      onProgress?.(15, 'Preparing stream from ZIP archive...');
      const blob = await xmlZipFile.async('blob');
      totalBytes = blob.size;
      reader = blob.stream().getReader();
    } catch (err: any) {
      throw new Error(
        'ZIP archive extraction error. If your ZIP file is over 1GB, please unzip it on your computer and select export.xml directly.'
      );
    }
  } else {
    // Direct stream from raw File object on disk
    reader = file.stream().getReader();
  }

  const decoder = new TextDecoder('utf-8', { fatal: false });
  let buffer = '';
  let bytesRead = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    bytesRead += value.byteLength;
    buffer += decoder.decode(value, { stream: true });

    // Process all completed <Workout>...</Workout> blocks currently in buffer
    processBuffer();

    // Progress update
    const pct = Math.min(99, Math.round((bytesRead / totalBytes) * 100));
    onProgress?.(pct, `Parsing XML stream (${runningWorkoutsFound} running workouts extracted)...`);

    // Yield main thread periodically so browser stays responsive
    if (bytesRead % (8 * 1024 * 1024) < 64 * 1024) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  // Final decode flush
  buffer += decoder.decode();
  processBuffer(true);

  /**
   * Process completed <Workout> elements in buffer and IMMEDIATELY slice away parsed text.
   * Keeps buffer length minimal (< 50KB) so V8 string allocations stay tiny.
   */
  function processBuffer(isEnd = false) {
    while (true) {
      const workoutStart = buffer.indexOf('<Workout');

      if (workoutStart === -1) {
        // No workout here, but this region still holds <Record> elements we need
        // (resting HR). Harvest them before the text is thrown away.
        const consumed = harvestRecords(buffer);
        if (isEnd) {
          buffer = '';
        } else {
          // Retain from whichever comes first: an incomplete <Record we haven't
          // parsed yet, or a 20-char tail so a '<Workout' split across chunk
          // boundaries isn't lost.
          const keepFrom = Math.min(consumed, Math.max(0, buffer.length - 20));
          buffer = buffer.slice(keepFrom);
        }
        break;
      }

      // Text preceding '<Workout' is complete; harvest records, then discard it.
      if (workoutStart > 0) {
        harvestRecords(buffer.slice(0, workoutStart));
        buffer = buffer.slice(workoutStart);
      }

      // Find opening tag end '>'
      const tagOpenEnd = buffer.indexOf('>');
      if (tagOpenEnd === -1) {
        // Tag header incomplete across chunk boundary. Wait for next chunk!
        break;
      }

      const isSelfClosing = buffer.charAt(tagOpenEnd - 1) === '/';
      let workoutEnd = -1;

      if (isSelfClosing) {
        workoutEnd = tagOpenEnd + 1;
      } else {
        const closingTagIdx = buffer.indexOf('</Workout>', tagOpenEnd);
        if (closingTagIdx === -1) {
          // Container tag body incomplete across chunk boundary. Wait for next chunk!
          break;
        }
        workoutEnd = closingTagIdx + 10;
      }

      // Extract complete <Workout> block
      const rawWorkout = buffer.slice(0, workoutEnd);

      // Parse workout block
      parseWorkoutElement(rawWorkout);

      // Immediately remove parsed workout block from buffer
      buffer = buffer.slice(workoutEnd);
    }
  }

  /**
   * Scans a region of the stream for standalone <Record> elements we care about
   * (currently resting heart rate) before that region is discarded.
   *
   * Only the opening tag is needed - every attribute we read lives there - so a
   * record is "complete" as soon as its first '>' is in the buffer, regardless
   * of any MetadataEntry children that follow.
   *
   * Returns the index up to which text was fully consumed. Anything at or after
   * that index is an incomplete tag the caller must retain for the next chunk.
   */
  function harvestRecords(text: string): number {
    let pos = 0;

    while (true) {
      const recordStart = text.indexOf('<Record', pos);
      if (recordStart === -1) return text.length;

      const tagEnd = text.indexOf('>', recordStart);
      if (tagEnd === -1) {
        // Opening tag straddles a chunk boundary - retain it for the next pass.
        return recordStart;
      }

      const tag = text.slice(recordStart, tagEnd + 1);

      if (tag.includes(RESTING_HR_TYPE)) {
        const valueMatch = /value=["']([^"']+)["']/i.exec(tag);
        const dateMatch = /startDate=["']([^"']+)["']/i.exec(tag);

        if (valueMatch) {
          const value = parseFloat(valueMatch[1]);
          // Apple emits "YYYY-MM-DD HH:MM:SS +ZZZZ", which Date cannot parse as
          // a whole. Day granularity is ample for a 90-day window, so take the
          // leading date portion only.
          const dateMs = dateMatch
            ? new Date(dateMatch[1].slice(0, 10)).getTime()
            : NaN;

          if (Number.isFinite(value) && value > 0) {
            restingHRSamples.push({
              dateMs: Number.isFinite(dateMs) ? dateMs : 0,
              value,
            });
          }
        }
      }

      pos = tagEnd + 1;
    }
  }

  /**
   * Parse individual <Workout> block according to exact Jupyter Python logic.
   */
  function parseWorkoutElement(xml: string) {
    // 1. Filter for HKWorkoutActivityTypeRunning
    if (!xml.includes('HKWorkoutActivityTypeRunning')) {
      return;
    }

    // 2. Get startDate attribute
    const startDateMatch = /startDate=["']([^"']+)["']/i.exec(xml);
    if (!startDateMatch) return;

    const startDateStr = startDateMatch[1];
    const dateFormatted = startDateStr.split(' ')[0].split('T')[0];

    const durMatch = /duration=["']([^"']+)["']/i.exec(xml);
    const durationMin = durMatch ? parseFloat(durMatch[1]) : 0;

    // 3. Extract WorkoutStatistics or attributes
    let totalDistKm = 0;
    let avgHR = 0;

    // WorkoutStatistics for Distance
    const distMatch = /<WorkoutStatistics\s+[^>]*type=["'][^"']*DistanceWalkingRunning["'][^>]*sum=["']([^"']+)["']/i.exec(xml);
    if (distMatch) {
      const rawSum = parseFloat(distMatch[1]);
      const unitMatch = /unit=["']([^"']+)["']/i.exec(distMatch[0]);
      const unit = unitMatch ? unitMatch[1].toLowerCase() : 'km';
      if (unit === 'mi' || unit === 'miles') totalDistKm = rawSum * 1.60934;
      else if (unit === 'm') totalDistKm = rawSum / 1000;
      else totalDistKm = rawSum;
    } else {
      // Fallback to totalDistance attribute
      const attrDistMatch = /totalDistance=["']([^"']+)["']/i.exec(xml);
      if (attrDistMatch) {
        const rawDist = parseFloat(attrDistMatch[1]);
        const attrUnitMatch = /totalDistanceUnit=["']([^"']+)["']/i.exec(xml);
        const unit = attrUnitMatch ? attrUnitMatch[1].toLowerCase() : 'km';
        if (unit === 'mi' || unit === 'miles') totalDistKm = rawDist * 1.60934;
        else if (unit === 'm') totalDistKm = rawDist / 1000;
        else totalDistKm = rawDist;
      }
    }

    // WorkoutStatistics for HeartRate
    const hrMatch = /<WorkoutStatistics\s+[^>]*type=["'][^"']*HeartRate["'][^>]*average=["']([^"']+)["']/i.exec(xml);
    if (hrMatch) {
      avgHR = parseFloat(hrMatch[1]);
    } else {
      // Fallback to MetadataEntry HKAverageHeartRate
      const metaHrMatch = /<MetadataEntry\s+[^>]*key=["']HKAverageHeartRate["'][^>]*value=["']([^"']+)["']/i.exec(xml);
      if (metaHrMatch) {
        avgHR = parseFloat(metaHrMatch[1]);
      }
    }

    // True peak HR for this workout. Averages systematically understate max HR,
    // which skews every HRR-based metric downstream.
    const hrMaxMatch = /<WorkoutStatistics\s+[^>]*type=["'][^"']*HeartRate["'][^>]*maximum=["']([^"']+)["']/i.exec(xml);
    if (hrMaxMatch) {
      const peak = parseFloat(hrMaxMatch[1]);
      if (Number.isFinite(peak) && peak > observedPeakHR) observedPeakHR = peak;
    } else {
      const metaMaxMatch = /<MetadataEntry\s+[^>]*key=["']HKMaximumHeartRate["'][^>]*value=["']([^"']+)["']/i.exec(xml);
      if (metaMaxMatch) {
        const peak = parseFloat(metaMaxMatch[1]);
        if (Number.isFinite(peak) && peak > observedPeakHR) observedPeakHR = peak;
      }
    }

    // 4. Extract WorkoutActivity sub-elements (Interval splits)
    const workoutActivities: { durSec: number; distKm: number; avgHr: number }[] = [];
    let actSearchPos = 0;

    while (true) {
      const actStart = xml.indexOf('<WorkoutActivity', actSearchPos);
      if (actStart === -1) break;

      const actEnd = xml.indexOf('</WorkoutActivity>', actStart);
      const selfCloseEnd = xml.indexOf('/>', actStart);
      const tagOpenEnd = xml.indexOf('>', actStart);

      let endIdx = -1;
      if (selfCloseEnd !== -1 && (actEnd === -1 || selfCloseEnd < actEnd) && selfCloseEnd < tagOpenEnd + 2) {
        endIdx = selfCloseEnd + 2;
      } else if (actEnd !== -1) {
        endIdx = actEnd + 18;
      } else {
        break;
      }

      const actXml = xml.slice(actStart, endIdx);

      const sMatch = /startDate=["']([^"']+)["']/i.exec(actXml);
      const eMatch = /endDate=["']([^"']+)["']/i.exec(actXml);

      if (sMatch && eMatch) {
        const sTime = new Date(sMatch[1]).getTime();
        const eTime = new Date(eMatch[1]).getTime();
        const durSec = (eTime - sTime) / 1000;

        let actDistKm = 0;
        let actHrVal = 0;

        const aDistMatch = /<WorkoutStatistics\s+[^>]*type=["'][^"']*DistanceWalkingRunning["'][^>]*sum=["']([^"']+)["']/i.exec(actXml);
        if (aDistMatch) {
          const rawSum = parseFloat(aDistMatch[1]);
          const uMatch = /unit=["']([^"']+)["']/i.exec(aDistMatch[0]);
          const u = uMatch ? uMatch[1].toLowerCase() : 'km';
          if (u === 'mi' || u === 'miles') actDistKm = rawSum * 1.60934;
          else if (u === 'm') actDistKm = rawSum / 1000;
          else actDistKm = rawSum;
        }

        const aHrMatch = /<WorkoutStatistics\s+[^>]*type=["'][^"']*HeartRate["'][^>]*average=["']([^"']+)["']/i.exec(actXml);
        if (aHrMatch) {
          actHrVal = parseFloat(aHrMatch[1]);
        }

        if (durSec > 0 && actHrVal > 0) {
          workoutActivities.push({ durSec, distKm: actDistKm, avgHr: actHrVal });
        }
      }

      actSearchPos = endIdx;
    }

    // 5. Determine if Norwegian 4x4 or Zone 2 Run
    const is4x4 =
      workoutActivities.length > 2 ||
      avgHR > 160 ||
      TARGET_4X4_DATES.has(dateFormatted);

    if (is4x4 && workoutActivities.length > 0) {
      // Extract 4x4 work intervals (window: 235s to 245s, i.e. 3m55s to 4m05s)
      const splits: IntervalSplit[] = [];
      let totalWorkDist = 0;
      let totalWorkSec = 0;
      let weightedHRSum = 0;
      let peakSpeed = 0;
      let peakHR = 0;
      let intervalIdx = 1;

      for (const act of workoutActivities) {
        if (act.durSec >= 235 && act.durSec <= 245) {
          const speedKmh = act.distKm > 0 ? act.distKm / (act.durSec / 3600) : 0;
          const durMin = Math.floor(act.durSec / 60);
          const durSec = Math.floor(act.durSec % 60);

          splits.push({
            Step: `Interval ${intervalIdx}`,
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

          intervalIdx++;
        }
      }

      if (splits.length > 0) {
        const avgWorkHR = totalWorkSec > 0 ? weightedHRSum / totalWorkSec : avgHR;
        const avgWorkSpeed = totalWorkSec > 0 ? totalWorkDist / (totalWorkSec / 3600) : 0;

        norwegianSessions.push({
          Source: 'export',
          Date_Str: dateFormatted,
          Total_Work_Intervals: splits.length,
          Avg_Speed_kmh: Number(avgWorkSpeed.toFixed(1)),
          Avg_Work_HR: Number(avgWorkHR.toFixed(1)),
          Total_Work_Distance_km: Number(totalWorkDist.toFixed(2)),
          Peak_Interval_Speed: Number(peakSpeed.toFixed(1)),
          Peak_Interval_HR: Number(peakHR.toFixed(1)),
          Splits: splits,
        });

        runningWorkoutsFound++;
      } else {
        // Interval session with no bout in the 3m55s-4m05s window. Excluding it
        // is intentional (the workout went wrong), but count it so the import
        // summary doesn't quietly under-report.
        rejectedSessions++;
      }
    } else {
      // Steady/General Runs
      if (totalDistKm > 0 && durationMin > 0) {
        const speedKmh = totalDistKm / (durationMin / 60.0);
        const ewWkg = speedKmh * 0.2917;
        const api = avgHR > 0 ? (ewWkg / avgHR) * 1000 : 0;

        // Zone 2 / Aerobic Base criteria: Majority of time in Z1/Z2/Z3 (Avg HR <= 158 bpm, or speed <= 11.5 km/h), min distance 2.5km
        const isZone2 = totalDistKm >= 2.5 && ((avgHR > 0 && avgHR <= 158) || (avgHR === 0 && speedKmh <= 11.5));

        if (isZone2) {
          zone2Runs.push({
            Source: 'export',
            Date_Str: dateFormatted,
            Total_Distance_km: Number(totalDistKm.toFixed(1)),
            Duration_min: Number(durationMin.toFixed(1)),
            Avg_Speed_kmh: Number(speedKmh.toFixed(1)),
            Avg_HR: Number(avgHR.toFixed(1)),
            Avg_eW_wkg: Number(ewWkg.toFixed(2)),
            Aerobic_Power_Index: Number(api.toFixed(1)),
          });
        } else {
          // Categorize Misc / High Intensity Run (Tempo, 5K effort, shakeout)
          let workoutType = 'General Run';
          if (totalDistKm >= 4.5 && totalDistKm <= 5.5 && (avgHR >= 165 || speedKmh >= 12.0)) {
            workoutType = '5K Effort';
          } else if (avgHR >= 160 || speedKmh >= 11.5) {
            workoutType = 'Tempo / Threshold';
          } else if (totalDistKm < 2.5) {
            workoutType = 'Short Run / Shakeout';
          }

          miscRuns.push({
            Source: 'export',
            Date_Str: dateFormatted,
            Total_Distance_km: Number(totalDistKm.toFixed(1)),
            Duration_min: Number(durationMin.toFixed(1)),
            Avg_Speed_kmh: Number(speedKmh.toFixed(1)),
            Avg_HR: Number(avgHR.toFixed(1)),
            Workout_Type: workoutType,
            Notes: `Extracted from Apple Health (${totalDistKm.toFixed(1)} km at ${speedKmh.toFixed(1)} km/h)`,
          });
        }

        runningWorkoutsFound++;
      }
    }
  }

  // Sort chronological
  zone2Runs.sort((a, b) => new Date(a.Date_Str).getTime() - new Date(b.Date_Str).getTime());
  norwegianSessions.sort((a, b) => new Date(a.Date_Str).getTime() - new Date(b.Date_Str).getTime());
  miscRuns.sort((a, b) => new Date(a.Date_Str).getTime() - new Date(b.Date_Str).getTime());

  // Prefer true workout maxima; fall back to per-run averages only when no
  // WorkoutStatistics maximum was present anywhere in the export.
  observedMaxHR = observedPeakHR;
  if (observedMaxHR <= 0) {
    [...zone2Runs, ...miscRuns].forEach((r) => {
      if (r.Avg_HR > observedMaxHR) observedMaxHR = r.Avg_HR;
    });
    norwegianSessions.forEach((s) => {
      if (s.Peak_Interval_HR > observedMaxHR) observedMaxHR = s.Peak_Interval_HR;
      else if (s.Avg_Work_HR > observedMaxHR) observedMaxHR = s.Avg_Work_HR;
    });
  }

  // Average resting HR over the trailing window so it reflects current fitness
  // rather than a multi-year mean.
  let recentResting = restingHRSamples;
  if (restingHRSamples.length > 0) {
    const newestMs = Math.max(...restingHRSamples.map((s) => s.dateMs));
    const windowStart = newestMs - RESTING_HR_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const windowed = restingHRSamples.filter((s) => s.dateMs >= windowStart);
    if (windowed.length > 0) recentResting = windowed;
  }

  const restingHRDetected = recentResting.length > 0;
  const detectedRestingHR = restingHRDetected
    ? Math.round(recentResting.reduce((a, b) => a + b.value, 0) / recentResting.length)
    : 52;

  const maxHRDetected = observedMaxHR > 150;
  const detectedMaxHR = maxHRDetected ? Math.round(observedMaxHR) : 188;

  const summary = rejectedSessions > 0
    ? `Done! Extracted ${runningWorkoutsFound} running workouts (${rejectedSessions} interval session${rejectedSessions === 1 ? '' : 's'} excluded).`
    : `Done! Extracted ${runningWorkoutsFound} running workouts.`;
  onProgress?.(100, summary);

  return {
    zone2Runs,
    norwegianSessions,
    miscRuns,
    totalWorkoutsFound: runningWorkoutsFound,
    runningWorkoutsFound,
    rejectedSessions,
    detectedRestingHR,
    detectedMaxHR,
    restingHRDetected,
    maxHRDetected,
    source: 'export',
  };
}
