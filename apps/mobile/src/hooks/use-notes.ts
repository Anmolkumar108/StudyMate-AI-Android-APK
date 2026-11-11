import { useCallback, useEffect, useState } from 'react';

import { noteApi } from '@/services/api/client';
import { offlineSyncManager } from '@/services/offline-sync-manager';
import {
  applyPendingActionsToNotes,
  loadCachedNotes,
  loadPendingNoteActions,
  queuePendingNoteAction,
  saveCachedNotes,
} from '@/services/storage/notes-cache';
import {
  ApiError,
  AuthError,
  BadRequestError,
  NetworkError,
  NotFoundError,
} from '@/types/auth';
import { Note, NoteCreate, NoteListParams, NoteUpdate } from '@/types/note';

export interface UseNotesReturn {
  notes: Note[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  fetchNotes: (params?: NoteListParams, isRefresh?: boolean) => Promise<void>;
  createNote: (payload: NoteCreate) => Promise<Note>;
  updateNote: (id: string, payload: NoteUpdate) => Promise<Note>;
  togglePin: (id: string) => Promise<Note>;
  deleteNote: (id: string) => Promise<void>;
  clearError: () => void;
}

export function useNotes(): UseNotesReturn {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const formatErrorMessage = (err: unknown): string => {
    if (err instanceof BadRequestError) {
      return err.message || 'Invalid note or subject selection.';
    }
    if (err instanceof NotFoundError) {
      return 'Note not found. It may have already been deleted.';
    }
    if (err instanceof AuthError) {
      return 'Your session has expired. Please sign in again.';
    }
    if (err instanceof NetworkError) {
      return err.message || 'Network error. Please check your internet connection.';
    }
    if (err instanceof ApiError) {
      return err.message;
    }
    if (err instanceof Error) {
      return err.message;
    }
    return 'An unexpected error occurred. Please try again.';
  };

  const fetchNotes = useCallback(async (params?: NoteListParams, isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      // 1. Sync pending offline notes to server first so they are never overwritten
      await offlineSyncManager.syncAllPending();

      const data = await noteApi.list(params);
      setNotes(data);
      await saveCachedNotes(data);
    } catch (err) {
      // If network fails, load cache and overlay any pending actions!
      const cached = await loadCachedNotes();
      const pending = await loadPendingNoteActions();
      const hydrated = applyPendingActionsToNotes(cached, pending);
      if (hydrated.length > 0) {
        setNotes(hydrated);
      } else {
        setNotes((prev) => {
          if (prev.length === 0) {
            setError(formatErrorMessage(err));
          }
          return prev;
        });
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      let cached: Note[] | null = null;
      // 1. Instant offline cache hydration with pending actions overlaid
      try {
        cached = await loadCachedNotes();
        const pending = await loadPendingNoteActions();
        const hydrated = applyPendingActionsToNotes(cached, pending);
        if (hydrated.length > 0 && isMounted) {
          setNotes(hydrated);
          setIsLoading(false);
        }
      } catch {
        // Fallback
      }

      // 2. Network synchronization
      try {
        await offlineSyncManager.syncAllPending();
        const data = await noteApi.list();
        if (isMounted) {
          setNotes(data);
          await saveCachedNotes(data);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          // If cached notes are already loaded, suppress blocking network error
          const hasCached = (cached && cached.length > 0);
          if (!hasCached) {
            setError(formatErrorMessage(err));
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    load();

    // Subscribe to offline sync manager to auto-refresh notes when reconnected
    const unsubscribeSync = offlineSyncManager.subscribe((syncState) => {
      if (syncState.status === 'success' && isMounted) {
        loadCachedNotes()
          .then(async (cached) => {
            const pending = await loadPendingNoteActions();
            const hydrated = applyPendingActionsToNotes(cached, pending);
            if (hydrated && hydrated.length > 0 && isMounted) {
              setNotes(hydrated);
            }
          })
          .catch(() => {});
      }
    });

    offlineSyncManager.init();

    return () => {
      isMounted = false;
      unsubscribeSync();
    };
  }, []);

  const createNote = useCallback(async (payload: NoteCreate): Promise<Note> => {
    setError(null);
    try {
      const newNote = await noteApi.create(payload);
      setNotes((prev) => {
        const next = [newNote, ...prev.filter((n) => n.id !== newNote.id)];
        saveCachedNotes(next);
        return next;
      });
      return newNote;
    } catch (err) {
      // Offline fallback: save locally and queue for background sync
      const isNetErr =
        err instanceof NetworkError ||
        (err instanceof Error &&
          (err.message.toLowerCase().includes('network') ||
            err.message.toLowerCase().includes('connect') ||
            err.message.toLowerCase().includes('failed to fetch')));

      if (isNetErr) {
        const offlineNote: Note = {
          id: `offline_note_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          user_id: 'local_offline_user',
          title: payload.title.trim(),
          content: payload.content || '',
          subject_id: payload.subject_id || null,
          is_pinned: payload.is_pinned ?? false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        await queuePendingNoteAction({
          type: 'create',
          noteId: offlineNote.id,
          payload,
        });

        setNotes((prev) => {
          const next = [offlineNote, ...prev];
          saveCachedNotes(next);
          return next;
        });

        offlineSyncManager.init();
        return offlineNote;
      }

      const msg = formatErrorMessage(err);
      setError(msg);
      throw new Error(msg);
    }
  }, []);

  const updateNote = useCallback(
    async (id: string, payload: NoteUpdate): Promise<Note> => {
      setError(null);
      try {
        const updated = await noteApi.update(id, payload);
        setNotes((prev) => {
          const next = prev.map((n) => (n.id === id ? updated : n)).sort((a, b) => {
            if (a.is_pinned !== b.is_pinned) {
              return a.is_pinned ? -1 : 1;
            }
            return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
          });
          saveCachedNotes(next);
          return next;
        });
        return updated;
      } catch (err) {
        const isNetErr =
          err instanceof NetworkError ||
          (err instanceof Error &&
            (err.message.toLowerCase().includes('network') ||
              err.message.toLowerCase().includes('connect')));

        if (isNetErr) {
          let updatedOffline: Note | null = null;
          setNotes((prev) => {
            const next: Note[] = prev.map((n) => {
              if (n.id === id) {
                const merged: Note = {
                  ...n,
                  title: payload.title !== undefined && payload.title !== null ? payload.title : n.title,
                  content: payload.content !== undefined && payload.content !== null ? payload.content : n.content,
                  subject_id: payload.subject_id !== undefined ? payload.subject_id : n.subject_id,
                  is_pinned: payload.is_pinned !== undefined && payload.is_pinned !== null ? payload.is_pinned : n.is_pinned,
                  updated_at: new Date().toISOString(),
                };
                updatedOffline = merged;
                return merged;
              }
              return n;
            });
            saveCachedNotes(next);
            return next;
          });

          await queuePendingNoteAction({
            type: 'update',
            noteId: id,
            payload,
          });

          offlineSyncManager.init();
          if (updatedOffline) return updatedOffline;
        }

        const msg = formatErrorMessage(err);
        setError(msg);
        throw new Error(msg);
      }
    },
    []
  );

  const togglePin = useCallback(
    async (id: string): Promise<Note> => {
      const existing = notes.find((n) => n.id === id);
      const newPinState = existing ? !existing.is_pinned : true;
      return await updateNote(id, { is_pinned: newPinState });
    },
    [notes, updateNote]
  );

  const deleteNote = useCallback(async (id: string): Promise<void> => {
    setError(null);
    try {
      await noteApi.delete(id);
      setNotes((prev) => {
        const next = prev.filter((n) => n.id !== id);
        saveCachedNotes(next);
        return next;
      });
    } catch (err) {
      const isNetErr =
        err instanceof NetworkError ||
        (err instanceof Error &&
          (err.message.toLowerCase().includes('network') ||
            err.message.toLowerCase().includes('connect')));

      if (isNetErr) {
        setNotes((prev) => {
          const next = prev.filter((n) => n.id !== id);
          saveCachedNotes(next);
          return next;
        });
        await queuePendingNoteAction({
          type: 'delete',
          noteId: id,
        });
        offlineSyncManager.init();
        return;
      }

      const msg = formatErrorMessage(err);
      setError(msg);
      throw new Error(msg);
    }
  }, []);

  return {
    notes,
    isLoading,
    isRefreshing,
    error,
    fetchNotes,
    createNote,
    updateNote,
    togglePin,
    deleteNote,
    clearError,
  };
}
