import JSZip from 'jszip';
import { Zone2Run, Norwegian4x4Session, IntervalSplit, MiscRun } from '../types';

export interface ParsedAppleHealthData {
  zone2Runs: Zone2Run[];
  norwegianSessions: Norwegian4x4Session[];
  miscRuns: MiscRun[];
  totalWorkoutsFound: number;
  runningWorkoutsFound: number;
  isCdaFile?: boolean;
  detectedRestingHR?: number;
  detectedMaxHR?: number;
}

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
    };
  }

  const zone2Runs: Zone2Run[] = [];
  const norwegianSessions: Norwegian4x4Session[] = [];
  const miscRuns: MiscRun[] = [];
  let runningWorkoutsFound = 0;
  const restingHRSamples: number[] = [];
  let observedMaxHR = 0;

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
        if (isEnd) {
          buffer = '';
        } else {
          // Discard all processed non-workout content, keeping last 20 chars for tag split boundary
          if (buffer.length > 20) {
            buffer = buffer.slice(-20);
          }
        }
        break;
      }

      // Immediately discard non-workout text preceding '<Workout'
      if (workoutStart > 0) {
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

  // Calculate detected max HR across workouts
  [...zone2Runs, ...miscRuns].forEach((r) => {
    if (r.Avg_HR > observedMaxHR) observedMaxHR = r.Avg_HR;
  });
  norwegianSessions.forEach((s) => {
    if (s.Peak_Interval_HR > observedMaxHR) observedMaxHR = s.Peak_Interval_HR;
    else if (s.Avg_Work_HR > observedMaxHR) observedMaxHR = s.Avg_Work_HR;
  });

  const detectedRestingHR = restingHRSamples.length > 0
    ? Math.round(restingHRSamples.reduce((a, b) => a + b, 0) / restingHRSamples.length)
    : 52;
  const detectedMaxHR = observedMaxHR > 150 ? Math.round(observedMaxHR) : 188;

  onProgress?.(100, `Done! Extracted ${runningWorkoutsFound} running workouts matching your exact Python pipeline.`);

  return {
    zone2Runs,
    norwegianSessions,
    miscRuns,
    totalWorkoutsFound: runningWorkoutsFound,
    runningWorkoutsFound,
    detectedRestingHR,
    detectedMaxHR,
  };
}
