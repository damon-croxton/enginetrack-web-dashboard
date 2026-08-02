import React, { useMemo } from 'react';
import { Zone2Run, Norwegian4x4Session, MiscRun, TabType } from '../types';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import {
  Activity,
  Flame,
  Award,
  Zap,
  Dna,
  Sparkles,
  Calendar,
  ChevronRight,
  Gauge,
  Trophy,
  History,
  Layers,
  TrendingUp
} from 'lucide-react';
import {
  getTimestamp,
  calculateNonLinearAPI,
  calculateHRRAerobicIndex,
  calculateGenericHRRAerobicIndex,
  DEFAULT_PHYSIOLOGY
} from '../utils/cardioMetrics';

interface DashboardViewProps {
  zone2Runs: Zone2Run[];
  norwegianSessions: Norwegian4x4Session[];
  miscRuns?: MiscRun[];
  onSelectTab: (tab: TabType) => void;
  onOpenInfoModal: () => void;
  restingHR?: number;
  maxHR?: number;
}

// Compact, high-contrast, clean custom tooltip
const CustomDashboardTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    let dateFormatted = label;
    if (typeof label === 'number') {
      dateFormatted = new Date(label).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } else if (typeof label === 'string' && !isNaN(new Date(label).getTime())) {
      dateFormatted = new Date(label).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    }

    return (
      <div className="bg-slate-950/95 border border-slate-700 px-3 py-2 rounded-xl shadow-2xl text-[11px] max-w-[210px] backdrop-blur-md">
        <p className="font-bold text-white border-b border-slate-800 pb-1 font-mono text-[11px] mb-1">
          📅 {dateFormatted}
        </p>
        <div className="space-y-1">
          {payload.map((entry: any, index: number) => {
            const val = typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value;
            return (
              <div key={`item-${index}`} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1 font-medium text-slate-300">
                  <span
                    className="h-2 w-2 rounded-full inline-block shrink-0"
                    style={{ backgroundColor: entry.color || entry.fill }}
                  />
                  <span className="truncate max-w-[110px]">{entry.name}</span>
                </span>
                <span className="font-mono font-bold text-white shrink-0">{val}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  zone2Runs,
  norwegianSessions,
  miscRuns = [],
  onSelectTab,
  onOpenInfoModal,
  restingHR = DEFAULT_PHYSIOLOGY.restingHR,
  maxHR = DEFAULT_PHYSIOLOGY.maxHR,
}) => {
  // Sort runs
  const sortedZone2 = useMemo(() => {
    return [...zone2Runs].sort(
      (a, b) => new Date(a.Date_Str).getTime() - new Date(b.Date_Str).getTime()
    );
  }, [zone2Runs]);

  const sorted4x4 = useMemo(() => {
    return [...norwegianSessions].sort(
      (a, b) => new Date(a.Date_Str).getTime() - new Date(b.Date_Str).getTime()
    );
  }, [norwegianSessions]);

  const sortedMisc = useMemo(() => {
    return [...miscRuns].sort(
      (a, b) => new Date(a.Date_Str).getTime() - new Date(b.Date_Str).getTime()
    );
  }, [miscRuns]);

  // 1. Best HRR Result
  const bestHRRResult = useMemo(() => {
    if (sortedZone2.length === 0) return '0.00';
    const hrrValues = sortedZone2.map((run) => calculateHRRAerobicIndex(run, restingHR, maxHR));
    return Math.max(...hrrValues).toFixed(2);
  }, [sortedZone2, restingHR, maxHR]);

  // 2. Maximum 4x4 Interval Distance
  const max4x4IntervalDist = useMemo(() => {
    if (sorted4x4.length === 0) return '0.0';
    const workDistances = sorted4x4.map((s) => s.Total_Work_Distance_km);
    return Math.max(...workDistances).toFixed(1);
  }, [sorted4x4]);

  // 3. Estimated Half Marathon Time (Riegel predictor from estimated 5k pace)
  const estHalfMarathon = useMemo(() => {
    let base5kSpeedKmh = 12.0; // default 5:00/km -> 25min 5k
    if (sortedZone2.length > 0) {
      const avgZ2 = sortedZone2.reduce((acc, r) => acc + r.Avg_Speed_kmh, 0) / sortedZone2.length;
      base5kSpeedKmh = avgZ2 * 1.22;
    }
    if (sorted4x4.length > 0) {
      const max4x4 = Math.max(...sorted4x4.map((s) => s.Peak_Interval_Speed));
      base5kSpeedKmh = Math.max(base5kSpeedKmh, max4x4 * 0.90);
    }
    if (sortedMisc.length > 0) {
      const maxMisc = Math.max(...sortedMisc.map((m) => m.Avg_Speed_kmh));
      base5kSpeedKmh = Math.max(base5kSpeedKmh, maxMisc);
    }

    const t1Minutes = (5 / base5kSpeedKmh) * 60;
    const t2Minutes = t1Minutes * Math.pow(21.0975 / 5, 1.15);
    const totalSec = t2Minutes * 60;
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);

    const paceSecPerKm = totalSec / 21.0975;
    const paceMin = Math.floor(paceSecPerKm / 60);
    const paceSec = Math.round(paceSecPerKm % 60);

    const timeFormatted = `${hours}h ${minutes < 10 ? '0' + minutes : minutes}m`;
    const paceFormatted = `${paceMin}:${paceSec < 10 ? '0' + paceSec : paceSec} /km`;

    return { timeFormatted, paceFormatted };
  }, [sortedZone2, sorted4x4, sortedMisc]);

  // 4. Yearly Total Running Distance for each year present in data (including miscRuns)
  const yearlyDistanceTotals = useMemo(() => {
    const totalsByYr: Record<number, { distanceKm: number; runCount: number }> = {};

    sortedZone2.forEach((r) => {
      const yr = new Date(r.Date_Str).getFullYear();
      if (isNaN(yr)) return;
      if (!totalsByYr[yr]) totalsByYr[yr] = { distanceKm: 0, runCount: 0 };
      totalsByYr[yr].distanceKm += r.Total_Distance_km;
      totalsByYr[yr].runCount += 1;
    });

    sorted4x4.forEach((s) => {
      const yr = new Date(s.Date_Str).getFullYear();
      if (isNaN(yr)) return;
      if (!totalsByYr[yr]) totalsByYr[yr] = { distanceKm: 0, runCount: 0 };
      totalsByYr[yr].distanceKm += s.Total_Work_Distance_km;
      totalsByYr[yr].runCount += 1;
    });

    sortedMisc.forEach((m) => {
      const yr = new Date(m.Date_Str).getFullYear();
      if (isNaN(yr)) return;
      if (!totalsByYr[yr]) totalsByYr[yr] = { distanceKm: 0, runCount: 0 };
      totalsByYr[yr].distanceKm += m.Total_Distance_km;
      totalsByYr[yr].runCount += 1;
    });

    return Object.keys(totalsByYr)
      .map(Number)
      .sort((a, b) => a - b)
      .map((yr) => ({
        year: yr,
        distanceKm: totalsByYr[yr].distanceKm.toFixed(1),
        runCount: totalsByYr[yr].runCount,
      }));
  }, [sortedZone2, sorted4x4, sortedMisc]);

  // Prepared Unified All-Runs Graph Data (Zone 2 + 4x4 + Misc)
  const preparedAllRunsGraph = useMemo(() => {
    const combined: Array<{
      Date_Str: string;
      timestamp: number;
      category: string;
      distanceKm: number;
      avgSpeedKmh: number;
      avgHR: number;
      hrrIndex: number;
    }> = [];

    sortedZone2.forEach((r) => {
      const ts = getTimestamp(r.Date_Str);
      if (isNaN(ts)) return;
      combined.push({
        Date_Str: r.Date_Str,
        timestamp: ts,
        category: 'Zone 2',
        distanceKm: r.Total_Distance_km,
        avgSpeedKmh: r.Avg_Speed_kmh,
        avgHR: r.Avg_HR,
        hrrIndex: calculateHRRAerobicIndex(r, restingHR, maxHR),
      });
    });

    sorted4x4.forEach((s) => {
      const ts = getTimestamp(s.Date_Str);
      if (isNaN(ts)) return;
      combined.push({
        Date_Str: s.Date_Str,
        timestamp: ts,
        category: '4x4 HIIT',
        distanceKm: s.Total_Work_Distance_km,
        avgSpeedKmh: s.Avg_Speed_kmh,
        avgHR: s.Avg_Work_HR,
        hrrIndex: calculateGenericHRRAerobicIndex(s.Avg_Speed_kmh, s.Avg_Work_HR, restingHR, maxHR),
      });
    });

    sortedMisc.forEach((m) => {
      const ts = getTimestamp(m.Date_Str);
      if (isNaN(ts)) return;
      combined.push({
        Date_Str: m.Date_Str,
        timestamp: ts,
        category: m.Workout_Type || 'Misc Run',
        distanceKm: m.Total_Distance_km,
        avgSpeedKmh: m.Avg_Speed_kmh,
        avgHR: m.Avg_HR,
        hrrIndex: calculateGenericHRRAerobicIndex(m.Avg_Speed_kmh, m.Avg_HR, restingHR, maxHR),
      });
    });

    return combined.sort((a, b) => a.timestamp - b.timestamp);
  }, [sortedZone2, sorted4x4, sortedMisc, restingHR, maxHR]);

  // Prepared Zone 2 Gold-Standard HRR graph data (2026 Only for Dashboard View)
  const preparedZone2Graph = useMemo(() => {
    return sortedZone2
      .filter((run) => {
        const yr = new Date(run.Date_Str).getFullYear();
        return yr === 2026;
      })
      .map((run) => {
        const hrrIndex = calculateHRRAerobicIndex(run, restingHR, maxHR);
        const nonLinearAPI = calculateNonLinearAPI(run);
        return {
          ...run,
          timestamp: getTimestamp(run.Date_Str),
          hrrIndex,
          nonLinearAPI,
        };
      });
  }, [sortedZone2, restingHR, maxHR]);

  // Prepared 4x4 Work Speed/Distance graph data (2026 Only for Dashboard View)
  const prepared4x4Graph = useMemo(() => {
    return sorted4x4
      .filter((s) => {
        const yr = new Date(s.Date_Str).getFullYear();
        return yr === 2026;
      })
      .map((s) => {
        return {
          ...s,
          timestamp: getTimestamp(s.Date_Str),
        };
      });
  }, [sorted4x4]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ========================================================
          TOP BENCHMARK COMPACT MILESTONE RIBBON
         ======================================================== */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2 shadow-md flex items-center gap-2 text-xs overflow-x-auto no-scrollbar">
        {/* Milestone 1: Best HRR Result */}
        <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 shrink-0">
          <Zap className="h-3.5 w-3.5 text-cyan-400" />
          <span className="text-slate-400 text-[10px] uppercase font-bold">BEST HRR:</span>
          <span className="font-mono font-black text-cyan-300 text-xs">
            {bestHRRResult} <span className="text-[10px] text-slate-500 font-normal">W/%HRR</span>
          </span>
        </div>

        {/* Milestone 2: Max 4x4 Work Distance */}
        <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 shrink-0">
          <Flame className="h-3.5 w-3.5 text-rose-400" />
          <span className="text-slate-400 text-[10px] uppercase font-bold">MAX 4x4 WORK:</span>
          <span className="font-mono font-black text-rose-300 text-xs">
            {max4x4IntervalDist} <span className="text-[10px] text-slate-500 font-normal">km</span>
          </span>
        </div>

        {/* Milestone 3: Estimate Half Marathon Time */}
        <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 shrink-0">
          <Gauge className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-slate-400 text-[10px] uppercase font-bold">EST. HALF MARATHON:</span>
          <span className="font-mono font-black text-amber-300 text-xs">
            {estHalfMarathon.timeFormatted} <span className="text-[10px] text-slate-500 font-normal">({estHalfMarathon.paceFormatted})</span>
          </span>
        </div>

        {/* Milestone 4: Total Distance for Each Year */}
        {yearlyDistanceTotals.length > 0 && (
          <div className="flex items-center gap-2 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 shrink-0">
            <Calendar className="h-3.5 w-3.5 text-purple-400" />
            <span className="text-slate-400 text-[10px] uppercase font-bold">YEARLY TOTALS:</span>
            <div className="flex items-center gap-2 font-mono text-[11px]">
              {yearlyDistanceTotals.map((y) => (
                <span key={y.year} className="text-slate-300">
                  <span className="text-purple-400 font-bold">{y.year}:</span> {y.distanceKm}km
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================
          UNIFIED ALL-RUNS GRAPH (MAIN HRR INDEX METRIC - ALL DATA)
         ======================================================== */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 sm:p-5 shadow-xl space-y-2 sm:space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 sm:p-2 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-400 shrink-0">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-1.5 flex-wrap">
                <span>All Runs Dataset (HRR Index)</span>
                <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                  All Historical Data
                </span>
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400 leading-tight">
                Continuous timeline plotting workouts across all years with Scientific HRR Index.
              </p>
            </div>
          </div>
        </div>

        <div className="h-[280px] sm:h-80 w-full pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={preparedAllRunsGraph} margin={{ top: 10, right: 8, left: -22, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis
                dataKey="timestamp"
                type="number"
                scale="time"
                domain={['dataMin - 86400000', 'dataMax + 86400000']}
                stroke="#94a3b8"
                fontSize={10}
                tickLine={false}
                tickFormatter={(ts) =>
                  new Date(ts).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })
                }
              />
              <YAxis yAxisId="left" stroke="#10b981" fontSize={10} tickLine={false} domain={['auto', 'auto']} />
              <YAxis yAxisId="right" orientation="right" stroke="#38bdf8" fontSize={10} tickLine={false} domain={['auto', 'auto']} unit=" km" />
              <Tooltip content={<CustomDashboardTooltip />} />
              <Legend verticalAlign="top" height={28} wrapperStyle={{ fontSize: '11px', paddingBottom: '4px' }} />
              <Bar yAxisId="right" dataKey="distanceKm" name="Run Distance (km)" fill="#38bdf8" opacity={0.25} barSize={16} radius={[4, 4, 0, 0]} />
              <Line yAxisId="left" type="monotone" dataKey="hrrIndex" name="Scientific HRR Index" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
              <Line yAxisId="left" type="monotone" dataKey="avgSpeedKmh" name="Run Speed (km/h)" stroke="#38bdf8" strokeWidth={1.8} strokeDasharray="4 4" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ========================================================
          LARGE WIDE GRAPH 1: ZONE 2 AEROBIC POWER (2026 DATA)
         ======================================================== */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 sm:p-5 shadow-xl space-y-2 sm:space-y-3">
        {/* Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 sm:p-2 rounded-xl bg-cyan-950/80 border border-cyan-800 text-cyan-400 shrink-0">
              <Activity className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-1.5 flex-wrap">
                <span>Zone 2 Aerobic Power Trend</span>
                <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800">
                  2026 Data
                </span>
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400 leading-tight">
                Mechanical Power (Watts/kg) normalized by % Heart Rate Reserve (HRR).
              </p>
            </div>
          </div>

          <button
            onClick={() => onSelectTab('zone2')}
            className="flex items-center gap-1 px-2.5 py-1 text-[11px] sm:text-xs font-semibold rounded-lg bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-800 text-cyan-300 transition-all self-start sm:self-center"
          >
            <span>Zone 2 Log</span>
            <ChevronRight className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
          </button>
        </div>

        {/* Large Expanded Graph */}
        <div className="h-[280px] sm:h-80 w-full pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={preparedZone2Graph} margin={{ top: 10, right: 8, left: -22, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis
                dataKey="timestamp"
                type="number"
                scale="time"
                domain={['dataMin - 86400000', 'dataMax + 86400000']}
                stroke="#94a3b8"
                fontSize={10}
                tickLine={false}
                tickFormatter={(ts) =>
                  new Date(ts).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })
                }
              />
              <YAxis yAxisId="left" stroke="#22d3ee" fontSize={10} tickLine={false} domain={['auto', 'auto']} />
              <YAxis yAxisId="right" orientation="right" stroke="#f43f5e" fontSize={10} tickLine={false} domain={['auto', 'auto']} unit=" km" />
              <Tooltip content={<CustomDashboardTooltip />} />
              <Legend verticalAlign="top" height={28} wrapperStyle={{ fontSize: '11px', paddingBottom: '4px' }} />
              <Bar yAxisId="right" dataKey="Total_Distance_km" name="Distance (km)" fill="#f43f5e" opacity={0.2} barSize={16} radius={[4, 4, 0, 0]} />
              <Line yAxisId="left" type="monotone" dataKey="hrrIndex" name="Scientific HRR Index" stroke="#22d3ee" strokeWidth={2.5} dot={{ r: 3 }} />
              <Line yAxisId="left" type="monotone" dataKey="nonLinearAPI" name="Active Cardiac Effort" stroke="#a855f7" strokeWidth={1.8} strokeDasharray="4 4" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ========================================================
          LARGE WIDE GRAPH 2: NORWEGIAN 4x4 HIGH-INTENSITY INTERVALS (2026 DATA)
         ======================================================== */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 sm:p-5 shadow-xl space-y-2 sm:space-y-3">
        {/* Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 sm:p-2 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-400 shrink-0">
              <Flame className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-1.5 flex-wrap">
                <span>Norwegian 4x4 Peak Interval Output</span>
                <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-rose-950 text-rose-300 border border-rose-800">
                  2026 Data
                </span>
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400 leading-tight">
                Peak Work Velocity (km/h) across 4x4 minute blocks mapped against active work distance.
              </p>
            </div>
          </div>

          <button
            onClick={() => onSelectTab('norwegian4x4')}
            className="flex items-center gap-1 px-2.5 py-1 text-[11px] sm:text-xs font-semibold rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-300 transition-all self-start sm:self-center"
          >
            <span>4x4 Splits</span>
            <ChevronRight className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
          </button>
        </div>

        {/* Large Expanded Graph */}
        <div className="h-[280px] sm:h-80 w-full pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={prepared4x4Graph} margin={{ top: 10, right: 8, left: -22, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis
                dataKey="timestamp"
                type="number"
                scale="time"
                domain={['dataMin - 86400000', 'dataMax + 86400000']}
                stroke="#94a3b8"
                fontSize={10}
                tickLine={false}
                tickFormatter={(ts) =>
                  new Date(ts).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })
                }
              />
              <YAxis yAxisId="left" stroke="#f43f5e" fontSize={10} tickLine={false} domain={['auto', 'auto']} unit=" km/h" />
              <YAxis yAxisId="right" orientation="right" stroke="#fbbf24" fontSize={10} tickLine={false} domain={['auto', 'auto']} unit=" km" />
              <Tooltip content={<CustomDashboardTooltip />} />
              <Legend verticalAlign="top" height={28} wrapperStyle={{ fontSize: '11px', paddingBottom: '4px' }} />
              <Bar yAxisId="right" dataKey="Total_Work_Distance_km" name="Work Distance (km)" fill="#fbbf24" opacity={0.3} barSize={18} radius={[4, 4, 0, 0]} />
              <Line yAxisId="left" type="monotone" dataKey="Peak_Interval_Speed" name="Peak Interval Velocity" stroke="#f43f5e" strokeWidth={2.5} dot={{ r: 3 }} />
              <Line yAxisId="left" type="monotone" dataKey="Avg_Speed_kmh" name="Overall Session Speed" stroke="#38bdf8" strokeWidth={1.8} strokeDasharray="4 4" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
