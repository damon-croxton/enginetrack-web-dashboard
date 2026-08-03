import React, { useState, useMemo } from 'react';
import { Zone2Run, Norwegian4x4Session, MiscRun } from '../types';
import {
  Target,
  Calendar,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  BarChart2,
  Sparkles,
  ShieldCheck,
  Zap,
  Flame,
  Activity,
  Layers,
  Filter,
  History
} from 'lucide-react';
import { EmptyState } from './EmptyState';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

interface TrainingPlannerViewProps {
  zone2Runs: Zone2Run[];
  norwegianSessions: Norwegian4x4Session[];
  miscRuns?: MiscRun[];
  startYearCutoff?: string;
  onOpenAppleHealthModal?: () => void;
  onResetData?: () => void;
}

export const TrainingPlannerView: React.FC<TrainingPlannerViewProps> = ({
  zone2Runs,
  norwegianSessions,
  miscRuns = [],
  startYearCutoff = 'all',
  onOpenAppleHealthModal,
  onResetData,
}) => {
  const hasData = zone2Runs.length > 0 || norwegianSessions.length > 0 || miscRuns.length > 0;

  // Weekly Target State
  const [targetWeeklyZ2Km, setTargetWeeklyZ2Km] = useState<number>(25);
  const [targetWeekly4x4Count, setTargetWeekly4x4Count] = useState<number>(1);

  // Dynamically compute list of years present in user data
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>();
    [...zone2Runs, ...norwegianSessions, ...miscRuns].forEach((item) => {
      const d = new Date(item.Date_Str);
      if (!isNaN(d.getTime())) {
        yearsSet.add(d.getFullYear());
      }
    });
    const currentYr = new Date().getFullYear();
    yearsSet.add(2023);
    yearsSet.add(2024);
    yearsSet.add(2025);
    yearsSet.add(currentYr);
    return Array.from(yearsSet).sort((a, b) => a - b);
  }, [zone2Runs, norwegianSessions, miscRuns]);

  // Month names for clean formatting (e.g., JUN26)
  const monthNamesShort = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

  // Continuous Monthly Historical Data Aggregation
  const monthlyData = useMemo(() => {
    // 1. Collect all dates across datasets to find earliest data point
    const allDates: Date[] = [];

    zone2Runs.forEach((r) => {
      const d = new Date(r.Date_Str);
      if (!isNaN(d.getTime())) allDates.push(d);
    });
    norwegianSessions.forEach((s) => {
      const d = new Date(s.Date_Str);
      if (!isNaN(d.getTime())) allDates.push(d);
    });
    miscRuns.forEach((m) => {
      const d = new Date(m.Date_Str);
      if (!isNaN(d.getTime())) allDates.push(d);
    });

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    let startYear = 2024;
    let startMonth = 0;

    if (allDates.length > 0) {
      allDates.sort((a, b) => a.getTime() - b.getTime());
      startYear = allDates[0].getFullYear();
      startMonth = allDates[0].getMonth();
    }

    // Apply top bar cutoff if selected
    if (startYearCutoff !== 'all') {
      const selectedCutoffYear = parseInt(startYearCutoff, 10);
      if (!isNaN(selectedCutoffYear) && selectedCutoffYear > startYear) {
        startYear = selectedCutoffYear;
        startMonth = 0; // Start at JAN of that cutoff year
      }
    }

    // 2. Generate a continuous sequence of all months from start (startYear, startMonth) to present (currentYear, currentMonth)
    const monthMap: Record<
      string,
      {
        monthKey: string;
        monthLabel: string;
        z2Km: number;
        z2Count: number;
        fourByFourCount: number;
        fourByFourWorkKm: number;
        miscKm: number;
        miscCount: number;
        totalKm: number;
      }
    > = {};

    const monthList: string[] = [];

    let y = startYear;
    let m = startMonth;

    while (y < currentYear || (y === currentYear && m <= currentMonth)) {
      const key = `${y}-${m < 9 ? '0' + (m + 1) : m + 1}`;
      const label = `${monthNamesShort[m]}${String(y).slice(2)}`;

      monthMap[key] = {
        monthKey: key,
        monthLabel: label,
        z2Km: 0,
        z2Count: 0,
        fourByFourCount: 0,
        fourByFourWorkKm: 0,
        miscKm: 0,
        miscCount: 0,
        totalKm: 0,
      };
      monthList.push(key);

      m++;
      if (m > 11) {
        m = 0;
        y++;
      }
    }

    // 3. Populate volume into month buckets
    zone2Runs.forEach((r) => {
      const d = new Date(r.Date_Str);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${d.getMonth() < 9 ? '0' + (d.getMonth() + 1) : d.getMonth() + 1}`;
      if (monthMap[key]) {
        monthMap[key].z2Km += r.Total_Distance_km;
        monthMap[key].z2Count += 1;
        monthMap[key].totalKm += r.Total_Distance_km;
      }
    });

    norwegianSessions.forEach((s) => {
      const d = new Date(s.Date_Str);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${d.getMonth() < 9 ? '0' + (d.getMonth() + 1) : d.getMonth() + 1}`;
      if (monthMap[key]) {
        monthMap[key].fourByFourCount += 1;
        monthMap[key].fourByFourWorkKm += s.Total_Work_Distance_km;
        monthMap[key].totalKm += s.Total_Work_Distance_km;
      }
    });

    miscRuns.forEach((mRun) => {
      const d = new Date(mRun.Date_Str);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${d.getMonth() < 9 ? '0' + (d.getMonth() + 1) : d.getMonth() + 1}`;
      if (monthMap[key]) {
        monthMap[key].miscCount += 1;
        monthMap[key].miscKm += mRun.Total_Distance_km;
        monthMap[key].totalKm += mRun.Total_Distance_km;
      }
    });

    // 4. Format rounded values and polarization percentage
    return monthList.map((key) => {
      const item = monthMap[key];
      const z2Km = Number(item.z2Km.toFixed(1));
      const fourByFourWorkKm = Number(item.fourByFourWorkKm.toFixed(1));
      const miscKm = Number(item.miscKm.toFixed(1));
      const totalKm = Number((z2Km + fourByFourWorkKm + miscKm).toFixed(1));
      const z2Pct = totalKm > 0 ? Math.round((z2Km / totalKm) * 100) : 100;

      return {
        monthKey: key,
        monthLabel: item.monthLabel,
        z2Km,
        z2Count: item.z2Count,
        fourByFourCount: item.fourByFourCount,
        fourByFourWorkKm,
        miscKm,
        miscCount: item.miscCount,
        totalKm,
        z2Pct,
      };
    });
  }, [zone2Runs, norwegianSessions, miscRuns, startYearCutoff]);

  // Current month stats
  const currentMonthData = monthlyData.length > 0 ? monthlyData[monthlyData.length - 1] : null;

  // Recent 7-day approximation for progress cards
  const currentZ2Km = currentMonthData ? currentMonthData.z2Km : 0;
  const current4x4Count = currentMonthData ? currentMonthData.fourByFourCount : 0;

  const z2ProgressPct = Math.min(100, Math.round((currentZ2Km / targetWeeklyZ2Km) * 100));
  const fourByFourProgressPct = Math.min(
    100,
    Math.round((current4x4Count / targetWeekly4x4Count) * 100)
  );

  const is80_20Polarized = currentMonthData ? currentMonthData.z2Pct >= 70 && currentMonthData.z2Pct <= 85 : true;

  if (!hasData) {
    return (
      <EmptyState
        icon={Target}
        title="No Training History"
        message="Monthly volume and consistency trends need logged sessions. Import your Apple Health data or load the demo dataset to see your history."
        accent="emerald"
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
          <div className="p-2 sm:p-3 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-400 shrink-0">
            <History className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-1.5 flex-wrap">
              <span>Historical Volume & Targets</span>
              <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded-full font-semibold">
                Monthly Timeline
              </span>
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-400 leading-tight">
              Track long-term historical mileage with adjustable year cutoffs.
            </p>
          </div>
        </div>

        {/* Target Adjuster Controls & Historical Cutoff Dropdown */}
        <div className="flex flex-wrap items-center gap-2.5 bg-slate-950/80 p-2 sm:p-2.5 rounded-xl border border-slate-800">
          {/* Target Zone 2 slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] font-semibold text-cyan-400">
              <span>Weekly Zone 2 Target:</span>
              <span className="font-mono">{targetWeeklyZ2Km} km/wk</span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              step="5"
              value={targetWeeklyZ2Km}
              onChange={(e) => setTargetWeeklyZ2Km(Number(e.target.value))}
              className="w-36 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
          </div>

          <div className="h-8 w-px bg-slate-800 hidden sm:block" />

          {/* Target 4x4 slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] font-semibold text-rose-400">
              <span>Weekly 4x4 HIIT Target:</span>
              <span className="font-mono">{targetWeekly4x4Count} / wk</span>
            </div>
            <input
              type="range"
              min="1"
              max="3"
              step="1"
              value={targetWeekly4x4Count}
              onChange={(e) => setTargetWeekly4x4Count(Number(e.target.value))}
              className="w-28 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-400"
            />
          </div>
        </div>
      </div>

      {/* Current Month Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Zone 2 Goal Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
              <Activity className="h-4 w-4" /> ZONE 2 AEROBIC VOLUME
            </span>
            <span className="text-xs font-mono font-bold text-slate-300">
              {currentZ2Km} km in {currentMonthData ? currentMonthData.monthLabel : 'Current Month'}
            </span>
          </div>

          <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden p-0.5 border border-slate-700">
            <div
              className="bg-gradient-to-r from-cyan-500 to-emerald-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${z2ProgressPct}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>{z2ProgressPct}% Weekly Goal Reached</span>
            {z2ProgressPct >= 100 ? (
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Target Achieved!
              </span>
            ) : (
              <span>{(targetWeeklyZ2Km - currentZ2Km > 0 ? targetWeeklyZ2Km - currentZ2Km : 0).toFixed(1)} km remaining</span>
            )}
          </div>
        </div>

        {/* 4x4 HIIT Goal Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
              <Flame className="h-4 w-4" /> NORWEGIAN 4x4 SESSIONS
            </span>
            <span className="text-xs font-mono font-bold text-slate-300">
              {current4x4Count} sessions in {currentMonthData ? currentMonthData.monthLabel : 'Current Month'}
            </span>
          </div>

          <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden p-0.5 border border-slate-700">
            <div
              className="bg-gradient-to-r from-rose-500 to-amber-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${fourByFourProgressPct}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>{fourByFourProgressPct}% Weekly Goal Reached</span>
            {fourByFourProgressPct >= 100 ? (
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Target Achieved!
              </span>
            ) : (
              <span>{Math.max(0, targetWeekly4x4Count - current4x4Count)} session remaining</span>
            )}
          </div>
        </div>

        {/* 80/20 Polarization Ratio Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
              <Layers className="h-4 w-4" /> POLARIZATION INDEX
            </span>
            <span className="text-xs font-mono font-bold text-purple-300">
              {currentMonthData ? `${currentMonthData.z2Pct}% Z2 Base` : '80% / 20%'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 bg-slate-800 rounded-full h-3 overflow-hidden flex border border-slate-700">
              <div
                className="bg-cyan-500 h-full"
                style={{ width: `${currentMonthData ? currentMonthData.z2Pct : 80}%` }}
                title="Zone 2 Low Intensity"
              />
              <div
                className="bg-rose-500 h-full"
                style={{ width: `${currentMonthData ? 100 - currentMonthData.z2Pct : 20}%` }}
                title="High Intensity / General"
              />
            </div>
          </div>

          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>80/20 Seiler Aerobic Target</span>
            {is80_20Polarized ? (
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5" /> Optimal Aerobic Base
              </span>
            ) : (
              <span className="text-amber-400 font-bold flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" /> Rebalance Needed
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Monthly Historical Volume Chart & Filter Dropdown */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 sm:p-5 shadow-xl space-y-2 sm:space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
          <h3 className="text-xs sm:text-base font-bold text-white flex items-center gap-1.5">
            <BarChart2 className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-400" />
            <span>Monthly Continuous Historical Volume</span>
          </h3>
          <p className="text-[11px] sm:text-xs text-slate-400 font-medium">
            Controlled by year cutoff filter
          </p>
        </div>

        <div className="h-[280px] sm:h-72 w-full pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData} margin={{ top: 10, right: 8, left: -22, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="monthLabel" stroke="#94a3b8" fontSize={10} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} unit=" km" />
              <Tooltip />
              <Legend verticalAlign="top" height={28} wrapperStyle={{ fontSize: '11px', paddingBottom: '4px' }} />
              <Bar dataKey="z2Km" name="Zone 2 (km)" stackId="a" fill="#06b6d4" radius={[0, 0, 0, 0]} />
              <Bar dataKey="fourByFourWorkKm" name="4x4 Work (km)" stackId="a" fill="#f43f5e" radius={[0, 0, 0, 0]} />
              <Bar dataKey="miscKm" name="General Runs (km)" stackId="a" fill="#c084fc" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
