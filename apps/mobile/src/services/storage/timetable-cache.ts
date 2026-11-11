import { AttendanceSummaryResponse, WeeklyTimetableResponse } from '../../types/timetable';
import { inMemoryAdapter, StorageAdapter } from './token-storage';

export const TIMETABLE_CACHE_KEY = 'studymate_timetable_cache';
export const ATTENDANCE_SUMMARY_CACHE_KEY = 'studymate_attendance_summary_cache';

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
    // Fallback on Web or Node tests
  }
  return inMemoryAdapter;
}

let activeAdapter: StorageAdapter = createDefaultAdapter();

export function setTimetableCacheAdapter(adapter: StorageAdapter): void {
  activeAdapter = adapter;
}

export function resetTimetableCacheAdapter(): void {
  activeAdapter = createDefaultAdapter();
}

/**
 * Persists the latest weekly timetable response to local storage for offline viewing.
 */
export async function saveCachedTimetable(weeklyData: WeeklyTimetableResponse): Promise<void> {
  try {
    await activeAdapter.setItem(TIMETABLE_CACHE_KEY, JSON.stringify(weeklyData));
  } catch {
    // Graceful fallback
  }
}

/**
 * Retrieves previously cached timetable data.
 */
export async function loadCachedTimetable(): Promise<WeeklyTimetableResponse | null> {
  try {
    const raw = await activeAdapter.getItem(TIMETABLE_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as WeeklyTimetableResponse;
  } catch {
    return null;
  }
}

/**
 * Persists the latest attendance summary response.
 */
export async function saveCachedAttendanceSummary(
  summary: AttendanceSummaryResponse | null
): Promise<void> {
  try {
    if (!summary) {
      await activeAdapter.deleteItem(ATTENDANCE_SUMMARY_CACHE_KEY);
      return;
    }
    await activeAdapter.setItem(ATTENDANCE_SUMMARY_CACHE_KEY, JSON.stringify(summary));
  } catch {
    // Graceful fallback
  }
}

/**
 * Retrieves previously cached attendance summary.
 */
export async function loadCachedAttendanceSummary(): Promise<AttendanceSummaryResponse | null> {
  try {
    const raw = await activeAdapter.getItem(ATTENDANCE_SUMMARY_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AttendanceSummaryResponse;
  } catch {
    return null;
  }
}

/**
 * Clears timetable & attendance cache.
 */
export async function clearCachedTimetable(): Promise<void> {
  try {
    await activeAdapter.deleteItem(TIMETABLE_CACHE_KEY);
    await activeAdapter.deleteItem(ATTENDANCE_SUMMARY_CACHE_KEY);
  } catch {
    // Ignore error
  }
}

