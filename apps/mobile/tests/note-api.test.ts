import assert from 'node:assert';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { API_CONFIG } from '../src/config/env';
import { _resetRefreshState, noteApi } from '../src/services/api/client';
import { clearTokens, resetStorageAdapter, saveTokens } from '../src/services/storage/token-storage';
import {
  AuthError,
  BadRequestError,
  NetworkError,
  NotFoundError,
  ValidationError,
} from '../src/types/auth';
import { Note, NoteCreate, NoteUpdate } from '../src/types/note';

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

describe('Notes API Client', () => {
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

  it('lists notes belonging to authenticated user without filters', async () => {
    const mockNotes: Note[] = [
      {
        id: 'note-1',
        user_id: 'user-1',
        subject_id: 'subject-1',
        title: 'Algorithms Revision',
        content: 'Review divide-and-conquer principles.',
        is_pinned: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    let capturedUrl = '';
    let capturedAuthHeader: string | null = null;

    setMockFetch((url, options) => {
      capturedUrl = url;
      const headers = options?.headers as Record<string, string>;
      capturedAuthHeader = headers?.['Authorization'] || null;
      return createJsonResponse(mockNotes, 200);
    });

    const result = await noteApi.list();
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, 'note-1');
    assert.strictEqual(result[0].is_pinned, true);
    assert.strictEqual(capturedUrl, `${API_CONFIG.baseUrl}/api/v1/notes`);
    assert.strictEqual(capturedAuthHeader, 'Bearer valid-test-access-token');
  });

  it('lists notes with query parameters: search, subject_id, is_pinned, limit, offset', async () => {
    let capturedUrl = '';

    setMockFetch((url) => {
      capturedUrl = url;
      return createJsonResponse([], 200);
    });

    await noteApi.list({
      search: 'Binary Trees',
      subject_id: 'sub-123',
      is_pinned: true,
      limit: 25,
      offset: 10,
    });

    assert.ok(capturedUrl.includes('search=Binary+Trees') || capturedUrl.includes('search=Binary%20Trees'));
    assert.ok(capturedUrl.includes('subject_id=sub-123'));
    assert.ok(capturedUrl.includes('is_pinned=true'));
    assert.ok(capturedUrl.includes('limit=25'));
    assert.ok(capturedUrl.includes('offset=10'));
  });

  it('creates a new note with POST /api/v1/notes', async () => {
    const payload: NoteCreate = {
      title: 'Operating Systems Deadlocks',
      content: 'Coffman conditions: Mutual Exclusion, Hold & Wait, No Preemption, Circular Wait.',
      subject_id: 'sub-456',
      is_pinned: true,
    };

    const mockCreatedNote: Note = {
      id: 'new-note-id',
      user_id: 'user-1',
      subject_id: payload.subject_id || null,
      title: payload.title,
      content: payload.content,
      is_pinned: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let capturedMethod = '';
    let capturedBody = '';

    setMockFetch((url, options) => {
      capturedMethod = options?.method || '';
      capturedBody = options?.body as string;
      return createJsonResponse(mockCreatedNote, 201);
    });

    const result = await noteApi.create(payload);
    assert.strictEqual(capturedMethod, 'POST');
    const parsedBody = JSON.parse(capturedBody);
    assert.strictEqual(parsedBody.title, payload.title);
    assert.strictEqual(parsedBody.content, payload.content);
    assert.strictEqual(parsedBody.is_pinned, true);
    assert.strictEqual(result.id, 'new-note-id');
  });

  it('retrieves a single note by ID', async () => {
    const noteId = 'target-note-id';
    const mockNote: Note = {
      id: noteId,
      user_id: 'user-1',
      subject_id: null,
      title: 'Single Note',
      content: 'Body content here',
      is_pinned: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setMockFetch((url) => {
      assert.strictEqual(url, `${API_CONFIG.baseUrl}/api/v1/notes/${noteId}`);
      return createJsonResponse(mockNote, 200);
    });

    const result = await noteApi.getById(noteId);
    assert.strictEqual(result.id, noteId);
    assert.strictEqual(result.title, 'Single Note');
  });

  it('updates a note with PATCH /api/v1/notes/{id}', async () => {
    const noteId = 'note-to-update';
    const payload: NoteUpdate = {
      title: 'Renamed Title',
      is_pinned: true,
    };

    const mockUpdatedNote: Note = {
      id: noteId,
      user_id: 'user-1',
      subject_id: null,
      title: 'Renamed Title',
      content: 'Original content',
      is_pinned: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let capturedMethod = '';
    setMockFetch((url, options) => {
      assert.strictEqual(url, `${API_CONFIG.baseUrl}/api/v1/notes/${noteId}`);
      capturedMethod = options?.method || '';
      return createJsonResponse(mockUpdatedNote, 200);
    });

    const result = await noteApi.update(noteId, payload);
    assert.strictEqual(capturedMethod, 'PATCH');
    assert.strictEqual(result.title, 'Renamed Title');
    assert.strictEqual(result.is_pinned, true);
  });

  it('deletes a note with DELETE /api/v1/notes/{id}', async () => {
    const noteId = 'note-to-delete';
    let capturedMethod = '';

    setMockFetch((url, options) => {
      assert.strictEqual(url, `${API_CONFIG.baseUrl}/api/v1/notes/${noteId}`);
      capturedMethod = options?.method || '';
      return new Response(null, { status: 204 });
    });

    await noteApi.delete(noteId);
    assert.strictEqual(capturedMethod, 'DELETE');
  });

  it('handles 400 Bad Request when foreign or invalid subject_id is submitted', async () => {
    setMockFetch(() => {
      return createJsonResponse(
        { detail: 'Subject does not exist or does not belong to the user.' },
        400
      );
    });

    await assert.rejects(
      () =>
        noteApi.create({
          title: 'Foreign Subject Test',
          content: 'Test content',
          subject_id: 'foreign-subject-id',
        }),
      (err: unknown) => {
        assert.ok(err instanceof BadRequestError);
        assert.strictEqual(err.status, 400);
        assert.ok(err.message.includes('Subject does not exist'));
        return true;
      }
    );
  });

  it('handles 404 Not Found when note does not exist or belongs to another user', async () => {
    setMockFetch(() => {
      return createJsonResponse({ detail: 'Note not found.' }, 404);
    });

    await assert.rejects(
      () => noteApi.getById('non-existent-note-id'),
      (err: unknown) => {
        assert.ok(err instanceof NotFoundError);
        assert.strictEqual(err.status, 404);
        assert.strictEqual(err.message, 'Note not found.');
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
              loc: ['body', 'title'],
              msg: 'Field required',
              type: 'missing',
            },
          ],
        },
        422
      );
    });

    await assert.rejects(
      () =>
        noteApi.create({
          title: '',
          content: 'Some content',
        }),
      (err: unknown) => {
        assert.ok(err instanceof ValidationError);
        assert.strictEqual(err.status, 422);
        return true;
      }
    );
  });

  it('handles 401 Unauthorized with token refresh rotation and retry', async () => {
    let callCount = 0;

    setMockFetch((url) => {
      if (url.includes('/api/v1/auth/refresh')) {
        return createJsonResponse(
          {
            access_token: 'new-rotated-access-token',
            refresh_token: 'new-rotated-refresh-token',
            token_type: 'bearer',
            expires_in: 900,
          },
          200
        );
      }

      callCount++;
      if (callCount === 1) {
        return createJsonResponse({ detail: 'Token has been invalidated' }, 401);
      }

      return createJsonResponse(
        [
          {
            id: 'note-retried-1',
            user_id: 'user-1',
            subject_id: null,
            title: 'Refreshed Notes',
            content: 'Success after refresh',
            is_pinned: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
        200
      );
    });

    const result = await noteApi.list();
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, 'note-retried-1');
    assert.strictEqual(callCount, 2);
  });

  it('handles network failure properly', async () => {
    setMockFetch(() => {
      throw new Error('Connection refused');
    });

    await assert.rejects(
      async () => {
        await noteApi.list();
      },
      (err: unknown) => {
        assert.ok(err instanceof NetworkError);
        return true;
      }
    );
  });
});
