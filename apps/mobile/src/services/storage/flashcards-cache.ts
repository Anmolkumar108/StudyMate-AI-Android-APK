import { FlashcardDeck } from '../../types/flashcard';
import { inMemoryAdapter, StorageAdapter } from './token-storage';

export const FLASHCARDS_CACHE_KEY = 'studymate_flashcards_cache';

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

export function setFlashcardsCacheAdapter(adapter: StorageAdapter): void {
  activeAdapter = adapter;
}

export function resetFlashcardsCacheAdapter(): void {
  activeAdapter = createDefaultAdapter();
}

/**
 * Persists the latest loaded list of flashcard decks to local storage.
 */
export async function saveCachedDecks(decks: FlashcardDeck[]): Promise<void> {
  try {
    await activeAdapter.setItem(FLASHCARDS_CACHE_KEY, JSON.stringify(decks));
  } catch {
    // Graceful fallback
  }
}

/**
 * Retrieves previously cached flashcard decks from local storage for offline viewing.
 */
export async function loadCachedDecks(): Promise<FlashcardDeck[]> {
  try {
    const raw = await activeAdapter.getItem(FLASHCARDS_CACHE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as FlashcardDeck[];
  } catch {
    return [];
  }
}

/**
 * Clears flashcards cache.
 */
export async function clearCachedDecks(): Promise<void> {
  try {
    await activeAdapter.deleteItem(FLASHCARDS_CACHE_KEY);
  } catch {
    // Ignore error
  }
}

