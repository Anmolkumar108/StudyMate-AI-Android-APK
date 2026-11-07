import assert from 'node:assert';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { _resetRefreshState, studyPlannerApi } from '../src/services/api/client';
import { clearTokens, resetStorageAdapter, saveTokens } from '../src/services/storage/token-storage';
import { StudyPlan } from '../src/types/planner';

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

const mockPlan: StudyPlan = {
  id: 'plan-001',
  user_id: 'user-001',
  plan_date: '2026-11-05',
  target_study_minutes: 180,
  planned_minutes: 135,
  completed_minutes: 45,
  completion_percentage: 33.3,
  timeblocks: [
    {
      id: 'blk-1',
      subject_id: 'sub-1',
      subject_name: 'Operating Systems',
      subject_color: '#6366F1',
      task_id: null,
      exam_id: 'ex-1',
      title: 'Revise OS Virtual Memory',
      block_type: 'exam_revision',
      start_time: '16:00',
      end_time: '16:45',
      duration_minutes: 45,
      priority: 'urgent',
      is_completed: true,
      completed_at: '2026-11-05T16:45:00Z',
    },
    {
      id: 'blk-2',
      subject_id: 'sub-2',
      subject_name: 'Data Structures',
      subject_color: '#10B981',
      task_id: 'tk-1',
      exam_id: null,
      title: 'Graph Traversal Assignment',
      block_type: 'task_work',
      start_time: '17:00',
      end_time: '17:45',
      duration_minutes: 45,
      priority: 'high',
      is_completed: false,
      completed_at: null,
    },
  ],
  ai_summary: 'Target OS revision while alert, followed by Graphs.',
  status: 'active',
  created_at: '2026-11-05T08:00:00Z',
  updated_at: '2026-11-05T08:00:00Z',
};

describe('Smart Study Planner API Client (FR-10)', () => {
  beforeEach(async () => {
    originalFetch = globalThis.fetch;
    _resetRefreshState();
    resetStorageAdapter();
    await saveTokens({
      accessToken: 'valid-test-access-token',
      refreshToken: 'valid-test-refresh-token',
    });
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    mockHandler = null;
    await clearTokens();
    _resetRefreshState();
    resetStorageAdapter();
  });

  it('fetches today active study plan', async () => {
    setMockFetch((url, options) => {
      assert.ok(url.includes('/api/v1/study-planner/today'));
      assert.strictEqual(options?.method, 'GET');
      return createJsonResponse(mockPlan);
    });

    const res = await studyPlannerApi.getTodayPlan();
    assert.ok(res);
    assert.strictEqual(res.id, 'plan-001');
    assert.strictEqual(res.target_study_minutes, 180);
    assert.strictEqual(res.timeblocks.length, 2);
  });

  it('fetches study plan by specific date', async () => {
    setMockFetch((url) => {
      assert.ok(url.includes('/api/v1/study-planner/date/2026-11-05'));
      return createJsonResponse(mockPlan);
    });

    const res = await studyPlannerApi.getPlanByDate('2026-11-05');
    assert.ok(res);
    assert.strictEqual(res.plan_date, '2026-11-05');
  });

  it('generates an AI-assisted daily study plan with focus subjects and pace', async () => {
    setMockFetch((url, options) => {
      assert.ok(url.includes('/api/v1/study-planner/generate'));
      assert.strictEqual(options?.method, 'POST');
      const body = JSON.parse(options?.body as string);
      assert.strictEqual(body.target_study_minutes, 120);
      assert.deepStrictEqual(body.focus_subject_ids, ['sub-1', 'sub-2']);
      assert.strictEqual(body.pace_mode, 'pomodoro');
      assert.strictEqual(body.include_breaks, true);
      return createJsonResponse(mockPlan, 201);
    });

    const res = await studyPlannerApi.generate({
      target_study_minutes: 120,
      focus_subject_ids: ['sub-1', 'sub-2'],
      pace_mode: 'pomodoro',
      include_breaks: true,
    });
    assert.ok(res);
    assert.strictEqual(res.planned_minutes, 135);
  });

  it('toggles a study block completion status', async () => {
    setMockFetch((url, options) => {
      assert.ok(url.includes('/api/v1/study-planner/plan-001/blocks/blk-2/toggle'));
      assert.strictEqual(options?.method, 'PATCH');
      const body = JSON.parse(options?.body as string);
      assert.strictEqual(body.is_completed, true);
      const updated = {
        ...mockPlan,
        completed_minutes: 90,
        timeblocks: mockPlan.timeblocks.map((b) =>
          b.id === 'blk-2' ? { ...b, is_completed: true } : b
        ),
      };
      return createJsonResponse(updated);
    });

    const res = await studyPlannerApi.toggleBlock('plan-001', 'blk-2', { is_completed: true });
    assert.strictEqual(res.completed_minutes, 90);
  });

  it('rebalances remaining study blocks across available evening hours', async () => {
    setMockFetch((url, options) => {
      assert.ok(url.includes('/api/v1/study-planner/plan-001/rebalance'));
      assert.strictEqual(options?.method, 'POST');
      return createJsonResponse({
        ...mockPlan,
        ai_summary: 'Schedule rebalanced for evening study.',
      });
    });

    const res = await studyPlannerApi.rebalance('plan-001', { remaining_available_minutes: 90 });
    assert.ok(res.ai_summary?.includes('rebalanced'));
  });
});
