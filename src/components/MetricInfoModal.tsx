import React from 'react';
import { X, Zap, Flame, Heart, Sparkles, BookOpen, Activity, CheckCircle2 } from 'lucide-react';

interface MetricInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MetricInfoModal: React.FC<MetricInfoModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-850">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-950 text-cyan-400 border border-cyan-800">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-base sm:text-lg">
                Cardiovascular Science & Metric Methodology
              </h3>
              <p className="text-xs text-slate-400">
                Understanding Aerobic Power Index (API) and Norwegian 4x4 Protocol
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 text-slate-300 text-xs sm:text-sm leading-relaxed max-h-[75vh] overflow-y-auto">
          {/* Section 1: Aerobic Power Index */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
              <Zap className="h-4 w-4" />
              <span>Zone 2: Aerobic Power Index (API)</span>
            </div>

            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 font-mono text-cyan-300 text-xs sm:text-sm text-center">
              Aerobic Power Index = (Avg Estimated Power [W/kg] / Avg Heart Rate [bpm]) × 1000
            </div>

            <p className="text-slate-300">
              The <strong>Aerobic Power Index (API)</strong> evaluates cardiac efficiency by normalizing mechanical power output (or running speed equivalent) against heart rate response during low-intensity steady-state (Zone 2) runs.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
              <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 space-y-1">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400" /> Physiological Adaptations
                </span>
                <p className="text-slate-400 text-[11px]">
                  Stimulates mitochondrial biogenesis, type-I slow-twitch fiber capillary density, and lipid oxidation efficiency.
                </p>
              </div>

              <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 space-y-1">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400" /> Expected Trend
                </span>
                <p className="text-slate-400 text-[11px]">
                  As aerobic fitness improves, API increases because you generate more mechanical output (W/kg) at lower heart rates.
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Norwegian 4x4 HIIT Protocol */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
              <Flame className="h-4 w-4" />
              <span>Norwegian 4x4 High-Intensity Interval Protocol</span>
            </div>

            <p className="text-slate-300">
              Pioneered by exercise physiologists Jan Helgerud and Jan Hoff at the Norwegian University of Science and Technology (NTNU), the 4x4 protocol is widely regarded as the most effective method for increasing VO2 max and stroke volume.
            </p>

            <div className="bg-slate-900/90 rounded-xl p-3.5 border border-slate-800 space-y-2 text-xs">
              <div className="font-bold text-white flex items-center gap-2">
                <Activity className="h-4 w-4 text-rose-400" /> Protocol Execution Standard:
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-300 font-mono text-[11px]">
                <li><strong>Work Intervals:</strong> 4 intervals of 4 minutes at 90–95% HRmax (approx. 10k to 5k race pace).</li>
                <li><strong>Recovery Intervals:</strong> 3 minutes active recovery at ~60–70% HRmax between work bouts.</li>
                <li><strong>Primary Goal:</strong> Sustained maximal cardiac output and stroke volume without total acidosis saturation.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/20"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
