import { AIChatSession } from '../../types/ai';
import { inMemoryAdapter, StorageAdapter } from './token-storage';

export const CHAT_SESSIONS_CACHE_KEY = 'studymate_chat_sessions_cache';

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

export async function saveCachedChatSessions(sessions: AIChatSession[]): Promise<void> {
  try {
    await activeAdapter.setItem(CHAT_SESSIONS_CACHE_KEY, JSON.stringify(sessions));
  } catch {
    // Graceful fallback
  }
}

export async function loadCachedChatSessions(): Promise<AIChatSession[]> {
  try {
    const raw = await activeAdapter.getItem(CHAT_SESSIONS_CACHE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as AIChatSession[];
  } catch {
    return [];
  }
}

