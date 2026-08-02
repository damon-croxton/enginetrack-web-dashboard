import React, { useState, useMemo } from 'react';
import { Zone2Run, Norwegian4x4Session } from '../types';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  AreaChart,
  Area,
} from 'recharts';
import {
  Brain,
  Activity,
  Flame,
  Zap,
  Award,
  TrendingUp,
  Heart,
  Sliders,
  Sparkles,
  ShieldCheck,
  Target,
  Dna,
  Layers,
  HelpCircle,
  UploadCloud,
  RotateCcw,
  CheckCircle2
} from 'lucide-react';
import {
  getTimestamp,
  calculateTRIMP,
  estimateVO2Max,
  DEFAULT_PHYSIOLOGY
} from '../utils/cardioMetrics';

interface CardioLabViewProps {
  zone2Runs: Zone2Run[];
  norwegianSessions: Norwegian4x4Session[];
  onOpenInfoModal: () => void;
  onResetData?: () => void;
  onOpenAppleHealthModal?: () => void;
}

export const CardioLabView: React.FC<CardioLabViewProps> = ({
  zone2Runs,
  norwegianSessions,
  onOpenInfoModal,
  onResetData,
  onOpenAppleHealthModal,
}) => {
  const [restingHR, setRestingHR] = useState<number>(DEFAULT_PHYSIOLOGY.restingHR);
  const [maxHR, setMaxHR] = useState<number>(DEFAULT_PHYSIOLOGY.maxHR);
  const [weightKg, setWeightKg] = useState<number>(DEFAULT_PHYSIOLOGY.weightKg);

  // Combine and sort all workouts chronologically for Banister Fitness-Fatigue model
  const combinedChronological = useMemo(() => {
    const events: Array<{
      dateStr: string;
      timestamp: number;
      type: 'Zone 2' | 'Norwegian 4x4';
      trimp: number;
      distanceKm: number;
      speedKmh: number;
      avgHR: number;
      peakSpeedKmh: number;
    }> = [];

    zone2Runs.forEach((r) => {
      const trimp = calculateTRIMP(r.Duration_min, r.Avg_HR, restingHR, maxHR);
      events.push({
        dateStr: r.Date_Str,
        timestamp: getTimestamp(r.Date_Str),
        type: 'Zone 2',
        trimp,
        distanceKm: r.Total_Distance_km,
        speedKmh: r.Avg_Speed_kmh,
        avgHR: r.Avg_HR,
        peakSpeedKmh: r.Avg_Speed_kmh,
      });
    });

    norwegianSessions.forEach((s) => {
      // 4x4 session duration ~40 mins total (4x4 work + recoveries + warm-up)
      const trimp = calculateTRIMP(40, s.Avg_Work_HR, restingHR, maxHR);
      events.push({
        dateStr: s.Date_Str,
        timestamp: getTimestamp(s.Date_Str),
        type: 'Norwegian 4x4',
        trimp,
        distanceKm: s.Total_Work_Distance_km,
        speedKmh: s.Avg_Speed_kmh,
        avgHR: s.Avg_Work_HR,
        peakSpeedKmh: s.Peak_Interval_Speed,
      });
    });

    events.sort((a, b) => a.timestamp - b.timestamp);

    // Compute Fitness (CTL: 42-day EWMA) and Fatigue (ATL: 7-day EWMA)
    let ctl = 10;
    let atl = 10;
    let cumDistance = 0;
    let runningMax4x4Speed = 12.0;
    let runningAvgZ2Speed = 9.5;

    return events.map((ev, idx) => {
      cumDistance += ev.distanceKm;

      if (ev.type === 'Norwegian 4x4') {
        runningMax4x4Speed = Math.max(runningMax4x4Speed, ev.peakSpeedKmh);
      } else {
        runningAvgZ2Speed = (runningAvgZ2Speed + ev.speedKmh) / 2;
      }

      // Exponential smoothing factor: 1 - exp(-1/days)
      const decayCTL = 1 - Math.exp(-1 / 42);
      const decayATL = 1 - Math.exp(-1 / 7);

      ctl = ctl * (1 - decayCTL) + ev.trimp * decayCTL;
      atl = atl * (1 - decayATL) + ev.trimp * decayATL;
      const tsb = ctl - atl; // Readiness

      const vo2Est = estimateVO2Max(runningMax4x4Speed, runningAvgZ2Speed);

      // Mitochondrial Adaptation Index (0-100)
      const mitoIndex = Math.min(100, Number((ctl * 1.8 + vo2Est * 0.8).toFixed(1)));

      return {
        ...ev,
        ctl: Number(ctl.toFixed(1)),
        atl: Number(atl.toFixed(1)),
        tsb: Number(tsb.toFixed(1)),
        vo2Est,
        mitoIndex,
        cumDistance: Number(cumDistance.toFixed(1)),
      };
    });
  }, [zone2Runs, norwegianSessions, restingHR, maxHR]);

  // Key Milestones & All-Time PRs
  const bestZone2API = useMemo(() => {
    if (!zone2Runs.length) return 0;
    return Math.max(...zone2Runs.map((r) => r.Aerobic_Power_Index));
  }, [zone2Runs]);

  const longestZone2Km = useMemo(() => {
    if (!zone2Runs.length) return 0;
    return Math.max(...zone2Runs.map((r) => r.Total_Distance_km));
  }, [zone2Runs]);

  const fastest4x4Speed = useMemo(() => {
    if (!norwegianSessions.length) return 0;
    return Math.max(...norwegianSessions.map((s) => s.Peak_Interval_Speed));
  }, [norwegianSessions]);

  const max4x4WorkDist = useMemo(() => {
    if (!norwegianSessions.length) return 0;
    return Math.max(...norwegianSessions.map((s) => s.Total_Work_Distance_km));
  }, [norwegianSessions]);

  const totalAllTimeKm = useMemo(() => {
    const z2Total = zone2Runs.reduce((a, b) => a + b.Total_Distance_km, 0);
    const n4Total = norwegianSessions.reduce((a, b) => a + b.Total_Work_Distance_km, 0);
    return (z2Total + n4Total).toFixed(1);
  }, [zone2Runs, norwegianSessions]);

  const latestVO2 = combinedChronological.length > 0 ? combinedChronological[combinedChronological.length - 1].vo2Est : 38.5;
  const latestMitoScore = combinedChronological.length > 0 ? combinedChronological[combinedChronological.length - 1].mitoIndex : 45;

  // Custom Chart Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 border border-slate-700 p-3.5 rounded-xl shadow-xl text-xs space-y-2 min-w-[210px]">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-bold text-white text-sm">{data.dateStr}</span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                data.type === 'Norwegian 4x4'
                  ? 'bg-rose-950 text-rose-400 border-rose-800'
                  : 'bg-cyan-950 text-cyan-400 border-cyan-800'
              }`}
            >
              {data.type}
            </span>
          </div>
          <div className="space-y-1.5 pt-1 font-mono">
            <div className="flex justify-between items-center text-emerald-400">
              <span className="flex items-center gap-1 font-sans font-medium">
                <Dna className="h-3.5 w-3.5" /> Estimated VO2 max:
              </span>
              <span className="font-bold text-sm">{data.vo2Est} ml/kg/min</span>
            </div>
            <div className="flex justify-between items-center text-purple-400">
              <span className="flex items-center gap-1 font-sans font-medium">
                <Brain className="h-3.5 w-3.5" /> Fitness (CTL):
              </span>
              <span className="font-bold">{data.ctl}</span>
            </div>
            <div className="flex justify-between items-center text-rose-400">
              <span className="flex items-center gap-1 font-sans">
                <Flame className="h-3.5 w-3.5 text-rose-400" /> Fatigue (ATL):
              </span>
              <span>{data.atl}</span>
            </div>
            <div className="flex justify-between items-center text-amber-300">
              <span className="flex items-center gap-1 font-sans">
                <Target className="h-3.5 w-3.5" /> Readiness (TSB):
              </span>
              <span>{data.tsb}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // EMPTY STATE
  if (zone2Runs.length === 0 && norwegianSessions.length === 0) {
    return (
      <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-8 sm:p-12 text-center max-w-2xl mx-auto my-12 space-y-6 shadow-2xl">
        <div className="w-16 h-16 bg-purple-950/80 text-purple-400 border border-purple-800/80 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
          <Brain className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-white">No Cardio Lab Data Logged</h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
            Your Cardio Lab deep analytics laboratory is empty. Load the demo sample dataset or import your Apple Health XML file to calculate VO2 max trends and Fitness-Fatigue Banister models!
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          {onOpenAppleHealthModal && (
            <button
              onClick={onOpenAppleHealthModal}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-purple-950/50 transition-all"
            >
              <UploadCloud className="h-4 w-4" />
              <span>Import Apple Health File</span>
            </button>
          )}
          {onResetData && (
            <button
              onClick={onResetData}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 border border-slate-600 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all"
            >
              <RotateCcw className="h-4 w-4 text-slate-300" />
              <span>Load Demo Sample Data</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-8">
      {/* Concept Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-purple-950/40 to-slate-900 border border-purple-800/50 rounded-2xl p-3.5 sm:p-5 shadow-lg relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-1 max-w-3xl">
            <div className="flex items-center gap-1.5 text-purple-400 font-semibold text-[10px] sm:text-xs tracking-wider uppercase">
              <Brain className="h-3.5 w-3.5" />
              <span>Exercise Physiology & Physiological Modeling</span>
            </div>
            <h2 className="text-base sm:text-xl font-bold text-white">
              Cardio Lab: VO2 Max & Fitness-Fatigue Readiness
            </h2>
            <p className="text-[11px] sm:text-sm text-slate-300 leading-snug">
              Integrates Zone 2 volume with Norwegian 4x4 velocity to model cardiovascular adaptation, Banister TSB, and VO2 max trajectory!
            </p>
          </div>
          <button
            onClick={onOpenInfoModal}
            className="self-start md:self-center flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-[11px] sm:text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-purple-300 transition-all shrink-0"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            <span>Lab Science</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        {/* KPI 1: Estimated VO2 max */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-3 sm:p-5 shadow-lg relative overflow-hidden group hover:border-emerald-500/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400 line-clamp-1">
              Estimated VO2 Max
            </span>
            <div className="p-1.5 sm:p-2 rounded-xl bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 shrink-0">
              <Dna className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-3xl font-extrabold text-white font-mono tracking-tight">
              {latestVO2}
            </span>
            <span className="text-[10px] sm:text-xs text-slate-400">ml/kg</span>
          </div>
          <div className="mt-1.5 sm:mt-3 flex items-center gap-1 text-[10px] sm:text-xs text-emerald-400 font-medium">
            <Award className="h-3.5 w-3.5" />
            <span>Superior Fitness</span>
          </div>
        </div>

        {/* KPI 2: Mitochondrial Density Index */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-3 sm:p-5 shadow-lg relative overflow-hidden group hover:border-purple-500/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400 line-clamp-1">
              Mito Score
            </span>
            <div className="p-1.5 sm:p-2 rounded-xl bg-purple-950/60 text-purple-400 border border-purple-800/60 shrink-0">
              <Brain className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white font-mono tracking-tight">
              {latestMitoScore}
            </span>
            <span className="text-xs text-slate-400">/ 100</span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-purple-300 font-medium">
            <Sparkles className="h-4 w-4 text-purple-400" />
            <span>Capillary Density Adaptation</span>
          </div>
        </div>

        {/* KPI 3: Total Lifetime Engine Distance */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-cyan-500/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Lifetime Engine Distance
            </span>
            <div className="p-2 rounded-xl bg-cyan-950/60 text-cyan-400 border border-cyan-800/60">
              <Activity className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white font-mono tracking-tight">
              {totalAllTimeKm}
            </span>
            <span className="text-xs text-slate-400">km</span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
            <CheckCircle2 className="h-4 w-4 text-cyan-400" />
            <span>Zone 2 + 4x4 Workouts Logged</span>
          </div>
        </div>

        {/* KPI 4: Peak Interval Speed */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-amber-500/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              All-Time Peak Velocity
            </span>
            <div className="p-2 rounded-xl bg-amber-950/60 text-amber-400 border border-amber-800/60">
              <Flame className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white font-mono tracking-tight">
              {fastest4x4Speed}
            </span>
            <span className="text-xs text-slate-400">km/h</span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-amber-400 font-medium">
            <Award className="h-4 w-4" />
            <span>Max 4x4 Interval Output</span>
          </div>
        </div>
      </div>

      {/* VO2 MAX LONGITUDINAL TREND CHART */}
      <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-3 sm:p-6 shadow-xl space-y-3 sm:space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700/60 pb-3 sm:pb-4">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-1.5">
              <Dna className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-400" />
              <span>VO2 Max & Fitness Load (Banister Model)</span>
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-400">
              Computed VO2 max against Chronic Training Load (CTL Fitness).
            </p>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-semibold">
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span className="text-emerald-300">VO2 Max</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
              <span className="text-purple-300">Fitness CTL</span>
            </div>
          </div>
        </div>

        <div className="h-[280px] sm:h-80 w-full pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={combinedChronological} margin={{ top: 10, right: 8, left: -22, bottom: 0 }}>
              <defs>
                <linearGradient id="colorVO2Fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis
                dataKey="timestamp"
                type="number"
                scale="time"
                domain={['dataMin - 172800000', 'dataMax + 172800000']}
                stroke="#94a3b8"
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: '#475569' }}
                tickFormatter={(ts) =>
                  new Date(ts).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })
                }
              />
              <YAxis
                yAxisId="left"
                stroke="#10b981"
                fontSize={11}
                domain={['auto', 'auto']}
                tickLine={false}
                axisLine={{ stroke: '#059669' }}
                unit=" ml/kg"
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#c084fc"
                fontSize={11}
                domain={['auto', 'auto']}
                tickLine={false}
                axisLine={{ stroke: '#9333ea' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="vo2Est"
                name="VO2 Max (ml/kg/min)"
                fill="url(#colorVO2Fill)"
                stroke="#10b981"
                strokeWidth={3}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="ctl"
                name="Chronic Fitness Load (CTL)"
                stroke="#c084fc"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#9333ea' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* PERSONAL RECORDS & MILESTONES WALL */}
      <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-400" />
            <span>Cardiovascular Engine Hall of Fame & Personal Bests</span>
          </h3>
          <span className="text-xs text-slate-400 font-mono">All-Time Statistics</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-2">
            <div className="text-xs text-slate-400 font-semibold">BEST ZONE 2 API</div>
            <div className="text-2xl font-extrabold text-cyan-300 font-mono">{bestZone2API.toFixed(2)}</div>
            <p className="text-[11px] text-slate-400">Peak aerobic efficiency recorded</p>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-2">
            <div className="text-xs text-slate-400 font-semibold">LONGEST ZONE 2 RUN</div>
            <div className="text-2xl font-extrabold text-blue-400 font-mono">{longestZone2Km} km</div>
            <p className="text-[11px] text-slate-400">Max single aerobic endurance distance</p>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-2">
            <div className="text-xs text-slate-400 font-semibold">FASTEST 4x4 INTERVAL</div>
            <div className="text-2xl font-extrabold text-amber-400 font-mono">{fastest4x4Speed} km/h</div>
            <p className="text-[11px] text-slate-400">Max velocity during 4-min work block</p>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-2">
            <div className="text-xs text-slate-400 font-semibold">MAX 4x4 WORK DISTANCE</div>
            <div className="text-2xl font-extrabold text-rose-400 font-mono">{max4x4WorkDist} km</div>
            <p className="text-[11px] text-slate-400">Total distance covered in 16 work mins</p>
          </div>
        </div>
      </div>
    </div>
  );
};
