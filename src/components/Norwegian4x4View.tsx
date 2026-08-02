import React, { useState, useMemo } from 'react';
import { Norwegian4x4Session } from '../types';
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
} from 'recharts';
import {
  Flame,
  Heart,
  Gauge,
  MapPin,
  ChevronDown,
  ChevronUp,
  Activity,
  Award,
  Zap,
  Layers,
  HelpCircle,
  Sliders,
  Sparkles,
  UploadCloud,
  RotateCcw,
  CheckCircle2,
  TrendingUp,
  BarChart3
} from 'lucide-react';
import {
  getTimestamp,
  calculate4x4WorkEfficiency,
  calculate4x4WorkPowerScore
} from '../utils/cardioMetrics';

interface Norwegian4x4ViewProps {
  sessions: Norwegian4x4Session[];
  onOpenInfoModal: () => void;
  onResetData?: () => void;
  onOpenAppleHealthModal?: () => void;
}

export type NorwegianGraphMode = 'work_distance_speed' | 'peak_speed_progression' | 'work_efficiency' | 'work_power_score';

export const Norwegian4x4View: React.FC<Norwegian4x4ViewProps> = ({
  sessions,
  onOpenInfoModal,
  onResetData,
  onOpenAppleHealthModal,
}) => {
  const [graphMode, setGraphMode] = useState<NorwegianGraphMode>('work_distance_speed');

  // Prepare session data with timestamps for continuous linear time axis
  const preparedSessions = useMemo(() => {
    return [...sessions]
      .sort((a, b) => new Date(a.Date_Str).getTime() - new Date(b.Date_Str).getTime())
      .map((session) => {
        const eff = calculate4x4WorkEfficiency(session);
        const powerScore = calculate4x4WorkPowerScore(session);

        return {
          ...session,
          timestamp: getTimestamp(session.Date_Str),
          workEfficiency: eff,
          workPowerScore: powerScore,
        };
      });
  }, [sessions]);

  // Keep track of open accordions
  const [openSessionIndex, setOpenSessionIndex] = useState<number | null>(preparedSessions.length - 1);

  const toggleAccordion = (idx: number) => {
    setOpenSessionIndex(openSessionIndex === idx ? null : idx);
  };

  // Latest Session & Overall Peak Calculations
  const latestSession = preparedSessions[preparedSessions.length - 1];
  const peakSpeedOverall = useMemo(() => {
    if (!sessions.length) return 0;
    return Math.max(...sessions.map((s) => s.Peak_Interval_Speed));
  }, [sessions]);

  const totalWorkKmOverall = useMemo(() => {
    return sessions.reduce((acc, s) => acc + s.Total_Work_Distance_km, 0).toFixed(2);
  }, [sessions]);

  // Custom Recharts Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 border border-slate-700 p-3.5 rounded-xl shadow-xl text-xs space-y-2 min-w-[220px]">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-bold text-white text-sm">{data.Date_Str}</span>
            <span className="px-2 py-0.5 rounded text-[10px] bg-rose-950 text-rose-400 font-semibold border border-rose-800">
              Norwegian 4x4
            </span>
          </div>
          <div className="space-y-1.5 pt-1 font-mono">
            <div className="flex justify-between items-center text-cyan-400">
              <span className="flex items-center gap-1 font-sans font-medium">
                <MapPin className="h-3.5 w-3.5" /> Active Work Distance:
              </span>
              <span className="font-bold text-sm">{data.Total_Work_Distance_km} km</span>
            </div>
            <div className="flex justify-between items-center text-amber-400">
              <span className="flex items-center gap-1 font-sans font-medium">
                <Gauge className="h-3.5 w-3.5" /> Peak Interval Speed:
              </span>
              <span className="font-bold">{data.Peak_Interval_Speed} km/h</span>
            </div>
            <div className="flex justify-between items-center text-slate-200">
              <span className="flex items-center gap-1 font-sans">
                <TrendingUp className="h-3.5 w-3.5 text-slate-400" /> Avg Work Speed:
              </span>
              <span>{data.Avg_Speed_kmh} km/h</span>
            </div>
            <div className="flex justify-between items-center text-rose-400">
              <span className="flex items-center gap-1 font-sans">
                <Heart className="h-3.5 w-3.5 text-rose-400" /> Avg Work HR:
              </span>
              <span>{data.Avg_Work_HR} bpm</span>
            </div>
            <div className="flex justify-between items-center text-emerald-400">
              <span className="flex items-center gap-1 font-sans">
                <Zap className="h-3.5 w-3.5 text-emerald-400" /> Work Capacity:
              </span>
              <span>{data.workEfficiency}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // EMPTY STATE
  if (!sessions || sessions.length === 0) {
    return (
      <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-8 sm:p-12 text-center max-w-2xl mx-auto my-12 space-y-6 shadow-2xl">
        <div className="w-16 h-16 bg-rose-950/80 text-rose-400 border border-rose-800/80 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
          <Flame className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-white">No Norwegian 4x4 Sessions Logged</h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
            Your high-intensity interval dashboard is currently empty. Import your Apple Health <code className="bg-slate-950 text-rose-300 px-1.5 py-0.5 rounded border border-slate-800">export.xml</code> file or load the demo sample dataset to track your 4x4 work intervals!
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          {onOpenAppleHealthModal && (
            <button
              onClick={onOpenAppleHealthModal}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-950/50 transition-all"
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
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-1 max-w-3xl">
            <div className="flex items-center gap-1.5 text-rose-400 font-semibold text-[10px] sm:text-xs tracking-wider uppercase">
              <Flame className="h-3.5 w-3.5" />
              <span>Norwegian 4x4 Performance Engine</span>
            </div>
            <h2 className="text-base sm:text-xl font-bold text-white">
              Work Interval Output & Pace Progression
            </h2>
            <p className="text-[11px] sm:text-sm text-slate-300 leading-snug">
              Adaptation is measured by increasing active work distance and interval speeds covered during 4-minute work blocks!
            </p>
          </div>
          <button
            onClick={onOpenInfoModal}
            className="self-start md:self-center flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-[11px] sm:text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-rose-300 transition-all shrink-0"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            <span>Protocol Science</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        {/* KPI 1: Active Work Distance */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-3 sm:p-5 shadow-lg relative overflow-hidden group hover:border-cyan-500/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400 line-clamp-1">
              Work Distance
            </span>
            <div className="p-1.5 sm:p-2 rounded-xl bg-cyan-950/60 text-cyan-400 border border-cyan-800/60 shrink-0">
              <MapPin className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-3xl font-extrabold text-white font-mono tracking-tight">
              {latestSession?.Total_Work_Distance_km || 0}
            </span>
            <span className="text-[10px] sm:text-xs text-slate-400">km</span>
          </div>
          <div className="mt-1.5 sm:mt-3 flex items-center gap-1 text-[10px] sm:text-xs text-cyan-400 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Total: {totalWorkKmOverall} km</span>
          </div>
        </div>

        {/* KPI 2: Peak Interval Speed */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-3 sm:p-5 shadow-lg relative overflow-hidden group hover:border-amber-500/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400 line-clamp-1">
              Peak Speed
            </span>
            <div className="p-1.5 sm:p-2 rounded-xl bg-amber-950/60 text-amber-400 border border-amber-800/60 shrink-0">
              <Gauge className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-3xl font-extrabold text-white font-mono tracking-tight">
              {latestSession?.Peak_Interval_Speed || 0}
            </span>
            <span className="text-[10px] sm:text-xs text-slate-400">km/h</span>
          </div>
          <div className="mt-1.5 sm:mt-3 flex items-center gap-1 text-[10px] sm:text-xs text-amber-400 font-medium">
            <Award className="h-3.5 w-3.5" />
            <span>Best: {peakSpeedOverall} km/h</span>
          </div>
        </div>

        {/* KPI 3: Avg Work Heart Rate */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-3 sm:p-5 shadow-lg relative overflow-hidden group hover:border-rose-500/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400 line-clamp-1">
              Avg Work HR
            </span>
            <div className="p-1.5 sm:p-2 rounded-xl bg-rose-950/60 text-rose-400 border border-rose-800/60 shrink-0">
              <Heart className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-3xl font-extrabold text-white font-mono tracking-tight">
              {latestSession?.Avg_Work_HR || 0}
            </span>
            <span className="text-[10px] sm:text-xs text-slate-400">bpm</span>
          </div>
          <div className="mt-1.5 sm:mt-3 flex items-center gap-1 text-[10px] sm:text-xs text-slate-300">
            <span>Peak: <strong className="text-rose-400">{latestSession?.Peak_Interval_HR || 0} bpm</strong></span>
          </div>
        </div>

        {/* KPI 4: Work Interval Capacity */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-3 sm:p-5 shadow-lg relative overflow-hidden group hover:border-emerald-500/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400 line-clamp-1">
              Capacity Index
            </span>
            <div className="p-1.5 sm:p-2 rounded-xl bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 shrink-0">
              <Zap className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-3xl font-extrabold text-white font-mono tracking-tight">
              {latestSession?.workEfficiency || 0}
            </span>
            <span className="text-[10px] sm:text-xs text-slate-400">Score</span>
          </div>
          <div className="mt-1.5 sm:mt-3 flex items-center gap-1 text-[10px] sm:text-xs text-emerald-400 font-medium">
            <TrendingUp className="h-3.5 w-3.5" />
            <span>Speed/HR Ratio</span>
          </div>
        </div>
      </div>

      {/* GRAPH MODE SELECTOR & TIMELINE CHART */}
      <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-3 sm:p-6 shadow-xl space-y-3 sm:space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-700/60 pb-3 sm:pb-5">
          <div className="space-y-0.5">
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-1.5">
              <Sliders className="h-4 w-4 sm:h-5 sm:w-5 text-rose-400" />
              <span>Select 4x4 Performance Mode</span>
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-400">
              Calendar timestamps plotted linearly along the X-Axis.
            </p>
          </div>

          {/* Mode Switcher Buttons */}
          <div className="flex flex-wrap items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setGraphMode('work_distance_speed')}
              className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold transition-all ${
                graphMode === 'work_distance_speed'
                  ? 'bg-cyan-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              Work Distance & Speed
            </button>
            <button
              onClick={() => setGraphMode('peak_speed_progression')}
              className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold transition-all ${
                graphMode === 'peak_speed_progression'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              Peak Speed
            </button>
            <button
              onClick={() => setGraphMode('work_efficiency')}
              className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold transition-all ${
                graphMode === 'work_efficiency'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              Work Capacity
            </button>
            <button
              onClick={() => setGraphMode('work_power_score')}
              className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold transition-all ${
                graphMode === 'work_power_score'
                  ? 'bg-rose-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              Power Score
            </button>
          </div>
        </div>

        {/* MAIN DISPLAY GRAPH (CONTINUOUS LINEAR TIME AXIS) */}
        <div className="h-[290px] sm:h-96 w-full pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={preparedSessions} margin={{ top: 10, right: 8, left: -22, bottom: 0 }}>
              <defs>
                <linearGradient id="color4x4Dist" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
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

              {/* MODE 1: ACTIVE WORK DISTANCE & SPEED */}
              {graphMode === 'work_distance_speed' && (
                <>
                  <YAxis
                    yAxisId="left"
                    stroke="#22d3ee"
                    fontSize={11}
                    domain={['auto', 'auto']}
                    tickLine={false}
                    axisLine={{ stroke: '#0891b2' }}
                    unit=" km"
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#f59e0b"
                    fontSize={11}
                    domain={['auto', 'auto']}
                    tickLine={false}
                    axisLine={{ stroke: '#d97706' }}
                    unit=" km/h"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar
                    yAxisId="left"
                    dataKey="Total_Work_Distance_km"
                    name="Active Work Distance (km)"
                    fill="url(#color4x4Dist)"
                    stroke="#06b6d4"
                    radius={[6, 6, 0, 0]}
                    barSize={18}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="Avg_Speed_kmh"
                    name="Avg Work Speed (km/h)"
                    stroke="#f59e0b"
                    strokeWidth={3}
                    dot={{ r: 5, fill: '#b45309', stroke: '#f59e0b', strokeWidth: 2 }}
                    activeDot={{ r: 8, fill: '#f59e0b', stroke: '#ffffff', strokeWidth: 2 }}
                  />
                </>
              )}

              {/* MODE 2: PEAK SPEED PROGRESSION */}
              {graphMode === 'peak_speed_progression' && (
                <>
                  <YAxis
                    yAxisId="left"
                    stroke="#f59e0b"
                    fontSize={11}
                    domain={['auto', 'auto']}
                    tickLine={false}
                    axisLine={{ stroke: '#d97706' }}
                    unit=" km/h"
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#f43f5e"
                    fontSize={11}
                    domain={[150, 190]}
                    tickLine={false}
                    axisLine={{ stroke: '#e11d48' }}
                    unit=" bpm"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="Peak_Interval_HR"
                    name="Peak HR (bpm)"
                    stroke="#f43f5e"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={{ r: 3, fill: '#be123c' }}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="Peak_Interval_Speed"
                    name="Peak Interval Speed (km/h)"
                    stroke="#f59e0b"
                    strokeWidth={3.5}
                    dot={{ r: 6, fill: '#b45309', stroke: '#f59e0b', strokeWidth: 2 }}
                  />
                </>
              )}

              {/* MODE 3: WORK CAPACITY INDEX */}
              {graphMode === 'work_efficiency' && (
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
                    stroke="#22d3ee"
                    fontSize={11}
                    domain={['auto', 'auto']}
                    tickLine={false}
                    axisLine={{ stroke: '#0891b2' }}
                    unit=" km"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar
                    yAxisId="right"
                    dataKey="Total_Work_Distance_km"
                    name="Active Work Distance (km)"
                    fill="url(#color4x4Dist)"
                    stroke="#06b6d4"
                    radius={[6, 6, 0, 0]}
                    barSize={18}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="workEfficiency"
                    name="Work Capacity Index"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={{ r: 5, fill: '#047857', stroke: '#10b981', strokeWidth: 2 }}
                  />
                </>
              )}

              {/* MODE 4: WORK POWER SCORE */}
              {graphMode === 'work_power_score' && (
                <>
                  <YAxis
                    yAxisId="left"
                    stroke="#f43f5e"
                    fontSize={11}
                    domain={['auto', 'auto']}
                    tickLine={false}
                    axisLine={{ stroke: '#e11d48' }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#f59e0b"
                    fontSize={11}
                    domain={['auto', 'auto']}
                    tickLine={false}
                    axisLine={{ stroke: '#d97706' }}
                    unit=" km/h"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="Peak_Interval_Speed"
                    name="Peak Speed (km/h)"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    strokeDasharray="3 3"
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="workPowerScore"
                    name="Work Power Score (Dist x Speed)"
                    stroke="#f43f5e"
                    strokeWidth={3.5}
                    dot={{ r: 6, fill: '#be123c', stroke: '#f43f5e', strokeWidth: 2 }}
                  />
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* EXPLANATION FOOTNOTE */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 text-xs space-y-2">
          <div className="flex items-center gap-2 font-bold text-rose-300">
            <Sparkles className="h-4 w-4 text-rose-400" />
            <span>Understanding Norwegian 4x4 Adaptation Metrics:</span>
          </div>
          <p className="text-slate-300 leading-relaxed">
            In Norwegian 4x4 high-intensity interval training, heart rate is explicitly maintained at 90–95% HRmax to induce maximal cardiac stroke volume strain. Therefore, <strong>cardiovascular improvement is proven when you cover MORE distance and reach HIGHER speeds at that same target heart rate ceiling!</strong>
          </p>
        </div>
      </div>

      {/* Accordion / Collapsible Session Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Activity className="h-5 w-5 text-rose-400" />
              <span>Session History & Individual Interval Split Breakdown</span>
            </h3>
            <p className="text-xs text-slate-400">Expand session cards to view precise split speeds, heart rates, and distances</p>
          </div>
        </div>

        <div className="space-y-3">
          {[...preparedSessions].reverse().map((session, revIdx) => {
            const originalIndex = preparedSessions.length - 1 - revIdx;
            const isOpen = openSessionIndex === originalIndex;

            return (
              <div
                key={session.Date_Str + revIdx}
                className="bg-slate-800/90 border border-slate-700/80 rounded-2xl overflow-hidden transition-all shadow-md hover:border-slate-600"
              >
                {/* Accordion Header */}
                <button
                  onClick={() => toggleAccordion(originalIndex)}
                  className="w-full text-left p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-800/80 hover:bg-slate-750 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-rose-950/80 border border-rose-800/80 text-rose-400 shrink-0">
                      <Flame className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm sm:text-base">{session.Date_Str}</span>
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          {session.Total_Work_Intervals} x 4min
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 font-mono">
                        <span>Work Dist: <strong className="text-cyan-300">{session.Total_Work_Distance_km} km</strong></span>
                        <span>•</span>
                        <span>Avg Speed: <strong className="text-slate-200">{session.Avg_Speed_kmh} km/h</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-700/60">
                    <div className="text-left sm:text-right font-mono">
                      <div className="text-xs text-slate-400">Avg Work HR</div>
                      <div className="text-sm font-extrabold text-rose-400">{session.Avg_Work_HR} bpm</div>
                    </div>
                    <div className="text-left sm:text-right font-mono">
                      <div className="text-xs text-slate-400">Peak Speed</div>
                      <div className="text-sm font-extrabold text-amber-400">{session.Peak_Interval_Speed} km/h</div>
                    </div>
                    <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 ml-2">
                      {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </div>
                </button>

                {/* Expanded Split Breakdown */}
                {isOpen && (
                  <div className="p-5 bg-slate-900/90 border-t border-slate-700/80 space-y-4">
                    <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                      <span>INTERVAL SPLIT DETAILS</span>
                      <span>Target HR Zone: 90-95% HRmax</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                      {session.Splits.map((split, sIdx) => {
                        const isHighestHR = split.Avg_HR === Math.max(...session.Splits.map((s) => s.Avg_HR));
                        return (
                          <div
                            key={split.Step + sIdx}
                            className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-3.5 space-y-2.5 relative"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-white text-xs flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full bg-rose-500" />
                                {split.Step}
                              </span>
                              <span className="text-[10px] font-mono bg-slate-950 px-2 py-0.5 rounded text-slate-400 border border-slate-800">
                                {split.Duration_Str}
                              </span>
                            </div>

                            <div className="space-y-1.5 text-xs font-mono">
                              <div className="flex justify-between items-center">
                                <span className="text-slate-400">Avg Speed:</span>
                                <span className="font-bold text-white">{split.Avg_Speed_kmh} km/h</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-slate-400">Distance:</span>
                                <span className="text-cyan-300">{split.Distance_km} km</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-slate-400">Avg HR:</span>
                                <span className={`font-bold ${isHighestHR ? 'text-amber-400' : 'text-rose-400'}`}>
                                  {split.Avg_HR} bpm
                                </span>
                              </div>
                            </div>

                            {/* Speed Bar Indicator */}
                            <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-gradient-to-r from-rose-500 to-amber-400 h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${Math.min(100, Math.max(10, ((split.Avg_Speed_kmh - 10) / 10) * 100))}%`,
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
