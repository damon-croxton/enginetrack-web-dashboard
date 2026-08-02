import React, { useState, useEffect, useMemo } from 'react';
import { Zone2Run, Zone2SortField, SortOrder } from '../types';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Area,
  AreaChart,
} from 'recharts';
import {
  TrendingUp,
  Heart,
  Zap,
  MapPin,
  Clock,
  ArrowUpDown,
  Search,
  CheckCircle2,
  HelpCircle,
  BarChart3,
  Sparkles,
  Sliders,
  Award,
  Info,
  RotateCcw,
  UploadCloud,
  Layers,
  Activity,
  Flame
} from 'lucide-react';
import {
  getTimestamp,
  calculateNonLinearAPI,
  calculateEfficiencyFactor,
  calculateHRRAerobicIndex,
  DEFAULT_PHYSIOLOGY
} from '../utils/cardioMetrics';

interface Zone2ViewProps {
  runs: Zone2Run[];
  onOpenInfoModal: () => void;
  onResetData?: () => void;
  onOpenAppleHealthModal?: () => void;
  restingHR?: number;
  maxHR?: number;
}

export type Zone2GraphMode = 'hrr_scientific' | 'nonlinear' | 'efficiency_factor' | 'baseline_linear' | 'cumulative_volume';

export const Zone2View: React.FC<Zone2ViewProps> = ({
  runs,
  onOpenInfoModal,
  onResetData,
  onOpenAppleHealthModal,
  restingHR: propRestingHR,
  maxHR: propMaxHR,
}) => {
  const [sortField, setSortField] = useState<Zone2SortField>('Date_Str');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [graphMode, setGraphMode] = useState<Zone2GraphMode>('hrr_scientific');
  const [restingHR, setRestingHR] = useState<number>(propRestingHR || DEFAULT_PHYSIOLOGY.restingHR);
  const [maxHR, setMaxHR] = useState<number>(propMaxHR || DEFAULT_PHYSIOLOGY.maxHR);

  useEffect(() => {
    if (propRestingHR) setRestingHR(propRestingHR);
  }, [propRestingHR]);

  useEffect(() => {
    if (propMaxHR) setMaxHR(propMaxHR);
  }, [propMaxHR]);

  // Prepare chart data with timestamps for continuous linear time scaling on XAxis
  const preparedRuns = useMemo(() => {
    let cumKm = 0;
    return [...runs]
      .sort((a, b) => new Date(a.Date_Str).getTime() - new Date(b.Date_Str).getTime())
      .map((run) => {
        cumKm += run.Total_Distance_km;
        const nonLinear = calculateNonLinearAPI(run, restingHR);
        const ef = calculateEfficiencyFactor(run);
        const hrr = calculateHRRAerobicIndex(run, restingHR, maxHR);
        const paceMinKm = run.Avg_Speed_kmh > 0 ? 60 / run.Avg_Speed_kmh : 0;

        return {
          ...run,
          timestamp: getTimestamp(run.Date_Str),
          nonLinearAPI: nonLinear,
          efficiencyFactor: ef,
          hrrIndex: hrr,
          cumKm: Number(cumKm.toFixed(1)),
          paceMinKm: Number(paceMinKm.toFixed(2)),
        };
      });
  }, [runs, restingHR, maxHR]);

  const latestRun = preparedRuns[preparedRuns.length - 1];
  const firstRun = preparedRuns[0];

  // Progression calculations for primary display
  const latestAPI = latestRun ? latestRun.Aerobic_Power_Index : 0;
  const latestNonLinear = latestRun ? latestRun.nonLinearAPI : 0;
  const firstNonLinear = firstRun ? firstRun.nonLinearAPI : 0;
  const nonLinearDelta = firstRun && latestRun && firstNonLinear > 0
    ? (((latestNonLinear - firstNonLinear) / firstNonLinear) * 100).toFixed(1)
    : '0';

  const apiDelta = firstRun && latestRun && firstRun.Aerobic_Power_Index > 0
    ? (((latestRun.Aerobic_Power_Index - firstRun.Aerobic_Power_Index) / firstRun.Aerobic_Power_Index) * 100).toFixed(1)
    : '0';

  const hrDelta = firstRun && latestRun
    ? latestRun.Avg_HR - firstRun.Avg_HR
    : 0;

  const totalKm = useMemo(() => {
    return runs.reduce((acc, r) => acc + r.Total_Distance_km, 0).toFixed(1);
  }, [runs]);

  // Table filtering and sorting
  const filteredAndSortedRuns = useMemo(() => {
    let filtered = runs.filter((run) => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        run.Date_Str.includes(term) ||
        run.Aerobic_Power_Index.toString().includes(term) ||
        run.Total_Distance_km.toString().includes(term) ||
        run.Avg_HR.toString().includes(term)
      );
    });

    return filtered.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === 'Date_Str') {
        valA = new Date(valA).getTime();
        valB = new Date(valB).getTime();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [runs, sortField, sortOrder, searchTerm]);

  const toggleSort = (field: Zone2SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Custom Chart Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 border border-slate-700 p-3.5 rounded-xl shadow-xl text-xs space-y-2 min-w-[220px]">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-bold text-white text-sm">{data.Date_Str}</span>
            <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-950 text-cyan-400 font-semibold border border-cyan-800">
              Zone 2 Run
            </span>
          </div>
          <div className="space-y-1.5 pt-1 font-mono">
            <div className="flex justify-between items-center text-cyan-400">
              <span className="flex items-center gap-1 font-sans font-medium">
                <Zap className="h-3.5 w-3.5" /> Non-Linear API:
              </span>
              <span className="font-bold text-sm">{data.nonLinearAPI}</span>
            </div>
            <div className="flex justify-between items-center text-emerald-400">
              <span className="flex items-center gap-1 font-sans font-medium">
                <Award className="h-3.5 w-3.5" /> Scientific HRR Index:
              </span>
              <span className="font-bold">{data.hrrIndex}</span>
            </div>
            <div className="flex justify-between items-center text-amber-300">
              <span className="flex items-center gap-1 font-sans font-medium">
                <BarChart3 className="h-3.5 w-3.5" /> Efficiency Factor:
              </span>
              <span className="font-bold">{data.efficiencyFactor}</span>
            </div>
            <div className="flex justify-between items-center text-blue-400">
              <span className="flex items-center gap-1 font-sans font-medium">
                <MapPin className="h-3.5 w-3.5" /> Distance:
              </span>
              <span className="font-bold">{data.Total_Distance_km} km</span>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span className="flex items-center gap-1 font-sans">
                <Heart className="h-3.5 w-3.5 text-rose-400" /> Avg Heart Rate:
              </span>
              <span>{data.Avg_HR} bpm</span>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span className="flex items-center gap-1 font-sans">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-400" /> Speed:
              </span>
              <span>{data.Avg_Speed_kmh} km/h</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // EMPTY STATE
  if (!runs || runs.length === 0) {
    return (
      <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-8 sm:p-12 text-center max-w-2xl mx-auto my-12 space-y-6 shadow-2xl">
        <div className="w-16 h-16 bg-cyan-950/80 text-cyan-400 border border-cyan-800/80 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
          <Activity className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-white">No Zone 2 Workouts Logged</h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
            Your Zone 2 dashboard is currently empty. Import your Apple Health <code className="bg-slate-950 text-cyan-300 px-1.5 py-0.5 rounded border border-slate-800">export.xml</code> file or load the demo sample dataset to visualize your aerobic engine!
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          {onOpenAppleHealthModal && (
            <button
              onClick={onOpenAppleHealthModal}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/50 transition-all"
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
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-700/80 rounded-2xl p-3.5 sm:p-5 shadow-lg relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-1 max-w-3xl">
            <div className="flex items-center gap-1.5 text-cyan-400 font-semibold text-[10px] sm:text-xs tracking-wider uppercase">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Zone 2 Cardiovascular Aerobic Engine</span>
            </div>
            <h2 className="text-base sm:text-xl font-bold text-white">
              Aerobic Power & Efficiency Progression
            </h2>
            <p className="text-[11px] sm:text-sm text-slate-300 leading-snug">
              Explore exercise physiology models below. Non-linear and HRR models correctly account for cardiac reserve and stroke volume growth!
            </p>
          </div>
          <button
            onClick={onOpenInfoModal}
            className="self-start md:self-center flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-[11px] sm:text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-cyan-300 transition-all shrink-0"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            <span>Formula Details</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        {/* KPI 1: Non-Linear Active Cardiac Efficiency */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-3 sm:p-5 shadow-lg relative overflow-hidden group hover:border-cyan-500/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400 line-clamp-1">
              Active Index
            </span>
            <div className="p-1.5 sm:p-2 rounded-xl bg-cyan-950/60 text-cyan-400 border border-cyan-800/60 shrink-0">
              <Zap className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-3xl font-extrabold text-white font-mono tracking-tight">
              {latestNonLinear}
            </span>
            <span className="text-[10px] sm:text-xs text-slate-400">Score</span>
          </div>
          <div className="mt-1.5 sm:mt-3 flex items-center gap-1 text-[10px] sm:text-xs text-emerald-400 font-medium">
            <TrendingUp className="h-3.5 w-3.5" />
            <span>+{nonLinearDelta}% growth</span>
          </div>
        </div>

        {/* KPI 2: Scientific Gold-Standard HRR Index */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-3 sm:p-5 shadow-lg relative overflow-hidden group hover:border-emerald-500/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400 line-clamp-1">
              HRR Index
            </span>
            <div className="p-1.5 sm:p-2 rounded-xl bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 shrink-0">
              <Award className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-3xl font-extrabold text-white font-mono tracking-tight">
              {latestRun?.hrrIndex || 0}
            </span>
            <span className="text-[10px] sm:text-xs text-slate-400">eW / %HRR</span>
          </div>
          <div className="mt-1.5 sm:mt-3 flex items-center gap-1 text-[10px] sm:text-xs text-emerald-400 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            <span>Physio Normalized</span>
          </div>
        </div>

        {/* KPI 3: Latest Avg Heart Rate */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-3 sm:p-5 shadow-lg relative overflow-hidden group hover:border-rose-500/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400 line-clamp-1">
              Latest Avg HR
            </span>
            <div className="p-1.5 sm:p-2 rounded-xl bg-rose-950/60 text-rose-400 border border-rose-800/60 shrink-0">
              <Heart className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-3xl font-extrabold text-white font-mono tracking-tight">
              {latestRun?.Avg_HR || 0}
            </span>
            <span className="text-[10px] sm:text-xs text-slate-400">bpm</span>
          </div>
          <div className="mt-1.5 sm:mt-3 flex items-center gap-1 text-[10px] sm:text-xs text-slate-300">
            <span className="text-emerald-400 font-semibold">{hrDelta <= 0 ? `${hrDelta} bpm` : `+${hrDelta} bpm`}</span>
            <span className="text-slate-400">from baseline</span>
          </div>
        </div>

        {/* KPI 4: Cumulative Zone 2 Distance */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-3 sm:p-5 shadow-lg relative overflow-hidden group hover:border-blue-500/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400 line-clamp-1">
              Total Distance
            </span>
            <div className="p-1.5 sm:p-2 rounded-xl bg-blue-950/60 text-blue-400 border border-blue-800/60 shrink-0">
              <MapPin className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-3xl font-extrabold text-white font-mono tracking-tight">
              {totalKm}
            </span>
            <span className="text-[10px] sm:text-xs text-slate-400">km</span>
          </div>
          <div className="mt-1.5 sm:mt-3 flex items-center gap-1 text-[10px] sm:text-xs text-slate-400">
            <CheckCircle2 className="h-3.5 w-3.5 text-blue-400" />
            <span>Across {runs.length} runs</span>
          </div>
        </div>
      </div>

      {/* GRAPH MODE SELECTOR & CUSTOM PHYSIOLOGY BAR */}
      <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-3 sm:p-6 shadow-xl space-y-3 sm:space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-700/60 pb-3 sm:pb-5">
          <div className="space-y-0.5">
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-1.5">
              <Sliders className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-400" />
              <span>Select Aerobic Graph Mode</span>
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-400">
              Choose analytical perspective. Continuous linear calendar time on X-Axis.
            </p>
          </div>

          {/* Mode Switcher Buttons */}
          <div className="flex flex-wrap items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setGraphMode('hrr_scientific')}
              className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold transition-all ${
                graphMode === 'hrr_scientific'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              Scientific HRR
            </button>
            <button
              onClick={() => setGraphMode('nonlinear')}
              className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold transition-all ${
                graphMode === 'nonlinear'
                  ? 'bg-cyan-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              Non-Linear Active
            </button>
            <button
              onClick={() => setGraphMode('efficiency_factor')}
              className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold transition-all ${
                graphMode === 'efficiency_factor'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              Efficiency Factor
            </button>
            <button
              onClick={() => setGraphMode('baseline_linear')}
              className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold transition-all ${
                graphMode === 'baseline_linear'
                  ? 'bg-blue-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              Baseline Linear
            </button>
            <button
              onClick={() => setGraphMode('cumulative_volume')}
              className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold transition-all ${
                graphMode === 'cumulative_volume'
                  ? 'bg-purple-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              Cumulative Mileage
            </button>
          </div>
        </div>

        {/* Physiology Parameter Adjuster (for Non-Linear & HRR models) */}
        {(graphMode === 'nonlinear' || graphMode === 'hrr_scientific') && (
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2.5 sm:p-3.5 flex flex-wrap items-center justify-between gap-2 sm:gap-4 text-xs">
            <div className="flex items-center gap-1.5 text-slate-300 font-medium text-[11px] sm:text-xs">
              <Info className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
              <span>Personal Baseline Parameters:</span>
            </div>
            <div className="flex items-center gap-3 font-mono text-[11px] sm:text-xs">
              <label className="flex items-center gap-1.5 text-slate-400">
                Rest HR:
                <input
                  type="number"
                  min="35"
                  max="80"
                  value={restingHR}
                  onChange={(e) => setRestingHR(Number(e.target.value) || 55)}
                  className="w-12 sm:w-16 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-white text-center font-bold focus:ring-1 focus:ring-cyan-500 text-xs"
                />
                <span className="text-[10px]">bpm</span>
              </label>
              <label className="flex items-center gap-1.5 text-slate-400">
                Max HR:
                <input
                  type="number"
                  min="150"
                  max="220"
                  value={maxHR}
                  onChange={(e) => setMaxHR(Number(e.target.value) || 188)}
                  className="w-12 sm:w-16 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-white text-center font-bold focus:ring-1 focus:ring-cyan-500 text-xs"
                />
                <span className="text-[10px]">bpm</span>
              </label>
            </div>
          </div>
        )}

        {/* MAIN DISPLAY GRAPH (CONTINUOUS LINEAR TIME AXIS) */}
        <div className="h-[300px] sm:h-96 w-full pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={preparedRuns}
              margin={{ top: 10, right: 8, left: -22, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorDistFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorCumFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a855f7" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />

              {/* Continuous Linear Time XAxis */}
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

              {/* MODE 1: NON-LINEAR MOTIVATIONAL */}
              {graphMode === 'nonlinear' && (
                <>
                  <YAxis
                    yAxisId="left"
                    stroke="#22d3ee"
                    fontSize={11}
                    domain={['auto', 'auto']}
                    tickLine={false}
                    axisLine={{ stroke: '#0891b2' }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#60a5fa"
                    fontSize={11}
                    domain={[0, 'auto']}
                    tickLine={false}
                    axisLine={{ stroke: '#2563eb' }}
                    unit=" km"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar
                    yAxisId="right"
                    dataKey="Total_Distance_km"
                    name="Run Distance (km)"
                    fill="url(#colorDistFill)"
                    stroke="#3b82f6"
                    radius={[6, 6, 0, 0]}
                    barSize={16}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="nonLinearAPI"
                    name="Non-Linear Active Cardiac Index"
                    stroke="#22d3ee"
                    strokeWidth={3}
                    dot={{ r: 5, fill: '#0891b2', stroke: '#22d3ee', strokeWidth: 2 }}
                    activeDot={{ r: 8, fill: '#22d3ee', stroke: '#ffffff', strokeWidth: 2 }}
                  />
                </>
              )}

              {/* MODE 2: HRR SCIENTIFIC MODEL */}
              {graphMode === 'hrr_scientific' && (
                <>
                  <YAxis
                    yAxisId="left"
                    stroke="#10b981"
                    fontSize={11}
                    domain={['auto', 'auto']}
                    tickLine={false}
                    axisLine={{ stroke: '#059669' }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#60a5fa"
                    fontSize={11}
                    domain={[0, 'auto']}
                    tickLine={false}
                    axisLine={{ stroke: '#2563eb' }}
                    unit=" km"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar
                    yAxisId="right"
                    dataKey="Total_Distance_km"
                    name="Run Distance (km)"
                    fill="url(#colorDistFill)"
                    stroke="#3b82f6"
                    radius={[6, 6, 0, 0]}
                    barSize={16}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="hrrIndex"
                    name="Scientific HRR Index"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={{ r: 5, fill: '#047857', stroke: '#10b981', strokeWidth: 2 }}
                    activeDot={{ r: 8, fill: '#10b981', stroke: '#ffffff', strokeWidth: 2 }}
                  />
                </>
              )}

              {/* MODE 3: EFFICIENCY FACTOR */}
              {graphMode === 'efficiency_factor' && (
                <>
                  <YAxis
                    yAxisId="left"
                    stroke="#f59e0b"
                    fontSize={11}
                    domain={['auto', 'auto']}
                    tickLine={false}
                    axisLine={{ stroke: '#d97706' }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#f43f5e"
                    fontSize={11}
                    domain={['auto', 'auto']}
                    tickLine={false}
                    axisLine={{ stroke: '#e11d48' }}
                    unit=" bpm"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="Avg_HR"
                    name="Avg Heart Rate"
                    stroke="#f43f5e"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={{ r: 3, fill: '#be123c' }}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="efficiencyFactor"
                    name="Efficiency Factor (Speed/HR)"
                    stroke="#f59e0b"
                    strokeWidth={3}
                    dot={{ r: 5, fill: '#b45309', stroke: '#f59e0b', strokeWidth: 2 }}
                  />
                </>
              )}

              {/* MODE 4: BASELINE LINEAR API */}
              {graphMode === 'baseline_linear' && (
                <>
                  <YAxis
                    yAxisId="left"
                    stroke="#3b82f6"
                    fontSize={11}
                    domain={['auto', 'auto']}
                    tickLine={false}
                    axisLine={{ stroke: '#2563eb' }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#60a5fa"
                    fontSize={11}
                    domain={[0, 'auto']}
                    tickLine={false}
                    axisLine={{ stroke: '#2563eb' }}
                    unit=" km"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar
                    yAxisId="right"
                    dataKey="Total_Distance_km"
                    name="Total Distance (km)"
                    fill="url(#colorDistFill)"
                    stroke="#3b82f6"
                    radius={[6, 6, 0, 0]}
                    barSize={16}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="Aerobic_Power_Index"
                    name="Baseline Linear API"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    dot={{ r: 5, fill: '#1d4ed8', stroke: '#3b82f6', strokeWidth: 2 }}
                  />
                </>
              )}

              {/* MODE 5: CUMULATIVE VOLUME */}
              {graphMode === 'cumulative_volume' && (
                <>
                  <YAxis
                    yAxisId="left"
                    stroke="#c084fc"
                    fontSize={11}
                    domain={[0, 'auto']}
                    tickLine={false}
                    axisLine={{ stroke: '#9333ea' }}
                    unit=" km"
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#22d3ee"
                    fontSize={11}
                    domain={['auto', 'auto']}
                    tickLine={false}
                    axisLine={{ stroke: '#0891b2' }}
                    unit=" km/h"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="cumKm"
                    name="Cumulative Distance (km)"
                    fill="url(#colorCumFill)"
                    stroke="#a855f7"
                    strokeWidth={2}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="Avg_Speed_kmh"
                    name="Avg Speed (km/h)"
                    stroke="#22d3ee"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#0891b2' }}
                  />
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* FORMULA INSIGHT EXPLANATION CARD */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 text-xs space-y-2">
          <div className="flex items-center gap-2 font-bold text-cyan-300">
            <Sparkles className="h-4 w-4 text-cyan-400" />
            <span>Why formulas behave differently & what this graph tells you:</span>
          </div>
          {graphMode === 'nonlinear' && (
            <p className="text-slate-300 leading-relaxed">
              <strong>Non-Linear Active Cardiac Effort Index:</strong> By subtracting your resting heart rate ({restingHR} bpm), this formula isolates net active cardiac effort: eW / (HR - HR_rest)^0.65. Because heart rate does not drop linearly at low speeds, this curve reveals your real stroke volume gains and mitochondrial density growth over time!
            </p>
          )}
          {graphMode === 'hrr_scientific' && (
            <p className="text-slate-300 leading-relaxed">
              <strong>Scientific Heart Rate Reserve (HRR) Model:</strong> Normalizes mechanical power output against percentage of Heart Rate Reserve: %HRR = (HR_avg - HR_rest) / (HR_max - HR_rest). This is the gold standard in exercise physiology for comparing cardiorespiratory fitness across varying thermal or terrain conditions.
            </p>
          )}
          {graphMode === 'efficiency_factor' && (
            <p className="text-slate-300 leading-relaxed">
              <strong>Efficiency Factor (EF):</strong> Standardized ratio of velocity (km/h) to heart rate (BPM). An increasing trend shows that your heart beats fewer times to move your body across the same distance.
            </p>
          )}
          {graphMode === 'baseline_linear' && (
            <p className="text-slate-300 leading-relaxed">
              <strong>Baseline Linear API:</strong> The classic ratio (eW / HR) * 1000. Note: On longer or hotter runs where pace drops slightly while heart rate stays fixed at Zone 2 ceiling, linear ratios can appear flat or slightly dip. Switch to Non-Linear or HRR mode above to see net cardiac adaptation.
            </p>
          )}
          {graphMode === 'cumulative_volume' && (
            <p className="text-slate-300 leading-relaxed">
              <strong>Cumulative Endurance Mileage:</strong> Aerobic adaptations (capillaries, mitochondrial biogenesis, stroke volume) are driven by cumulative volume logged over time.
            </p>
          )}
        </div>
      </div>

      {/* Data Table Section */}
      <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white">Zone 2 Run Log & Multi-Model Metrics</h3>
            <p className="text-xs text-slate-400">Detailed record of individual aerobic runs and computed indexes</p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search date or metric..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-700/80">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900/90 text-slate-300 font-semibold border-b border-slate-700">
                <th
                  onClick={() => toggleSort('Date_Str')}
                  className="py-3 px-4 cursor-pointer hover:text-cyan-400 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Date</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-500" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('Total_Distance_km')}
                  className="py-3 px-4 cursor-pointer hover:text-cyan-400 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Distance (km)</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-500" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('Avg_Speed_kmh')}
                  className="py-3 px-4 cursor-pointer hover:text-cyan-400 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Avg Speed</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-500" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('Avg_HR')}
                  className="py-3 px-4 cursor-pointer hover:text-cyan-400 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Avg HR</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-500" />
                  </div>
                </th>
                <th className="py-3 px-4 text-cyan-300 font-bold">
                  Non-Linear Index
                </th>
                <th className="py-3 px-4 text-emerald-300 font-bold">
                  HRR Scientific
                </th>
                <th
                  onClick={() => toggleSort('Aerobic_Power_Index')}
                  className="py-3 px-4 cursor-pointer hover:text-cyan-400 transition-colors text-right"
                >
                  <div className="flex items-center justify-end gap-1.5 text-blue-400 font-bold">
                    <span>Baseline API</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60 font-mono text-slate-300">
              {filteredAndSortedRuns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No runs found matching query.
                  </td>
                </tr>
              ) : (
                filteredAndSortedRuns.map((run, idx) => {
                  const nonLinear = calculateNonLinearAPI(run, restingHR);
                  const hrrVal = calculateHRRAerobicIndex(run, restingHR, maxHR);
                  const isTopAPI = run.Aerobic_Power_Index === Math.max(...runs.map((r) => r.Aerobic_Power_Index));

                  return (
                    <tr
                      key={run.Date_Str + idx}
                      className="hover:bg-slate-700/40 transition-colors"
                    >
                      <td className="py-3 px-4 font-sans font-medium text-white flex items-center gap-2">
                        <span>{run.Date_Str}</span>
                        {isTopAPI && (
                          <span className="px-1.5 py-0.5 text-[9px] font-sans font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded">
                            PR
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">{run.Total_Distance_km} km ({run.Duration_min}m)</td>
                      <td className="py-3 px-4 text-slate-200">{run.Avg_Speed_kmh} km/h</td>
                      <td className="py-3 px-4">
                        <span className="text-rose-400 font-semibold">{run.Avg_HR}</span> bpm
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-cyan-300 font-bold">{nonLinear}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-emerald-400 font-bold">{hrrVal}</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="inline-block px-2.5 py-1 rounded-lg bg-blue-950/80 text-blue-300 border border-blue-800 font-bold">
                          {run.Aerobic_Power_Index.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
