import assert from 'node:assert';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { _resetRefreshState, examApi } from '../src/services/api/client';
import { clearTokens, resetStorageAdapter, saveTokens } from '../src/services/storage/token-storage';
import {
  Exam,
  ExamCreate,
  ExamListResponse,
  ExamUpcomingSummary,
} from '../src/types/exam';

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

const mockExam: Exam = {
  id: 'exam-101',
  user_id: 'user-1',
  subject_id: 'sub-1',
  title: 'Operating Systems Midterm',
  exam_date: '2026-11-20T10:00:00Z',
  location: 'Hall A',
  target_score: 90,
  achieved_score: null,
  syllabus_topics: [
    { id: 'top-1', name: 'Process Scheduling', is_completed: true, confidence: 'high' },
    { id: 'top-2', name: 'Virtual Memory & Paging', is_completed: false, confidence: 'medium' },
  ],
  revision_plan: {
    total_days: 15,
    generated_at: '2026-11-01T00:00:00Z',
    summary: 'Plan for Midterm',
    phases: [
      {
        phase_number: 1,
        title: 'Foundations & Concepts',
        start_date: '2026-11-05T00:00:00Z',
        end_date: '2026-11-11T00:00:00Z',
        days: 6,
        description: 'Read notes and lecture slides',
        daily_focus_minutes: 60,
        suggested_activities: ['Review slides 1-5', 'Create flashcards'],
      },
    ],
  },
  readiness_percentage: 50,
  total_topics: 2,
  completed_topics: 1,
  days_remaining: 13,
  hours_remaining: 312,
  is_past: false,
  subject_name: 'Operating Systems',
  created_at: '2026-11-01T00:00:00Z',
  updated_at: '2026-11-01T00:00:00Z',
};

describe('Exam Preparation & Revision Countdown API Client (FR-13)', () => {
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
  });

  it('lists exams with upcoming filter', async () => {
    setMockFetch((url, options) => {
      assert.ok(url.includes('/api/v1/exams'));
      assert.ok(url.includes('upcoming_only=true'));
      assert.strictEqual(options?.method || 'GET', 'GET');
      const responseData: ExamListResponse = {
        items: [mockExam],
        total: 1,
        upcoming_count: 1,
        average_readiness: 50,
      };
      return createJsonResponse(responseData);
    });

    const result = await examApi.list({ upcoming_only: true });
    assert.strictEqual(result.items.length, 1);
    assert.strictEqual(result.items[0].title, 'Operating Systems Midterm');
    assert.strictEqual(result.items[0].readiness_percentage, 50);
  });

  it('fetches upcoming exam summary for dashboard', async () => {
    setMockFetch((url, options) => {
      assert.ok(url.includes('/api/v1/exams/upcoming/summary'));
      assert.strictEqual(options?.method || 'GET', 'GET');
      const summary: ExamUpcomingSummary = {
        next_exam: mockExam,
        total_upcoming: 1,
        average_readiness: 50,
      };
      return createJsonResponse(summary);
    });

    const summary = await examApi.getUpcomingSummary();
    assert.strictEqual(summary.total_upcoming, 1);
    assert.strictEqual(summary.next_exam?.title, 'Operating Systems Midterm');
  });

  it('retrieves single exam by ID', async () => {
    setMockFetch((url, options) => {
      assert.ok(url.includes('/api/v1/exams/exam-101'));
      assert.strictEqual(options?.method || 'GET', 'GET');
      return createJsonResponse(mockExam);
    });

    const item = await examApi.getById('exam-101');
    assert.strictEqual(item.id, 'exam-101');
    assert.strictEqual(item.syllabus_topics.length, 2);
  });

  it('creates an exam successfully', async () => {
    const payload: ExamCreate = {
      title: 'Database Systems Final',
      exam_date: '2026-12-05T09:00:00Z',
      subject_id: 'sub-2',
      location: 'Lecture Hall 3',
      target_score: 95,
      syllabus_topics: [
        { id: 'top-1', name: 'B+ Trees', is_completed: false, confidence: 'medium' },
        { id: 'top-2', name: 'ACID & 2PL', is_completed: false, confidence: 'medium' },
      ],
    };

    setMockFetch((url, options) => {
      assert.ok(url.includes('/api/v1/exams'));
      assert.strictEqual(options?.method, 'POST');
      const body = JSON.parse(options?.body as string);
      assert.strictEqual(body.title, 'Database Systems Final');
      assert.strictEqual(body.target_score, 95);
      return createJsonResponse(
        { ...mockExam, id: 'exam-102', ...body, readiness_percentage: 0 },
        201
      );
    });

    const created = await examApi.create(payload);
    assert.strictEqual(created.id, 'exam-102');
    assert.strictEqual(created.title, 'Database Systems Final');
    assert.strictEqual(created.readiness_percentage, 0);
  });

  it('updates an existing exam', async () => {
    setMockFetch((url, options) => {
      assert.ok(url.includes('/api/v1/exams/exam-101'));
      assert.strictEqual(options?.method, 'PATCH');
      const body = JSON.parse(options?.body as string);
      assert.strictEqual(body.target_score, 98);
      return createJsonResponse({ ...mockExam, target_score: 98 });
    });

    const updated = await examApi.update('exam-101', { target_score: 98 });
    assert.strictEqual(updated.target_score, 98);
  });

  it('updates an existing exam with updated syllabus topics', async () => {
    setMockFetch((url, options) => {
      assert.ok(url.includes('/api/v1/exams/exam-101'));
      assert.strictEqual(options?.method, 'PATCH');
      const body = JSON.parse(options?.body as string);
      assert.deepStrictEqual(body.syllabus_topics, ['Process Scheduling', 'Virtual Memory', 'File Systems']);
      return createJsonResponse({
        ...mockExam,
        syllabus_topics: [
          { id: 'top-1', name: 'Process Scheduling', is_completed: true, confidence: 'medium' },
          { id: 'top-2', name: 'Virtual Memory', is_completed: false, confidence: 'medium' },
          { id: 'top-3', name: 'File Systems', is_completed: false, confidence: 'medium' },
        ],
      });
    });

    const updated = await examApi.update('exam-101', {
      syllabus_topics: ['Process Scheduling', 'Virtual Memory', 'File Systems'],
    });
    assert.strictEqual(updated.syllabus_topics.length, 3);
  });

  it('deletes an exam cleanly on 204 No Content', async () => {
    setMockFetch((url, options) => {
      assert.ok(url.includes('/api/v1/exams/exam-101'));
      assert.strictEqual(options?.method, 'DELETE');
      return new Response(null, { status: 204 });
    });

    await examApi.delete('exam-101');
    assert.ok(true);
  });

  it('toggles syllabus topic completion status', async () => {
    setMockFetch((url, options) => {
      assert.ok(url.includes('/api/v1/exams/exam-101/topics/top-2/toggle'));
      assert.strictEqual(options?.method, 'PATCH');
      const body = JSON.parse(options?.body as string);
      assert.strictEqual(body.is_completed, true);
      const updatedExam = {
        ...mockExam,
        syllabus_topics: [
          { id: 'top-1', name: 'Process Scheduling', is_completed: true, confidence: 'high' },
          { id: 'top-2', name: 'Virtual Memory & Paging', is_completed: true, confidence: 'medium' },
        ],
        readiness_percentage: 100,
      };
      return createJsonResponse(updatedExam);
    });

    const updated = await examApi.toggleTopic('exam-101', 'top-2', { is_completed: true });
    assert.strictEqual(updated.readiness_percentage, 100);
    assert.strictEqual(updated.syllabus_topics[1].is_completed, true);
  });

  it('generates an AI 3-phase revision plan', async () => {
    setMockFetch((url, options) => {
      assert.ok(url.includes('/api/v1/exams/exam-101/generate-plan'));
      assert.strictEqual(options?.method, 'POST');
      const updatedExam = {
        ...mockExam,
        revision_plan: {
          total_days: 15,
          phases: [
            {
              phase_number: 1,
              title: 'Concept Mastering',
              duration_days: 6,
              description: 'Core theories',
              recommended_actions: ['Read chapter 1-4'],
            },
            {
              phase_number: 2,
              title: 'Active Recall',
              duration_days: 5,
              description: 'Practice cards',
              recommended_actions: ['Spaced flashcard drilling'],
            },
            {
              phase_number: 3,
              title: 'Mock Exams',
              duration_days: 4,
              description: 'Timed tests',
              recommended_actions: ['Solve previous year papers'],
            },
          ],
        },
      };
      return createJsonResponse(updatedExam);
    });

    const result = await examApi.generateRevisionPlan('exam-101');
    assert.strictEqual(result.revision_plan?.phases.length, 3);
    assert.strictEqual(result.revision_plan?.phases[0].title, 'Concept Mastering');
  });
});
