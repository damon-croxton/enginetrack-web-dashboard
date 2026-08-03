import React, { useState, useMemo } from 'react';
import { MiscRun } from '../types';
import {
  Activity,
  Layers,
  Search,
  ArrowUpDown,
  Zap,
  Calendar,
  Flame,
  Gauge,
  Plus,
  Trash2,
  FileText,
  Clock,
  TrendingUp,
  Filter
} from 'lucide-react';
import { EmptyState } from './EmptyState';
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
import { getTimestamp, calculateGenericHRRAerobicIndex, DEFAULT_PHYSIOLOGY } from '../utils/cardioMetrics';

interface MiscRunsViewProps {
  miscRuns: MiscRun[];
  onAddRun?: (run: MiscRun) => void;
  onDeleteRun?: (dateStr: string) => void;
  restingHR?: number;
  maxHR?: number;
  onOpenAppleHealthModal?: () => void;
  onResetData?: () => void;
}

const CustomMiscTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    let dateFormatted = label;
    if (typeof label === 'number') {
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

export const MiscRunsView: React.FC<MiscRunsViewProps> = ({
  miscRuns,
  onAddRun,
  onDeleteRun,
  restingHR = DEFAULT_PHYSIOLOGY.restingHR,
  maxHR = DEFAULT_PHYSIOLOGY.maxHR,
  onOpenAppleHealthModal,
  onResetData,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [sortField, setSortField] = useState<'Date_Str' | 'Avg_Speed_kmh' | 'Total_Distance_km' | 'Avg_HR'>('Date_Str');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Summary Metrics
  const totalRunsCount = miscRuns.length;
  const totalDistanceKm = useMemo(
    () => miscRuns.reduce((acc, r) => acc + r.Total_Distance_km, 0),
    [miscRuns]
  );
  
  const fastestSpeed = useMemo(() => {
    if (miscRuns.length === 0) return 0;
    return Math.max(...miscRuns.map((r) => r.Avg_Speed_kmh));
  }, [miscRuns]);

  const best5kEffort = useMemo(() => {
    const fiveKRuns = miscRuns.filter(
      (r) => r.Total_Distance_km >= 4.5 && r.Total_Distance_km <= 5.5
    );
    if (fiveKRuns.length === 0) return null;
    return fiveKRuns.reduce((prev, curr) => (curr.Avg_Speed_kmh > prev.Avg_Speed_kmh ? curr : prev));
  }, [miscRuns]);

  const avgHRAll = useMemo(() => {
    if (miscRuns.length === 0) return 0;
    return Math.round(miscRuns.reduce((acc, r) => acc + r.Avg_HR, 0) / miscRuns.length);
  }, [miscRuns]);

  // Prepared chart data with continuous linear time scale
  const preparedChartData = useMemo(() => {
    return [...miscRuns]
      .sort((a, b) => new Date(a.Date_Str).getTime() - new Date(b.Date_Str).getTime())
      .map((r) => ({
        ...r,
        timestamp: getTimestamp(r.Date_Str),
        hrrIndex: calculateGenericHRRAerobicIndex(r.Avg_Speed_kmh, r.Avg_HR, restingHR, maxHR),
      }));
  }, [miscRuns, restingHR, maxHR]);

  // Filtered & Sorted Data
  const filteredRuns = useMemo(() => {
    return miscRuns
      .filter((r) => {
        const matchesSearch =
          r.Date_Str.includes(searchTerm) ||
          (r.Workout_Type && r.Workout_Type.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (r.Notes && r.Notes.toLowerCase().includes(searchTerm.toLowerCase()));

        if (filterType === 'all') return matchesSearch;
        return matchesSearch && r.Workout_Type === filterType;
      })
      .sort((a, b) => {
        let valA = a[sortField] || 0;
        let valB = b[sortField] || 0;
        if (sortField === 'Date_Str') {
          valA = new Date(a.Date_Str).getTime();
          valB = new Date(b.Date_Str).getTime();
        }
        if (sortOrder === 'asc') return valA > valB ? 1 : -1;
        return valA < valB ? 1 : -1;
      });
  }, [miscRuns, searchTerm, filterType, sortField, sortOrder]);

  // Scatter chart data
  const chartData = useMemo(() => {
    return miscRuns.map((r) => ({
      x: r.Avg_Speed_kmh,
      y: r.Avg_HR,
      z: r.Total_Distance_km,
      name: `${r.Date_Str} (${r.Workout_Type || 'Run'})`,
      date: r.Date_Str,
      dist: r.Total_Distance_km,
      type: r.Workout_Type || 'Run',
    }));
  }, [miscRuns]);

  // Dynamic workout types present in user data
  const availableWorkoutTypes = useMemo(() => {
    const typesSet = new Set<string>();
    miscRuns.forEach((r) => {
      if (r.Workout_Type) typesSet.add(r.Workout_Type);
    });
    return Array.from(typesSet);
  }, [miscRuns]);

  // Grouped runs by workout type for split table display
  const groupedRuns = useMemo<Record<string, MiscRun[]>>(() => {
    const groups: Record<string, MiscRun[]> = {};
    filteredRuns.forEach((run) => {
      const category = run.Workout_Type || 'General Run';
      if (!groups[category]) groups[category] = [];
      groups[category].push(run);
    });
    return groups;
  }, [filteredRuns]);

  if (miscRuns.length === 0) {
    return (
      <EmptyState
        icon={Layers}
        title="No General Runs Logged"
        message="Tempo efforts, 5K time trials and shakeout runs appear here once imported. Load your Apple Health export or the demo dataset to populate this view."
        accent="purple"
        onOpenAppleHealthModal={onOpenAppleHealthModal}
        onResetData={onResetData}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 sm:p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 sm:p-3 rounded-xl bg-purple-950/80 border border-purple-800 text-purple-400 shrink-0">
            <Layers className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-1.5 flex-wrap">
              <span>General & Non-Zone 2 Running Analysis</span>
              <span className="text-[10px] bg-purple-950 text-purple-300 border border-purple-800 px-2 py-0.5 rounded-full font-semibold">
                Split by Type
              </span>
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-400 leading-tight">
              5K time trials, threshold tempo runs, shakeouts, and race efforts extracted from Apple Health.
            </p>
          </div>
        </div>

        {/* Quick Badges */}
        <div className="flex items-center gap-2 font-mono text-[11px] sm:text-xs">
          <div className="bg-slate-950 border border-slate-800 px-2.5 py-1 rounded-xl text-slate-300">
            <span className="text-slate-500 mr-1">LOGGED:</span>
            <span className="text-white font-bold">{totalRunsCount}</span>
          </div>
          <div className="bg-slate-950 border border-slate-800 px-2.5 py-1 rounded-xl text-slate-300">
            <span className="text-slate-500 mr-1">VOLUME:</span>
            <span className="text-purple-400 font-bold">{totalDistanceKm.toFixed(1)} km</span>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 sm:p-4 space-y-0.5 shadow-md">
          <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 flex items-center gap-1">
            <Zap className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-amber-400" /> TOP SPEED
          </div>
          <div className="text-xl sm:text-2xl font-black text-white font-mono">
            {fastestSpeed.toFixed(1)} <span className="text-xs font-normal text-slate-400">km/h</span>
          </div>
          <div className="text-[10px] text-slate-500 truncate">
            Pace: {Math.floor(60 / (fastestSpeed || 1))}:{String(Math.round((3600 / (fastestSpeed || 1)) % 60)).padStart(2, '0')} /km
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 sm:p-4 space-y-0.5 shadow-md">
          <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 flex items-center gap-1">
            <Flame className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-rose-400" /> BEST 5K TIME
          </div>
          <div className="text-xl sm:text-2xl font-black text-white font-mono">
            {best5kEffort ? (
              `${Math.floor(best5kEffort.Duration_min)}m ${Math.round((best5kEffort.Duration_min % 1) * 60)}s`
            ) : (
              'N/A'
            )}
          </div>
          <div className="text-[10px] text-slate-500 truncate">
            {best5kEffort ? `${best5kEffort.Avg_Speed_kmh} km/h on ${best5kEffort.Date_Str}` : 'No 5K effort logged'}
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 sm:p-4 space-y-0.5 shadow-md">
          <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 flex items-center gap-1">
            <Activity className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-cyan-400" /> AVG HEART RATE
          </div>
          <div className="text-xl sm:text-2xl font-black text-white font-mono">
            {avgHRAll} <span className="text-xs font-normal text-slate-400">bpm</span>
          </div>
          <div className="text-[10px] text-slate-500 truncate">
            High intensity & tempo
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 sm:p-4 space-y-0.5 shadow-md">
          <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 flex items-center gap-1">
            <Gauge className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-emerald-400" /> RACE SIM FEED
          </div>
          <div className="text-xs font-bold text-emerald-400 mt-0.5 truncate">
            Connected to Simulator
          </div>
          <div className="text-[10px] text-slate-400 truncate">
            Informs 5K/10K estimates
          </div>
        </div>
      </div>

      {/* Continuous Time Series Chart: Velocity & HRR Index vs Distance */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 sm:p-5 shadow-xl space-y-2 sm:space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-200 flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-purple-400" />
              <span>General Runs Velocity & HRR Efficiency Timeline</span>
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-400">
              Tracking speed (km/h) and HRR Index normalized by workout distance.
            </p>
          </div>
        </div>

        <div className="h-[280px] sm:h-72 w-full pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={preparedChartData} margin={{ top: 10, right: 8, bottom: 10, left: -22 }}>
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
              <YAxis yAxisId="left" stroke="#c084fc" fontSize={10} tickLine={false} domain={['auto', 'auto']} unit=" km/h" />
              <YAxis yAxisId="right" orientation="right" stroke="#38bdf8" fontSize={10} tickLine={false} domain={['auto', 'auto']} unit=" km" />
              <Tooltip content={<CustomMiscTooltip />} />
              <Legend verticalAlign="top" height={28} wrapperStyle={{ fontSize: '11px', paddingBottom: '4px' }} />
              <Bar yAxisId="right" dataKey="Total_Distance_km" name="Distance (km)" fill="#38bdf8" opacity={0.25} barSize={16} radius={[4, 4, 0, 0]} />
              <Line yAxisId="left" type="monotone" dataKey="Avg_Speed_kmh" name="Avg Speed (km/h)" stroke="#c084fc" strokeWidth={2.5} dot={{ r: 3 }} />
              <Line yAxisId="left" type="monotone" dataKey="hrrIndex" name="HRR Index" stroke="#34d399" strokeWidth={1.8} strokeDasharray="4 4" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Controls & Search */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-md flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search Input */}
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search date, type or notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Filter Type */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl text-xs text-slate-300">
            <Filter className="h-3.5 w-3.5 text-purple-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-transparent text-white focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-slate-900 text-white">All Workout Types</option>
              {availableWorkoutTypes.map((t) => (
                <option key={t} value={t} className="bg-slate-900 text-white">
                  {t}
                </option>
              ))}
              {!availableWorkoutTypes.includes('5K Effort') && (
                <option value="5K Effort" className="bg-slate-900 text-white">5K Effort</option>
              )}
              {!availableWorkoutTypes.includes('Tempo / Threshold') && (
                <option value="Tempo / Threshold" className="bg-slate-900 text-white">Tempo / Threshold</option>
              )}
            </select>
          </div>
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">Sort:</span>
          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value as any)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white focus:outline-none"
          >
            <option value="Date_Str">Date</option>
            <option value="Avg_Speed_kmh">Speed</option>
            <option value="Total_Distance_km">Distance</option>
            <option value="Avg_HR">Heart Rate</option>
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="p-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 hover:text-white"
          >
            <ArrowUpDown className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Split Tables per Workout Type */}
      {Object.keys(groupedRuns).length === 0 ? (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-8 text-center text-slate-500 font-sans text-xs">
          No matching general or non-Zone 2 runs found.
        </div>
      ) : (
        <div className="space-y-6">
          {(Object.entries(groupedRuns) as [string, MiscRun[]][]).map(([typeKey, runs]) => {
            const groupTotalKm = runs.reduce((acc, r) => acc + r.Total_Distance_km, 0);
            const groupBestSpeed = Math.max(...runs.map((r) => r.Avg_Speed_kmh));

            return (
              <div key={typeKey} className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden space-y-0">
                {/* Section Header */}
                <div className="bg-slate-950/90 px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-950 text-purple-300 border border-purple-800">
                      {typeKey}
                    </span>
                    <span className="text-xs text-slate-400 font-medium font-mono">
                      ({runs.length} {runs.length === 1 ? 'workout' : 'workouts'})
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-mono">
                    <span className="text-slate-400">
                      Volume: <strong className="text-purple-300">{groupTotalKm.toFixed(1)} km</strong>
                    </span>
                    <span className="text-slate-400">
                      Top Speed: <strong className="text-emerald-300">{groupBestSpeed.toFixed(1)} km/h</strong>
                    </span>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950/50 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800/80">
                      <tr>
                        <th className="py-2.5 px-4">Date</th>
                        <th className="py-2.5 px-4">Distance</th>
                        <th className="py-2.5 px-4">Duration</th>
                        <th className="py-2.5 px-4">Avg Speed</th>
                        <th className="py-2.5 px-4">Avg Pace</th>
                        <th className="py-2.5 px-4">Avg HR</th>
                        <th className="py-2.5 px-4">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                      {runs.map((run, idx) => {
                        const paceMin = Math.floor(60 / run.Avg_Speed_kmh);
                        const paceSec = Math.round((3600 / run.Avg_Speed_kmh) % 60);
                        const paceStr = `${paceMin}:${paceSec < 10 ? '0' + paceSec : paceSec} /km`;

                        return (
                          <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-2.5 px-4 font-bold text-white whitespace-nowrap">
                              {run.Date_Str}
                            </td>
                            <td className="py-2.5 px-4 font-bold text-purple-300 whitespace-nowrap">
                              {run.Total_Distance_km.toFixed(1)} km
                            </td>
                            <td className="py-2.5 px-4 whitespace-nowrap">
                              {run.Duration_min.toFixed(1)} min
                            </td>
                            <td className="py-2.5 px-4 font-bold text-white whitespace-nowrap">
                              {run.Avg_Speed_kmh.toFixed(1)} km/h
                            </td>
                            <td className="py-2.5 px-4 text-cyan-300 whitespace-nowrap">
                              {paceStr}
                            </td>
                            <td className="py-2.5 px-4 text-rose-300 whitespace-nowrap">
                              {run.Avg_HR} bpm
                            </td>
                            <td className="py-2.5 px-4 text-slate-400 font-sans max-w-xs truncate">
                              {run.Notes || '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
