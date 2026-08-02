import React from 'react';
import { TabType, TimeRangeOption } from '../types';
import {
  Activity,
  Flame,
  Plus,
  Info,
  RotateCcw,
  Calendar,
  UploadCloud,
  Trash2,
  Brain,
  LayoutDashboard,
  History,
  Target,
  Gauge,
  Layers
} from 'lucide-react';

interface HeaderProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  timeRange: TimeRangeOption;
  setTimeRange: (range: TimeRangeOption) => void;
  startYearCutoff: string;
  setStartYearCutoff: (cutoff: string) => void;
  availableYears: number[];
  onOpenAddModal: () => void;
  onOpenInfoModal: () => void;
  onOpenAppleHealthModal: () => void;
  onResetData: () => void;
  onClearData: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  timeRange,
  setTimeRange,
  startYearCutoff,
  setStartYearCutoff,
  availableYears,
  onOpenAddModal,
  onOpenInfoModal,
  onOpenAppleHealthModal,
  onResetData,
  onClearData,
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-900/95 backdrop-blur-md sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-2 sm:px-5 py-1 sm:py-1.5 space-y-1 sm:space-y-1.5">
        {/* Top Bar: Logo & Controls */}
        <div className="flex items-center justify-between gap-1.5 flex-wrap sm:flex-nowrap">
          {/* Logo & Compact Title */}
          <div className="flex items-center gap-1.5">
            <div className="h-6 w-6 sm:h-7 sm:w-7 rounded-lg bg-gradient-to-tr from-cyan-600 to-emerald-500 p-0.5 shadow-sm">
              <div className="h-full w-full bg-slate-950 rounded-[5px] flex items-center justify-center">
                <Activity className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-cyan-400" />
              </div>
            </div>
            <h1 className="text-xs sm:text-base font-extrabold tracking-tight text-white flex items-center gap-1">
              <span>EngineTrack</span>
              <span className="text-[9px] sm:text-[10px] font-bold text-cyan-400 bg-cyan-950/80 px-1 py-0.2 rounded border border-cyan-800/80">
                v2.5
              </span>
            </h1>
          </div>

          {/* Compact Control Actions */}
          <div className="flex items-center gap-1 sm:gap-1.5 text-xs flex-wrap">
            {/* Global Start Year Cutoff Dropdown */}
            <div className="flex items-center gap-0.5 sm:gap-1 bg-slate-950 px-1.5 sm:px-2 py-0.5 rounded-lg border border-slate-800 text-[10px] sm:text-[11px]">
              <span className="text-slate-400 font-medium hidden md:inline">Cutoff:</span>
              <select
                value={startYearCutoff}
                onChange={(e) => setStartYearCutoff(e.target.value)}
                className="bg-transparent text-emerald-400 font-bold focus:outline-none cursor-pointer text-[10px] sm:text-[11px]"
                title="Filter dataset starting from selected year"
              >
                <option value="all" className="bg-slate-900 text-white">All Years</option>
                {availableYears.map((yr) => (
                  <option key={yr} value={String(yr)} className="bg-slate-900 text-white">
                    From {yr}
                  </option>
                ))}
              </select>
            </div>

            {/* Time Range Toggle */}
            <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800">
              {(['30d', '90d', 'all'] as TimeRangeOption[]).map((option) => (
                <button
                  key={option}
                  onClick={() => setTimeRange(option)}
                  className={`px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-[11px] font-medium rounded transition-all ${
                    timeRange === option
                      ? 'bg-slate-800 text-cyan-300 border border-slate-700'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {option === '30d' ? '30d' : option === '90d' ? '90d' : 'All'}
                </button>
              ))}
            </div>

            {/* Apple Health Import */}
            <button
              onClick={onOpenAppleHealthModal}
              className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-[11px] font-semibold rounded-lg bg-emerald-950/80 border border-emerald-800/80 text-emerald-300 hover:bg-emerald-900 transition-all"
              title="Sync Apple Health / HealthKit"
            >
              <UploadCloud className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-emerald-400" />
              <span className="hidden xs:inline">Health</span>
            </button>

            {/* Info Docs */}
            <button
              onClick={onOpenInfoModal}
              className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-all"
              title="Methodology Docs"
            >
              <Info className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-cyan-400" />
            </button>

            {/* Demo Reset */}
            <button
              onClick={onResetData}
              className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-all"
              title="Load Demo Data"
            >
              <RotateCcw className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-slate-400" />
            </button>

            {/* Clear Data */}
            <button
              onClick={onClearData}
              className="p-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 transition-all"
              title="Clear All Workouts"
            >
              <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-rose-400" />
            </button>

            {/* Add Session */}
            <button
              onClick={onOpenAddModal}
              className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-[11px] font-bold rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-sm transition-all"
            >
              <Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5 stroke-[2.5]" />
              <span className="hidden xs:inline">Log</span>
            </button>
          </div>
        </div>

        {/* Compact Navigation Bar - Horizontally Scrollable on Mobile */}
        <div className="flex items-center border-t border-slate-800/60 pt-0.5 overflow-x-auto no-scrollbar">
          <nav className="flex space-x-1 sm:space-x-1.5 shrink-0" aria-label="Tabs">
            {/* Dashboard */}
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
                activeTab === 'dashboard'
                  ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <LayoutDashboard className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-indigo-400" />
              <span>Dashboard</span>
            </button>

            {/* Zone 2 */}
            <button
              onClick={() => setActiveTab('zone2')}
              className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
                activeTab === 'zone2'
                  ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Activity className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-cyan-400" />
              <span>Zone 2</span>
            </button>

            {/* Norwegian 4x4 */}
            <button
              onClick={() => setActiveTab('norwegian4x4')}
              className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
                activeTab === 'norwegian4x4'
                  ? 'bg-rose-950/80 text-rose-300 border border-rose-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Flame className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-rose-400" />
              <span>Norwegian 4x4</span>
            </button>

            {/* Misc / General Runs */}
            <button
              onClick={() => setActiveTab('miscRuns')}
              className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
                activeTab === 'miscRuns'
                  ? 'bg-purple-950/80 text-purple-300 border border-purple-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Layers className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-purple-400" />
              <span>Misc Runs</span>
            </button>

            {/* Historical */}
            <button
              onClick={() => setActiveTab('trainingPlanner')}
              className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
                activeTab === 'trainingPlanner'
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Target className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-emerald-400" />
              <span>Historical</span>
            </button>

            {/* Race Simulator */}
            <button
              onClick={() => setActiveTab('raceSimulator')}
              className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
                activeTab === 'raceSimulator'
                  ? 'bg-amber-950/80 text-amber-300 border border-amber-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Gauge className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-amber-400" />
              <span>Simulator</span>
            </button>

            {/* Cardio Lab */}
            <button
              onClick={() => setActiveTab('cardioLab')}
              className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
                activeTab === 'cardioLab'
                  ? 'bg-purple-950/80 text-purple-300 border border-purple-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Brain className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-purple-400" />
              <span>Cardio Lab</span>
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
};
