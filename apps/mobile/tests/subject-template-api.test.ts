import assert from 'node:assert';
import { afterEach, beforeEach, describe, it } from 'node:test';

import {
  _resetRefreshState,
  MobileSubjectTemplate,
  subjectTemplateApi,
} from '../src/services/api/client';
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

describe('Curated Subject Templates API Client', () => {
  beforeEach(async () => {
    originalFetch = globalThis.fetch;
    resetStorageAdapter();
    _resetRefreshState();
    await saveTokens({
      accessToken: 'valid-student-token',
      refreshToken: 'valid-refresh-token',
    });
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    mockHandler = null;
    await clearTokens();
    resetStorageAdapter();
    _resetRefreshState();
  });

  it('fetches curated subject starter templates', async () => {
    const mockTemplates: MobileSubjectTemplate[] = [
      {
        id: 'tmpl-101',
        name: 'Data Structures & Algorithms',
        code: 'CS-201',
        category: 'Computer Science',
        description: 'Comprehensive data structures syllabus',
        color: '#6366F1',
        credits: 4,
        difficulty_level: 'intermediate',
        suggested_units: [{ title: 'Unit 1: Trees', weeks: 3 }],
        is_active: true,
        enrolled_count: 10,
      },
    ];

    setMockFetch((url) => {
      assert.ok(url.includes('/api/v1/subject-templates'));
      return createJsonResponse({
        items: mockTemplates,
        total: 1,
        categories: ['Computer Science'],
      });
    });

    const res = await subjectTemplateApi.list();
    assert.strictEqual(res.total, 1);
    assert.strictEqual(res.items[0].name, 'Data Structures & Algorithms');
    assert.strictEqual(res.categories[0], 'Computer Science');
  });

  it('1-Click enrolls in a curated template and creates student subject', async () => {
    setMockFetch((url, options) => {
      assert.ok(url.includes('/api/v1/subject-templates/tmpl-101/enroll'));
      assert.strictEqual(options?.method, 'POST');
      return createJsonResponse({
        subject_id: 'sub-new-999',
        name: 'Data Structures & Algorithms',
        code: 'CS-201',
        color: '#6366F1',
        message: "Successfully enrolled in 'Data Structures & Algorithms'.",
      }, 201);
    });

    const res = await subjectTemplateApi.enroll('tmpl-101');
    assert.strictEqual(res.subject_id, 'sub-new-999');
    assert.strictEqual(res.name, 'Data Structures & Algorithms');
    assert.ok(res.message.includes('Successfully enrolled'));
  });
});

