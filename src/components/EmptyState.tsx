import React from 'react';
import { LucideIcon, UploadCloud, RotateCcw } from 'lucide-react';

/**
 * Full literal class strings — Tailwind extracts class names statically, so an
 * interpolated `bg-${accent}-950` would never be generated.
 */
const ACCENT_TILE = {
  cyan: 'bg-cyan-950/80 text-cyan-400 border-cyan-800/80',
  purple: 'bg-purple-950/80 text-purple-400 border-purple-800/80',
  emerald: 'bg-emerald-950/80 text-emerald-400 border-emerald-800/80',
  amber: 'bg-amber-950/80 text-amber-400 border-amber-800/80',
  indigo: 'bg-indigo-950/80 text-indigo-400 border-indigo-800/80',
} as const;

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  message: string;
  accent?: keyof typeof ACCENT_TILE;
  onOpenAppleHealthModal?: () => void;
  onResetData?: () => void;
}

/**
 * Shown when a view has no data to work with.
 *
 * Views must render this rather than falling through to their normal layout —
 * several of them substitute placeholder constants for missing figures, which
 * would otherwise present invented numbers as if they were real results.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  message,
  accent = 'cyan',
  onOpenAppleHealthModal,
  onResetData,
}) => {
  return (
    <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-8 sm:p-12 text-center max-w-2xl mx-auto my-12 space-y-6 shadow-2xl">
      <div
        className={`w-16 h-16 border rounded-2xl flex items-center justify-center mx-auto shadow-inner ${ACCENT_TILE[accent]}`}
      >
        <Icon className="h-8 w-8" />
      </div>

      <div className="space-y-2">
        <h3 className="text-xl font-bold text-white">{title}</h3>
        <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">{message}</p>
      </div>

      {(onOpenAppleHealthModal || onResetData) && (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          {onOpenAppleHealthModal && (
            <button
              onClick={onOpenAppleHealthModal}
              className="w-full sm:w-auto px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/50 transition-all"
            >
              <UploadCloud className="h-4 w-4" />
              <span>Import Apple Health File</span>
            </button>
          )}
          {onResetData && (
            <button
              onClick={onResetData}
              className="w-full sm:w-auto px-5 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 border border-slate-600 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all"
            >
              <RotateCcw className="h-4 w-4 text-slate-300" />
              <span>Load Demo Sample Data</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
