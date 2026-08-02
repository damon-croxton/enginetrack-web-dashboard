import React, { useState } from 'react';
import { Zone2Run, Norwegian4x4Session, IntervalSplit, TabType } from '../types';
import { X, Plus, Activity, Flame, Calculator, Sparkles } from 'lucide-react';

interface AddSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: TabType;
  onAddZone2Run: (run: Zone2Run) => void;
  onAdd4x4Session: (session: Norwegian4x4Session) => void;
}

export const AddSessionModal: React.FC<AddSessionModalProps> = ({
  isOpen,
  onClose,
  activeTab,
  onAddZone2Run,
  onAdd4x4Session,
}) => {
  const [sessionType, setSessionType] = useState<TabType>(activeTab);

  // Today's date YYYY-MM-DD
  const todayStr = new Date().toISOString().split('T')[0];

  // Zone 2 Form State
  const [z2Date, setZ2Date] = useState(todayStr);
  const [z2Distance, setZ2Distance] = useState('12.0');
  const [z2Duration, setZ2Duration] = useState('68.0');
  const [z2HR, setZ2HR] = useState('138');
  const [z2EW, setZ2EW] = useState('2.65');

  // Norwegian 4x4 Form State
  const [n4Date, setN4Date] = useState(todayStr);
  const [n4Splits, setN4Splits] = useState<IntervalSplit[]>([
    { Step: 'Interval 1', Duration_Str: '4m 0s', Distance_km: 1.0, Avg_Speed_kmh: 15.0, Avg_HR: 172 },
    { Step: 'Interval 2', Duration_Str: '4m 0s', Distance_km: 1.02, Avg_Speed_kmh: 15.3, Avg_HR: 175 },
    { Step: 'Interval 3', Duration_Str: '4m 0s', Distance_km: 1.03, Avg_Speed_kmh: 15.5, Avg_HR: 177 },
    { Step: 'Interval 4', Duration_Str: '4m 0s', Distance_km: 1.05, Avg_Speed_kmh: 15.8, Avg_HR: 180 },
  ]);

  if (!isOpen) return null;

  // Realtime calculated values for Zone 2
  const distanceNum = parseFloat(z2Distance) || 0;
  const durationNum = parseFloat(z2Duration) || 0;
  const hrNum = parseFloat(z2HR) || 1;
  const ewNum = parseFloat(z2EW) || 0;

  const calculatedSpeed = durationNum > 0 ? Number(((distanceNum / (durationNum / 60))).toFixed(2)) : 0;
  const calculatedAPI = hrNum > 0 ? Number((((ewNum / hrNum) * 1000)).toFixed(2)) : 0;

  const handleZone2Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!distanceNum || !durationNum || !hrNum || !ewNum) return;

    const newRun: Zone2Run = {
      Date_Str: z2Date,
      Total_Distance_km: distanceNum,
      Duration_min: durationNum,
      Avg_Speed_kmh: calculatedSpeed,
      Avg_HR: hrNum,
      Avg_eW_wkg: ewNum,
      Aerobic_Power_Index: calculatedAPI,
    };

    onAddZone2Run(newRun);
    onClose();
  };

  const handle4x4Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!n4Splits.length) return;

    const totalWorkDist = Number(n4Splits.reduce((acc, s) => acc + s.Distance_km, 0).toFixed(2));
    const avgWorkHR = Math.round(n4Splits.reduce((acc, s) => acc + s.Avg_HR, 0) / n4Splits.length);
    const avgSpeed = Number((n4Splits.reduce((acc, s) => acc + s.Avg_Speed_kmh, 0) / n4Splits.length).toFixed(2));
    const peakSpeed = Math.max(...n4Splits.map((s) => s.Avg_Speed_kmh));
    const peakHR = Math.max(...n4Splits.map((s) => s.Avg_HR));

    const newSession: Norwegian4x4Session = {
      Date_Str: n4Date,
      Total_Work_Intervals: n4Splits.length,
      Avg_Speed_kmh: avgSpeed,
      Avg_Work_HR: avgWorkHR,
      Total_Work_Distance_km: totalWorkDist,
      Peak_Interval_Speed: peakSpeed,
      Peak_Interval_HR: peakHR,
      Splits: n4Splits,
    };

    onAdd4x4Session(newSession);
    onClose();
  };

  const updateSplit = (idx: number, field: keyof IntervalSplit, value: any) => {
    const updated = [...n4Splits];
    updated[idx] = { ...updated[idx], [field]: value };
    setN4Splits(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-850">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-950 text-cyan-400 border border-cyan-800">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-base sm:text-lg">Log New Running Session</h3>
              <p className="text-xs text-slate-400">Record training session to compute progression metrics</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modality Selector Tabs */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/50 flex gap-3">
          <button
            type="button"
            onClick={() => setSessionType('zone2')}
            className={`flex-1 py-2.5 px-4 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-all ${
              sessionType === 'zone2'
                ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/20'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="h-4 w-4" />
            <span>Zone 2 Run</span>
          </button>
          <button
            type="button"
            onClick={() => setSessionType('norwegian4x4')}
            className={`flex-1 py-2.5 px-4 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-all ${
              sessionType === 'norwegian4x4'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-500/20'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Flame className="h-4 w-4" />
            <span>Norwegian 4x4 Session</span>
          </button>
        </div>

        {/* Form Body */}
        {sessionType === 'zone2' ? (
          <form onSubmit={handleZone2Submit} className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Date</label>
                <input
                  type="date"
                  value={z2Date}
                  onChange={(e) => setZ2Date(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Total Distance (km)</label>
                <input
                  type="number"
                  step="0.1"
                  value={z2Distance}
                  onChange={(e) => setZ2Distance(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Duration (minutes)</label>
                <input
                  type="number"
                  step="0.5"
                  value={z2Duration}
                  onChange={(e) => setZ2Duration(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Avg Heart Rate (bpm)</label>
                <input
                  type="number"
                  value={z2HR}
                  onChange={(e) => setZ2HR(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Estimated Power (eW W/kg)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={z2EW}
                  onChange={(e) => setZ2EW(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono"
                  required
                />
              </div>
            </div>

            {/* Computed API Banner */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-xs text-cyan-400 font-bold">
                  <Calculator className="h-4 w-4" /> Computed Aerobic Power Index (API):
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  Formula: ({ewNum} W/kg / {hrNum} bpm) * 1000
                </div>
              </div>
              <div className="text-2xl font-extrabold text-cyan-300 font-mono">
                {calculatedAPI.toFixed(2)}
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-semibold rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/20"
              >
                Save Zone 2 Run
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handle4x4Submit} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Session Date</label>
              <input
                type="date"
                value={n4Date}
                onChange={(e) => setN4Date(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">Interval Splits (4x4 Protocol)</label>

              {n4Splits.map((split, idx) => (
                <div key={idx} className="bg-slate-950 border border-slate-800 rounded-xl p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="col-span-2 sm:col-span-1 font-bold text-rose-400 flex items-center">
                    {split.Step}
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Dist (km)</span>
                    <input
                      type="number"
                      step="0.01"
                      value={split.Distance_km}
                      onChange={(e) => updateSplit(idx, 'Distance_km', parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono text-white"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Avg Speed (km/h)</span>
                    <input
                      type="number"
                      step="0.1"
                      value={split.Avg_Speed_kmh}
                      onChange={(e) => updateSplit(idx, 'Avg_Speed_kmh', parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono text-white"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Avg HR (bpm)</span>
                    <input
                      type="number"
                      value={split.Avg_HR}
                      onChange={(e) => updateSplit(idx, 'Avg_HR', parseInt(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono text-white"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-500/20"
              >
                Save 4x4 Session
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
