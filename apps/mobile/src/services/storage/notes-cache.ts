import { Note, NoteCreate, NoteUpdate } from '../../types/note';
import { inMemoryAdapter, StorageAdapter } from './token-storage';

export const NOTES_CACHE_KEY = 'studymate_notes_cache';
export const NOTES_PENDING_ACTIONS_KEY = 'studymate_notes_pending_actions';

export interface PendingNoteAction {
  id: string;
  type: 'create' | 'update' | 'delete' | 'toggle_pin';
  noteId?: string;
  payload?: NoteCreate | NoteUpdate;
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
    // Fallback on Web or Node tests
  }
  return inMemoryAdapter;
}

let activeAdapter: StorageAdapter = createDefaultAdapter();

export function setNotesCacheAdapter(adapter: StorageAdapter): void {
  activeAdapter = adapter;
}

export function resetNotesCacheAdapter(): void {
  activeAdapter = createDefaultAdapter();
}

/**
 * Persists the latest loaded list of notes to local storage.
 */
export async function saveCachedNotes(notes: Note[]): Promise<void> {
  try {
    await activeAdapter.setItem(NOTES_CACHE_KEY, JSON.stringify(notes));
  } catch {
    // Graceful fallback
  }
}

/**
 * Retrieves previously cached notes from local storage for offline viewing.
 */
export async function loadCachedNotes(): Promise<Note[]> {
  try {
    const raw = await activeAdapter.getItem(NOTES_CACHE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Note[];
  } catch {
    return [];
  }
}

/**
 * Clears notes cache.
 */
export async function clearCachedNotes(): Promise<void> {
  try {
    await activeAdapter.deleteItem(NOTES_CACHE_KEY);
  } catch {
    // Ignore error
  }
}

/**
 * Appends a pending offline note mutation to the sync queue.
 */
export async function queuePendingNoteAction(
  action: Omit<PendingNoteAction, 'id' | 'createdAt'>
): Promise<void> {
  try {
    const existing = await loadPendingNoteActions();
    const newAction: PendingNoteAction = {
      ...action,
      id: `note_act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
    };
    existing.push(newAction);
    await activeAdapter.setItem(NOTES_PENDING_ACTIONS_KEY, JSON.stringify(existing));
  } catch {
    // Graceful fallback
  }
}

/**
 * Retrieves all pending offline note mutations.
 */
export async function loadPendingNoteActions(): Promise<PendingNoteAction[]> {
  try {
    const raw = await activeAdapter.getItem(NOTES_PENDING_ACTIONS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PendingNoteAction[];
  } catch {
    return [];
  }
}

/**
 * Overwrites the pending note mutations queue with remaining unsynced actions.
 */
export async function savePendingNoteActions(actions: PendingNoteAction[]): Promise<void> {
  try {
    if (actions.length === 0) {
      await clearPendingNoteActions();
    } else {
      await activeAdapter.setItem(NOTES_PENDING_ACTIONS_KEY, JSON.stringify(actions));
    }
  } catch {
    // Graceful fallback
  }
}

/**
 * Clears pending offline note mutations queue.
 */
export async function clearPendingNoteActions(): Promise<void> {
  try {
    await activeAdapter.deleteItem(NOTES_PENDING_ACTIONS_KEY);
  } catch {
    // Ignore error
  }
}

/**
 * Optimistically overlays queued pending actions on top of cached notes
 * so the UI reflects offline edits and newly created notes without waiting for network.
 */
export function applyPendingActionsToNotes(notes: Note[], actions: PendingNoteAction[]): Note[] {
  let result = [...notes];

  for (const action of actions) {
    if (action.type === 'create' && action.payload) {
      const p = action.payload as NoteCreate;
      const noteId = action.noteId || `offline_note_${action.id}`;
      if (!result.some((n) => n.id === noteId)) {
        const optimisticNote: Note = {
          id: noteId,
          user_id: 'local_offline_user',
          title: p.title || 'Untitled Note',
          content: p.content || '',
          subject_id: p.subject_id || null,
          is_pinned: p.is_pinned ?? false,
          created_at: action.createdAt || new Date().toISOString(),
          updated_at: action.createdAt || new Date().toISOString(),
        };
        result = [optimisticNote, ...result];
      }
    } else if (action.type === 'update' && action.noteId && action.payload) {
      const p = action.payload as NoteUpdate;
      result = result.map((n) => {
        if (n.id === action.noteId) {
          return {
            ...n,
            title: typeof p.title === 'string' && p.title.trim() ? p.title : n.title,
            content: typeof p.content === 'string' ? p.content : n.content,
            subject_id: p.subject_id !== undefined ? p.subject_id : n.subject_id,
            is_pinned: p.is_pinned !== undefined && p.is_pinned !== null ? p.is_pinned : n.is_pinned,
            updated_at: new Date().toISOString(),
          };
        }
        return n;
      });
    } else if (action.type === 'toggle_pin' && action.noteId) {
      result = result.map((n) => (n.id === action.noteId ? { ...n, is_pinned: !n.is_pinned } : n));
    } else if (action.type === 'delete' && action.noteId) {
      result = result.filter((n) => n.id !== action.noteId);
    }
  }

  return result;
}

