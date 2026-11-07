export type SearchResultType =
  | 'note'
  | 'task'
  | 'document'
  | 'flashcard'
  | 'subject'
  | 'exam';

export type SearchCategory =
  | 'all'
  | 'notes'
  | 'tasks'
  | 'documents'
  | 'flashcards'
  | 'subjects'
  | 'exams';

export interface SearchResultItem {
  id: string;
  type: SearchResultType;
  title: string;
  snippet?: string | null;
  subject_id?: string | null;
  subject_name?: string | null;
  subject_color?: string | null;
  target_route: string;
  metadata?: Record<string, unknown>;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface UniversalSearchResponse {
  query: string;
  total_count: number;
  counts_by_type: Record<string, number>;
  results: SearchResultItem[];
}

export interface UniversalSearchParams {
  query: string;
  category?: SearchCategory;
  subjectId?: string;
  limit?: number;
  offset?: number;
}

