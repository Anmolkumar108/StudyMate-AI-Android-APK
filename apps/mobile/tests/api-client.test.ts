import assert from 'node:assert';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { API_CONFIG } from '../src/config/env';
import {
  _resetRefreshState,
  apiRequest,
  authApi,
  notifyLogoutStarted,
} from '../src/services/api/client';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  resetStorageAdapter,
  saveTokens,
} from '../src/services/storage/token-storage';
import {
  AuthError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
  InvalidResponseError,
  NetworkError,
  ServerError,
  TimeoutError,
  ValidationError,
} from '../src/types/auth';

// Mock helper to intercept global fetch
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

describe('Authentication API Client', () => {
  beforeEach(async () => {
    originalFetch = globalThis.fetch;
    resetStorageAdapter();
    _resetRefreshState();
    await clearTokens();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    mockHandler = null;
    _resetRefreshState();
  });

  describe('Registration endpoint', () => {
    it('successfully registers a student and returns user response', async () => {
      const mockUser = {
        id: '11111111-1111-1111-1111-111111111111',
        email: 'newstudent@studymate.ai',
        full_name: 'New Student',
        role: 'student',
        status: 'pending_verification',
        daily_study_goal_minutes: 60,
        theme_preference: 'dark',
        push_notifications_enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setMockFetch(async (url, init) => {
        assert.strictEqual(url, `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.register}`);
        assert.strictEqual(init?.method, 'POST');
        const body = JSON.parse(init?.body as string);
        assert.strictEqual(body.email, 'newstudent@studymate.ai');
        assert.strictEqual(body.full_name, 'New Student');
        return createJsonResponse(mockUser, 201);
      });

      const res = await authApi.register({
        email: 'newstudent@studymate.ai',
        password: 'ValidPassword123!',
        full_name: 'New Student',
      });

      assert.strictEqual(res.id, mockUser.id);
      assert.strictEqual(res.email, mockUser.email);
      assert.strictEqual(res.status, 'pending_verification');
    });

    it('handles 409 conflict when email is already registered', async () => {
      setMockFetch(async () => {
        return createJsonResponse(
          { detail: 'An account with this email already exists.' },
          409
        );
      });

      await assert.rejects(
        async () => {
          await authApi.register({
            email: 'duplicate@studymate.ai',
            password: 'ValidPassword123!',
            full_name: 'Duplicate Student',
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof ConflictError);
          assert.strictEqual(
            (err as ConflictError).message,
            'An account with this email already exists.'
          );
          return true;
        }
      );
    });

    it('handles 422 validation error from FastAPI', async () => {
      setMockFetch(async () => {
        return createJsonResponse(
          {
            detail: [
              {
                loc: ['body', 'password'],
                msg: 'Password must be at least 8 characters long.',
                type: 'value_error',
              },
            ],
          },
          422
        );
      });

      await assert.rejects(
        async () => {
          await authApi.register({
            email: 'valid@studymate.ai',
            password: 'short',
            full_name: 'Test',
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof ValidationError);
          assert.strictEqual(
            (err as ValidationError).message,
            'Password must be at least 8 characters long.'
          );
          return true;
        }
      );
    });
  });

  describe('Login endpoint', () => {
    it('successfully logs in and automatically stores tokens in secure storage', async () => {
      const mockTokens = {
        access_token: 'initial_access_token_123',
        refresh_token: 'initial_refresh_token_456',
        token_type: 'bearer',
        expires_in: 900,
      };

      setMockFetch(async (url, init) => {
        assert.strictEqual(url, `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.login}`);
        assert.strictEqual(init?.method, 'POST');
        const body = JSON.parse(init?.body as string);
        assert.strictEqual(body.email, 'student@studymate.ai');
        return createJsonResponse(mockTokens, 200);
      });

      const res = await authApi.login({
        email: 'student@studymate.ai',
        password: 'ValidPassword123!',
      });

      assert.strictEqual(res.access_token, mockTokens.access_token);
      assert.strictEqual(res.refresh_token, mockTokens.refresh_token);

      // Verify tokens were stored
      assert.strictEqual(await getAccessToken(), mockTokens.access_token);
      assert.strictEqual(await getRefreshToken(), mockTokens.refresh_token);
    });

    it('throws AuthError on 401 invalid credentials', async () => {
      setMockFetch(async () => {
        return createJsonResponse({ detail: 'Invalid email or password.' }, 401);
      });

      await assert.rejects(
        async () => {
          await authApi.login({
            email: 'wrong@studymate.ai',
            password: 'WrongPassword!',
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof AuthError);
          assert.strictEqual((err as AuthError).message, 'Invalid email or password.');
          return true;
        }
      );
    });

    it('throws ForbiddenError on 403 suspended account', async () => {
      setMockFetch(async () => {
        return createJsonResponse(
          { detail: 'Account is suspended. Please contact support.' },
          403
        );
      });

      await assert.rejects(
        async () => {
          await authApi.login({
            email: 'suspended@studymate.ai',
            password: 'ValidPassword123!',
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof ForbiddenError);
          assert.strictEqual(
            (err as ForbiddenError).message,
            'Account is suspended. Please contact support.'
          );
          return true;
        }
      );
    });

    it('throws ForbiddenError on 403 pending verification account', async () => {
      setMockFetch(async () => {
        return createJsonResponse(
          { detail: 'Account verification is pending. Please verify your email.' },
          403
        );
      });

      await assert.rejects(
        async () => {
          await authApi.login({
            email: 'pending@studymate.ai',
            password: 'ValidPassword123!',
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof ForbiddenError);
          assert.strictEqual(
            (err as ForbiddenError).message,
            'Account verification is pending. Please verify your email.'
          );
          return true;
        }
      );
    });
  });

  describe('Current user profile (/me)', () => {
    it('sends Authorization header and returns user profile', async () => {
      await saveTokens({
        accessToken: 'valid_bearer_token',
        refreshToken: 'valid_refresh_token',
      });

      const mockUser = {
        id: '99999999-9999-9999-9999-999999999999',
        email: 'authenticated@studymate.ai',
        full_name: 'Auth Student',
        role: 'student',
        status: 'active',
        daily_study_goal_minutes: 45,
        theme_preference: 'dark',
        push_notifications_enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setMockFetch(async (url, init) => {
        assert.strictEqual(url, `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.me}`);
        assert.strictEqual(init?.method, 'GET');
        const headers = init?.headers as Record<string, string>;
        assert.strictEqual(headers.Authorization, 'Bearer valid_bearer_token');
        return createJsonResponse(mockUser, 200);
      });

      const user = await authApi.getMe();
      assert.strictEqual(user.id, mockUser.id);
      assert.strictEqual(user.email, mockUser.email);
    });
  });

  describe('Single-flight Refresh Token Rotation & Retries', () => {
    it('coalesces multiple concurrent 401 requests into exactly 1 refresh call and retries both', async () => {
      await saveTokens({
        accessToken: 'expired_access_token',
        refreshToken: 'current_refresh_token_1',
      });

      let refreshCallCount = 0;
      let meCallCount = 0;
      let sessionsCallCount = 0;

      setMockFetch(async (url, init) => {
        const headers = init?.headers as Record<string, string>;

        if (url.endsWith('/api/v1/auth/refresh')) {
          refreshCallCount++;
          const body = JSON.parse(init?.body as string);
          assert.strictEqual(body.refresh_token, 'current_refresh_token_1');
          return createJsonResponse({
            access_token: 'new_rotated_access_token',
            refresh_token: 'new_rotated_refresh_token',
            token_type: 'bearer',
            expires_in: 900,
          });
        }

        if (url.endsWith('/api/v1/auth/me')) {
          meCallCount++;
          if (headers.Authorization === 'Bearer expired_access_token') {
            return createJsonResponse({ detail: 'Token expired' }, 401);
          }
          if (headers.Authorization === 'Bearer new_rotated_access_token') {
            return createJsonResponse({
              id: '1',
              email: 'student@studymate.ai',
              full_name: 'Student',
              role: 'student',
              status: 'active',
              daily_study_goal_minutes: 60,
              theme_preference: 'dark',
              push_notifications_enabled: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          }
        }

        if (url.endsWith('/api/v1/auth/sessions')) {
          sessionsCallCount++;
          if (headers.Authorization === 'Bearer expired_access_token') {
            return createJsonResponse({ detail: 'Token expired' }, 401);
          }
          if (headers.Authorization === 'Bearer new_rotated_access_token') {
            return createJsonResponse([]);
          }
        }

        throw new Error(`Unexpected call to ${url}`);
      });

      // Fire 2 concurrent requests that both initially receive 401
      const [user, sessions] = await Promise.all([
        authApi.getMe(),
        authApi.listSessions(),
      ]);

      assert.strictEqual(user.email, 'student@studymate.ai');
      assert.deepStrictEqual(sessions, []);

      // Verify single flight refresh: exactly 1 refresh call was made
      assert.strictEqual(refreshCallCount, 1);
      // Both endpoints were called twice (1st expired -> 401, 2nd retried with new token)
      assert.strictEqual(meCallCount, 2);
      assert.strictEqual(sessionsCallCount, 2);

      // Verify token rotation stored the new tokens
      assert.strictEqual(await getAccessToken(), 'new_rotated_access_token');
      assert.strictEqual(await getRefreshToken(), 'new_rotated_refresh_token');
    });

    it('retries at most once and does not loop indefinitely if retried request still returns 401', async () => {
      await saveTokens({
        accessToken: 'initial_token',
        refreshToken: 'valid_refresh',
      });

      setMockFetch(async (url) => {
        if (url.endsWith('/api/v1/auth/refresh')) {
          return createJsonResponse({
            access_token: 'new_token',
            refresh_token: 'new_refresh',
            token_type: 'bearer',
            expires_in: 900,
          });
        }
        // Always return 401 even with new token
        return createJsonResponse({ detail: 'Still unauthorized' }, 401);
      });

      await assert.rejects(
        async () => {
          await authApi.getMe();
        },
        (err: unknown) => {
          assert.ok(err instanceof AuthError);
          return true;
        }
      );

      // Tokens should be cleared after terminal failure
      assert.strictEqual(await getAccessToken(), null);
    });

    it('clears stored credentials when refresh request itself fails (terminal refresh failure)', async () => {
      await saveTokens({
        accessToken: 'expired_access',
        refreshToken: 'revoked_refresh',
      });

      setMockFetch(async (url) => {
        if (url.endsWith('/api/v1/auth/refresh')) {
          return createJsonResponse(
            { detail: 'Invalid, expired, or revoked refresh token.' },
            401
          );
        }
        return createJsonResponse({ detail: 'Token expired' }, 401);
      });

      await assert.rejects(
        async () => {
          await authApi.getMe();
        },
        (err: unknown) => {
          assert.ok(err instanceof AuthError);
          return true;
        }
      );

      assert.strictEqual(await getAccessToken(), null);
      assert.strictEqual(await getRefreshToken(), null);
    });
  });

  describe('Logout & Race Condition Prevention', () => {
    it('successfully logs out and wipes local credentials', async () => {
      await saveTokens({
        accessToken: 'active_access',
        refreshToken: 'active_refresh',
      });

      let logoutCalled = false;
      setMockFetch(async (url, init) => {
        if (url.endsWith('/api/v1/auth/logout')) {
          logoutCalled = true;
          const body = JSON.parse(init?.body as string);
          assert.strictEqual(body.refresh_token, 'active_refresh');
          return createJsonResponse({ message: 'Successfully logged out.' });
        }
        throw new Error(`Unexpected url ${url}`);
      });

      const res = await authApi.logout('active_refresh');
      assert.strictEqual(res.message, 'Successfully logged out.');
      assert.strictEqual(logoutCalled, true);
      assert.strictEqual(await getAccessToken(), null);
      assert.strictEqual(await getRefreshToken(), null);
    });

    it('prevents a late refresh from resurrecting session after logout started', async () => {
      await saveTokens({
        accessToken: 'old_access',
        refreshToken: 'old_refresh',
      });

      // Simulate logout notification started
      notifyLogoutStarted();

      // Trigger logout
      await clearTokens();

      // Attempting any late refresh should immediately yield null without storing tokens
      assert.strictEqual(await getAccessToken(), null);
      assert.strictEqual(await getRefreshToken(), null);
    });
  });

  describe('Origin security guard', () => {
    it('does not send Authorization header to untrusted foreign origins', async () => {
      await saveTokens({
        accessToken: 'sensitive_jwt_token',
        refreshToken: 'sensitive_refresh',
      });

      let capturedHeaders: Record<string, string> | undefined;
      setMockFetch(async (url, init) => {
        capturedHeaders = init?.headers as Record<string, string>;
        return createJsonResponse({ ok: true });
      });

      // Call external url
      await apiRequest('https://evil-third-party.com/api', { requiresAuth: true });

      assert.strictEqual(capturedHeaders?.Authorization, undefined);
    });
  });

  describe('Network errors and timeouts', () => {
    it('maps fetch failures to NetworkError with targetUrl diagnostics', async () => {
      setMockFetch(async () => {
        throw new TypeError('Failed to fetch');
      });

      await assert.rejects(
        async () => {
          await authApi.getMe();
        },
        (err: unknown) => {
          assert.ok(err instanceof NetworkError);
          const netErr = err as NetworkError;
          assert.strictEqual(netErr.status, 0);
          assert.strictEqual(netErr.code, 'NETWORK_ERROR');
          assert.ok(netErr.targetUrl?.includes('/api/v1/auth/me'));
          return true;
        }
      );
    });

    it('maps abort signals to TimeoutError with timeout duration diagnostics', async () => {
      setMockFetch(async (_url, init) => {
        return new Promise((_, reject) => {
          const signal = init?.signal;
          if (signal) {
            signal.addEventListener('abort', () => {
              const abortErr = new Error('The operation was aborted');
              abortErr.name = 'AbortError';
              reject(abortErr);
            });
          }
        });
      });

      await assert.rejects(
        async () => {
          await apiRequest('/api/v1/auth/me', { timeoutMs: 10 });
        },
        (err: unknown) => {
          assert.ok(err instanceof TimeoutError);
          const timeErr = err as TimeoutError;
          assert.strictEqual(timeErr.status, 408);
          assert.strictEqual(timeErr.code, 'TIMEOUT_ERROR');
          assert.ok(timeErr.targetUrl?.includes('/api/v1/auth/me'));
          return true;
        }
      );
    });

    it('maps Expo-style canceled error on timeout to TimeoutError', async () => {
      setMockFetch(async (_url, init) => {
        return new Promise((_, reject) => {
          const signal = init?.signal;
          if (signal) {
            signal.addEventListener('abort', () => {
              // Expo / WinterCG throws generic Error with 'Fetch request has been canceled'
              const canceledErr = new Error('Fetch request has been canceled');
              reject(canceledErr);
            });
          }
        });
      });

      await assert.rejects(
        async () => {
          await apiRequest('/api/v1/auth/me', { timeoutMs: 10 });
        },
        (err: unknown) => {
          assert.ok(err instanceof TimeoutError);
          const timeErr = err as TimeoutError;
          assert.strictEqual(timeErr.status, 408);
          assert.strictEqual(timeErr.code, 'TIMEOUT_ERROR');
          assert.ok(timeErr.targetUrl?.includes('/api/v1/auth/me'));
          return true;
        }
      );
    });

    it('maps caller-initiated signal abortion to NetworkError with cancel reason', async () => {
      const cancelController = new AbortController();

      setMockFetch(async (_url, init) => {
        return new Promise((_, reject) => {
          const signal = init?.signal;
          if (signal) {
            signal.addEventListener('abort', () => {
              const abortErr = new Error('The user aborted a request.');
              abortErr.name = 'AbortError';
              reject(abortErr);
            });
          }
        });
      });

      // Trigger caller cancellation before timeout
      setTimeout(() => {
        cancelController.abort('Component unmounted');
      }, 5);

      await assert.rejects(
        async () => {
          await apiRequest('/api/v1/auth/me', {
            signal: cancelController.signal,
            timeoutMs: 5000,
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof NetworkError);
          const netErr = err as NetworkError;
          assert.strictEqual(netErr.status, 0);
          assert.ok(netErr.message.includes('Component unmounted'));
          return true;
        }
      );
    });

    it('maps HTTP 400 Bad Request to BadRequestError', async () => {
      setMockFetch(async () => {
        return createJsonResponse({ detail: 'Invalid parameters provided.' }, 400);
      });

      await assert.rejects(
        async () => {
          await apiRequest('/api/v1/auth/login', { method: 'POST', body: '{}' });
        },
        (err: unknown) => {
          assert.ok(err instanceof BadRequestError);
          const reqErr = err as BadRequestError;
          assert.strictEqual(reqErr.status, 400);
          assert.strictEqual(reqErr.code, 'BAD_REQUEST');
          assert.strictEqual(reqErr.message, 'Invalid parameters provided.');
          return true;
        }
      );
    });

    it('maps HTTP 500 server crashes to ServerError', async () => {
      setMockFetch(async () => {
        return createJsonResponse({ detail: 'Internal database connection failed' }, 500);
      });

      await assert.rejects(
        async () => {
          await authApi.getMe();
        },
        (err: unknown) => {
          assert.ok(err instanceof ServerError);
          const srvErr = err as ServerError;
          assert.strictEqual(srvErr.status, 500);
          assert.strictEqual(srvErr.code, 'SERVER_ERROR');
          return true;
        }
      );
    });

    it('handles malformed non-JSON responses from server with InvalidResponseError', async () => {
      setMockFetch(async () => {
        return new Response('<html><body>502 Bad Gateway</body></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        });
      });

      await assert.rejects(
        async () => {
          await authApi.getMe();
        },
        (err: unknown) => {
          assert.ok(err instanceof InvalidResponseError);
          const invErr = err as InvalidResponseError;
          assert.strictEqual(invErr.code, 'INVALID_RESPONSE');
          return true;
        }
      );
    });
  });
});
