/**
 * Subject type definitions matching the StudyMate AI FastAPI backend schemas.
 */

export interface Subject {
  id: string;
  user_id: string;
  name: string;
  code: string | null;
  description: string | null;
  semester: number | null;
  color: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubjectCreate {
  name: string;
  code?: string | null;
  description?: string | null;
  semester?: number | null;
  color?: string | null;
}

export interface SubjectUpdate {
  name?: string | null;
  code?: string | null;
  description?: string | null;
  semester?: number | null;
  color?: string | null;
}

export interface SubjectColorPreset {
  name: string;
  hex: string;
}

export const SUBJECT_COLOR_PRESETS: SubjectColorPreset[] = [
  { name: 'Indigo', hex: '#4F46E5' },
  { name: 'Emerald', hex: '#059669' },
  { name: 'Amber', hex: '#D97706' },
  { name: 'Rose', hex: '#E11D48' },
  { name: 'Cyan', hex: '#0891B2' },
  { name: 'Purple', hex: '#7C3AED' },
  { name: 'Pink', hex: '#DB2777' },
  { name: 'Slate', hex: '#475569' },
];

export interface SubjectValidationResult {
  isValid: boolean;
  errors: {
    name?: string;
    code?: string;
    semester?: string;
    description?: string;
  };
}

export function validateSubjectForm(values: {
  name: string;
  code?: string;
  semester?: string | number;
  description?: string;
}): SubjectValidationResult {
  const errors: SubjectValidationResult['errors'] = {};

  const trimmedName = values.name.trim();
  if (!trimmedName) {
    errors.name = 'Subject name is required.';
  } else if (trimmedName.length > 150) {
    errors.name = 'Subject name cannot exceed 150 characters.';
  }

  if (values.code && values.code.trim().length > 50) {
    errors.code = 'Course code cannot exceed 50 characters.';
  }

  if (values.description && values.description.trim().length > 2000) {
    errors.description = 'Description cannot exceed 2000 characters.';
  }

  if (values.semester !== undefined && values.semester !== '' && values.semester !== null) {
    const semNum = Number(values.semester);
    if (!Number.isInteger(semNum) || semNum < 1 || semNum > 50) {
      errors.semester = 'Semester must be a whole number between 1 and 50.';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
