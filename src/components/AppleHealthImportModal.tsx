import React, { useState } from 'react';
import { parseAppleHealthFile, ParsedAppleHealthData } from '../utils/appleHealthParser';
import { loadDemoWorkouts, syncHealthKit, isHealthKitSupported } from '../utils/healthKitSync';
import { Zone2Run, Norwegian4x4Session } from '../types';
import {
  X,
  UploadCloud,
  FileCheck,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Activity,
  Flame,
  ArrowRight,
  HardDrive,
  Smartphone,
  FileCode,
  Zap,
  RefreshCw,
  Info
} from 'lucide-react';

interface AppleHealthImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (parsed: ParsedAppleHealthData, replaceExisting: boolean) => void;
}

export const AppleHealthImportModal: React.FC<AppleHealthImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
}) => {
  const isNative = isHealthKitSupported();
  const [sourceMode, setSourceMode] = useState<'exportXml' | 'healthKitApi'>(
    isNative ? 'healthKitApi' : 'exportXml'
  );
  const [isParsing, setIsParsing] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [parsedData, setParsedData] = useState<ParsedAppleHealthData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [replaceExisting, setReplaceExisting] = useState(true);

  if (!isOpen) return null;

  const handleHealthKitDirectSync = async () => {
    setErrorMessage(null);
    setIsParsing(true);
    setProgressPercent(10);
    setStatusText(isNative ? 'Requesting Apple Health access...' : 'Loading sample workouts...');

    const onProgress = (percent: number, text: string) => {
      setProgressPercent(percent);
      setStatusText(text);
    };

    try {
      // Only the native bridge yields real data; everything else is samples.
      const result = isNative
        ? await syncHealthKit(onProgress)
        : await loadDemoWorkouts(onProgress);
      setParsedData(result);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(
        err.message ||
          (isNative ? 'Apple Health sync failed.' : 'Failed to load sample workouts.')
      );
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const processFile = async (file: File) => {
    setErrorMessage(null);
    setIsParsing(true);
    setProgressPercent(5);
    setStatusText('Preparing file for local parsing...');

    try {
      const result = await parseAppleHealthFile(file, (percent, text) => {
        setProgressPercent(percent);
        setStatusText(text);
      });

      if (result.isCdaFile) {
        setErrorMessage('You selected "export_cda.xml", which contains clinical documents. Please select "export.xml" or "export.zip" instead.');
        setParsedData(null);
      } else {
        setParsedData(result);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Failed to parse Apple Health file. Ensure export.xml or export.zip is selected.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleConfirmImport = () => {
    if (!parsedData) return;
    onImportSuccess(parsedData, replaceExisting);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-850">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-950 text-cyan-400 border border-cyan-800">
              <UploadCloud className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-white text-base sm:text-lg">
                  Import Apple Health Data
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" /> 100% On-Device
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Select your Apple Health <code className="text-cyan-300 font-mono">export.zip</code> or <code className="text-cyan-300 font-mono">export.xml</code> file
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
        <div className="p-6 space-y-6">
          {/* Data Source Mode Toggle Switch */}
          <div className="bg-slate-950 p-1.5 rounded-2xl border border-slate-800 grid grid-cols-2 gap-2 text-xs">
            <button
              onClick={() => {
                setSourceMode('healthKitApi');
                setParsedData(null);
                setErrorMessage(null);
              }}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold transition-all ${
                sourceMode === 'healthKitApi'
                  ? 'bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 shadow-md font-extrabold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Smartphone className="h-4 w-4" />
              <span>{isNative ? 'Direct HealthKit Sync (iOS)' : 'Sample Data (Demo)'}</span>
            </button>

            <button
              onClick={() => {
                setSourceMode('exportXml');
                setParsedData(null);
                setErrorMessage(null);
              }}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold transition-all ${
                sourceMode === 'exportXml'
                  ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-md font-extrabold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <FileCode className="h-4 w-4" />
              <span>Apple export.xml File Upload</span>
            </button>
          </div>

          {/* Mode Guidance & Security Banner */}
          {sourceMode === 'healthKitApi' ? (
            isNative ? (
              <div className="bg-cyan-950/40 border border-cyan-800/80 rounded-xl p-3.5 flex items-start gap-3">
                <Zap className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" />
                <div className="text-xs text-cyan-200/90 leading-relaxed">
                  <strong className="text-cyan-300 font-semibold block mb-0.5">Live Apple HealthKit Device Sync</strong>
                  Queries workouts, heart rate samples, resting HR, and max HR directly from your Apple Watch / iPhone Health database via native HealthKit framework.
                </div>
              </div>
            ) : (
              /* No native bridge here, so this tab can only produce invented data.
                 Say so plainly rather than describing a device sync that isn't happening. */
              <div className="bg-amber-950/40 border border-amber-800/80 rounded-xl p-3.5 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-200/90 leading-relaxed">
                  <strong className="text-amber-300 font-semibold block mb-0.5">Sample data — not from your device</strong>
                  HealthKit is unavailable in a browser, so this tab loads four invented
                  workouts for testing the dashboard. The numbers are not yours. Use the
                  file upload tab for your real Apple Health data.
                </div>
              </div>
            )
          ) : (
            <div className="bg-emerald-950/40 border border-emerald-800/80 rounded-xl p-3.5 flex items-start gap-3">
              <HardDrive className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-xs text-emerald-200/90 leading-relaxed">
                <strong className="text-emerald-300 font-semibold block mb-0.5">Local In-Browser XML Processing</strong>
                Your health file is parsed directly inside your device's browser using local streaming JavaScript. No health records are transmitted to any server.
              </div>
            </div>
          )}

          {!parsedData ? (
            sourceMode === 'healthKitApi' ? (
              /* HealthKit Direct Sync Card */
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-5 text-center">
                {isParsing ? (
                  <div className="space-y-4 py-4">
                    <Loader2 className="h-10 w-10 text-cyan-400 animate-spin mx-auto" />
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-white">{statusText}</p>
                      <p className="text-xs text-slate-400 font-mono">{progressPercent}% Completed</p>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden max-w-md mx-auto">
                      <div
                        className="bg-gradient-to-r from-cyan-500 to-emerald-400 h-full transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="w-16 h-16 rounded-2xl bg-cyan-950/80 border border-cyan-800 text-cyan-400 flex items-center justify-center mx-auto shadow-lg shadow-cyan-500/10">
                      <Smartphone className="h-8 w-8 text-cyan-400" />
                    </div>

                    <div>
                      <h4 className="text-base font-bold text-white">
                        {isNative ? 'Apple HealthKit Native Bridge' : 'Sample Workouts'}
                      </h4>
                      <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                        {isNative
                          ? 'One-tap sync to pull latest workouts, running paces, and heart rate samples directly into EngineTrack.'
                          : 'Web browsers (Safari/Chrome) cannot access HealthKit directly due to iOS privacy rules. This button loads 4 invented workouts so you can exercise the dashboard.'}
                      </p>
                    </div>

                    {!isNative && (
                      <div className="bg-amber-950/40 border border-amber-800/80 rounded-xl p-3 text-xs text-amber-300 text-left flex items-start gap-2.5">
                        <Info className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                        <div>
                          <strong>Want your real iPhone workouts?</strong> Switch to the{' '}
                          <button
                            onClick={() => setSourceMode('exportXml')}
                            className="underline font-bold hover:text-amber-200"
                          >
                            Apple export.xml File Upload
                          </button>{' '}
                          tab to load your exported <code className="font-mono text-amber-200">export.zip</code> or <code className="font-mono text-amber-200">export.xml</code>.
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 text-left max-w-md mx-auto">
                      <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl space-y-1">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">HealthKit Mode</div>
                        <div className={`text-xs font-bold flex items-center gap-1 ${isNative ? 'text-emerald-400' : 'text-amber-400'}`}>
                          <CheckCircle2 className="h-3.5 w-3.5" /> {isNative ? 'Native Bridge' : 'Demo / Sample Mode'}
                        </div>
                      </div>
                      <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl space-y-1">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">
                          {isNative ? 'Auto Physiology' : 'Sample Physiology'}
                        </div>
                        <div className={`text-xs font-bold font-mono ${isNative ? 'text-cyan-300' : 'text-amber-300'}`}>
                          Rest: 52 / Max: 188
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleHealthKitDirectSync}
                      className="w-full max-w-md py-3 px-6 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-extrabold text-sm shadow-xl shadow-cyan-500/20 flex items-center justify-center gap-2 mx-auto transition-all"
                    >
                      <RefreshCw className="h-4 w-4" />
                      <span>{isNative ? 'Sync Workouts via HealthKit' : 'Load Sample Workouts (Demo)'}</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* Upload Dropzone for export.xml */
              <div className="space-y-4">
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
                    isParsing
                      ? 'border-cyan-500/50 bg-slate-950/80'
                      : 'border-slate-700 hover:border-cyan-500 hover:bg-slate-800/50 cursor-pointer bg-slate-950/40'
                  }`}
                >
                  {isParsing ? (
                    <div className="space-y-4 py-4">
                      <Loader2 className="h-10 w-10 text-cyan-400 animate-spin mx-auto" />
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-white">{statusText}</p>
                        <p className="text-xs text-slate-400 font-mono">{progressPercent}% Completed</p>
                      </div>
                      {/* Progress Bar */}
                      <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden max-w-md mx-auto">
                        <div
                          className="bg-gradient-to-r from-cyan-500 to-emerald-400 h-full transition-all duration-300"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <label className="block space-y-3 cursor-pointer">
                      <div className="w-14 h-14 rounded-2xl bg-cyan-950/60 border border-cyan-800 text-cyan-400 flex items-center justify-center mx-auto shadow-lg shadow-cyan-500/10">
                        <FileCheck className="h-7 w-7" />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-white block">
                          Drop your Apple Health <code className="text-cyan-300">export.zip</code> or <code className="text-cyan-300">export.xml</code> here
                        </span>
                        <span className="text-xs text-slate-400 mt-1 block">
                          or tap to browse files on your iPhone / PC
                        </span>
                      </div>
                      <input
                        type="file"
                        accept=".zip,.xml"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                {/* Step-by-step export instructions for iPhone */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs text-slate-300 space-y-2">
                  <div className="font-bold text-cyan-400 flex items-center gap-1.5">
                    <Smartphone className="h-4 w-4" /> How to export your real data on iPhone:
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-slate-400 leading-relaxed pl-1">
                    <li>Open the <strong className="text-slate-200">Health</strong> app on your iPhone.</li>
                    <li>Tap your <strong className="text-slate-200">Profile icon</strong> in the top-right corner.</li>
                    <li>Scroll down and tap <strong className="text-slate-200">Export All Health Data</strong>.</li>
                    <li>Choose <strong className="text-slate-200">Save to Files</strong> or AirDrop <code className="text-cyan-300 font-mono">export.zip</code>.</li>
                    <li>Tap the upload box above and select your <code className="text-cyan-300 font-mono">export.zip</code> file!</li>
                  </ol>
                </div>
              </div>
            )
          ) : (
            /* Parsed Summary Review */
            <div className="space-y-4">
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    <span className="font-bold text-white text-sm">Parsing Complete</span>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    {parsedData.runningWorkoutsFound} running workouts extracted
                  </span>
                </div>

                {/* Physiology baselines: state plainly whether these were detected
                    or fell back to defaults, since HRR metrics depend on them. */}
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <span className={`px-2 py-1 rounded-lg border font-mono ${
                    parsedData.restingHRDetected
                      ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                      : 'bg-slate-900 border-slate-700 text-slate-400'
                  }`}>
                    Resting HR: {parsedData.detectedRestingHR}
                    <span className="ml-1 font-sans">
                      {parsedData.restingHRDetected ? 'detected' : '(default — none found)'}
                    </span>
                  </span>
                  <span className={`px-2 py-1 rounded-lg border font-mono ${
                    parsedData.maxHRDetected
                      ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                      : 'bg-slate-900 border-slate-700 text-slate-400'
                  }`}>
                    Max HR: {parsedData.detectedMaxHR}
                    <span className="ml-1 font-sans">
                      {parsedData.maxHRDetected ? 'detected' : '(default — none found)'}
                    </span>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-cyan-400 font-bold">
                      <Activity className="h-4 w-4" /> Zone 2 Runs Identified:
                    </div>
                    <div className="text-2xl font-extrabold text-white font-mono">
                      {parsedData.zone2Runs.length}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Aerobic runs with API calculations
                    </p>
                  </div>

                  <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-rose-400 font-bold">
                      <Flame className="h-4 w-4" /> Norwegian 4x4 Sessions:
                    </div>
                    <div className="text-2xl font-extrabold text-white font-mono">
                      {parsedData.norwegianSessions.length}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      High-intensity interval sessions
                    </p>
                  </div>

                  <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-purple-400 font-bold">
                      <HardDrive className="h-4 w-4" /> Misc / General Runs:
                    </div>
                    <div className="text-2xl font-extrabold text-white font-mono">
                      {parsedData.miscRuns ? parsedData.miscRuns.length : 0}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      5K time trials, tempos & shakeouts
                    </p>
                  </div>
                </div>
              </div>

              {/* A parse that found nothing is far more likely to be a failure
                  than a genuine absence of runs. Never present it as success. */}
              {parsedData.runningWorkoutsFound === 0 && (
                <div className="bg-rose-950/50 border border-rose-800 rounded-xl p-3.5 flex items-start gap-3">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                  <div className="text-xs text-rose-200/90 leading-relaxed space-y-1.5">
                    <strong className="text-rose-300 font-semibold block">
                      No running workouts were found in that file
                    </strong>
                    <p>
                      If you know this export contains runs, the file most likely did not
                      read correctly rather than being empty.
                    </p>
                    <p>
                      On iPhone, open the <strong className="text-rose-100">Files</strong> app,
                      press and hold <code className="font-mono text-rose-100">export.zip</code>,
                      choose <strong className="text-rose-100">Uncompress</strong>, then import
                      the <code className="font-mono text-rose-100">export.xml</code> inside the
                      new folder.
                    </p>
                  </div>
                </div>
              )}

              {/* What the parser actually saw. Without this, a wrong-looking
                  classification can only be guessed at from a distance. */}
              {parsedData.diagnostics.runningWorkoutsSeen > 0 && (
                <details className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                  <summary className="px-4 py-3 text-[11px] font-bold text-slate-300 cursor-pointer hover:text-cyan-300 transition-colors">
                    Parser details
                  </summary>
                  <div className="px-4 pb-3 text-[11px] font-mono text-slate-400 space-y-1">
                    <div className="flex justify-between gap-4">
                      <span>Running workouts seen</span>
                      <span className="text-slate-200">{parsedData.diagnostics.runningWorkoutsSeen}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>…with interval bouts</span>
                      <span className="text-slate-200">{parsedData.diagnostics.workoutsWithActivities}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Interval bouts found</span>
                      <span className="text-slate-200">{parsedData.diagnostics.activitiesSeen}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>…missing heart rate</span>
                      <span className="text-slate-200">{parsedData.diagnostics.activitiesMissingHR}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>…missing distance</span>
                      <span className="text-slate-200">{parsedData.diagnostics.activitiesMissingDistance}</span>
                    </div>
                  </div>
                </details>
              )}

              {/* Deliberate exclusions - shown so a missing session is never a mystery */}
              {parsedData.rejectedSessions > 0 && (
                <div className="bg-amber-950/40 border border-amber-800/80 rounded-xl p-3.5 flex items-start gap-3">
                  <Info className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                  <div className="text-xs text-amber-200/90 leading-relaxed">
                    <strong className="text-amber-300 font-semibold block mb-0.5">
                      {parsedData.rejectedSessions} interval session
                      {parsedData.rejectedSessions === 1 ? '' : 's'} excluded
                    </strong>
                    No work bout fell within 3m55s–4m05s, so these were treated as
                    malformed 4x4 attempts and left out of the dataset.
                  </div>
                </div>
              )}

              {/* Replace Sample Data Option. Hidden on a zero result: replacing
                  existing workouts with nothing is pure data loss. */}
              {parsedData.runningWorkoutsFound > 0 && (
              <label className="flex items-start gap-3 p-3.5 bg-slate-950 border border-slate-800 rounded-xl cursor-pointer hover:border-cyan-500/50 transition-all group">
                <input
                  type="checkbox"
                  checked={replaceExisting}
                  onChange={(e) => setReplaceExisting(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-cyan-500 focus:ring-cyan-500 border-slate-700 bg-slate-900 cursor-pointer"
                />
                <div className="text-xs space-y-0.5">
                  <span className="font-bold text-white group-hover:text-cyan-300 transition-colors block">
                    Replace existing / sample data with imported workouts
                  </span>
                  <span className="text-slate-400 block leading-normal">
                    Check this to wipe out initial demo / mock data so your graphs purely reflect your actual Apple Health export.
                  </span>
                </div>
              </label>
              )}
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex justify-between items-center">
          <button
            onClick={() => {
              setParsedData(null);
              setErrorMessage(null);
            }}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200"
          >
            {parsedData ? 'Select Different File' : 'Cancel'}
          </button>

          {parsedData && parsedData.runningWorkoutsFound > 0 && (
            <button
              onClick={handleConfirmImport}
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-bold shadow-lg shadow-cyan-500/20 flex items-center gap-2"
            >
              <span>Import {parsedData.runningWorkoutsFound} Workouts</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
