import assert from 'node:assert';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { _resetRefreshState, announcementApi, MobileAnnouncement } from '../src/services/api/client';

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

describe('System Broadcast Announcements API Client', () => {
  beforeEach(() => {
    originalFetch = globalThis.fetch;
    _resetRefreshState();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    mockHandler = null;
    _resetRefreshState();
  });

  it('fetches active system announcements from backend endpoint', async () => {
    const mockAnnouncements: MobileAnnouncement[] = [
      {
        id: 'ann-123',
        title: 'Midterm Study Challenge',
        message: 'Log 2 hours of focus time today to win study bonus points!',
        severity: 'info',
        target_audience: 'all',
        is_active: true,
        created_at: new Date().toISOString(),
        expires_at: null,
      },
      {
        id: 'ann-456',
        title: 'Platform Maintenance Notice',
        message: 'FastAPI backend service updates scheduled tonight 2:00 AM UTC.',
        severity: 'warning',
        target_audience: 'students',
        is_active: true,
        created_at: new Date().toISOString(),
        expires_at: null,
      },
    ];

    setMockFetch((url, options) => {
      assert.ok(url.includes('/api/v1/announcements/active'));
      assert.strictEqual(options?.method, 'GET');
      return createJsonResponse(mockAnnouncements);
    });

    const res = await announcementApi.getActiveAnnouncements();
    assert.strictEqual(res.length, 2);
    assert.strictEqual(res[0].id, 'ann-123');
    assert.strictEqual(res[0].severity, 'info');
    assert.strictEqual(res[1].id, 'ann-456');
    assert.strictEqual(res[1].severity, 'warning');
  });

  it('handles empty active announcements array gracefully', async () => {
    setMockFetch((url) => {
      assert.ok(url.includes('/api/v1/announcements/active'));
      return createJsonResponse([]);
    });

    const res = await announcementApi.getActiveAnnouncements();
    assert.ok(Array.isArray(res));
    assert.strictEqual(res.length, 0);
  });
});

