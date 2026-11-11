import assert from 'node:assert';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { offlineSyncManager } from '../src/services/offline-sync-manager';
import {
  applyPendingActionsToNotes,
  clearPendingNoteActions,
  loadPendingNoteActions,
  queuePendingNoteAction,
  resetNotesCacheAdapter,
} from '../src/services/storage/notes-cache';
import {
  applyPendingActionsToTasks,
  clearPendingActions,
  loadPendingActions,
  queuePendingAction,
  resetTaskCacheAdapter,
} from '../src/services/storage/task-cache';
import { userSecurityApi } from '../src/services/api/client';
import { clearTokens, resetStorageAdapter, saveTokens } from '../src/services/storage/token-storage';

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

describe('Offline Sync Manager & Push Notifications (FR-11, Offline Resilience)', () => {
  beforeEach(async () => {
    originalFetch = globalThis.fetch;
    resetStorageAdapter();
    resetNotesCacheAdapter();
    resetTaskCacheAdapter();
    await clearPendingNoteActions();
    await clearPendingActions();
    await saveTokens({
      accessToken: 'mock-valid-access-token',
      refreshToken: 'mock-valid-refresh-token',
    });
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    mockHandler = null;
    await clearPendingNoteActions();
    await clearPendingActions();
    await clearTokens();
    resetStorageAdapter();
    resetNotesCacheAdapter();
    resetTaskCacheAdapter();
  });

  it('initializes with idle status and clean state', () => {
    const state = offlineSyncManager.getState();
    assert.strictEqual(state.status, 'idle');
    assert.strictEqual(state.error, null);
  });

  it('queues offline note creation and counts pending items accurately', async () => {
    await queuePendingNoteAction({
      type: 'create',
      noteId: 'offline_note_123',
      payload: {
        title: 'Offline CS Lecture Notes',
        content: 'Binary Search Trees & AVL Rotations',
      },
    });

    const pending = await loadPendingNoteActions();
    assert.strictEqual(pending.length, 1);
    assert.strictEqual(pending[0].type, 'create');
    assert.strictEqual(pending[0].noteId, 'offline_note_123');

    const counts = await offlineSyncManager.getPendingCount();
    assert.strictEqual(counts.notes, 1);
    assert.strictEqual(counts.tasks, 0);
    assert.strictEqual(counts.total, 1);
  });

  it('queues offline task creation and counts pending items accurately', async () => {
    await queuePendingAction({
      type: 'create_task',
      payload: {
        title: 'Review Midterm Chapter 4',
        priority: 'high',
        status: 'todo',
      },
    });

    const pending = await loadPendingActions();
    assert.strictEqual(pending.length, 1);
    assert.strictEqual(pending[0].type, 'create_task');

    const counts = await offlineSyncManager.getPendingCount();
    assert.strictEqual(counts.notes, 0);
    assert.strictEqual(counts.tasks, 1);
    assert.strictEqual(counts.total, 1);
  });

  it('syncAllPending flushes queued notes and tasks to server upon reconnect', async () => {
    await queuePendingNoteAction({
      type: 'create',
      noteId: 'offline_note_999',
      payload: {
        title: 'Queued Note Title',
        content: 'Queued Note Content',
      },
    });

    await queuePendingAction({
      type: 'create_task',
      payload: {
        title: 'Queued Task Title',
        priority: 'medium',
        status: 'todo',
      },
    });

    let noteCreatedOnServer = false;
    let taskCreatedOnServer = false;

    setMockFetch((url, options) => {
      if (url.includes('/api/v1/notes') && options?.method === 'POST') {
        noteCreatedOnServer = true;
        return createJsonResponse({
          id: 'server_note_real_id',
          user_id: 'user_1',
          title: 'Queued Note Title',
          content: 'Queued Note Content',
          subject_id: null,
          is_pinned: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
      if (url.includes('/api/v1/notes') && options?.method === 'GET') {
        return createJsonResponse([]);
      }
      if (url.includes('/api/v1/tasks') && options?.method === 'POST') {
        taskCreatedOnServer = true;
        return createJsonResponse({
          id: 'server_task_real_id',
          user_id: 'user_1',
          title: 'Queued Task Title',
          priority: 'medium',
          status: 'todo',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
      if (url.includes('/api/v1/tasks') && options?.method === 'GET') {
        return createJsonResponse({ items: [], total: 0 });
      }
      throw new Error(`Unexpected url in test: ${url}`);
    });

    const result = await offlineSyncManager.syncAllPending();
    assert.strictEqual(noteCreatedOnServer, true, 'Note should have been uploaded to server');
    assert.strictEqual(taskCreatedOnServer, true, 'Task should have been uploaded to server');
    assert.strictEqual(result.syncedNotes, 1);
    assert.strictEqual(result.syncedTasks, 1);

    // Queues must be cleared after successful sync
    const remainingNotes = await loadPendingNoteActions();
    const remainingTasks = await loadPendingActions();
    assert.strictEqual(remainingNotes.length, 0);
    assert.strictEqual(remainingTasks.length, 0);
  });

  it('registers device push token with backend successfully', async () => {
    let tokenRegistered = false;

    setMockFetch((url, options) => {
      if (url.includes('/api/v1/users/me/push-token') && options?.method === 'POST') {
        tokenRegistered = true;
        const body = JSON.parse(options.body as string);
        assert.strictEqual(body.push_token, 'ExponentPushToken[mock-fcm-device-token-123]');
        assert.strictEqual(body.platform, 'android');
        return createJsonResponse({ message: 'Push token registered successfully.' });
      }
      throw new Error(`Unexpected url: ${url}`);
    });

    const res = await userSecurityApi.registerPushToken(
      'ExponentPushToken[mock-fcm-device-token-123]',
      'android'
    );
    assert.strictEqual(tokenRegistered, true);
    assert.strictEqual(res.message, 'Push token registered successfully.');
  });

  it('preserves pending actions in queue if device is still offline (network error)', async () => {
    await queuePendingNoteAction({
      type: 'create',
      noteId: 'offline_note_keep',
      payload: {
        title: 'Note made while offline',
        content: 'Should not be deleted if sync fails',
      },
    });

    await queuePendingAction({
      type: 'create_task',
      payload: {
        title: 'Task made while offline',
        priority: 'high',
        status: 'todo',
      },
    });

    // Simulate complete offline network error (e.g. Airplane mode)
    setMockFetch(() => {
      const netErr = new Error('Failed to fetch (net::ERR_INTERNET_DISCONNECTED)');
      netErr.name = 'NetworkError';
      throw netErr;
    });

    const result = await offlineSyncManager.syncAllPending();
    assert.strictEqual(result.syncedNotes, 0);
    assert.strictEqual(result.syncedTasks, 0);

    // CRITICAL: Actions must NOT be wiped when offline!
    const pendingNotes = await loadPendingNoteActions();
    const pendingTasks = await loadPendingActions();
    assert.strictEqual(pendingNotes.length, 1, 'Offline note action must be preserved in queue');
    assert.strictEqual(pendingTasks.length, 1, 'Offline task action must be preserved in queue');
  });

  it('applyPendingActionsToNotes and applyPendingActionsToTasks overlay created items optimistically', () => {
    const overlaidNotes = applyPendingActionsToNotes([], [
      {
        id: 'act_1',
        type: 'create',
        noteId: 'offline_n1',
        payload: { title: 'CSS Day 5', content: 'Flexbox and Grid' },
        createdAt: '2026-11-09T10:00:00Z',
      },
    ]);
    assert.strictEqual(overlaidNotes.length, 1);
    assert.strictEqual(overlaidNotes[0].id, 'offline_n1');
    assert.strictEqual(overlaidNotes[0].title, 'CSS Day 5');

    const overlaidTasks = applyPendingActionsToTasks([], [
      {
        id: 'act_2',
        type: 'create_task',
        taskId: 'offline_t1',
        payload: { title: 'Finish Assignment 3', priority: 'high', status: 'todo' },
        createdAt: '2026-11-09T10:00:00Z',
      },
    ]);
    assert.strictEqual(overlaidTasks.length, 1);
    assert.strictEqual(overlaidTasks[0].id, 'offline_t1');
    assert.strictEqual(overlaidTasks[0].title, 'Finish Assignment 3');
  });
});

