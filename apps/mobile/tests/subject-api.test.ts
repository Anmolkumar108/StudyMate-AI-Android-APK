import assert from 'node:assert';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { API_CONFIG } from '../src/config/env';
import { _resetRefreshState, subjectApi } from '../src/services/api/client';
import { clearTokens, resetStorageAdapter, saveTokens } from '../src/services/storage/token-storage';
import {
  AuthError,
  ConflictError,
  NetworkError,
  NotFoundError,
  ValidationError,
} from '../src/types/auth';
import { Subject, SubjectCreate, SubjectUpdate } from '../src/types/subject';

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

describe('Subjects API Client', () => {
  beforeEach(async () => {
    originalFetch = globalThis.fetch;
    resetStorageAdapter();
    await saveTokens({
      accessToken: 'valid-test-access-token',
      refreshToken: 'valid-test-refresh-token',
    });
    _resetRefreshState();
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    mockHandler = null;
    await clearTokens();
    _resetRefreshState();
  });

  it('lists subjects belonging to authenticated user', async () => {
    const mockSubjects: Subject[] = [
      {
        id: 'subject-1',
        user_id: 'user-1',
        name: 'Calculus I',
        code: 'MATH-101',
        description: 'Derivatives and integrals.',
        semester: 1,
        color: '#4F46E5',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    let capturedUrl = '';
    let capturedAuthHeader: string | null = null;

    setMockFetch((url, options) => {
      capturedUrl = url;
      const headers = options?.headers as Record<string, string>;
      capturedAuthHeader = headers?.Authorization || null;
      return createJsonResponse(mockSubjects, 200);
    });

    const result = await subjectApi.list();
    assert.strictEqual(capturedUrl, `${API_CONFIG.baseUrl}/api/v1/subjects`);
    assert.strictEqual(capturedAuthHeader, 'Bearer valid-test-access-token');
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].name, 'Calculus I');
  });

  it('creates a new subject with POST /api/v1/subjects', async () => {
    const payload: SubjectCreate = {
      name: 'Algorithms',
      code: 'CS-301',
      description: 'Sorting, trees, graphs',
      semester: 3,
      color: '#059669',
    };

    let capturedMethod = '';
    let capturedBody: string | null = null;

    setMockFetch((url, options) => {
      capturedMethod = options?.method || '';
      capturedBody = options?.body as string;
      const createdSubject: Subject = {
        id: 'new-id',
        user_id: 'user-1',
        ...payload,
        code: payload.code || null,
        description: payload.description || null,
        semester: payload.semester || null,
        color: payload.color || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      return createJsonResponse(createdSubject, 201);
    });

    const created = await subjectApi.create(payload);
    assert.strictEqual(capturedMethod, 'POST');
    assert.ok(String(capturedBody).includes('Algorithms'));
    assert.strictEqual(created.id, 'new-id');
    assert.strictEqual(created.name, 'Algorithms');
  });

  it('retrieves a single subject by ID', async () => {
    const mockSubject: Subject = {
      id: 'sub-123',
      user_id: 'user-1',
      name: 'Physics I',
      code: 'PHYS-101',
      description: 'Classical mechanics',
      semester: 1,
      color: '#D97706',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let capturedUrl = '';

    setMockFetch((url) => {
      capturedUrl = url;
      return createJsonResponse(mockSubject, 200);
    });

    const result = await subjectApi.getById('sub-123');
    assert.strictEqual(capturedUrl, `${API_CONFIG.baseUrl}/api/v1/subjects/sub-123`);
    assert.strictEqual(result.id, 'sub-123');
    assert.strictEqual(result.name, 'Physics I');
  });

  it('updates a subject with PATCH /api/v1/subjects/{id}', async () => {
    const updatePayload: SubjectUpdate = {
      name: 'Advanced Physics',
      semester: 2,
    };

    let capturedMethod = '';
    let capturedBody: string | null = null;

    setMockFetch((url, options) => {
      capturedMethod = options?.method || '';
      capturedBody = options?.body as string;
      const updatedSubject: Subject = {
        id: 'sub-123',
        user_id: 'user-1',
        name: 'Advanced Physics',
        code: 'PHYS-101',
        description: null,
        semester: 2,
        color: '#D97706',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      return createJsonResponse(updatedSubject, 200);
    });

    const updated = await subjectApi.update('sub-123', updatePayload);
    assert.strictEqual(capturedMethod, 'PATCH');
    assert.ok(String(capturedBody).includes('Advanced Physics'));
    assert.strictEqual(updated.name, 'Advanced Physics');
    assert.strictEqual(updated.semester, 2);
  });

  it('deletes a subject with DELETE /api/v1/subjects/{id}', async () => {
    let capturedMethod = '';
    let capturedUrl = '';

    setMockFetch((url, options) => {
      capturedMethod = options?.method || '';
      capturedUrl = url;
      return new Response(null, { status: 204 });
    });

    await subjectApi.delete('sub-to-delete');
    assert.strictEqual(capturedMethod, 'DELETE');
    assert.strictEqual(capturedUrl, `${API_CONFIG.baseUrl}/api/v1/subjects/sub-to-delete`);
  });

  it('handles 409 Conflict when duplicate subject name is submitted', async () => {
    setMockFetch(() => {
      return createJsonResponse(
        { detail: "A subject with the name 'Math' already exists." },
        409
      );
    });

    await assert.rejects(
      async () => {
        await subjectApi.create({ name: 'Math' });
      },
      (err: unknown) => {
        assert.ok(err instanceof ConflictError);
        assert.ok(err.message.includes('already exists'));
        return true;
      }
    );
  });

  it('handles 404 Not Found when subject does not exist or belongs to another user', async () => {
    setMockFetch(() => {
      return createJsonResponse({ detail: 'Subject not found.' }, 404);
    });

    await assert.rejects(
      async () => {
        await subjectApi.getById('non-existent-or-idor-id');
      },
      (err: unknown) => {
        assert.ok(err instanceof NotFoundError);
        assert.strictEqual(err.status, 404);
        return true;
      }
    );
  });

  it('handles 422 Validation Error from backend', async () => {
    setMockFetch(() => {
      return createJsonResponse(
        {
          detail: [
            {
              loc: ['body', 'semester'],
              msg: 'Input should be greater than or equal to 1',
              type: 'greater_than_equal',
            },
          ],
        },
        422
      );
    });

    await assert.rejects(
      async () => {
        await subjectApi.create({ name: 'Valid Name', semester: 0 });
      },
      (err: unknown) => {
        assert.ok(err instanceof ValidationError);
        assert.ok(err.message.includes('greater than or equal to 1'));
        return true;
      }
    );
  });

  it('handles 401 Unauthorized with token refresh and retry', async () => {
    let callCount = 0;

    setMockFetch((url) => {
      if (url.includes('/api/v1/auth/refresh')) {
        return createJsonResponse({
          access_token: 'new-rotated-access-token',
          refresh_token: 'new-rotated-refresh-token',
          token_type: 'bearer',
          expires_in: 900,
        });
      }

      callCount++;
      if (callCount === 1) {
        return createJsonResponse({ detail: 'Token has been invalidated' }, 401);
      }

      // Retry call succeeded
      return createJsonResponse([], 200);
    });

    const result = await subjectApi.list();
    assert.strictEqual(callCount, 2);
    assert.deepStrictEqual(result, []);
  });

  it('handles network failure properly', async () => {
    setMockFetch(() => {
      throw new Error('Connection refused');
    });

    await assert.rejects(
      async () => {
        await subjectApi.list();
      },
      (err: unknown) => {
        assert.ok(err instanceof NetworkError);
        return true;
      }
    );
  });
});
