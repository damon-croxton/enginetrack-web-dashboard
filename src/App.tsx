import React, { useState, useEffect, useMemo } from 'react';
import { Zone2Run, Norwegian4x4Session, MiscRun, TabType, TimeRangeOption } from './types';
import { INITIAL_ZONE2_DATA, INITIAL_NORWEGIAN4X4_DATA, INITIAL_MISC_RUNS_DATA } from './data/mockData';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { Zone2View } from './components/Zone2View';
import { Norwegian4x4View } from './components/Norwegian4x4View';
import { MiscRunsView } from './components/MiscRunsView';
import { CardioLabView } from './components/CardioLabView';
import { TrainingPlannerView } from './components/TrainingPlannerView';
import { RaceSimulatorView } from './components/RaceSimulatorView';
import { AddSessionModal } from './components/AddSessionModal';
import { MetricInfoModal } from './components/MetricInfoModal';
import { AppleHealthImportModal } from './components/AppleHealthImportModal';
import { ParsedAppleHealthData } from './utils/appleHealthParser';
import { DEFAULT_PHYSIOLOGY } from './utils/cardioMetrics';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [timeRange, setTimeRange] = useState<TimeRangeOption>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isAppleHealthModalOpen, setIsAppleHealthModalOpen] = useState(false);

  // Resting HR & Max HR baselines
  const [restingHR, setRestingHR] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('enginetrack_resting_hr');
      return saved ? Number(saved) : DEFAULT_PHYSIOLOGY.restingHR;
    } catch (e) {
      return DEFAULT_PHYSIOLOGY.restingHR;
    }
  });

  const [maxHR, setMaxHR] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('enginetrack_max_hr');
      return saved ? Number(saved) : DEFAULT_PHYSIOLOGY.maxHR;
    } catch (e) {
      return DEFAULT_PHYSIOLOGY.maxHR;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('enginetrack_resting_hr', String(restingHR));
    } catch (e) {
      console.error(e);
    }
  }, [restingHR]);

  useEffect(() => {
    try {
      localStorage.setItem('enginetrack_max_hr', String(maxHR));
    } catch (e) {
      console.error(e);
    }
  }, [maxHR]);

  // Persistence in localStorage
  const [zone2Runs, setZone2Runs] = useState<Zone2Run[]>(() => {
    try {
      const saved = localStorage.getItem('enginetrack_zone2_runs');
      return saved ? JSON.parse(saved) : INITIAL_ZONE2_DATA;
    } catch (e) {
      return INITIAL_ZONE2_DATA;
    }
  });

  const [norwegianSessions, setNorwegianSessions] = useState<Norwegian4x4Session[]>(() => {
    try {
      const saved = localStorage.getItem('enginetrack_4x4_sessions');
      return saved ? JSON.parse(saved) : INITIAL_NORWEGIAN4X4_DATA;
    } catch (e) {
      return INITIAL_NORWEGIAN4X4_DATA;
    }
  });

  const [miscRuns, setMiscRuns] = useState<MiscRun[]>(() => {
    try {
      const saved = localStorage.getItem('enginetrack_misc_runs');
      return saved ? JSON.parse(saved) : INITIAL_MISC_RUNS_DATA;
    } catch (e) {
      return INITIAL_MISC_RUNS_DATA;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('enginetrack_zone2_runs', JSON.stringify(zone2Runs));
    } catch (e) {
      console.error(e);
    }
  }, [zone2Runs]);

  useEffect(() => {
    try {
      localStorage.setItem('enginetrack_4x4_sessions', JSON.stringify(norwegianSessions));
    } catch (e) {
      console.error(e);
    }
  }, [norwegianSessions]);

  useEffect(() => {
    try {
      localStorage.setItem('enginetrack_misc_runs', JSON.stringify(miscRuns));
    } catch (e) {
      console.error(e);
    }
  }, [miscRuns]);

  const [startYearCutoff, setStartYearCutoff] = useState<string>(() => {
    try {
      return localStorage.getItem('enginetrack_cutoff_year') || 'all';
    } catch (e) {
      return 'all';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('enginetrack_cutoff_year', startYearCutoff);
    } catch (e) {
      console.error(e);
    }
  }, [startYearCutoff]);

  // Compute list of years available in dataset
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>();
    [...zone2Runs, ...norwegianSessions, ...miscRuns].forEach((item) => {
      const d = new Date(item.Date_Str);
      if (!isNaN(d.getTime())) yearsSet.add(d.getFullYear());
    });
    const currentYr = new Date().getFullYear();
    yearsSet.add(2023);
    yearsSet.add(2024);
    yearsSet.add(2025);
    yearsSet.add(currentYr);
    return Array.from(yearsSet).sort((a, b) => a - b);
  }, [zone2Runs, norwegianSessions, miscRuns]);

  // Date filtering logic relative to dataset latest date or current date + Start Year Cutoff
  const filterByCutoffAndRange = <T extends { Date_Str: string }>(items: T[]): T[] => {
    if (items.length === 0) return items;
    let result = items;

    // Apply Start Year Cutoff
    if (startYearCutoff !== 'all') {
      const cutoffYear = parseInt(startYearCutoff, 10);
      result = result.filter((item) => {
        const d = new Date(item.Date_Str);
        return !isNaN(d.getTime()) && d.getFullYear() >= cutoffYear;
      });
    }

    // Apply Time Range (30d / 90d / all)
    if (timeRange !== 'all' && result.length > 0) {
      const dates = result.map((i) => new Date(i.Date_Str).getTime());
      const maxDateMs = Math.max(...dates);
      const referenceDate = new Date(Math.max(Date.now(), maxDateMs));
      const daysLimit = timeRange === '30d' ? 30 : 90;
      const cutoff = new Date(referenceDate.getTime() - daysLimit * 24 * 60 * 60 * 1000);

      result = result.filter((item) => {
        const itemDate = new Date(item.Date_Str);
        return itemDate >= cutoff;
      });
    }

    return result;
  };

  const filteredZone2Runs = useMemo(() => filterByCutoffAndRange(zone2Runs), [zone2Runs, timeRange, startYearCutoff]);
  const filtered4x4Sessions = useMemo(() => filterByCutoffAndRange(norwegianSessions), [norwegianSessions, timeRange, startYearCutoff]);
  const filteredMiscRuns = useMemo(() => filterByCutoffAndRange(miscRuns), [miscRuns, timeRange, startYearCutoff]);

  // Handlers
  const handleAddZone2Run = (newRun: Zone2Run) => {
    setZone2Runs((prev) => [...prev, newRun]);
  };

  const handleAdd4x4Session = (newSession: Norwegian4x4Session) => {
    setNorwegianSessions((prev) => [...prev, newSession]);
  };

  const handleImportAppleHealth = (parsed: ParsedAppleHealthData, replaceExisting = true) => {
    if (parsed.detectedRestingHR) {
      setRestingHR(parsed.detectedRestingHR);
    }
    if (parsed.detectedMaxHR) {
      setMaxHR(parsed.detectedMaxHR);
    }

    if (replaceExisting) {
      setZone2Runs(parsed.zone2Runs);
      setNorwegianSessions(parsed.norwegianSessions);
      setMiscRuns(parsed.miscRuns || []);
    } else {
      // Merge and deduplicate by Date_Str
      setZone2Runs((prev) => {
        const newDates = new Set(parsed.zone2Runs.map((r) => r.Date_Str));
        const filteredPrev = prev.filter((r) => !newDates.has(r.Date_Str));
        return [...filteredPrev, ...parsed.zone2Runs].sort(
          (a, b) => new Date(a.Date_Str).getTime() - new Date(b.Date_Str).getTime()
        );
      });
      setNorwegianSessions((prev) => {
        const newDates = new Set(parsed.norwegianSessions.map((s) => s.Date_Str));
        const filteredPrev = prev.filter((s) => !newDates.has(s.Date_Str));
        return [...filteredPrev, ...parsed.norwegianSessions].sort(
          (a, b) => new Date(a.Date_Str).getTime() - new Date(b.Date_Str).getTime()
        );
      });
      setMiscRuns((prev) => {
        const newDates = new Set((parsed.miscRuns || []).map((m) => m.Date_Str));
        const filteredPrev = prev.filter((m) => !newDates.has(m.Date_Str));
        return [...filteredPrev, ...(parsed.miscRuns || [])].sort(
          (a, b) => new Date(a.Date_Str).getTime() - new Date(b.Date_Str).getTime()
        );
      });
    }
  };

  const handleResetData = () => {
    setZone2Runs(INITIAL_ZONE2_DATA);
    setNorwegianSessions(INITIAL_NORWEGIAN4X4_DATA);
    setMiscRuns(INITIAL_MISC_RUNS_DATA);
    try {
      localStorage.setItem('enginetrack_zone2_runs', JSON.stringify(INITIAL_ZONE2_DATA));
      localStorage.setItem('enginetrack_4x4_sessions', JSON.stringify(INITIAL_NORWEGIAN4X4_DATA));
      localStorage.setItem('enginetrack_misc_runs', JSON.stringify(INITIAL_MISC_RUNS_DATA));
    } catch (e) {
      console.error(e);
    }
  };

  const handleClearData = () => {
    setZone2Runs([]);
    setNorwegianSessions([]);
    setMiscRuns([]);
    try {
      localStorage.setItem('enginetrack_zone2_runs', JSON.stringify([]));
      localStorage.setItem('enginetrack_4x4_sessions', JSON.stringify([]));
      localStorage.setItem('enginetrack_misc_runs', JSON.stringify([]));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Top Header & Tab Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        timeRange={timeRange}
        setTimeRange={setTimeRange}
        startYearCutoff={startYearCutoff}
        setStartYearCutoff={setStartYearCutoff}
        availableYears={availableYears}
        onOpenAddModal={() => setIsAddModalOpen(true)}
        onOpenInfoModal={() => setIsInfoModalOpen(true)}
        onOpenAppleHealthModal={() => setIsAppleHealthModalOpen(true)}
        onResetData={handleResetData}
        onClearData={handleClearData}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-2 sm:px-6 lg:px-8 py-2.5 sm:py-6">
        {activeTab === 'dashboard' && (
          <DashboardView
            zone2Runs={filteredZone2Runs}
            norwegianSessions={filtered4x4Sessions}
            miscRuns={filteredMiscRuns}
            onSelectTab={(t) => setActiveTab(t)}
            onOpenInfoModal={() => setIsInfoModalOpen(true)}
            restingHR={restingHR}
            maxHR={maxHR}
          />
        )}
        {activeTab === 'zone2' && (
          <Zone2View
            runs={filteredZone2Runs}
            onOpenInfoModal={() => setIsInfoModalOpen(true)}
            onResetData={handleResetData}
            onOpenAppleHealthModal={() => setIsAppleHealthModalOpen(true)}
            restingHR={restingHR}
            maxHR={maxHR}
            onUpdatePhysiology={(r, m) => {
              setRestingHR(r);
              setMaxHR(m);
            }}
          />
        )}
        {activeTab === 'norwegian4x4' && (
          <Norwegian4x4View
            sessions={filtered4x4Sessions}
            onOpenInfoModal={() => setIsInfoModalOpen(true)}
            onResetData={handleResetData}
            onOpenAppleHealthModal={() => setIsAppleHealthModalOpen(true)}
          />
        )}
        {activeTab === 'miscRuns' && (
          <MiscRunsView
            miscRuns={filteredMiscRuns}
            restingHR={restingHR}
            maxHR={maxHR}
          />
        )}
        {activeTab === 'trainingPlanner' && (
          <TrainingPlannerView
            zone2Runs={filteredZone2Runs}
            norwegianSessions={filtered4x4Sessions}
            miscRuns={filteredMiscRuns}
            startYearCutoff={startYearCutoff}
          />
        )}
        {activeTab === 'raceSimulator' && (
          <RaceSimulatorView
            zone2Runs={filteredZone2Runs}
            norwegianSessions={filtered4x4Sessions}
            miscRuns={filteredMiscRuns}
          />
        )}
        {activeTab === 'cardioLab' && (
          <CardioLabView
            zone2Runs={filteredZone2Runs}
            norwegianSessions={filtered4x4Sessions}
            onOpenInfoModal={() => setIsInfoModalOpen(true)}
            onResetData={handleResetData}
            onOpenAppleHealthModal={() => setIsAppleHealthModalOpen(true)}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950/60 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <strong className="text-slate-400">EngineTrack Web Dashboard</strong> • High Performance Endurance & HIIT Engine Analytics
          </div>
          <div className="font-mono text-[11px] text-slate-600">
            Zone 2 Aerobic API & Norwegian 4x4 Protocol
          </div>
        </div>
      </footer>

      {/* Modals */}
      <AddSessionModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        activeTab={activeTab}
        onAddZone2Run={handleAddZone2Run}
        onAdd4x4Session={handleAdd4x4Session}
      />

      <MetricInfoModal
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
      />

      <AppleHealthImportModal
        isOpen={isAppleHealthModalOpen}
        onClose={() => setIsAppleHealthModalOpen(false)}
        onImportSuccess={handleImportAppleHealth}
      />
    </div>
  );
}
