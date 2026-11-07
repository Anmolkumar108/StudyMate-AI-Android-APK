export type StudyBlockType = 'task_work' | 'exam_revision' | 'spaced_review' | 'break';

export type StudyBlockPriority = 'urgent' | 'high' | 'medium' | 'low';

export interface StudyBlock {
  id: string;
  subject_id: string | null;
  subject_name: string;
  subject_color: string;
  task_id: string | null;
  exam_id: string | null;
  title: string;
  block_type: StudyBlockType;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  priority: StudyBlockPriority;
  is_completed: boolean;
  completed_at: string | null;
}

export interface StudyPlan {
  id: string;
  user_id: string;
  plan_date: string;
  target_study_minutes: number;
  planned_minutes: number;
  completed_minutes: number;
  completion_percentage: number;
  timeblocks: StudyBlock[];
  ai_summary: string | null;
  status: 'active' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export type StudyPaceMode = 'balanced' | 'intensive' | 'pomodoro';

export interface StudyPlanGenerateRequest {
  plan_date?: string;
  target_study_minutes?: number;
  focus_subject_ids?: string[];
  pace_mode?: StudyPaceMode;
  start_hour?: number;
  include_breaks?: boolean;
}

export interface StudyBlockToggleRequest {
  is_completed: boolean;
}

export interface StudyPlanRebalanceRequest {
  remaining_available_minutes?: number;
}

