import assert from 'node:assert';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { _resetRefreshState, searchApi } from '../src/services/api/client';
import { clearTokens, resetStorageAdapter, saveTokens } from '../src/services/storage/token-storage';
import { UniversalSearchResponse } from '../src/types/search';

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

const mockSearchResponse: UniversalSearchResponse = {
  query: 'database',
  total_count: 3,
  counts_by_type: {
    note: 1,
    task: 1,
    document: 0,
    flashcard: 1,
    subject: 0,
    exam: 0,
  },
  results: [
    {
      id: 'note-001',
      type: 'note',
      title: 'Database Systems Chapter 3',
      snippet: 'Relational algebra and SQL queries...',
      subject_id: 'sub-001',
      subject_name: 'Database Systems',
      subject_color: '#3B82F6',
      target_route: '/notes/note-001',
      metadata: { is_pinned: false },
      created_at: '2026-11-01T10:00:00Z',
    },
    {
      id: 'task-001',
      type: 'task',
      title: 'Finish Database schema assignment',
      snippet: 'ER diagram and DDL tables...',
      subject_id: 'sub-001',
      subject_name: 'Database Systems',
      subject_color: '#3B82F6',
      target_route: '/tasks?taskId=task-001',
      metadata: { status: 'todo', priority: 'high' },
      created_at: '2026-11-02T10:00:00Z',
    },
    {
      id: 'card-001',
      type: 'flashcard',
      title: 'Deck: DBMS Basics',
      snippet: 'Q: What is ACID? | A: Atomicity, Consistency...',
      subject_id: 'sub-001',
      subject_name: 'Database Systems',
      subject_color: '#3B82F6',
      target_route: '/flashcards/deck-001',
      metadata: { deck_id: 'deck-001' },
      created_at: '2026-11-03T10:00:00Z',
    },
  ],
};

describe('Universal Search API (FR-18)', () => {
  beforeEach(async () => {
    originalFetch = globalThis.fetch;
    resetStorageAdapter();
    _resetRefreshState();
    await saveTokens({
      accessToken: 'valid-access-token',
      refreshToken: 'valid-refresh-token',
    });
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    mockHandler = null;
    await clearTokens();
  });

  it('performs universal search across all categories with proper query encoding', async () => {
    let capturedUrl = '';
    let capturedAuth = '';

    setMockFetch(async (url, init) => {
      capturedUrl = url;
      capturedAuth = (init?.headers as Record<string, string>)?.Authorization || '';
      return createJsonResponse(mockSearchResponse);
    });

    const response = await searchApi.universalSearch({
      query: 'database normalization',
      category: 'all',
    });

    assert.ok(capturedUrl.includes('/api/v1/search?q=database%20normalization'));
    // Category 'all' should not be explicitly attached to save URL length
    assert.ok(!capturedUrl.includes('category=all'));
    assert.strictEqual(capturedAuth, 'Bearer valid-access-token');
    assert.strictEqual(response.query, 'database');
    assert.strictEqual(response.total_count, 3);
    assert.strictEqual(response.results.length, 3);
    assert.strictEqual(response.results[0].type, 'note');
    assert.strictEqual(response.results[0].target_route, '/notes/note-001');
    assert.strictEqual(response.results[1].type, 'task');
  });

  it('filters by category, subjectId, limit, and offset', async () => {
    let capturedUrl = '';

    setMockFetch(async (url) => {
      capturedUrl = url;
      return createJsonResponse({
        ...mockSearchResponse,
        total_count: 1,
        results: [mockSearchResponse.results[0]],
      });
    });

    const response = await searchApi.universalSearch({
      query: 'algorithm',
      category: 'notes',
      subjectId: 'sub-456',
      limit: 10,
      offset: 5,
    });

    assert.ok(capturedUrl.includes('q=algorithm'));
    assert.ok(capturedUrl.includes('category=notes'));
    assert.ok(capturedUrl.includes('subject_id=sub-456'));
    assert.ok(capturedUrl.includes('limit=10'));
    assert.ok(capturedUrl.includes('offset=5'));
    assert.strictEqual(response.results.length, 1);
  });

  it('handles empty results smoothly', async () => {
    setMockFetch(async () => {
      return createJsonResponse({
        query: 'xyznonexistent123',
        total_count: 0,
        counts_by_type: {},
        results: [],
      });
    });

    const response = await searchApi.universalSearch({
      query: 'xyznonexistent123',
    });

    assert.strictEqual(response.total_count, 0);
    assert.strictEqual(response.results.length, 0);
  });

  it('allows browsing category with empty search query', async () => {
    let capturedUrl = '';

    setMockFetch(async (url) => {
      capturedUrl = url;
      return createJsonResponse({
        query: '',
        total_count: 5,
        counts_by_type: { notes: 5 },
        results: [mockSearchResponse.results[0]],
      });
    });

    const response = await searchApi.universalSearch({
      query: '',
      category: 'notes',
    });

    assert.ok(capturedUrl.includes('q='));
    assert.ok(capturedUrl.includes('category=notes'));
    assert.strictEqual(response.total_count, 5);
    assert.strictEqual(response.results.length, 1);
  });
});
