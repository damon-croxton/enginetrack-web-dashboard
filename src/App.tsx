import React, { useState, useEffect, useMemo } from 'react';
import { AlertTriangle, X } from 'lucide-react';
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
import {
  STORAGE_KEYS,
  StorageFailure,
  readJSON,
  readNumber,
  readString,
  requestPersistentStorage,
  writeJSON,
  writeValue,
} from './utils/storage';
import { downloadBackup, readBackupFile } from './utils/backup';

/** Distance and duration separate two runs logged on the same date. */
const runIdentity = (r: { Date_Str: string; Duration_min: number; Total_Distance_km: number }) =>
  `${r.Date_Str}|${r.Duration_min}|${r.Total_Distance_km}`;

const sessionIdentity = (s: Norwegian4x4Session) =>
  `${s.Date_Str}|${s.Total_Work_Intervals}|${s.Total_Work_Distance_km}`;

/**
 * Replaces prior entries that the import supersedes, keeps the rest, and returns
 * the union sorted chronologically.
 */
function mergeByIdentity<T extends { Date_Str: string }>(
  previous: T[],
  incoming: T[],
  identity: (item: T) => string
): T[] {
  const incomingKeys = new Set(incoming.map(identity));
  const retained = previous.filter((item) => !incomingKeys.has(identity(item)));
  return [...retained, ...incoming].sort(
    (a, b) => new Date(a.Date_Str).getTime() - new Date(b.Date_Str).getTime()
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [timeRange, setTimeRange] = useState<TimeRangeOption>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isAppleHealthModalOpen, setIsAppleHealthModalOpen] = useState(false);

  // Surfaced to the user when a write is dropped. Silently losing an import is
  // the worst outcome here, since this device is the only copy of the data.
  const [storageError, setStorageError] = useState<StorageFailure | null>(null);

  // Ask the browser not to evict us. Best effort; see utils/storage.ts.
  useEffect(() => {
    requestPersistentStorage();
  }, []);

  // Resting HR & Max HR baselines
  const [restingHR, setRestingHR] = useState<number>(() =>
    readNumber(STORAGE_KEYS.restingHR, DEFAULT_PHYSIOLOGY.restingHR)
  );

  const [maxHR, setMaxHR] = useState<number>(() =>
    readNumber(STORAGE_KEYS.maxHR, DEFAULT_PHYSIOLOGY.maxHR)
  );

  useEffect(() => {
    setStorageError(writeValue(STORAGE_KEYS.restingHR, String(restingHR)));
  }, [restingHR]);

  useEffect(() => {
    setStorageError(writeValue(STORAGE_KEYS.maxHR, String(maxHR)));
  }, [maxHR]);

  // Persistence in localStorage
  const [zone2Runs, setZone2Runs] = useState<Zone2Run[]>(() =>
    readJSON(STORAGE_KEYS.zone2Runs, INITIAL_ZONE2_DATA)
  );

  const [norwegianSessions, setNorwegianSessions] = useState<Norwegian4x4Session[]>(() =>
    readJSON(STORAGE_KEYS.norwegianSessions, INITIAL_NORWEGIAN4X4_DATA)
  );

  const [miscRuns, setMiscRuns] = useState<MiscRun[]>(() =>
    readJSON(STORAGE_KEYS.miscRuns, INITIAL_MISC_RUNS_DATA)
  );

  useEffect(() => {
    setStorageError(writeJSON(STORAGE_KEYS.zone2Runs, zone2Runs));
  }, [zone2Runs]);

  useEffect(() => {
    setStorageError(writeJSON(STORAGE_KEYS.norwegianSessions, norwegianSessions));
  }, [norwegianSessions]);

  useEffect(() => {
    setStorageError(writeJSON(STORAGE_KEYS.miscRuns, miscRuns));
  }, [miscRuns]);

  const [startYearCutoff, setStartYearCutoff] = useState<string>(() =>
    readString(STORAGE_KEYS.cutoffYear, 'all')
  );

  useEffect(() => {
    setStorageError(writeValue(STORAGE_KEYS.cutoffYear, startYearCutoff));
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
      // Merge, replacing only genuine duplicates. Keying on Date_Str alone would
      // collapse two runs done on the same day into one.
      setZone2Runs((prev) => mergeByIdentity(prev, parsed.zone2Runs, runIdentity));
      setNorwegianSessions((prev) =>
        mergeByIdentity(prev, parsed.norwegianSessions, sessionIdentity)
      );
      setMiscRuns((prev) => mergeByIdentity(prev, parsed.miscRuns || [], runIdentity));
    }
  };

  // The state effects above own persistence, so these only set state.
  const handleResetData = () => {
    setZone2Runs(INITIAL_ZONE2_DATA);
    setNorwegianSessions(INITIAL_NORWEGIAN4X4_DATA);
    setMiscRuns(INITIAL_MISC_RUNS_DATA);
  };

  const totalWorkouts = zone2Runs.length + norwegianSessions.length + miscRuns.length;

  const handleClearData = () => {
    // Destructive and irreversible, and this device is the only copy — so point
    // at the backup before wiping.
    if (totalWorkouts > 0) {
      const confirmed = window.confirm(
        `Delete all ${totalWorkouts} logged workout${totalWorkouts === 1 ? '' : 's'}?\n\n` +
          'This cannot be undone. If you have not exported a backup, cancel and do that first.'
      );
      if (!confirmed) return;
    }

    setZone2Runs([]);
    setNorwegianSessions([]);
    setMiscRuns([]);
  };

  const handleExportBackup = () => {
    downloadBackup({ restingHR, maxHR, zone2Runs, norwegianSessions, miscRuns });
  };

  const handleImportBackup = async (file: File) => {
    try {
      const backup = await readBackupFile(file);

      setRestingHR(backup.restingHR);
      setMaxHR(backup.maxHR);
      // Merge rather than replace, so restoring an older backup alongside newer
      // workouts doesn't discard them.
      setZone2Runs((prev) => mergeByIdentity(prev, backup.zone2Runs, runIdentity));
      setNorwegianSessions((prev) =>
        mergeByIdentity(prev, backup.norwegianSessions, sessionIdentity)
      );
      setMiscRuns((prev) => mergeByIdentity(prev, backup.miscRuns, runIdentity));

      const restored =
        backup.zone2Runs.length + backup.norwegianSessions.length + backup.miscRuns.length;
      window.alert(`Restored ${restored} workout${restored === 1 ? '' : 's'} from backup.`);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not read that backup file.');
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
        onExportBackup={handleExportBackup}
        onImportBackup={handleImportBackup}
      />

      {/* A dropped write means the data is gone on next launch. Say so while the
          user can still export it. */}
      {storageError && (
        <div className="bg-rose-950/80 border-b border-rose-800 px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs text-rose-200 leading-relaxed">
              {storageError.message}
            </div>
            <button
              onClick={handleExportBackup}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-rose-900 hover:bg-rose-800 border border-rose-700 text-rose-100 text-[11px] font-bold transition-colors"
            >
              Export Backup
            </button>
            <button
              onClick={() => setStorageError(null)}
              aria-label="Dismiss"
              className="shrink-0 p-1.5 rounded-lg text-rose-300 hover:bg-rose-900/60 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

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
          onOpenAppleHealthModal={() => setIsAppleHealthModalOpen(true)}
          onResetData={handleResetData}
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
          onOpenAppleHealthModal={() => setIsAppleHealthModalOpen(true)}
          onResetData={handleResetData}
          />
        )}
        {activeTab === 'trainingPlanner' && (
          <TrainingPlannerView
            zone2Runs={filteredZone2Runs}
            norwegianSessions={filtered4x4Sessions}
            miscRuns={filteredMiscRuns}
            startYearCutoff={startYearCutoff}
          onOpenAppleHealthModal={() => setIsAppleHealthModalOpen(true)}
          onResetData={handleResetData}
          />
        )}
        {activeTab === 'raceSimulator' && (
          <RaceSimulatorView
            zone2Runs={filteredZone2Runs}
            norwegianSessions={filtered4x4Sessions}
            miscRuns={filteredMiscRuns}
          onOpenAppleHealthModal={() => setIsAppleHealthModalOpen(true)}
          onResetData={handleResetData}
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
      <footer className="border-t border-slate-800 bg-slate-950/60 py-6 text-center text-xs text-slate-500 pb-safe px-safe">
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
