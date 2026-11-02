import { useCallback, useEffect, useState } from 'react';

import { noteApi } from '@/services/api/client';
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
      const data = await noteApi.list(params);
      setNotes(data);
    } catch (err) {
      setError(formatErrorMessage(err));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const data = await noteApi.list();
        if (isMounted) {
          setNotes(data);
        }
      } catch (err) {
        if (isMounted) {
          setError(formatErrorMessage(err));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  const createNote = useCallback(async (payload: NoteCreate): Promise<Note> => {
    setError(null);
    try {
      const newNote = await noteApi.create(payload);
      setNotes((prev) => [newNote, ...prev.filter((n) => n.id !== newNote.id)]);
      return newNote;
    } catch (err) {
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
        setNotes((prev) =>
          prev.map((n) => (n.id === id ? updated : n)).sort((a, b) => {
            // Keep pinned notes at the top
            if (a.is_pinned !== b.is_pinned) {
              return a.is_pinned ? -1 : 1;
            }
            return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
          })
        );
        return updated;
      } catch (err) {
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
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
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
