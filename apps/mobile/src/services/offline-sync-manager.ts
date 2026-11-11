/**
 * Offline Sync Manager for StudyMate AI Mobile
 *
 * Implements:
 * - Persistent pending queues for Notes and Tasks created/modified while offline.
 * - Automatic background synchronization when the network reconnects or app enters foreground.
 * - Optimistic local state persistence with ID resolution (replaces offline client IDs with server IDs).
 * - AppState lifecycle listening for background-to-foreground transitions.
 */

import { noteApi, taskApi } from './api/client';
import {
  clearPendingNoteActions,
  loadCachedNotes,
  loadPendingNoteActions,
  saveCachedNotes,
  savePendingNoteActions,
} from './storage/notes-cache';
import {
  clearPendingActions,
  loadCachedTasks,
  loadPendingActions,
  saveCachedTasks,
  savePendingActions,
} from './storage/task-cache';
import { Note, NoteCreate } from '../types/note';
import { Task, TaskCreate } from '../types/task';

function getAppState(): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rn = require('react-native');
    return rn.AppState;
  } catch {
    return null;
  }
}

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

export interface SyncState {
  status: SyncStatus;
  lastSyncTime: Date | null;
  pendingNotesCount: number;
  pendingTasksCount: number;
  error: string | null;
}

export type SyncListener = (state: SyncState) => void;

class OfflineSyncManager {
  private status: SyncStatus = 'idle';
  private lastSyncTime: Date | null = null;
  private error: string | null = null;
  private listeners: Set<SyncListener> = new Set();
  private intervalTimer: NodeJS.Timeout | null = null;
  private appStateSubscription: any = null;
  private isInitialized = false;

  public getState(): SyncState {
    return {
      status: this.status,
      lastSyncTime: this.lastSyncTime,
      pendingNotesCount: 0,
      pendingTasksCount: 0,
      error: this.error,
    };
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const state = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(state);
      } catch (err) {
        console.warn('[OfflineSyncManager] Listener error:', err);
      }
    });
  }

  /**
   * Initializes background lifecycle listener and periodic sync interval.
   */
  public init(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // 1. React Native AppState listener: triggers sync when returning to active screen
    try {
      const appState = getAppState();
      if (appState && typeof appState.addEventListener === 'function') {
        this.appStateSubscription = appState.addEventListener(
          'change',
          (nextState: string) => {
            if (nextState === 'active') {
              this.syncAllPending().catch(() => {});
            }
          }
        );
      }
    } catch {
      // Non-RN environments
    }

    // 2. Periodic sync check (every 15 seconds when pending actions exist)
    this.intervalTimer = setInterval(() => {
      this.checkAndSync().catch(() => {});
    }, 15000);

    // Initial check
    setTimeout(() => {
      this.checkAndSync().catch(() => {});
    }, 2000);
  }

  public destroy(): void {
    if (this.appStateSubscription?.remove) {
      this.appStateSubscription.remove();
    }
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    this.listeners.clear();
    this.isInitialized = false;
  }

  /**
   * Fast check to see if there are any pending offline items before attempting network calls.
   */
  public async getPendingCount(): Promise<{ notes: number; tasks: number; total: number }> {
    try {
      const [notes, tasks] = await Promise.all([
        loadPendingNoteActions(),
        loadPendingActions(),
      ]);
      return {
        notes: notes.length,
        tasks: tasks.length,
        total: notes.length + tasks.length,
      };
    } catch {
      return { notes: 0, tasks: 0, total: 0 };
    }
  }

  private async checkAndSync(): Promise<void> {
    const counts = await this.getPendingCount();
    if (counts.total > 0 && this.status !== 'syncing') {
      await this.syncAllPending();
    }
  }

  /**
   * Primary synchronization execution loop:
   * 1. Flushes pending notes to PostgreSQL
   * 2. Flushes pending tasks to PostgreSQL
   * 3. Reconciles cached local state with fresh server state
   */
  public async syncAllPending(): Promise<{ syncedNotes: number; syncedTasks: number }> {
    if (this.status === 'syncing') {
      return { syncedNotes: 0, syncedTasks: 0 };
    }

    const counts = await this.getPendingCount();
    if (counts.total === 0) {
      return { syncedNotes: 0, syncedTasks: 0 };
    }

    this.status = 'syncing';
    this.error = null;
    this.notify();

    let syncedNotes = 0;
    let syncedTasks = 0;

    try {
      // -------------------------------------------------------------
      // 1. NOTES SYNC
      // -------------------------------------------------------------
      const pendingNotes = await loadPendingNoteActions();
      if (pendingNotes.length > 0) {
        let cachedNotes = await loadCachedNotes();
        const remainingNotes: typeof pendingNotes = [];

        for (let i = 0; i < pendingNotes.length; i++) {
          const action = pendingNotes[i];
          try {
            if (action.type === 'create' && action.payload) {
              const payload = action.payload as NoteCreate;
              const serverNote = await noteApi.create(payload);
              syncedNotes++;

              // Replace offline temporary note in cache
              if (action.noteId) {
                cachedNotes = cachedNotes.map((n) =>
                  n.id === action.noteId ? serverNote : n
                );
              } else {
                cachedNotes = [serverNote, ...cachedNotes];
              }
            } else if (action.type === 'update' && action.noteId && action.payload) {
              if (!action.noteId.startsWith('offline_')) {
                await noteApi.update(action.noteId, action.payload);
                syncedNotes++;
              }
            } else if (action.type === 'toggle_pin' && action.noteId) {
              if (!action.noteId.startsWith('offline_')) {
                await noteApi.update(action.noteId, { is_pinned: true });
                syncedNotes++;
              }
            } else if (action.type === 'delete' && action.noteId) {
              if (!action.noteId.startsWith('offline_')) {
                await noteApi.delete(action.noteId);
                syncedNotes++;
              }
            }
          } catch (itemErr: any) {
            console.log('[OfflineSyncManager] Single note sync skipped:', itemErr);
            remainingNotes.push(action);
            const isNetErr =
              itemErr?.name === 'NetworkError' ||
              (itemErr?.message &&
                (itemErr.message.toLowerCase().includes('network') ||
                  itemErr.message.toLowerCase().includes('connect') ||
                  itemErr.message.toLowerCase().includes('failed to fetch')));
            if (isNetErr) {
              // Still offline: preserve all subsequent pending actions and abort note sync loop
              remainingNotes.push(...pendingNotes.slice(i + 1));
              break;
            }
          }
        }

        // If any notes synced, fetch authoritative notes from server to ensure perfect synchronization
        if (syncedNotes > 0) {
          try {
            const freshNotes = await noteApi.list();
            await saveCachedNotes(freshNotes);
          } catch {
            await saveCachedNotes(cachedNotes);
          }
        }

        await savePendingNoteActions(remainingNotes);
      }

      // -------------------------------------------------------------
      // 2. TASKS SYNC
      // -------------------------------------------------------------
      const pendingTasks = await loadPendingActions();
      if (pendingTasks.length > 0) {
        const remainingTasks: typeof pendingTasks = [];

        for (let j = 0; j < pendingTasks.length; j++) {
          const action = pendingTasks[j];
          try {
            if (action.type === 'create_task' && action.payload) {
              const payload = action.payload as unknown as TaskCreate;
              await taskApi.create(payload);
              syncedTasks++;
            } else if (action.type === 'toggle_status' && action.taskId) {
              if (!action.taskId.startsWith('offline_')) {
                const status = (action.payload?.status as any) || 'completed';
                await taskApi.toggleComplete(action.taskId, status);
                syncedTasks++;
              }
            } else if (action.type === 'delete_task' && action.taskId) {
              if (!action.taskId.startsWith('offline_')) {
                await taskApi.delete(action.taskId);
                syncedTasks++;
              }
            }
          } catch (taskErr: any) {
            console.log('[OfflineSyncManager] Single task sync skipped:', taskErr);
            remainingTasks.push(action);
            const isNetErr =
              taskErr?.name === 'NetworkError' ||
              (taskErr?.message &&
                (taskErr.message.toLowerCase().includes('network') ||
                  taskErr.message.toLowerCase().includes('connect') ||
                  taskErr.message.toLowerCase().includes('failed to fetch')));
            if (isNetErr) {
              // Still offline: preserve all subsequent pending actions and abort task sync loop
              remainingTasks.push(...pendingTasks.slice(j + 1));
              break;
            }
          }
        }

        if (syncedTasks > 0) {
          try {
            const freshTasks = await taskApi.list({ limit: 100 });
            await saveCachedTasks(freshTasks.items);
          } catch {
            // Keep current cache
          }
        }

        await savePendingActions(remainingTasks);
      }

      if (syncedNotes > 0 || syncedTasks > 0) {
        this.status = 'success';
        this.lastSyncTime = new Date();
        this.error = null;
        this.notify();
      } else {
        this.status = 'idle';
        this.notify();
      }

      return { syncedNotes, syncedTasks };
    } catch (err: unknown) {
      this.status = 'error';
      this.error = err instanceof Error ? err.message : 'Synchronization failed. Will retry automatically.';
      this.notify();
      return { syncedNotes, syncedTasks };
    } finally {
      if (this.status === 'syncing') {
        this.status = 'idle';
        this.notify();
      }
    }
  }
}

export const offlineSyncManager = new OfflineSyncManager();
