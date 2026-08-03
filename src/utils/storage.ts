/**
 * localStorage access for the dashboard.
 *
 * This is the only copy of the user's training data once the app is installed
 * to a home screen, so writes must never fail silently. Safari also clears
 * script-writable storage after seven days of no interaction — home-screen web
 * apps are exempt from that timer, but eviction under storage pressure is still
 * possible, hence `requestPersistentStorage`.
 */

export const STORAGE_KEYS = {
  zone2Runs: 'enginetrack_zone2_runs',
  norwegianSessions: 'enginetrack_4x4_sessions',
  miscRuns: 'enginetrack_misc_runs',
  restingHR: 'enginetrack_resting_hr',
  maxHR: 'enginetrack_max_hr',
  cutoffYear: 'enginetrack_cutoff_year',
} as const;

export type StorageFailure = {
  key: string;
  /** True when the write failed because the origin is out of quota. */
  isQuotaExceeded: boolean;
  message: string;
};

/** Reads and parses a JSON value, falling back when absent or corrupt. */
export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function readString(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function readNumber(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const value = Number(raw);
    return Number.isFinite(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function isQuotaError(err: unknown): boolean {
  if (!(err instanceof DOMException)) return false;
  // Safari reports quota failures under its own legacy name and code.
  return (
    err.name === 'QuotaExceededError' ||
    err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    err.code === 22 ||
    err.code === 1014
  );
}

/**
 * Writes a value, returning a describable failure rather than throwing.
 *
 * Returns null on success. Callers must surface a non-null result — a dropped
 * write means the data is gone on next launch, and the user needs to know while
 * they can still export it.
 */
export function writeValue(key: string, value: string): StorageFailure | null {
  try {
    localStorage.setItem(key, value);
    return null;
  } catch (err) {
    const quota = isQuotaError(err);
    return {
      key,
      isQuotaExceeded: quota,
      message: quota
        ? 'This device is out of space for EngineTrack, so the last change was not saved. Export a backup, then clear some data.'
        : 'The last change could not be saved to this device. Export a backup to avoid losing it.',
    };
  }
}

export function writeJSON(key: string, value: unknown): StorageFailure | null {
  try {
    return writeValue(key, JSON.stringify(value));
  } catch (err) {
    return {
      key,
      isQuotaExceeded: false,
      message: 'The last change could not be prepared for saving.',
    };
  }
}

/**
 * Asks the browser to exempt this origin from routine eviction.
 *
 * Best effort — the browser may decline, and a granted request is not an
 * absolute guarantee. Cheap enough to always attempt on startup.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
