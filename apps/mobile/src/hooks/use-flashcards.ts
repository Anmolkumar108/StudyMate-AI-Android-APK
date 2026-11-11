import { useCallback, useEffect, useState } from 'react';

import { flashcardApi } from '@/services/api/client';
import { loadCachedDecks, saveCachedDecks } from '@/services/storage/flashcards-cache';
import {
  ApiError,
  AuthError,
  BadRequestError,
  NetworkError,
  NotFoundError,
} from '@/types/auth';
import {
  CardCreate,
  CardUpdate,
  DeckCreate,
  DeckListParams,
  DeckUpdate,
  Flashcard,
  FlashcardDeck,
  FlashcardDeckWithCards,
} from '@/types/flashcard';

export interface UseFlashcardsReturn {
  decks: FlashcardDeck[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  fetchDecks: (params?: DeckListParams, isRefresh?: boolean) => Promise<void>;
  fetchDeck: (deckId: string) => Promise<FlashcardDeckWithCards>;
  createDeck: (payload: DeckCreate) => Promise<FlashcardDeck>;
  updateDeck: (id: string, payload: DeckUpdate) => Promise<FlashcardDeck>;
  deleteDeck: (id: string) => Promise<void>;
  createCard: (deckId: string, payload: CardCreate) => Promise<Flashcard>;
  updateCard: (
    deckId: string,
    cardId: string,
    payload: CardUpdate
  ) => Promise<Flashcard>;
  deleteCard: (deckId: string, cardId: string) => Promise<void>;
  clearError: () => void;
}

export function useFlashcards(): UseFlashcardsReturn {
  const [decks, setDecks] = useState<FlashcardDeck[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const formatErrorMessage = (err: unknown): string => {
    if (err instanceof BadRequestError) {
      return err.message || 'Invalid deck or card details.';
    }
    if (err instanceof NotFoundError) {
      return 'Deck or card not found. It may have already been deleted.';
    }
    if (err instanceof AuthError) {
      return 'Your session has expired. Please sign in again.';
    }
    if (err instanceof NetworkError) {
      return err.message || 'Network error. Please check your connection.';
    }
    if (err instanceof ApiError) {
      return err.message;
    }
    if (err instanceof Error) {
      return err.message;
    }
    return 'An unexpected error occurred. Please try again.';
  };

  const fetchDecks = useCallback(
    async (params?: DeckListParams, isRefresh = false) => {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const data = await flashcardApi.listDecks(params);
        setDecks(data);
        saveCachedDecks(data);
      } catch (err) {
        setDecks((prev) => {
          if (prev.length === 0) {
            setError(formatErrorMessage(err));
          }
          return prev;
        });
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    let isMounted = true;
    async function load() {
      let cached: FlashcardDeck[] | null = null;
      try {
        cached = await loadCachedDecks();
        if (cached && cached.length > 0 && isMounted) {
          setDecks(cached);
          setIsLoading(false);
        }
      } catch {
        // Fallback
      }

      try {
        const data = await flashcardApi.listDecks();
        if (isMounted) {
          setDecks(data);
          saveCachedDecks(data);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          const hasCached = cached && cached.length > 0;
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

    return () => {
      isMounted = false;
    };
  }, []);

  const fetchDeck = useCallback(
    async (deckId: string): Promise<FlashcardDeckWithCards> => {
      try {
        return await flashcardApi.getDeck(deckId);
      } catch (err) {
        const msg = formatErrorMessage(err);
        setError(msg);
        throw err;
      }
    },
    []
  );

  const createDeck = useCallback(
    async (payload: DeckCreate): Promise<FlashcardDeck> => {
      setError(null);
      try {
        const newDeck = await flashcardApi.createDeck(payload);
        setDecks((prev) => {
          const next = [newDeck, ...prev];
          saveCachedDecks(next);
          return next;
        });
        return newDeck;
      } catch (err) {
        const msg = formatErrorMessage(err);
        setError(msg);
        throw err;
      }
    },
    []
  );

  const updateDeck = useCallback(
    async (id: string, payload: DeckUpdate): Promise<FlashcardDeck> => {
      setError(null);
      try {
        const updated = await flashcardApi.updateDeck(id, payload);
        setDecks((prev) => {
          const next = prev.map((d) => (d.id === id ? updated : d));
          saveCachedDecks(next);
          return next;
        });
        return updated;
      } catch (err) {
        const msg = formatErrorMessage(err);
        setError(msg);
        throw err;
      }
    },
    []
  );

  const deleteDeck = useCallback(async (id: string): Promise<void> => {
    setError(null);
    try {
      await flashcardApi.deleteDeck(id);
      setDecks((prev) => {
        const next = prev.filter((d) => d.id !== id);
        saveCachedDecks(next);
        return next;
      });
    } catch (err) {
      const msg = formatErrorMessage(err);
      setError(msg);
      throw err;
    }
  }, []);

  const createCard = useCallback(
    async (deckId: string, payload: CardCreate): Promise<Flashcard> => {
      setError(null);
      try {
        const newCard = await flashcardApi.createCard(deckId, payload);
        // Increment card count in local deck state
        setDecks((prev) =>
          prev.map((d) =>
            d.id === deckId ? { ...d, card_count: d.card_count + 1 } : d
          )
        );
        return newCard;
      } catch (err) {
        const msg = formatErrorMessage(err);
        setError(msg);
        throw err;
      }
    },
    []
  );

  const updateCard = useCallback(
    async (
      deckId: string,
      cardId: string,
      payload: CardUpdate
    ): Promise<Flashcard> => {
      setError(null);
      try {
        return await flashcardApi.updateCard(deckId, cardId, payload);
      } catch (err) {
        const msg = formatErrorMessage(err);
        setError(msg);
        throw err;
      }
    },
    []
  );

  const deleteCard = useCallback(
    async (deckId: string, cardId: string): Promise<void> => {
      setError(null);
      try {
        await flashcardApi.deleteCard(deckId, cardId);
        // Decrement card count in local deck state
        setDecks((prev) =>
          prev.map((d) =>
            d.id === deckId
              ? { ...d, card_count: Math.max(0, d.card_count - 1) }
              : d
          )
        );
      } catch (err) {
        const msg = formatErrorMessage(err);
        setError(msg);
        throw err;
      }
    },
    []
  );

  return {
    decks,
    isLoading,
    isRefreshing,
    error,
    fetchDecks,
    fetchDeck,
    createDeck,
    updateDeck,
    deleteDeck,
    createCard,
    updateCard,
    deleteCard,
    clearError,
  };
}
