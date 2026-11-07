import assert from 'node:assert';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { _resetRefreshState, analyticsApi, studySessionApi } from '../src/services/api/client';
import { clearTokens, resetStorageAdapter, saveTokens } from '../src/services/storage/token-storage';
import {
  AnalyticsHeatmapResponse,
  AnalyticsOverviewResponse,
  StudySessionResponse,
  TodayStudySummary,
} from '../src/types/analytics';

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

const mockSession: StudySessionResponse = {
  id: 'sess-001',
  user_id: 'user-001',
  subject_id: 'sub-001',
  task_id: 'task-001',
  duration_minutes: 45,
  actual_seconds_spent: 2700,
  session_type: 'focus',
  completed_successfully: true,
  rating_focus: 5,
  notes: 'Algorithms study block',
  started_at: '2026-11-05T14:00:00Z',
  ended_at: '2026-11-05T14:45:00Z',
  created_at: '2026-11-05T14:45:00Z',
  subject_name: 'Computer Science',
  subject_color: '#06B6D4',
  task_title: 'Dijkstra Implementation',
};

const mockTodaySummary: TodayStudySummary = {
  total_focus_minutes: 75,
  total_focus_sessions: 2,
  daily_goal_minutes: 120,
  goal_progress_percent: 62.5,
  current_streak_days: 5,
};

const mockOverview: AnalyticsOverviewResponse = {
  total_focus_hours: 12.5,
  total_sessions: 18,
  current_streak_days: 5,
  longest_streak_days: 14,
  tasks_completed_count: 8,
  quizzes_taken_count: 3,
  average_quiz_score: 88.5,
  flashcards_reviewed_count: 45,
  productivity_score: 82,
  subject_distribution: [
    {
      subject_id: 'sub-001',
      subject_name: 'Computer Science',
      subject_code: 'CS301',
      color_hex: '#06B6D4',
      total_minutes: 450,
      total_hours: 7.5,
      percentage: 60.0,
      session_count: 10,
    },
    {
      subject_id: 'sub-002',
      subject_name: 'Mathematics',
      subject_code: 'MATH201',
      color_hex: '#6366F1',
      total_minutes: 300,
      total_hours: 5.0,
      percentage: 40.0,
      session_count: 8,
    },
  ],
  weekly_trends: [
    { date: '2026-10-30', focus_minutes: 60, sessions_count: 1, tasks_completed: 1, quizzes_taken: 0, level: 3 },
    { date: '2026-10-31', focus_minutes: 90, sessions_count: 2, tasks_completed: 2, quizzes_taken: 1, level: 4 },
    { date: '2026-11-01', focus_minutes: 45, sessions_count: 1, tasks_completed: 0, quizzes_taken: 0, level: 2 },
    { date: '2026-11-02', focus_minutes: 60, sessions_count: 1, tasks_completed: 1, quizzes_taken: 0, level: 3 },
    { date: '2026-11-03', focus_minutes: 30, sessions_count: 1, tasks_completed: 1, quizzes_taken: 0, level: 2 },
    { date: '2026-11-04', focus_minutes: 120, sessions_count: 2, tasks_completed: 2, quizzes_taken: 1, level: 4 },
    { date: '2026-11-05', focus_minutes: 75, sessions_count: 2, tasks_completed: 1, quizzes_taken: 1, level: 3 },
  ],
  quiz_mastery_curve: [
    { date: 'Nov 02', quiz_title: 'Sorting Algorithms', score_percentage: 85.0, total_questions: 10 },
    { date: 'Nov 04', quiz_title: 'Graph Theory', score_percentage: 92.0, total_questions: 10 },
  ],
  milestones: [
    {
      id: 'first_focus',
      title: 'First Deep Focus',
      description: 'Completed your very first focus study block',
      icon: '🌱',
      unlocked: true,
      progress_text: '1/1 sessions',
    },
    {
      id: 'streak_3',
      title: 'Momentum Builder',
      description: 'Maintained a 3-day consecutive study streak',
      icon: '🔥',
      unlocked: true,
      progress_text: '3/3 days',
    },
  ],
};

const mockHeatmap: AnalyticsHeatmapResponse = {
  start_date: '2026-05-09',
  end_date: '2026-11-05',
  total_days: 180,
  total_active_days: 42,
  total_focus_minutes: 2450,
  current_streak_days: 5,
  longest_streak_days: 14,
  matrix: [
    { date: '2026-11-04', focus_minutes: 120, sessions_count: 2, tasks_completed: 2, quizzes_taken: 1, level: 4 },
    { date: '2026-11-05', focus_minutes: 75, sessions_count: 2, tasks_completed: 1, quizzes_taken: 1, level: 3 },
  ],
};

describe('Study Analytics & Heatmap API Client (FR-16)', () => {
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

  it('successfully logs a completed focus study session to PostgreSQL', async () => {
    setMockFetch((url, options) => {
      assert.ok(url.includes('/api/v1/study-sessions/log'));
      assert.strictEqual(options?.method, 'POST');
      assert.ok(options?.headers);
      assert.strictEqual(
        (options?.headers as Record<string, string>)['Authorization'],
        'Bearer valid-access-token'
      );
      const body = JSON.parse(options?.body as string);
      assert.strictEqual(body.duration_minutes, 45);
      assert.strictEqual(body.session_type, 'focus');
      return createJsonResponse(mockSession, 201);
    });

    const result = await studySessionApi.logSession({
      duration_minutes: 45,
      actual_seconds_spent: 2700,
      session_type: 'focus',
      subject_id: 'sub-001',
      task_id: 'task-001',
      started_at: '2026-11-05T14:00:00Z',
      ended_at: '2026-11-05T14:45:00Z',
    });

    assert.strictEqual(result.id, 'sess-001');
    assert.strictEqual(result.duration_minutes, 45);
    assert.strictEqual(result.subject_name, 'Computer Science');
    assert.strictEqual(result.task_title, 'Dijkstra Implementation');
  });

  it('fetches today study focus summary with goal progress', async () => {
    setMockFetch((url, options) => {
      assert.ok(url.includes('/api/v1/study-sessions/today'));
      assert.strictEqual(options?.method, 'GET');
      return createJsonResponse(mockTodaySummary);
    });

    const summary = await studySessionApi.getTodaySummary();
    assert.strictEqual(summary.total_focus_minutes, 75);
    assert.strictEqual(summary.total_focus_sessions, 2);
    assert.strictEqual(summary.goal_progress_percent, 62.5);
    assert.strictEqual(summary.current_streak_days, 5);
  });

  it('fetches complete analytics overview with subject distribution and weekly trends', async () => {
    setMockFetch((url, options) => {
      assert.ok(url.includes('/api/v1/analytics/overview'));
      assert.ok(url.includes('timeframe=all'));
      assert.strictEqual(options?.method, 'GET');
      return createJsonResponse(mockOverview);
    });

    const overview = await analyticsApi.getOverview('all');
    assert.strictEqual(overview.total_focus_hours, 12.5);
    assert.strictEqual(overview.total_sessions, 18);
    assert.strictEqual(overview.productivity_score, 82);
    assert.strictEqual(overview.subject_distribution.length, 2);
    assert.strictEqual(overview.subject_distribution[0].subject_name, 'Computer Science');
    assert.strictEqual(overview.subject_distribution[0].percentage, 60.0);
    assert.strictEqual(overview.weekly_trends.length, 7);
    assert.strictEqual(overview.milestones.length, 2);
    assert.strictEqual(overview.milestones[0].unlocked, true);
  });

  it('fetches 6-month consistency heatmap matrix', async () => {
    setMockFetch((url, options) => {
      assert.ok(url.includes('/api/v1/analytics/heatmap'));
      assert.ok(url.includes('days=180'));
      assert.strictEqual(options?.method, 'GET');
      return createJsonResponse(mockHeatmap);
    });

    const heatmap = await analyticsApi.getHeatmap(180);
    assert.strictEqual(heatmap.total_days, 180);
    assert.strictEqual(heatmap.total_active_days, 42);
    assert.strictEqual(heatmap.total_focus_minutes, 2450);
    assert.strictEqual(heatmap.current_streak_days, 5);
    assert.strictEqual(heatmap.matrix.length, 2);
    assert.strictEqual(heatmap.matrix[0].level, 4);
  });
});
