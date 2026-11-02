import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  saveCachedTasks,
  loadCachedTasks,
  clearCachedTasks,
  queuePendingAction,
  loadPendingActions,
  clearPendingActions,
  applyPendingActionsToTasks,
  setTaskCacheAdapter,
} from '../src/services/storage/task-cache';
import { Task } from '../src/types/task';

// In-memory test storage adapter
const memoryStore = new Map<string, string>();
const testAdapter = {
  getItem: async (key: string) => memoryStore.get(key) || null,
  setItem: async (key: string, value: string) => {
    memoryStore.set(key, value);
  },
  deleteItem: async (key: string) => {
    memoryStore.delete(key);
  },
};

describe('Task Offline Cache & Sync Queue', () => {
  beforeEach(() => {
    memoryStore.clear();
    setTaskCacheAdapter(testAdapter);
  });

  it('saves and loads cached tasks correctly', async () => {
    const sampleTasks: Task[] = [
      {
        id: 't-1',
        user_id: 'u-1',
        title: 'Midterm Prep',
        priority: 'high',
        status: 'todo',
        subtasks: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    await saveCachedTasks(sampleTasks);
    const loaded = await loadCachedTasks();
    assert.strictEqual(loaded.length, 1);
    assert.strictEqual(loaded[0].id, 't-1');
    assert.strictEqual(loaded[0].title, 'Midterm Prep');
  });

  it('clears cached tasks', async () => {
    await saveCachedTasks([
      {
        id: 't-1',
        user_id: 'u-1',
        title: 'Clean',
        priority: 'low',
        status: 'todo',
        subtasks: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);
    await clearCachedTasks();
    const loaded = await loadCachedTasks();
    assert.strictEqual(loaded.length, 0);
  });

  it('queues pending actions and applies them optimistically', async () => {
    const sampleTasks: Task[] = [
      {
        id: 't-1',
        user_id: 'u-1',
        title: 'Project Step 1',
        priority: 'medium',
        status: 'todo',
        subtasks: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 't-2',
        user_id: 'u-1',
        title: 'To Delete',
        priority: 'low',
        status: 'todo',
        subtasks: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    await queuePendingAction({ type: 'toggle_status', taskId: 't-1' });
    await queuePendingAction({ type: 'delete_task', taskId: 't-2' });

    const actions = await loadPendingActions();
    assert.strictEqual(actions.length, 2);

    const updated = applyPendingActionsToTasks(sampleTasks, actions);
    assert.strictEqual(updated.length, 1);
    assert.strictEqual(updated[0].id, 't-1');
    assert.strictEqual(updated[0].status, 'completed');

    await clearPendingActions();
    const afterClear = await loadPendingActions();
    assert.strictEqual(afterClear.length, 0);
  });
});

