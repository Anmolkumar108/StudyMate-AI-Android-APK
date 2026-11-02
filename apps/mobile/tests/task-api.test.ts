import assert from 'node:assert';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { API_CONFIG } from '../src/config/env';
import { _resetRefreshState, taskApi } from '../src/services/api/client';
import { clearTokens, resetStorageAdapter, saveTokens } from '../src/services/storage/token-storage';
import { Task, TaskCreate, TaskListResponse, TaskUpdate } from '../src/types/task';

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

describe('Task API Client (FR-09)', () => {
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

  it('lists tasks with status and priority filters', async () => {
    const mockList: TaskListResponse = {
      items: [
        {
          id: 'task-1',
          user_id: 'user-1',
          title: 'Algorithms Homework 2',
          priority: 'urgent',
          status: 'todo',
          subtasks: [{ id: 's1', title: 'Q1 Dynamic Programming', is_completed: true }],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      total: 1,
      completed_count: 0,
      pending_count: 1,
      overdue_count: 0,
    };

    setMockFetch((url) => {
      assert.ok(url.includes(API_CONFIG.endpoints.tasks));
      assert.ok(url.includes('status=todo'));
      assert.ok(url.includes('priority=urgent'));
      return createJsonResponse(mockList, 200);
    });

    const res = await taskApi.list({ status: 'todo', priority: 'urgent' });
    assert.strictEqual(res.total, 1);
    assert.strictEqual(res.items[0].title, 'Algorithms Homework 2');
    assert.strictEqual(res.items[0].priority, 'urgent');
  });

  it('creates a new task with subtasks', async () => {
    const payload: TaskCreate = {
      title: 'Database Schema Design',
      description: 'Design 3NF relational models',
      priority: 'high',
      status: 'todo',
      estimated_minutes: 60,
      subtasks: [{ title: 'ERD diagram', is_completed: false }],
    };

    const mockCreated: Task = {
      id: 'task-created-id',
      user_id: 'user-1',
      title: payload.title,
      description: payload.description,
      priority: 'high',
      status: 'todo',
      estimated_minutes: 60,
      subtasks: [{ id: 'sub-1', title: 'ERD diagram', is_completed: false }],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setMockFetch((url, options) => {
      assert.strictEqual(options?.method, 'POST');
      assert.ok(url.includes(API_CONFIG.endpoints.tasks));
      const body = JSON.parse(options?.body as string);
      assert.strictEqual(body.title, 'Database Schema Design');
      return createJsonResponse(mockCreated, 201);
    });

    const res = await taskApi.create(payload);
    assert.strictEqual(res.id, 'task-created-id');
    assert.strictEqual(res.title, 'Database Schema Design');
    assert.strictEqual(res.subtasks.length, 1);
  });

  it('toggles task completion status', async () => {
    const mockUpdated: Task = {
      id: 'task-1',
      user_id: 'user-1',
      title: 'Completed Task',
      priority: 'medium',
      status: 'completed',
      subtasks: [],
      completed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setMockFetch((url, options) => {
      assert.strictEqual(options?.method, 'PATCH');
      assert.ok(url.includes(API_CONFIG.endpoints.taskById('task-1')));
      const body = JSON.parse(options?.body as string);
      assert.strictEqual(body.status, 'completed');
      return createJsonResponse(mockUpdated, 200);
    });

    const res = await taskApi.toggleComplete('task-1', 'todo');
    assert.strictEqual(res.status, 'completed');
  });

  it('deletes a task cleanly on 204 No Content', async () => {
    setMockFetch((url, options) => {
      assert.strictEqual(options?.method, 'DELETE');
      assert.ok(url.includes(API_CONFIG.endpoints.taskById('task-to-delete')));
      return new Response(null, { status: 204 });
    });

    await assert.doesNotReject(async () => {
      await taskApi.delete('task-to-delete');
    });
  });

  it('fetches task analytics with metrics and weekly trends', async () => {
    const mockAnalytics = {
      total_tasks: 10,
      completed_tasks: 7,
      pending_tasks: 3,
      overdue_tasks: 0,
      completion_rate: 70.0,
      total_focus_minutes: 180,
      total_focus_sessions: 6,
      weekly_trends: [{ day: 'Mon', completed: 3, created: 2 }],
      subject_workload: [
        {
          subject_id: 'sub-1',
          subject_name: 'CS101',
          color: '#6366F1',
          total_tasks: 5,
          completed_tasks: 4,
          pending_tasks: 1,
        },
      ],
    };

    setMockFetch((url) => {
      assert.ok(url.includes(API_CONFIG.endpoints.taskAnalytics));
      return createJsonResponse(mockAnalytics, 200);
    });

    const res = await taskApi.getAnalytics();
    assert.strictEqual(res.completion_rate, 70.0);
    assert.strictEqual(res.total_focus_minutes, 180);
    assert.strictEqual(res.weekly_trends.length, 1);
  });

  it('manages task templates and creates tasks from templates', async () => {
    const mockTemplates = [
      {
        id: 'tmpl-1',
        title: 'College Assignment',
        description: 'Standard lab template',
        default_priority: 'medium',
        estimated_minutes: 60,
        subtasks: [{ id: 's1', title: 'Read rubric', is_completed: false }],
        category: 'assignment',
        is_system: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    setMockFetch((url, options) => {
      if (options?.method === 'GET') {
        assert.ok(url.includes(API_CONFIG.endpoints.taskTemplates));
        return createJsonResponse(mockTemplates, 200);
      }
      if (options?.method === 'POST') {
        assert.ok(url.includes(API_CONFIG.endpoints.taskFromTemplate));
        return createJsonResponse(
          {
            id: 'new-task-from-tmpl',
            title: 'College Assignment',
            status: 'todo',
            priority: 'medium',
            subtasks: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          201
        );
      }
      throw new Error(`Unexpected request to ${url}`);
    });

    const list = await taskApi.listTemplates();
    assert.strictEqual(list.length, 1);
    assert.strictEqual(list[0].title, 'College Assignment');

    const created = await taskApi.createFromTemplate({ template_id: 'tmpl-1' });
    assert.strictEqual(created.id, 'new-task-from-tmpl');
  });

  it('logs Pomodoro focus time to a task', async () => {
    setMockFetch((url, options) => {
      assert.strictEqual(options?.method, 'POST');
      assert.ok(url.includes(API_CONFIG.endpoints.taskLogFocus('task-focus-1')));
      const body = JSON.parse(options?.body as string);
      assert.strictEqual(body.minutes, 25);
      return createJsonResponse(
        {
          id: 'task-focus-1',
          title: 'Deep Work Task',
          focus_minutes: 50,
          focus_sessions_count: 2,
          status: 'in_progress',
          priority: 'high',
          subtasks: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        200
      );
    });

    const res = await taskApi.logFocus('task-focus-1', 25, 1);
    assert.strictEqual(res.focus_minutes, 50);
    assert.strictEqual(res.focus_sessions_count, 2);
  });

  it('calls AI task assistance endpoints (breakdown and natural parsing)', async () => {
    setMockFetch((url, options) => {
      if (url.includes(API_CONFIG.endpoints.taskAiBreakdown)) {
        return createJsonResponse(
          {
            subtasks: [
              { title: 'Read Chapter 3', estimated_minutes: 30 },
              { title: 'Write Summary', estimated_minutes: 45 },
            ],
          },
          200
        );
      }
      if (url.includes(API_CONFIG.endpoints.taskAiParseNatural)) {
        return createJsonResponse(
          {
            title: 'Physics Lab 3',
            description: 'Due tonight',
            priority: 'urgent',
            due_datetime: null,
            estimated_minutes: 90,
            suggested_subtasks: ['Setup equipment', 'Take readings'],
          },
          200
        );
      }
      throw new Error(`Unexpected AI route ${url}`);
    });

    const breakdown = await taskApi.aiBreakdown('Big Assignment');
    assert.strictEqual(breakdown.subtasks.length, 2);

    const parsed = await taskApi.aiParseNatural('Submit physics lab 3 tonight urgent');
    assert.strictEqual(parsed.title, 'Physics Lab 3');
    assert.strictEqual(parsed.priority, 'urgent');
  });

  it('uploads task attachment via base64 JSON endpoint', async () => {
    setMockFetch((url, options) => {
      assert.strictEqual(options?.method, 'POST');
      assert.ok(url.includes('/api/v1/tasks/task-attach-1/attachments-base64'));
      const body = JSON.parse(options?.body as string);
      assert.strictEqual(body.filename, 'notes.pdf');
      assert.strictEqual(body.file_type, 'application/pdf');
      assert.strictEqual(body.file_base64, 'JVBERi0xLjQKJcfs');
      return createJsonResponse(
        {
          id: 'task-attach-1',
          title: 'Task with Base64 Attachment',
          attachments: [
            {
              id: 'att-1',
              file_name: 'notes.pdf',
              file_size: 1024,
              content_type: 'application/pdf',
              created_at: new Date().toISOString(),
            },
          ],
          status: 'todo',
          priority: 'medium',
          subtasks: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        200
      );
    });

    const res = await taskApi.uploadAttachmentBase64('task-attach-1', {
      filename: 'notes.pdf',
      file_type: 'application/pdf',
      file_base64: 'JVBERi0xLjQKJcfs',
    });
    assert.strictEqual(res.id, 'task-attach-1');
    assert.strictEqual(res.attachments?.[0]?.file_name, 'notes.pdf');
  });
});

