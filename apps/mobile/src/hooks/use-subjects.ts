import { useCallback, useEffect, useState } from 'react';

import { subjectApi } from '@/services/api/client';
import { ApiError, AuthError, ConflictError, NetworkError, NotFoundError } from '@/types/auth';
import { Subject, SubjectCreate, SubjectUpdate } from '@/types/subject';

export interface UseSubjectsReturn {
  subjects: Subject[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  fetchSubjects: (isRefresh?: boolean) => Promise<void>;
  createSubject: (payload: SubjectCreate) => Promise<Subject>;
  updateSubject: (id: string, payload: SubjectUpdate) => Promise<Subject>;
  deleteSubject: (id: string) => Promise<void>;
  clearError: () => void;
}

export function useSubjects(): UseSubjectsReturn {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const formatErrorMessage = (err: unknown): string => {
    if (err instanceof ConflictError) {
      return err.message || 'A subject with this name already exists.';
    }
    if (err instanceof NotFoundError) {
      return 'Subject not found. It may have already been deleted.';
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

  const fetchSubjects = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const data = await subjectApi.list();
      setSubjects(data);
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
        const data = await subjectApi.list();
        if (isMounted) {
          setSubjects(data);
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

  const createSubject = useCallback(async (payload: SubjectCreate): Promise<Subject> => {
    setError(null);
    try {
      const newSubject = await subjectApi.create(payload);
      setSubjects((prev) => [newSubject, ...prev.filter((s) => s.id !== newSubject.id)]);
      return newSubject;
    } catch (err) {
      const msg = formatErrorMessage(err);
      setError(msg);
      throw new Error(msg);
    }
  }, []);

  const updateSubject = useCallback(
    async (id: string, payload: SubjectUpdate): Promise<Subject> => {
      setError(null);
      try {
        const updated = await subjectApi.update(id, payload);
        setSubjects((prev) => prev.map((s) => (s.id === id ? updated : s)));
        return updated;
      } catch (err) {
        const msg = formatErrorMessage(err);
        setError(msg);
        throw new Error(msg);
      }
    },
    []
  );

  const deleteSubject = useCallback(async (id: string): Promise<void> => {
    setError(null);
    try {
      await subjectApi.delete(id);
      setSubjects((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      const msg = formatErrorMessage(err);
      setError(msg);
      throw new Error(msg);
    }
  }, []);

  return {
    subjects,
    isLoading,
    isRefreshing,
    error,
    fetchSubjects,
    createSubject,
    updateSubject,
    deleteSubject,
    clearError,
  };
}
