import { Exam } from '../../types/exam';
import { inMemoryAdapter, StorageAdapter } from './token-storage';

export const EXAMS_CACHE_KEY = 'studymate_exams_cache';

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

export async function saveCachedExams(exams: Exam[]): Promise<void> {
  try {
    await activeAdapter.setItem(EXAMS_CACHE_KEY, JSON.stringify(exams));
  } catch {
    // Graceful fallback
  }
}

export async function loadCachedExams(): Promise<Exam[]> {
  try {
    const raw = await activeAdapter.getItem(EXAMS_CACHE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Exam[];
  } catch {
    return [];
  }
}

