/**
 * Quiz domain types for StudyMate AI Active Recall & AI Quiz Engine.
 */

export interface QuizQuestionOption {
  key: string;
  text: string;
}

export interface QuizQuestion {
  id: string;
  quiz_id: string;
  question_text: string;
  question_type: 'mcq' | 'true_false' | 'short_answer' | string;
  options: QuizQuestionOption[];
  correct_option_key?: string;
  explanation?: string;
  created_at?: string;
}

export interface QuizAttempt {
  id: string;
  quiz_id: string;
  user_id?: string;
  score_percentage: number;
  correct_count: number;
  incorrect_count: number;
  answers_submitted?: Record<string, string>;
  time_taken_seconds: number;
  completed_at: string;
  review?: {
    question_id: string;
    user_answer: string;
    correct_answer?: string;
    is_correct: boolean;
    explanation?: string;
  }[];
}

export interface Quiz {
  id: string;
  user_id: string;
  subject_id?: string | null;
  title: string;
  source_type: 'note' | 'document' | 'custom' | 'topic' | string;
  source_id?: string | null;
  difficulty: 'easy' | 'medium' | 'hard' | string;
  question_count: number;
  created_at: string;
  questions?: QuizQuestion[];
  attempts?: QuizAttempt[];
}

export interface QuizGenerateRequest {
  topic?: string;
  note_id?: string;
  document_id?: string;
  subject_id?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  question_count?: number;
}

export interface QuizSubmitRequest {
  answers: Record<string, string>;
  time_taken_seconds?: number;
}

export interface ConvertMissedToCardsRequest {
  deck_title?: string;
}

export interface ConvertMissedToCardsResponse {
  message: string;
  deck_id: string;
  cards_created: number;
}

