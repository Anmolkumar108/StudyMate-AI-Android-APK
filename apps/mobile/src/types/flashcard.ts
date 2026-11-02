/**
 * Flashcard and Deck type definitions matching the StudyMate AI FastAPI backend schemas.
 */

export interface FlashcardDeck {
  id: string;
  user_id: string;
  subject_id: string | null;
  title: string;
  description: string | null;
  card_count: number;
  created_at: string;
  updated_at: string;
}

export interface Flashcard {
  id: string;
  deck_id: string;
  user_id: string;
  question: string;
  answer: string;
  created_at: string;
  updated_at: string;
}

export interface FlashcardDeckWithCards extends FlashcardDeck {
  cards: Flashcard[];
}

export interface DeckCreate {
  title: string;
  description?: string | null;
  subject_id?: string | null;
}

export interface DeckUpdate {
  title?: string | null;
  description?: string | null;
  subject_id?: string | null;
}

export interface CardCreate {
  question: string;
  answer: string;
}

export interface CardUpdate {
  question?: string | null;
  answer?: string | null;
}

export interface DeckListParams {
  search?: string;
  subject_id?: string;
  limit?: number;
  offset?: number;
}

export interface DeckValidationResult {
  isValid: boolean;
  errors: {
    title?: string;
    description?: string;
  };
}

export interface CardValidationResult {
  isValid: boolean;
  errors: {
    question?: string;
    answer?: string;
  };
}

export function validateDeckForm(values: {
  title: string;
  description?: string;
}): DeckValidationResult {
  const errors: DeckValidationResult['errors'] = {};

  const cleanTitle = values.title?.trim() || '';
  if (!cleanTitle) {
    errors.title = 'Deck title is required.';
  } else if (cleanTitle.length > 200) {
    errors.title = 'Deck title cannot exceed 200 characters.';
  }

  if (values.description && values.description.length > 2000) {
    errors.description = 'Description cannot exceed 2000 characters.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateCardForm(values: {
  question: string;
  answer: string;
}): CardValidationResult {
  const errors: CardValidationResult['errors'] = {};

  const cleanQuestion = values.question?.trim() || '';
  if (!cleanQuestion) {
    errors.question = 'Question is required.';
  } else if (cleanQuestion.length > 2000) {
    errors.question = 'Question cannot exceed 2000 characters.';
  }

  const cleanAnswer = values.answer?.trim() || '';
  if (!cleanAnswer) {
    errors.answer = 'Answer is required.';
  } else if (cleanAnswer.length > 2000) {
    errors.answer = 'Answer cannot exceed 2000 characters.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
