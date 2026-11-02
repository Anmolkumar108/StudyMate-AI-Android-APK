import assert from 'node:assert';
import { afterEach, beforeEach, describe, it } from 'node:test';

import {
  _resetRefreshState,
  authApi,
} from '../src/services/api/client';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  hasTokens,
  resetStorageAdapter,
  saveTokens,
} from '../src/services/storage/token-storage';
import { AuthStatus, UserResponse } from '../src/types/auth';

let originalFetch: typeof globalThis.fetch;

function setMockFetch(
  handler: (url: string, init?: RequestInit) => Promise<Response> | Response
) {
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    return handler(url, init);
  };
}

function createJsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Headless simulation of session restoration logic corresponding to AuthContext.
 */
async function simulateRestoreSession(): Promise<{
  status: AuthStatus;
  user: UserResponse | null;
  error: string | null;
}> {
  try {
    const tokensExist = await hasTokens();
    if (!tokensExist) {
      return { status: 'unauthenticated', user: null, error: null };
    }

    const profile = await authApi.getMe();
    if (profile.status === 'suspended') {
      await clearTokens();
      return {
        status: 'unauthenticated',
        user: null,
        error: 'Your account is suspended. Please contact support.',
      };
    }

    if (profile.status === 'pending_verification') {
      return { status: 'pending_verification', user: profile, error: null };
    }

    return { status: 'authenticated', user: profile, error: null };
  } catch {
    await clearTokens();
    return { status: 'unauthenticated', user: null, error: null };
  }
}

describe('Authentication Session Lifecycle & Restoration', () => {
  beforeEach(async () => {
    originalFetch = globalThis.fetch;
    resetStorageAdapter();
    _resetRefreshState();
    await clearTokens();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    _resetRefreshState();
  });

  it('restores unauthenticated state when no tokens exist in storage', async () => {
    const state = await simulateRestoreSession();
    assert.strictEqual(state.status, 'unauthenticated');
    assert.strictEqual(state.user, null);
    assert.strictEqual(state.error, null);
  });

  it('restores authenticated state when valid tokens exist and profile is active', async () => {
    await saveTokens({
      accessToken: 'valid_access_jwt',
      refreshToken: 'valid_refresh_token',
    });

    const activeUser: UserResponse = {
      id: 'usr-123',
      email: 'student@studymate.ai',
      full_name: 'Study Student',
      role: 'student',
      status: 'active',
      daily_study_goal_minutes: 60,
      theme_preference: 'dark',
      push_notifications_enabled: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setMockFetch(async (url) => {
      if (url.endsWith('/api/v1/auth/me')) {
        return createJsonResponse(activeUser, 200);
      }
      throw new Error(`Unexpected url ${url}`);
    });

    const state = await simulateRestoreSession();
    assert.strictEqual(state.status, 'authenticated');
    assert.strictEqual(state.user?.email, 'student@studymate.ai');
    assert.strictEqual(state.user?.status, 'active');
  });

  it('restores pending_verification state when account is awaiting email verification', async () => {
    await saveTokens({
      accessToken: 'pending_access_jwt',
      refreshToken: 'pending_refresh_token',
    });

    const pendingUser: UserResponse = {
      id: 'usr-456',
      email: 'unverified@studymate.ai',
      full_name: 'Unverified Student',
      role: 'student',
      status: 'pending_verification',
      daily_study_goal_minutes: 30,
      theme_preference: 'light',
      push_notifications_enabled: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setMockFetch(async (url) => {
      if (url.endsWith('/api/v1/auth/me')) {
        return createJsonResponse(pendingUser, 200);
      }
      throw new Error(`Unexpected url ${url}`);
    });

    const state = await simulateRestoreSession();
    assert.strictEqual(state.status, 'pending_verification');
    assert.strictEqual(state.user?.status, 'pending_verification');
  });

  it('transitions to unauthenticated and wipes tokens when account is suspended', async () => {
    await saveTokens({
      accessToken: 'suspended_access_jwt',
      refreshToken: 'suspended_refresh_token',
    });

    const suspendedUser: UserResponse = {
      id: 'usr-789',
      email: 'suspended@studymate.ai',
      full_name: 'Suspended Student',
      role: 'student',
      status: 'suspended',
      daily_study_goal_minutes: 0,
      theme_preference: 'dark',
      push_notifications_enabled: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setMockFetch(async (url) => {
      if (url.endsWith('/api/v1/auth/me')) {
        return createJsonResponse(suspendedUser, 200);
      }
      throw new Error(`Unexpected url ${url}`);
    });

    const state = await simulateRestoreSession();
    assert.strictEqual(state.status, 'unauthenticated');
    assert.strictEqual(state.user, null);
    assert.ok(state.error?.includes('suspended'));
    assert.strictEqual(await getAccessToken(), null);
    assert.strictEqual(await getRefreshToken(), null);
  });

  it('transitions to unauthenticated and wipes tokens when stored token is invalid or expired', async () => {
    await saveTokens({
      accessToken: 'expired_jwt',
      refreshToken: 'expired_refresh',
    });

    setMockFetch(async (url) => {
      if (url.endsWith('/api/v1/auth/me')) {
        return createJsonResponse({ detail: 'Token expired' }, 401);
      }
      if (url.endsWith('/api/v1/auth/refresh')) {
        return createJsonResponse({ detail: 'Invalid refresh token' }, 401);
      }
      throw new Error(`Unexpected url ${url}`);
    });

    const state = await simulateRestoreSession();
    assert.strictEqual(state.status, 'unauthenticated');
    assert.strictEqual(state.user, null);
    assert.strictEqual(await getAccessToken(), null);
    assert.strictEqual(await getRefreshToken(), null);
  });
});
