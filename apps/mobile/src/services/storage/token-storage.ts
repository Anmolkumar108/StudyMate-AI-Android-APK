import type { AuthTokens } from '../../types/auth';

/**
 * Hardware-backed Secure Token Storage for StudyMate AI.
 *
 * In Android/iOS: Uses Expo SecureStore (backed by Android Keystore / iOS Keychain).
 * In Web / Node / Test: Uses an isolated in-memory adapter so tests and web runs work
 * seamlessly without throwing native bridge errors.
 *
 * Security Invariants:
 * - Passwords are NEVER stored.
 * - Access and Refresh tokens are NEVER logged.
 * - All tokens are cleared on logout and terminal session expiration.
 */

export const ACCESS_TOKEN_KEY = 'studymate_access_token';
export const REFRESH_TOKEN_KEY = 'studymate_refresh_token';

export interface StorageAdapter {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  deleteItem: (key: string) => Promise<void>;
}

// In-memory adapter
class InMemoryStorageAdapter implements StorageAdapter {
  private store = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async deleteItem(key: string): Promise<void> {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

export const inMemoryAdapter = new InMemoryStorageAdapter();

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
    // SecureStore not available in this environment (e.g. Node tests, Web)
  }
  return inMemoryAdapter;
}

let activeAdapter: StorageAdapter = createDefaultAdapter();

export function setStorageAdapter(adapter: StorageAdapter): void {
  activeAdapter = adapter;
}

export function resetStorageAdapter(): void {
  inMemoryAdapter.clear();
  activeAdapter = createDefaultAdapter();
}

export async function getAccessToken(): Promise<string | null> {
  try {
    return await activeAdapter.getItem(ACCESS_TOKEN_KEY);
  } catch (error) {
    console.error('Failed to read access token from secure storage:', (error as Error).message);
    return null;
  }
}

export async function getRefreshToken(): Promise<string | null> {
  try {
    return await activeAdapter.getItem(REFRESH_TOKEN_KEY);
  } catch (error) {
    console.error('Failed to read refresh token from secure storage:', (error as Error).message);
    return null;
  }
}

export async function getTokens(): Promise<{ accessToken: string | null; refreshToken: string | null }> {
  const [accessToken, refreshToken] = await Promise.all([
    getAccessToken(),
    getRefreshToken(),
  ]);
  return { accessToken, refreshToken };
}

export async function saveTokens(tokens: AuthTokens): Promise<void> {
  if (!tokens.accessToken || !tokens.refreshToken) {
    throw new Error('Cannot store empty tokens.');
  }

  try {
    await Promise.all([
      activeAdapter.setItem(ACCESS_TOKEN_KEY, tokens.accessToken),
      activeAdapter.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken),
    ]);
  } catch (error) {
    console.error('Failed to save tokens to secure storage:', (error as Error).message);
    throw error;
  }
}

export async function clearTokens(): Promise<void> {
  try {
    await Promise.allSettled([
      activeAdapter.deleteItem(ACCESS_TOKEN_KEY),
      activeAdapter.deleteItem(REFRESH_TOKEN_KEY),
    ]);
  } catch (error) {
    console.error('Failed to clear tokens from secure storage:', (error as Error).message);
  }
}

export async function hasTokens(): Promise<boolean> {
  const { accessToken, refreshToken } = await getTokens();
  return Boolean(accessToken || refreshToken);
}
