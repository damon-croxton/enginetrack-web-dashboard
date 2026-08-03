import { Zone2Run, Norwegian4x4Session, MiscRun } from '../types';

/**
 * JSON backup of the whole dataset.
 *
 * Once the app is installed to a home screen, the device is the only copy of
 * the user's training history — there is no account and no server. This is the
 * way data gets off it: before a browser clears storage, when moving to a new
 * phone, or after an accidental "Clear All Workouts".
 */
export interface EngineTrackBackup {
  format: 'enginetrack-backup';
  /** Bumped only for breaking shape changes, so imports can be checked. */
  version: 1;
  exportedAt: string;
  restingHR: number;
  maxHR: number;
  zone2Runs: Zone2Run[];
  norwegianSessions: Norwegian4x4Session[];
  miscRuns: MiscRun[];
}

export interface BackupContents {
  restingHR: number;
  maxHR: number;
  zone2Runs: Zone2Run[];
  norwegianSessions: Norwegian4x4Session[];
  miscRuns: MiscRun[];
}

export function buildBackup(contents: BackupContents): EngineTrackBackup {
  return {
    format: 'enginetrack-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    ...contents,
  };
}

/** Triggers a download of the dataset as a dated .json file. */
export function downloadBackup(contents: BackupContents): void {
  const backup = buildBackup(contents);
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `enginetrack-backup-${backup.exportedAt.slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();

  // Safari needs the object URL to outlive the click before it is revoked.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Validates and parses a backup file.
 *
 * Throws with a message meant for the user — restoring a backup is exactly when
 * a vague failure is most damaging.
 */
export async function readBackupFile(file: File): Promise<BackupContents> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error(`"${file.name}" is not valid JSON.`);
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('That file does not contain an EngineTrack backup.');
  }

  const backup = parsed as Partial<EngineTrackBackup>;

  if (backup.format !== 'enginetrack-backup') {
    throw new Error(
      'That file is not an EngineTrack backup. Use the JSON file produced by "Export Backup".'
    );
  }

  if (backup.version !== 1) {
    throw new Error(
      `This backup was written by a newer version of EngineTrack (format ${backup.version}).`
    );
  }

  const zone2Runs = Array.isArray(backup.zone2Runs) ? backup.zone2Runs : [];
  const norwegianSessions = Array.isArray(backup.norwegianSessions) ? backup.norwegianSessions : [];
  const miscRuns = Array.isArray(backup.miscRuns) ? backup.miscRuns : [];

  if (zone2Runs.length + norwegianSessions.length + miscRuns.length === 0) {
    throw new Error('That backup contains no workouts.');
  }

  return {
    restingHR: Number(backup.restingHR) || 55,
    maxHR: Number(backup.maxHR) || 188,
    zone2Runs,
    norwegianSessions,
    miscRuns,
  };
}
