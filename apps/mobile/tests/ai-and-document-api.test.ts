import assert from 'node:assert';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { API_CONFIG } from '../src/config/env';
import { _resetRefreshState, aiApi, documentApi } from '../src/services/api/client';
import { clearTokens, resetStorageAdapter, saveTokens } from '../src/services/storage/token-storage';
import { Document, DocumentListResponse } from '../src/types/document';
import { AIChatSession, AIExplanationResponse, AINoteGenerationResponse } from '../src/types/ai';

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

describe('Document API Client', () => {
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

  it('lists documents with search and pagination parameters', async () => {
    const mockResponse: DocumentListResponse = {
      items: [
        {
          id: 'doc-1',
          user_id: 'user-1',
          title: 'Algorithms Midterm Review',
          file_name: 'midterm.pdf',
          file_size_bytes: 2048,
          mime_type: 'application/pdf',
          status: 'ready',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      total: 1,
    };

    setMockFetch((url) => {
      assert(url.includes(API_CONFIG.endpoints.documents));
      assert(url.includes('search=midterm'));
      assert(url.includes('limit=10'));
      return createJsonResponse(mockResponse);
    });

    const res = await documentApi.listDocuments({ search: 'midterm', limit: 10 });
    assert.strictEqual(res.total, 1);
    assert.strictEqual(res.items[0].title, 'Algorithms Midterm Review');
  });

  it('retrieves single document by ID', async () => {
    const mockDoc: Document = {
      id: 'doc-42',
      user_id: 'user-1',
      title: 'Operating Systems Virtual Memory',
      file_name: 'os_vm.pdf',
      file_size_bytes: 4096,
      mime_type: 'application/pdf',
      status: 'ready',
      summary_tldr: 'Paging and segmentation mechanisms.',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setMockFetch((url) => {
      assert.strictEqual(url, `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.documentById('doc-42')}`);
      return createJsonResponse(mockDoc);
    });

    const doc = await documentApi.getDocument('doc-42');
    assert.strictEqual(doc.id, 'doc-42');
    assert.strictEqual(doc.summary_tldr, 'Paging and segmentation mechanisms.');
  });
});

describe('AI Tutor API Client', () => {
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

  it('requests topic explanation with depth parameter', async () => {
    const mockExplanation: AIExplanationResponse = {
      topic: 'Dijkstra Algorithm',
      depth: 'elif',
      explanation: 'Finds the shortest path like exploring closest neighbors first.',
      key_takeaways: ['Greedy approach', 'Requires non-negative weights'],
      self_check_question: 'Why does Dijkstra fail with negative edges?',
    };

    setMockFetch((url, options) => {
      assert.strictEqual(url, `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.aiExplain}`);
      assert.strictEqual(options?.method, 'POST');
      const body = JSON.parse(options?.body as string);
      assert.strictEqual(body.topic, 'Dijkstra Algorithm');
      assert.strictEqual(body.depth, 'elif');
      return createJsonResponse(mockExplanation);
    });

    const res = await aiApi.explainTopic({
      topic: 'Dijkstra Algorithm',
      depth: 'elif',
    });
    assert.strictEqual(res.topic, 'Dijkstra Algorithm');
    assert.strictEqual(res.depth, 'elif');
    assert.strictEqual(res.key_takeaways.length, 2);
  });

  it('generates structured Cornell notes from text', async () => {
    const mockNotes: AINoteGenerationResponse = {
      title: 'Thermodynamics Laws',
      note_type: 'cornell',
      content: '# 1st and 2nd Laws of Thermodynamics',
      key_points: ['Energy conservation', 'Entropy increase'],
      summary: 'Systems tend toward thermodynamic equilibrium.',
    };

    setMockFetch((url, options) => {
      assert.strictEqual(url, `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.aiGenerateNotes}`);
      const body = JSON.parse(options?.body as string);
      assert.strictEqual(body.format, 'cornell');
      return createJsonResponse(mockNotes);
    });

    const res = await aiApi.generateAINotes({
      source_text: 'Thermodynamics principles state energy is conserved...',
      format: 'cornell',
    });
    assert.strictEqual(res.title, 'Thermodynamics Laws');
    assert.strictEqual(res.note_type, 'cornell');
  });

  it('lists chat sessions', async () => {
    const mockSessions: { items: AIChatSession[]; total: number } = {
      items: [
        {
          id: 'session-101',
          user_id: 'user-1',
          title: 'Quantum Mechanics Questions',
          is_socratic: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          messages: [],
        },
      ],
      total: 1,
    };

    setMockFetch((url) => {
      assert(url.includes(API_CONFIG.endpoints.aiChatSessions));
      return createJsonResponse(mockSessions);
    });

    const res = await aiApi.listChatSessions();
    assert.strictEqual(res.total, 1);
    assert.strictEqual(res.items[0].title, 'Quantum Mechanics Questions');
    assert.strictEqual(res.items[0].is_socratic, true);
  });

  it('sends chat message and receives AI response', async () => {
    const mockReply = {
      session_id: 'session-123',
      message_id: 'msg-456',
      reply: 'Mera naam StudyMate AI hai!',
      role: 'assistant',
      created_at: new Date().toISOString(),
    };

    setMockFetch((url, options) => {
      assert.strictEqual(url, `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.aiChat}`);
      assert.strictEqual(options?.method, 'POST');
      const body = JSON.parse(options?.body as string);
      assert.strictEqual(body.message, 'Tumhara name kya hai');
      return createJsonResponse(mockReply);
    });

    const res = await aiApi.sendMessage({ message: 'Tumhara name kya hai' });
    assert.strictEqual(res.reply, 'Mera naam StudyMate AI hai!');
    assert.strictEqual(res.session_id, 'session-123');
  });
});

