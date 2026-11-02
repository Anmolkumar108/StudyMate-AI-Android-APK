import {
  DEFAULT_POMODORO_SETTINGS,
  DEFAULT_POMODORO_STATS,
  PomodoroPersistedData,
  PomodoroSettings,
  PomodoroStats,
} from '../../types/pomodoro';
import { inMemoryAdapter, StorageAdapter } from './token-storage';

export const POMODORO_STORAGE_KEY = 'studymate_pomodoro_data';
export const POMODORO_SETTINGS_KEY = 'studymate_pomodoro_settings';
export const POMODORO_STATS_KEY = 'studymate_pomodoro_stats';

/**
 * Returns formatted YYYY-MM-DD string in the device's local calendar day.
 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function createDefaultAdapter(): StorageAdapter {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SecureStore = require('expo-secure-store');
    if (SecureStore && typeof SecureStore.getItemAsync === 'function') {
      return {
        getItem: async (key: string) => SecureStore.getItemAsync(key),
        setItem: async (key: string, value: string) =>
          SecureStore.setItemAsync(key, value, {
            keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
          }),
        deleteItem: async (key: string) => SecureStore.deleteItemAsync(key),
      };
    }
  } catch {
    // Falls back to in-memory adapter on Web, Node, or Test
  }
  return inMemoryAdapter;
}

let activeAdapter: StorageAdapter = createDefaultAdapter();

export function setPomodoroStorageAdapter(adapter: StorageAdapter): void {
  activeAdapter = adapter;
}

export function resetPomodoroStorageAdapter(): void {
  activeAdapter = createDefaultAdapter();
}

/**
 * Loads the persisted Pomodoro timer data (state, settings, stats).
 */
export async function loadPomodoroData(): Promise<PomodoroPersistedData | null> {
  try {
    const raw = await activeAdapter.getItem(POMODORO_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PomodoroPersistedData;
  } catch {
    return null;
  }
}

/**
 * Persists the entire Pomodoro bundle.
 */
export async function savePomodoroData(data: PomodoroPersistedData): Promise<void> {
  try {
    await activeAdapter.setItem(POMODORO_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Graceful fallback if storage write fails
  }
}

/**
 * Clears persisted timer session data.
 */
export async function clearPomodoroData(): Promise<void> {
  try {
    await activeAdapter.deleteItem(POMODORO_STORAGE_KEY);
  } catch {
    // Ignore error
  }
}

/**
 * Loads user Pomodoro settings with fallback to defaults.
 */
export async function loadPomodoroSettings(): Promise<PomodoroSettings> {
  try {
    const raw = await activeAdapter.getItem(POMODORO_SETTINGS_KEY);
    if (!raw) return DEFAULT_POMODORO_SETTINGS;
    return { ...DEFAULT_POMODORO_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_POMODORO_SETTINGS;
  }
}

/**
 * Persists user Pomodoro settings.
 */
export async function savePomodoroSettings(settings: PomodoroSettings): Promise<void> {
  try {
    await activeAdapter.setItem(POMODORO_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore error
  }
}

/**
 * Loads historical focus session statistics.
 * Resets todayCompletedSessions if the last recorded session was on a previous local day.
 */
export async function loadPomodoroStats(): Promise<PomodoroStats> {
  try {
    const raw = await activeAdapter.getItem(POMODORO_STATS_KEY);
    if (!raw) return DEFAULT_POMODORO_STATS;
    const stats = JSON.parse(raw) as PomodoroStats;

    // Reset today's count if last session was on a previous calendar day (local time)
    const todayLocal = getLocalDateString(new Date());
    const lastDateLocal = stats.lastCompletedDate
      ? getLocalDateString(new Date(stats.lastCompletedDate))
      : null;

    if (lastDateLocal !== todayLocal) {
      return {
        ...stats,
        todayCompletedSessions: 0,
      };
    }

    return stats;
  } catch {
    return DEFAULT_POMODORO_STATS;
  }
}

/**
 * Persists updated focus session statistics.
 */
export async function savePomodoroStats(stats: PomodoroStats): Promise<void> {
  try {
    await activeAdapter.setItem(POMODORO_STATS_KEY, JSON.stringify(stats));
  } catch {
    // Ignore error
  }
}

/**
 * Records completion of a focus session and returns updated statistics.
 * Accurately calculates today's count based on the local calendar day.
 */
export async function recordFocusSessionCompletion(
  durationMinutes: number
): Promise<PomodoroStats> {
  const currentStats = await loadPomodoroStats();
  const now = new Date();
  const todayLocal = getLocalDateString(now);
  const lastDateLocal = currentStats.lastCompletedDate
    ? getLocalDateString(new Date(currentStats.lastCompletedDate))
    : null;

  const todayCount =
    lastDateLocal === todayLocal ? currentStats.todayCompletedSessions + 1 : 1;

  const updated: PomodoroStats = {
    totalCompletedSessions: currentStats.totalCompletedSessions + 1,
    totalFocusMinutes: currentStats.totalFocusMinutes + durationMinutes,
    todayCompletedSessions: todayCount,
    lastCompletedDate: now.toISOString(),
  };

  await savePomodoroStats(updated);
  return updated;
}
