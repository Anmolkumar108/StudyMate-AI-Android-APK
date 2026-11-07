import assert from 'node:assert';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { _resetRefreshState, userSecurityApi } from '../src/services/api/client';
import { clearTokens, resetStorageAdapter, saveTokens } from '../src/services/storage/token-storage';

type MockResponseHandler = (
  url: string,
  options?: RequestInit
) => Promise<Response> | Response;

let originalFetch: typeof globalThis.fetch;
let mockHandler: MockResponseHandler | null = null;

function setMockFetch(handler: MockResponseHandler) {
  mockHandler = handler;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (mockHandler) {
      return mockHandler(url, init);
    }
    throw new Error(`Unhandled mock fetch request to ${url}`);
  };
}

function createJsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('User Security & GDPR Privacy API Client', () => {
  beforeEach(async () => {
    originalFetch = globalThis.fetch;
    resetStorageAdapter();
    _resetRefreshState();
    await saveTokens({
      accessToken: 'mock-valid-access-token',
      refreshToken: 'mock-valid-refresh-token',
    });
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    mockHandler = null;
    await clearTokens();
    resetStorageAdapter();
    _resetRefreshState();
  });

  it('submits change-password request with Argon2id hash update', async () => {
    setMockFetch((url, options) => {
      assert.ok(url.includes('/api/v1/users/me/change-password'));
      assert.strictEqual(options?.method, 'POST');
      const body = JSON.parse(options?.body as string);
      assert.strictEqual(body.current_password, 'OldPass123!');
      assert.strictEqual(body.new_password, 'NewPass456!');
      return createJsonResponse({ message: 'Password changed successfully.' });
    });

    const res = await userSecurityApi.changePassword('OldPass123!', 'NewPass456!');
    assert.strictEqual(res.message, 'Password changed successfully.');
  });

  it('updates stored access and refresh tokens when returned by change-password', async () => {
    setMockFetch((url, options) => {
      return createJsonResponse({
        message: 'Password updated.',
        access_token: 'new-rotated-access-token',
        refresh_token: 'new-rotated-refresh-token',
        token_type: 'bearer',
      });
    });

    const res = await userSecurityApi.changePassword('OldPass123!', 'NewPass456!');
    assert.strictEqual(res.access_token, 'new-rotated-access-token');

    const { getAccessToken, getRefreshToken } = await import('../src/services/storage/token-storage');
    const storedAccess = await getAccessToken();
    const storedRefresh = await getRefreshToken();
    assert.strictEqual(storedAccess, 'new-rotated-access-token');
    assert.strictEqual(storedRefresh, 'new-rotated-refresh-token');
  });

  it('fetches comprehensive GDPR data export', async () => {
    setMockFetch((url, options) => {
      assert.ok(url.includes('/api/v1/users/me/export'));
      assert.strictEqual(options?.method, 'POST');
      return createJsonResponse({
        export_version: '1.0',
        exported_at: new Date().toISOString(),
        user_profile: { email: 'student@studymate.ai' },
        subjects: [{ id: 'sub-1', name: 'Computer Science' }],
        notes: [],
        tasks: [],
        analytics: { total_focus_minutes: 120 },
      });
    });

    const exportData = await userSecurityApi.exportUserData();
    assert.strictEqual(exportData.export_version, '1.0');
    assert.strictEqual(exportData.user_profile.email, 'student@studymate.ai');
    assert.strictEqual(exportData.subjects.length, 1);
  });

  it('submits delete account request with password confirmation', async () => {
    setMockFetch((url, options) => {
      assert.ok(url.includes('/api/v1/users/me'));
      assert.strictEqual(options?.method, 'DELETE');
      const body = JSON.parse(options?.body as string);
      assert.strictEqual(body.password, 'ConfirmPass123!');
      assert.strictEqual(body.reason, 'Graduated from university');
      return createJsonResponse({ message: 'Account deleted.' });
    });

    const res = await userSecurityApi.deleteAccount('ConfirmPass123!', 'Graduated from university');
    assert.strictEqual(res.message, 'Account deleted.');
  });
});
