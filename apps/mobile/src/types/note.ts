/**
 * Note type definitions matching the StudyMate AI FastAPI backend schemas.
 */

export interface Note {
  id: string;
  user_id: string;
  subject_id: string | null;
  title: string;
  content: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface NoteCreate {
  title: string;
  content: string;
  subject_id?: string | null;
  is_pinned?: boolean;
}

export interface NoteUpdate {
  title?: string | null;
  content?: string | null;
  subject_id?: string | null;
  is_pinned?: boolean | null;
}

export interface NoteListParams {
  search?: string;
  subject_id?: string;
  is_pinned?: boolean;
  limit?: number;
  offset?: number;
}

export interface NoteValidationResult {
  isValid: boolean;
  errors: {
    title?: string;
    content?: string;
  };
}

export function validateNoteForm(values: {
  title: string;
  content: string;
}): NoteValidationResult {
  const errors: NoteValidationResult['errors'] = {};

  const trimmedTitle = values.title ? values.title.trim() : '';
  if (!trimmedTitle) {
    errors.title = 'Note title is required.';
  } else if (trimmedTitle.length > 200) {
    errors.title = 'Note title cannot exceed 200 characters.';
  }

  const trimmedContent = values.content ? values.content.trim() : '';
  if (!trimmedContent) {
    errors.content = 'Note content is required.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
