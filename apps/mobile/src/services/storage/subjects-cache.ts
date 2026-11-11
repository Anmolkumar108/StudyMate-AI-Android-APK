import { Subject } from '../../types/subject';
import { inMemoryAdapter, StorageAdapter } from './token-storage';

export const SUBJECTS_CACHE_KEY = 'studymate_subjects_cache';

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

export function setSubjectsCacheAdapter(adapter: StorageAdapter): void {
  activeAdapter = adapter;
}

export function resetSubjectsCacheAdapter(): void {
  activeAdapter = createDefaultAdapter();
}

/**
 * Persists the latest loaded list of academic subjects to local storage.
 */
export async function saveCachedSubjects(subjects: Subject[]): Promise<void> {
  try {
    await activeAdapter.setItem(SUBJECTS_CACHE_KEY, JSON.stringify(subjects));
  } catch {
    // Graceful fallback
  }
}

/**
 * Retrieves previously cached subjects from local storage for offline viewing.
 */
export async function loadCachedSubjects(): Promise<Subject[]> {
  try {
    const raw = await activeAdapter.getItem(SUBJECTS_CACHE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Subject[];
  } catch {
    return [];
  }
}

/**
 * Clears subjects cache.
 */
export async function clearCachedSubjects(): Promise<void> {
  try {
    await activeAdapter.deleteItem(SUBJECTS_CACHE_KEY);
  } catch {
    // Ignore error
  }
}

