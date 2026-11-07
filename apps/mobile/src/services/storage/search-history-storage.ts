import { inMemoryAdapter, StorageAdapter } from './token-storage';

export const SEARCH_HISTORY_STORAGE_KEY = 'studymate_search_history';
export const MAX_SEARCH_HISTORY_ITEMS = 10;

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
    // Falls back to in-memory adapter on Web or test runner
  }
  return inMemoryAdapter;
}

let activeAdapter: StorageAdapter = createDefaultAdapter();

export function setSearchHistoryStorageAdapter(adapter: StorageAdapter): void {
  activeAdapter = adapter;
}

export function resetSearchHistoryStorageAdapter(): void {
  activeAdapter = createDefaultAdapter();
}

export async function loadRecentSearches(): Promise<string[]> {
  try {
    const raw = await activeAdapter.getItem(SEARCH_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
    }
  } catch {
    // Graceful fallback
  }
  return [];
}

export async function addRecentSearch(term: string): Promise<string[]> {
  const clean = term.trim();
  if (!clean) return loadRecentSearches();

  try {
    const current = await loadRecentSearches();
    const updated = [clean, ...current.filter((item) => item.toLowerCase() !== clean.toLowerCase())].slice(
      0,
      MAX_SEARCH_HISTORY_ITEMS
    );
    await activeAdapter.setItem(SEARCH_HISTORY_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [clean];
  }
}

export async function removeRecentSearch(term: string): Promise<string[]> {
  try {
    const current = await loadRecentSearches();
    const updated = current.filter((item) => item.toLowerCase() !== term.toLowerCase().trim());
    await activeAdapter.setItem(SEARCH_HISTORY_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export async function clearRecentSearches(): Promise<void> {
  try {
    await activeAdapter.deleteItem(SEARCH_HISTORY_STORAGE_KEY);
  } catch {
    // Ignore error
  }
}

