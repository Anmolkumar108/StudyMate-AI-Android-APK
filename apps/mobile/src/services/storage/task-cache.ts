import { Task, TaskStatus } from '../../types/task';
import { inMemoryAdapter, StorageAdapter } from './token-storage';

export const TASK_CACHE_KEY = 'studymate_task_cache';
export const TASK_PENDING_ACTIONS_KEY = 'studymate_task_pending_actions';

export interface PendingTaskAction {
  id: string;
  type: 'toggle_status' | 'create_task' | 'delete_task';
  taskId?: string;
  payload?: Record<string, unknown>;
  createdAt: string;
}

function createDefaultAdapter(): StorageAdapter {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SecureStore = require('expo-secure-store');
    if (SecureStore && typeof SecureStore.getItemAsync === 'function') {
      return {
        getItem: async (key: string) => SecureStore.getItemAsync(key),
        setItem: async (key: string, value: string) =>
          SecureStore.setItemAsync(key, value, {
            keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
          }),
        deleteItem: async (key: string) => SecureStore.deleteItemAsync(key),
      };
    }
  } catch {
    // Falls back to in-memory adapter on Web, Node, or Test
  }
  return inMemoryAdapter;
}

let activeAdapter: StorageAdapter = createDefaultAdapter();

export function setTaskCacheAdapter(adapter: StorageAdapter): void {
  activeAdapter = adapter;
}

export function resetTaskCacheAdapter(): void {
  activeAdapter = createDefaultAdapter();
}

/**
 * Persists the latest loaded list of tasks to local storage.
 */
export async function saveCachedTasks(tasks: Task[]): Promise<void> {
  try {
    await activeAdapter.setItem(TASK_CACHE_KEY, JSON.stringify(tasks));
  } catch {
    // Graceful fallback
  }
}

/**
 * Retrieves previously cached tasks from local storage for offline viewing.
 */
export async function loadCachedTasks(): Promise<Task[]> {
  try {
    const raw = await activeAdapter.getItem(TASK_CACHE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Task[];
  } catch {
    return [];
  }
}

/**
 * Clears task cache.
 */
export async function clearCachedTasks(): Promise<void> {
  try {
    await activeAdapter.deleteItem(TASK_CACHE_KEY);
  } catch {
    // Ignore error
  }
}

/**
 * Appends a pending offline mutation to the sync queue.
 */
export async function queuePendingAction(action: Omit<PendingTaskAction, 'id' | 'createdAt'>): Promise<void> {
  try {
    const existing = await loadPendingActions();
    const newAction: PendingTaskAction = {
      ...action,
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
    };
    existing.push(newAction);
    await activeAdapter.setItem(TASK_PENDING_ACTIONS_KEY, JSON.stringify(existing));
  } catch {
    // Graceful fallback
  }
}

/**
 * Retrieves all pending offline mutations.
 */
export async function loadPendingActions(): Promise<PendingTaskAction[]> {
  try {
    const raw = await activeAdapter.getItem(TASK_PENDING_ACTIONS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PendingTaskAction[];
  } catch {
    return [];
  }
}

/**
 * Clears all pending sync mutations after successful synchronization.
 */
export async function clearPendingActions(): Promise<void> {
  try {
    await activeAdapter.deleteItem(TASK_PENDING_ACTIONS_KEY);
  } catch {
    // Ignore error
  }
}

/**
 * Optimistically overlays queued pending actions on top of cached tasks
 * so the UI reflects offline edits without waiting for network.
 */
export function applyPendingActionsToTasks(tasks: Task[], actions: PendingTaskAction[]): Task[] {
  let result = [...tasks];

  for (const action of actions) {
    if (action.type === 'toggle_status' && action.taskId) {
      result = result.map((t) => {
        if (t.id === action.taskId) {
          const newStatus: TaskStatus = t.status === 'completed' ? 'todo' : 'completed';
          return {
            ...t,
            status: newStatus,
            completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
          };
        }
        return t;
      });
    } else if (action.type === 'delete_task' && action.taskId) {
      result = result.filter((t) => t.id !== action.taskId);
    }
  }

  return result;
}

