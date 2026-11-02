import assert from 'node:assert';
import { beforeEach, describe, it } from 'node:test';

import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  getTokens,
  hasTokens,
  inMemoryAdapter,
  resetStorageAdapter,
  saveTokens,
  setStorageAdapter,
} from '../src/services/storage/token-storage';

describe('Secure Token Storage', () => {
  beforeEach(() => {
    resetStorageAdapter();
  });

  it('initially returns null for access and refresh tokens', async () => {
    const { accessToken, refreshToken } = await getTokens();
    assert.strictEqual(accessToken, null);
    assert.strictEqual(refreshToken, null);
    assert.strictEqual(await hasTokens(), false);
  });

  it('successfully saves and retrieves access and refresh tokens', async () => {
    await saveTokens({
      accessToken: 'test_access_jwt_123',
      refreshToken: 'test_refresh_opaque_456',
    });

    const access = await getAccessToken();
    const refresh = await getRefreshToken();
    const both = await getTokens();

    assert.strictEqual(access, 'test_access_jwt_123');
    assert.strictEqual(refresh, 'test_refresh_opaque_456');
    assert.strictEqual(both.accessToken, 'test_access_jwt_123');
    assert.strictEqual(both.refreshToken, 'test_refresh_opaque_456');
    assert.strictEqual(await hasTokens(), true);
  });

  it('rejects saving empty access or refresh tokens', async () => {
    await assert.rejects(
      async () => {
        await saveTokens({ accessToken: '', refreshToken: 'valid_refresh' });
      },
      { message: 'Cannot store empty tokens.' }
    );

    await assert.rejects(
      async () => {
        await saveTokens({ accessToken: 'valid_access', refreshToken: '' });
      },
      { message: 'Cannot store empty tokens.' }
    );
  });

  it('clears all tokens completely upon logout or session invalidation', async () => {
    await saveTokens({
      accessToken: 'token_to_clear_1',
      refreshToken: 'token_to_clear_2',
    });

    assert.strictEqual(await hasTokens(), true);

    await clearTokens();

    assert.strictEqual(await getAccessToken(), null);
    assert.strictEqual(await getRefreshToken(), null);
    assert.strictEqual(await hasTokens(), false);
  });

  it('allows custom storage adapter injection for test isolation', async () => {
    const mockStore = new Map<string, string>();
    const customAdapter = {
      getItem: async (key: string) => mockStore.get(key) ?? null,
      setItem: async (key: string, val: string) => {
        mockStore.set(key, val);
      },
      deleteItem: async (key: string) => {
        mockStore.delete(key);
      },
    };

    setStorageAdapter(customAdapter);

    await saveTokens({
      accessToken: 'custom_access',
      refreshToken: 'custom_refresh',
    });

    assert.strictEqual(await getAccessToken(), 'custom_access');
    assert.strictEqual(mockStore.size, 2);

    await clearTokens();
    assert.strictEqual(mockStore.size, 0);
  });
});
