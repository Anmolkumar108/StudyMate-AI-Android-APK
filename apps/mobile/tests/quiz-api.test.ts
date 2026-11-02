import assert from 'node:assert';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { API_CONFIG } from '../src/config/env';
import { _resetRefreshState, quizApi } from '../src/services/api/client';
import { clearTokens, resetStorageAdapter, saveTokens } from '../src/services/storage/token-storage';
import {
  ConvertMissedToCardsResponse,
  Quiz,
  QuizAttempt,
  QuizGenerateRequest,
  QuizSubmitRequest,
} from '../src/types/quiz';

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

describe('Quiz API Client', () => {
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

  it('lists quizzes without subject filter', async () => {
    const mockList = {
      items: [
        {
          id: 'quiz-1',
          user_id: 'user-1',
          title: 'Data Structures Practice',
          source_type: 'topic',
          difficulty: 'medium',
          question_count: 5,
          created_at: '2026-11-02T10:00:00Z',
        },
      ],
      total: 1,
    };

    setMockFetch((url, init) => {
      assert.strictEqual(init?.method, 'GET');
      assert.ok(url.includes('/api/v1/quizzes'));
      return createJsonResponse(mockList);
    });

    const res = await quizApi.list();
    assert.strictEqual(res.total, 1);
    assert.strictEqual(res.items[0].id, 'quiz-1');
    assert.strictEqual(res.items[0].title, 'Data Structures Practice');
  });

  it('lists quizzes with subjectId query parameter', async () => {
    setMockFetch((url, init) => {
      assert.strictEqual(init?.method, 'GET');
      assert.ok(url.includes('subject_id=sub-123'));
      return createJsonResponse({ items: [], total: 0 });
    });

    const res = await quizApi.list('sub-123');
    assert.strictEqual(res.total, 0);
  });

  it('fetches a single quiz by id with questions', async () => {
    const mockQuiz: Quiz = {
      id: 'quiz-456',
      user_id: 'user-1',
      title: 'Operating Systems',
      source_type: 'custom',
      difficulty: 'hard',
      question_count: 3,
      created_at: '2026-11-02T10:00:00Z',
      questions: [
        {
          id: 'q-1',
          quiz_id: 'quiz-456',
          question_text: 'What causes thrashing?',
          question_type: 'mcq',
          options: [
            { key: 'A', text: 'Excessive paging' },
            { key: 'B', text: 'CPU idle' },
          ],
          correct_option_key: 'A',
          explanation: 'Thrashing occurs when high paging activity starves processes of execution time.',
        },
      ],
    };

    setMockFetch((url, init) => {
      assert.strictEqual(init?.method, 'GET');
      assert.ok(url.includes('/api/v1/quizzes/quiz-456'));
      return createJsonResponse(mockQuiz);
    });

    const quiz = await quizApi.getById('quiz-456');
    assert.strictEqual(quiz.id, 'quiz-456');
    assert.strictEqual(quiz.questions?.length, 1);
    assert.strictEqual(quiz.questions[0].correct_option_key, 'A');
  });

  it('generates a new quiz from topic and difficulty', async () => {
    const payload: QuizGenerateRequest = {
      topic: 'Photosynthesis',
      difficulty: 'easy',
      question_count: 3,
    };

    setMockFetch((url, init) => {
      assert.strictEqual(init?.method, 'POST');
      assert.ok(url.includes('/api/v1/quizzes/generate'));
      const body = JSON.parse(String(init?.body));
      assert.strictEqual(body.topic, 'Photosynthesis');
      assert.strictEqual(body.difficulty, 'easy');
      assert.strictEqual(body.question_count, 3);

      return createJsonResponse({
        id: 'quiz-gen-1',
        user_id: 'user-1',
        title: 'Photosynthesis Quiz',
        source_type: 'topic',
        difficulty: 'easy',
        question_count: 3,
        created_at: '2026-11-02T10:00:00Z',
        questions: [],
      });
    });

    const created = await quizApi.generate(payload);
    assert.strictEqual(created.id, 'quiz-gen-1');
    assert.strictEqual(created.title, 'Photosynthesis Quiz');
  });

  it('submits a quiz attempt with answers and returns score and breakdown', async () => {
    const payload: QuizSubmitRequest = {
      answers: {
        'q-1': 'A',
        'q-2': 'B',
      },
      time_taken_seconds: 45,
    };

    const mockAttempt: QuizAttempt = {
      id: 'att-1',
      quiz_id: 'quiz-1',
      user_id: 'user-1',
      score_percentage: 100.0,
      correct_count: 2,
      incorrect_count: 0,
      answers_submitted: payload.answers,
      time_taken_seconds: 45,
      completed_at: '2026-11-02T10:05:00Z',
    };

    setMockFetch((url, init) => {
      assert.strictEqual(init?.method, 'POST');
      assert.ok(url.includes('/api/v1/quizzes/quiz-1/submit'));
      const body = JSON.parse(String(init?.body));
      assert.strictEqual(body.time_taken_seconds, 45);
      return createJsonResponse(mockAttempt);
    });

    const attempt = await quizApi.submit('quiz-1', payload);
    assert.strictEqual(attempt.score_percentage, 100.0);
    assert.strictEqual(attempt.correct_count, 2);
    assert.strictEqual(attempt.incorrect_count, 0);
  });

  it('converts missed quiz questions into flashcards for spaced repetition', async () => {
    const mockConvertRes: ConvertMissedToCardsResponse = {
      message: 'Successfully converted 2 missed question(s) into flashcards.',
      deck_id: 'deck-review-123',
      cards_created: 2,
    };

    setMockFetch((url, init) => {
      assert.strictEqual(init?.method, 'POST');
      assert.ok(
        url.includes('/api/v1/quizzes/quiz-1/attempts/att-1/convert-to-flashcards')
      );
      return createJsonResponse(mockConvertRes);
    });

    const res = await quizApi.convertMissedToFlashcards('quiz-1', 'att-1');
    assert.strictEqual(res.cards_created, 2);
    assert.strictEqual(res.deck_id, 'deck-review-123');
  });

  it('deletes a quiz by id', async () => {
    setMockFetch((url, init) => {
      assert.strictEqual(init?.method, 'DELETE');
      assert.ok(url.includes('/api/v1/quizzes/quiz-1'));
      return new Response(null, { status: 204 });
    });

    await assert.doesNotReject(async () => {
      await quizApi.delete('quiz-1');
    });
  });
});

