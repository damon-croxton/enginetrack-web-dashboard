import React, { useState, useMemo } from 'react';
import { Zone2Run, Norwegian4x4Session, MiscRun } from '../types';
import {
  Gauge,
  Trophy,
  Zap,
  Sparkles,
  Flame,
  Activity,
  Award,
  Layers,
  HelpCircle,
  Sliders,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { estimateVO2Max } from '../utils/cardioMetrics';

interface RaceSimulatorViewProps {
  zone2Runs: Zone2Run[];
  norwegianSessions: Norwegian4x4Session[];
  miscRuns?: MiscRun[];
}

export const RaceSimulatorView: React.FC<RaceSimulatorViewProps> = ({
  zone2Runs,
  norwegianSessions,
  miscRuns = [],
}) => {
  // Baseline speeds calculated from real user logs
  const baselineZone2Speed = useMemo(() => {
    if (zone2Runs.length === 0) return 9.5;
    return zone2Runs.reduce((acc, r) => acc + r.Avg_Speed_kmh, 0) / zone2Runs.length;
  }, [zone2Runs]);

  const baselinePeak4x4Speed = useMemo(() => {
    if (norwegianSessions.length === 0) return 13.5;
    return Math.max(...norwegianSessions.map((s) => s.Peak_Interval_Speed));
  }, [norwegianSessions]);

  // Best actual 5K attempt extracted from general/misc runs or zone2/all runs
  const bestActual5kRun = useMemo(() => {
    const candidateRuns = [
      ...miscRuns,
      ...zone2Runs.map((z) => ({
        Date_Str: z.Date_Str,
        Total_Distance_km: z.Total_Distance_km,
        Duration_min: z.Duration_min,
        Avg_Speed_kmh: z.Avg_Speed_kmh,
        Avg_HR: z.Avg_HR,
        Workout_Type: 'Zone 2 Run',
      })),
    ].filter((r) => r.Total_Distance_km >= 4.5 && r.Total_Distance_km <= 6.0);

    if (candidateRuns.length === 0) return null;
    return candidateRuns.reduce((prev, curr) =>
      curr.Avg_Speed_kmh > prev.Avg_Speed_kmh ? curr : prev
    );
  }, [miscRuns, zone2Runs]);

  // Mode Selection: 'actual5k' vs 'vo2model'
  const [predictionMode, setPredictionMode] = useState<'actual5k' | 'vo2model'>(
    bestActual5kRun ? 'actual5k' : 'vo2model'
  );

  // Fatigue Decay Exponent (Riegel 'F')
  // Standard Riegel = 1.06 (Elite/Optimistic). Amateur realistic decay = 1.15.
  const [fatigueExponent, setFatigueExponent] = useState<number>(1.15);

  // Interactive slider overrides
  const [customZ2Speed, setCustomZ2Speed] = useState<number>(
    Number(baselineZone2Speed.toFixed(1))
  );
  const [customPeak4x4Speed, setCustomPeak4x4Speed] = useState<number>(
    Number(baselinePeak4x4Speed.toFixed(1))
  );

  // Custom benchmark 5K speed slider (when actual5k mode active)
  const [custom5kSpeed, setCustom5kSpeed] = useState<number>(
    bestActual5kRun ? bestActual5kRun.Avg_Speed_kmh : 12.5
  );

  // Calculate estimated VO2 max for custom parameters
  const simulatedVO2 = useMemo(() => {
    return estimateVO2Max(customPeak4x4Speed, customZ2Speed);
  }, [customPeak4x4Speed, customZ2Speed]);

  // Riegel Race Predictor Formula: T2 = T1 * (D2 / D1)^F
  const racePredictions = useMemo(() => {
    let baseTimeMinutes = 0;
    let baseDistanceKm = 5;

    if (predictionMode === 'actual5k') {
      // Anchor directly on 5K benchmark effort (D1 = 5km)
      baseDistanceKm = 5;
      baseTimeMinutes = (5 / custom5kSpeed) * 60;
    } else {
      // VO2 Max model: Estimate 10K speed (km/h) based on VO2 Max
      const vdot10kSpeedKmh = simulatedVO2 * 0.27;
      baseDistanceKm = 10;
      baseTimeMinutes = (10 / vdot10kSpeedKmh) * 60;
    }

    const riegelPredictor = (distKm: number) => {
      // T2 = T1 * (D2 / D1)^F
      const timeMinutes = baseTimeMinutes * Math.pow(distKm / baseDistanceKm, fatigueExponent);
      const totalSeconds = timeMinutes * 60;
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = Math.round(totalSeconds % 60);

      const paceSecPerKm = totalSeconds / distKm;
      const paceMin = Math.floor(paceSecPerKm / 60);
      const paceSec = Math.round(paceSecPerKm % 60);

      const avgSpeedKmh = distKm / (timeMinutes / 60);

      const formattedTime =
        hours > 0
          ? `${hours}h ${minutes < 10 ? '0' + minutes : minutes}m ${seconds < 10 ? '0' + seconds : seconds}s`
          : `${minutes}m ${seconds < 10 ? '0' + seconds : seconds}s`;

      const formattedPace = `${paceMin}:${paceSec < 10 ? '0' + paceSec : paceSec} /km`;

      return {
        distKm,
        formattedTime,
        formattedPace,
        avgSpeedKmh: avgSpeedKmh.toFixed(1),
      };
    };

    return [
      { name: '5K Sprint', distance: 5, icon: Zap, ...riegelPredictor(5), targetHR: '88-92% HRMax' },
      { name: '10K Race', distance: 10, icon: Flame, ...riegelPredictor(10), targetHR: '85-89% HRMax' },
      { name: 'Half Marathon', distance: 21.0975, icon: Trophy, ...riegelPredictor(21.0975), targetHR: '82-85% HRMax' },
      { name: 'Full Marathon', distance: 42.195, icon: Award, ...riegelPredictor(42.195), targetHR: '75-80% HRMax' },
    ];
  }, [predictionMode, custom5kSpeed, simulatedVO2, fatigueExponent]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 sm:p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 sm:p-3 rounded-xl bg-amber-950/80 border border-amber-800 text-amber-400 shrink-0">
            <Gauge className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-1.5 flex-wrap">
              <span>Race Pace & Performance Simulator</span>
              <span className="text-[10px] bg-amber-950 text-amber-300 border border-amber-800 px-2 py-0.2 rounded-full font-semibold">
                Riegel Model
              </span>
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-400 leading-tight">
              Predict 5K, 10K, Half & Full Marathon finish times grounded on logged efforts.
            </p>
          </div>
        </div>

        {/* Dynamic VO2 / 5K Benchmark Pill */}
        <div className="bg-slate-950/80 border border-slate-800 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl flex items-center gap-2.5 self-start md:self-auto">
          <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
          <div>
            <div className="text-[9px] sm:text-[10px] text-slate-400 font-semibold uppercase">
              {predictionMode === 'actual5k' ? '5K BENCHMARK' : 'ESTIMATED VO2'}
            </div>
            <div className="text-lg sm:text-xl font-extrabold text-white font-mono">
              {predictionMode === 'actual5k' ? (
                `${custom5kSpeed.toFixed(1)} km/h`
              ) : (
                `${simulatedVO2} ml/kg`
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Baseline Anchor Selection Toggle & Decay Controls */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Sliders className="h-4 w-4 text-amber-400" />
            <span>Prediction Baseline & Fatigue Exponent</span>
          </h3>

          {/* Mode Switch Buttons */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setPredictionMode('actual5k')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                predictionMode === 'actual5k'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Anchor on Logged 5K Effort
            </button>
            <button
              onClick={() => setPredictionMode('vo2model')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                predictionMode === 'vo2model'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Theoretical VO2 Max Model
            </button>
          </div>
        </div>

        {/* Fatigue Exponent Slider & Note */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
          {/* Slider */}
          <div className="lg:col-span-2 bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-amber-400 flex items-center gap-1.5">
                <Layers className="h-4 w-4" /> Fatigue Decay Exponent (Riegel 'F'):
              </span>
              <span className="font-mono text-sm text-white font-extrabold">
                {fatigueExponent.toFixed(2)}{' '}
                <span className="text-[10px] font-normal text-slate-400">
                  {fatigueExponent === 1.06
                    ? '(Optimistic / Elite)'
                    : fatigueExponent >= 1.15
                    ? '(Realistic Amateur Decay)'
                    : '(Moderate)'}
                </span>
              </span>
            </div>
            <input
              type="range"
              min="1.05"
              max="1.22"
              step="0.01"
              value={fatigueExponent}
              onChange={(e) => setFatigueExponent(Number(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>1.05 (Sub-2h Marathon Elite)</span>
              <span className="text-amber-400 font-bold">1.15 (Default Amateur Scaling)</span>
              <span>1.22 (Conservative / Low Mileage)</span>
            </div>
          </div>

          {/* Explanation Box */}
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 text-xs text-slate-300 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-amber-300 text-[11px]">
              <CheckCircle2 className="h-3.5 w-3.5" /> Realistic Marathon Scaling
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              Standard Riegel ($F=1.06$) assumes 100+ km/wk elite aerobic volume, predicting an over-optimistic 3h09 marathon for a 23m 5K. $F=1.15$ correctly accounts for endurance fatigue, scaling the marathon to a realistic ~4h05–4h20 range.
            </p>
          </div>
        </div>

        {/* Dynamic Parameter Controls depending on Mode */}
        {predictionMode === 'actual5k' ? (
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-cyan-400 flex items-center gap-1.5">
                <Flame className="h-4 w-4" /> Benchmark 5K Velocity:
              </span>
              <span className="font-mono text-sm text-white font-extrabold">
                {custom5kSpeed.toFixed(1)} km/h{' '}
                <span className="text-slate-400 text-xs font-normal">
                  ({Math.floor(60 / custom5kSpeed)}:{String(Math.round((3600 / custom5kSpeed) % 60)).padStart(2, '0')} /km)
                </span>
              </span>
            </div>
            <input
              type="range"
              min="8.0"
              max="18.0"
              step="0.1"
              value={custom5kSpeed}
              onChange={(e) => setCustom5kSpeed(Number(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
            {bestActual5kRun && (
              <div className="text-[11px] text-slate-400 flex items-center justify-between">
                <span>Best logged 5K in General Runs:</span>
                <span className="font-mono text-cyan-300 font-bold">
                  {bestActual5kRun.Date_Str} — {bestActual5kRun.Total_Distance_km} km @ {bestActual5kRun.Avg_Speed_kmh} km/h
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-cyan-400 flex items-center gap-1.5">
                  <Activity className="h-4 w-4" /> Zone 2 Velocity:
                </span>
                <span className="font-mono text-sm text-white font-extrabold">{customZ2Speed} km/h</span>
              </div>
              <input
                type="range"
                min="6.0"
                max="16.0"
                step="0.1"
                value={customZ2Speed}
                onChange={(e) => setCustomZ2Speed(Number(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-rose-400 flex items-center gap-1.5">
                  <Flame className="h-4 w-4" /> Peak 4x4 Interval Velocity:
                </span>
                <span className="font-mono text-sm text-white font-extrabold">{customPeak4x4Speed} km/h</span>
              </div>
              <input
                type="range"
                min="8.0"
                max="22.0"
                step="0.1"
                value={customPeak4x4Speed}
                onChange={(e) => setCustomPeak4x4Speed(Number(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-400"
              />
            </div>
          </div>
        )}
      </div>

      {/* Race Distance Predictions Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {racePredictions.map((race) => {
          const Icon = race.icon;
          return (
            <div
              key={race.name}
              className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-xl relative overflow-hidden group hover:border-amber-500/50 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-xl bg-amber-950/80 border border-amber-800 text-amber-400">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {race.distance} km
                </span>
              </div>

              <div>
                <h4 className="text-base font-bold text-white">{race.name}</h4>
                <p className="text-[11px] text-slate-400">Riegel Projected Finish Time</p>
              </div>

              <div className="text-2xl font-extrabold text-amber-300 font-mono tracking-tight">
                {race.formattedTime}
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-800/80 text-xs">
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">Target Pace:</span>
                  <span className="font-mono font-bold text-white">{race.formattedPace}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">Average Velocity:</span>
                  <span className="font-mono font-bold text-amber-400">{race.avgSpeedKmh} km/h</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">HR Target Zone:</span>
                  <span className="font-mono font-bold text-rose-400">{race.targetHR}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
