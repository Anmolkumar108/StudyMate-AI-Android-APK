import assert from 'node:assert';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { API_CONFIG } from '../src/config/env';
import { _resetRefreshState, flashcardApi } from '../src/services/api/client';
import {
  clearTokens,
  resetStorageAdapter,
  saveTokens,
} from '../src/services/storage/token-storage';
import { BadRequestError, NotFoundError } from '../src/types/auth';
import {
  Flashcard,
  FlashcardDeck,
  FlashcardDeckWithCards,
} from '../src/types/flashcard';

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

describe('Flashcards API Client', () => {
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

  it('lists decks belonging to authenticated user without filters', async () => {
    const mockDecks: FlashcardDeck[] = [
      {
        id: 'deck-1',
        user_id: 'user-1',
        subject_id: 'sub-1',
        title: 'Microprocessors',
        description: 'ARM Cortex M4 architecture.',
        card_count: 14,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    setMockFetch(async (url, init) => {
      assert.strictEqual(url, `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.decks}`);
      assert.strictEqual(init?.method, 'GET');
      const headers = init?.headers as Record<string, string>;
      assert.strictEqual(headers.Authorization, 'Bearer valid-test-access-token');
      return createJsonResponse(mockDecks);
    });

    const res = await flashcardApi.listDecks();
    assert.strictEqual(res.length, 1);
    assert.strictEqual(res[0].id, 'deck-1');
    assert.strictEqual(res[0].title, 'Microprocessors');
    assert.strictEqual(res[0].card_count, 14);
  });

  it('applies search, subject_id, and pagination query params when listing decks', async () => {
    let capturedUrl = '';

    setMockFetch(async (url) => {
      capturedUrl = url;
      return createJsonResponse([]);
    });

    await flashcardApi.listDecks({
      search: 'architecture',
      subject_id: 'sub-1',
      limit: 25,
      offset: 10,
    });

    assert.ok(capturedUrl.includes('search=architecture'));
    assert.ok(capturedUrl.includes('subject_id=sub-1'));
    assert.ok(capturedUrl.includes('limit=25'));
    assert.ok(capturedUrl.includes('offset=10'));
  });

  it('retrieves single deck details with cards', async () => {
    const mockDeck: FlashcardDeckWithCards = {
      id: 'deck-1',
      user_id: 'user-1',
      subject_id: 'sub-1',
      title: 'Microprocessors',
      description: 'ARM Cortex M4 architecture.',
      card_count: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      cards: [
        {
          id: 'card-1',
          deck_id: 'deck-1',
          user_id: 'user-1',
          question: 'What is pipelining?',
          answer: 'Overlapping the execution of multiple instructions.',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    };

    setMockFetch(async (url, init) => {
      assert.strictEqual(
        url,
        `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.deckById('deck-1')}`
      );
      assert.strictEqual(init?.method, 'GET');
      return createJsonResponse(mockDeck);
    });

    const res = await flashcardApi.getDeck('deck-1');
    assert.strictEqual(res.id, 'deck-1');
    assert.strictEqual(res.cards.length, 1);
    assert.strictEqual(res.cards[0].question, 'What is pipelining?');
  });

  it('creates a new deck with POST /api/v1/flashcards/decks', async () => {
    const createdDeck: FlashcardDeck = {
      id: 'deck-new',
      user_id: 'user-1',
      subject_id: 'sub-1',
      title: 'Discrete Mathematics',
      description: 'Set theory and graph theory.',
      card_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setMockFetch(async (url, init) => {
      assert.strictEqual(url, `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.decks}`);
      assert.strictEqual(init?.method, 'POST');
      const body = JSON.parse(init?.body as string);
      assert.strictEqual(body.title, 'Discrete Mathematics');
      return createJsonResponse(createdDeck, 201);
    });

    const res = await flashcardApi.createDeck({
      title: 'Discrete Mathematics',
      description: 'Set theory and graph theory.',
      subject_id: 'sub-1',
    });

    assert.strictEqual(res.id, 'deck-new');
    assert.strictEqual(res.title, 'Discrete Mathematics');
  });

  it('updates an existing deck with PATCH', async () => {
    const updatedDeck: FlashcardDeck = {
      id: 'deck-1',
      user_id: 'user-1',
      subject_id: 'sub-1',
      title: 'Updated Title',
      description: null,
      card_count: 2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setMockFetch(async (url, init) => {
      assert.strictEqual(
        url,
        `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.deckById('deck-1')}`
      );
      assert.strictEqual(init?.method, 'PATCH');
      const body = JSON.parse(init?.body as string);
      assert.strictEqual(body.title, 'Updated Title');
      return createJsonResponse(updatedDeck);
    });

    const res = await flashcardApi.updateDeck('deck-1', {
      title: 'Updated Title',
    });
    assert.strictEqual(res.title, 'Updated Title');
  });

  it('deletes a deck with DELETE', async () => {
    let deleteCalled = false;
    setMockFetch(async (url, init) => {
      assert.strictEqual(
        url,
        `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.deckById('deck-1')}`
      );
      assert.strictEqual(init?.method, 'DELETE');
      deleteCalled = true;
      return new Response(null, { status: 204 });
    });

    await flashcardApi.deleteDeck('deck-1');
    assert.strictEqual(deleteCalled, true);
  });

  it('lists cards in a deck', async () => {
    const mockCards: Flashcard[] = [
      {
        id: 'card-1',
        deck_id: 'deck-1',
        user_id: 'user-1',
        question: 'Q1',
        answer: 'A1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    setMockFetch(async (url, init) => {
      assert.strictEqual(
        url,
        `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.cards('deck-1')}`
      );
      assert.strictEqual(init?.method, 'GET');
      return createJsonResponse(mockCards);
    });

    const res = await flashcardApi.listCards('deck-1');
    assert.strictEqual(res.length, 1);
    assert.strictEqual(res[0].question, 'Q1');
  });

  it('creates a card in a deck with POST', async () => {
    const newCard: Flashcard = {
      id: 'card-new',
      deck_id: 'deck-1',
      user_id: 'user-1',
      question: 'New Question',
      answer: 'New Answer',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setMockFetch(async (url, init) => {
      assert.strictEqual(
        url,
        `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.cards('deck-1')}`
      );
      assert.strictEqual(init?.method, 'POST');
      const body = JSON.parse(init?.body as string);
      assert.strictEqual(body.question, 'New Question');
      return createJsonResponse(newCard, 201);
    });

    const res = await flashcardApi.createCard('deck-1', {
      question: 'New Question',
      answer: 'New Answer',
    });
    assert.strictEqual(res.id, 'card-new');
  });

  it('updates a card in a deck with PATCH', async () => {
    const updatedCard: Flashcard = {
      id: 'card-1',
      deck_id: 'deck-1',
      user_id: 'user-1',
      question: 'Updated Question',
      answer: 'Updated Answer',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setMockFetch(async (url, init) => {
      assert.strictEqual(
        url,
        `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.cardById('deck-1', 'card-1')}`
      );
      assert.strictEqual(init?.method, 'PATCH');
      return createJsonResponse(updatedCard);
    });

    const res = await flashcardApi.updateCard('deck-1', 'card-1', {
      question: 'Updated Question',
    });
    assert.strictEqual(res.question, 'Updated Question');
  });

  it('deletes a card in a deck with DELETE', async () => {
    let deleteCalled = false;
    setMockFetch(async (url, init) => {
      assert.strictEqual(
        url,
        `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.cardById('deck-1', 'card-1')}`
      );
      assert.strictEqual(init?.method, 'DELETE');
      deleteCalled = true;
      return new Response(null, { status: 204 });
    });

    await flashcardApi.deleteCard('deck-1', 'card-1');
    assert.strictEqual(deleteCalled, true);
  });

  it('handles 404 Not Found properly', async () => {
    setMockFetch(async () => {
      return createJsonResponse({ detail: 'Flashcard deck not found.' }, 404);
    });

    await assert.rejects(
      async () => {
        await flashcardApi.getDeck('non-existent');
      },
      (err: unknown) => {
        assert.ok(err instanceof NotFoundError);
        assert.strictEqual((err as NotFoundError).status, 404);
        return true;
      }
    );
  });

  it('handles 400 Bad Request properly', async () => {
    setMockFetch(async () => {
      return createJsonResponse({ detail: 'Subject does not exist.' }, 400);
    });

    await assert.rejects(
      async () => {
        await flashcardApi.createDeck({ title: 'Test', subject_id: 'bad-sub' });
      },
      (err: unknown) => {
        assert.ok(err instanceof BadRequestError);
        assert.strictEqual((err as BadRequestError).status, 400);
        return true;
      }
    );
  });
});
