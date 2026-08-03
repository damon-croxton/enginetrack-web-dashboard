import React, { useState, useEffect, useRef } from 'react';
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
  Layers,
  MoreVertical
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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Dismiss the overflow menu on outside tap or Escape.
  useEffect(() => {
    if (!isMenuOpen) return;

    const handlePointer = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMenuOpen(false);
    };

    document.addEventListener('pointerdown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('pointerdown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isMenuOpen]);

  return (
    <header className="border-b border-slate-800 bg-slate-900/95 backdrop-blur-md sticky top-0 z-30 shadow-md pt-safe px-safe">
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
              <span className="text-[9px] sm:text-[10px] font-bold text-cyan-400 bg-cyan-950/80 px-1 py-0.5 rounded border border-cyan-800/80">
                v2.5
              </span>
            </h1>
          </div>

          {/* Primary actions. Secondary and destructive ones live in the
              overflow menu so the header stays one row on a phone. */}
          <div className="flex items-center gap-1.5 text-xs">
            <button
              onClick={onOpenAppleHealthModal}
              className="inline-flex items-center gap-1 px-2.5 py-2 text-[11px] font-semibold rounded-lg bg-emerald-950/80 border border-emerald-800/80 text-emerald-300 hover:bg-emerald-900 transition-all"
              title="Sync Apple Health / HealthKit"
              aria-label="Import Apple Health data"
            >
              <UploadCloud className="h-3.5 w-3.5 text-emerald-400" />
              <span className="hidden xs:inline">Health</span>
            </button>

            <button
              onClick={onOpenAddModal}
              className="inline-flex items-center gap-1 px-3 py-2 text-[11px] font-bold rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-sm transition-all"
              aria-label="Log a session"
            >
              <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
              <span className="hidden xs:inline">Log</span>
            </button>

            {/* Overflow menu */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setIsMenuOpen((open) => !open)}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-all"
                aria-label="More actions"
                aria-expanded={isMenuOpen}
                aria-haspopup="menu"
              >
                <MoreVertical className="h-4 w-4 text-slate-300" />
              </button>

              {isMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-1.5 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-40"
                >
                  <button
                    role="menuitem"
                    onClick={() => { setIsMenuOpen(false); onOpenInfoModal(); }}
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition-colors text-left"
                  >
                    <Info className="h-4 w-4 text-cyan-400 shrink-0" />
                    <span>Metric Methodology</span>
                  </button>

                  <button
                    role="menuitem"
                    onClick={() => { setIsMenuOpen(false); onResetData(); }}
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition-colors text-left border-t border-slate-800"
                  >
                    <RotateCcw className="h-4 w-4 text-slate-400 shrink-0" />
                    <span>Load Demo Data</span>
                  </button>

                  <button
                    role="menuitem"
                    onClick={() => { setIsMenuOpen(false); onClearData(); }}
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-xs font-semibold text-rose-300 hover:bg-rose-950/50 transition-colors text-left border-t border-slate-800"
                  >
                    <Trash2 className="h-4 w-4 text-rose-400 shrink-0" />
                    <span>Clear All Workouts</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1.5 text-xs">
          <div className="flex items-center gap-1 bg-slate-950 px-2 py-1.5 rounded-lg border border-slate-800 text-[11px]">
            <span className="text-slate-400 font-medium hidden md:inline">Cutoff:</span>
            <select
              value={startYearCutoff}
              onChange={(e) => setStartYearCutoff(e.target.value)}
              className="bg-transparent text-emerald-400 font-bold focus:outline-none cursor-pointer text-[11px]"
              title="Filter dataset starting from selected year"
              aria-label="Filter dataset from year"
            >
              <option value="all" className="bg-slate-900 text-white">All Years</option>
              {availableYears.map((yr) => (
                <option key={yr} value={String(yr)} className="bg-slate-900 text-white">
                  From {yr}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800">
            {(['30d', '90d', 'all'] as TimeRangeOption[]).map((option) => (
              <button
                key={option}
                onClick={() => setTimeRange(option)}
                className={`px-2.5 py-1.5 text-[11px] font-medium rounded transition-all ${
                  timeRange === option
                    ? 'bg-slate-800 text-cyan-300 border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {option === '30d' ? '30d' : option === '90d' ? '90d' : 'All'}
              </button>
            ))}
          </div>
        </div>

        {/* Compact Navigation Bar - Horizontally Scrollable on Mobile */}
        <div className="flex items-center border-t border-slate-800/60 pt-0.5 overflow-x-auto no-scrollbar">
          <nav className="flex space-x-1 sm:space-x-1.5 shrink-0" aria-label="Tabs">
            {/* Dashboard */}
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-1 px-2.5 sm:px-3 py-2 text-[11px] sm:text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
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
              className={`flex items-center gap-1 px-2.5 sm:px-3 py-2 text-[11px] sm:text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
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
              className={`flex items-center gap-1 px-2.5 sm:px-3 py-2 text-[11px] sm:text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
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
              className={`flex items-center gap-1 px-2.5 sm:px-3 py-2 text-[11px] sm:text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
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
              className={`flex items-center gap-1 px-2.5 sm:px-3 py-2 text-[11px] sm:text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
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
              className={`flex items-center gap-1 px-2.5 sm:px-3 py-2 text-[11px] sm:text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
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
              className={`flex items-center gap-1 px-2.5 sm:px-3 py-2 text-[11px] sm:text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
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
