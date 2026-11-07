export type TopicConfidence = 'low' | 'medium' | 'high';

export interface SyllabusTopic {
  id: string;
  name: string;
  is_completed: boolean;
  confidence: TopicConfidence;
}

export interface RevisionPhase {
  phase_number: number;
  title: string;
  start_date: string;
  end_date: string;
  days: number;
  description: string;
  daily_focus_minutes: number;
  suggested_activities: string[];
}

export interface RevisionPlan {
  total_days: number;
  generated_at: string;
  summary: string;
  phases: RevisionPhase[];
}

export interface Exam {
  id: string;
  user_id: string;
  subject_id: string;
  subject_name?: string | null;
  subject_color?: string | null;
  title: string;
  exam_date: string;
  location?: string | null;
  target_score?: number | null;
  achieved_score?: number | null;
  syllabus_topics: SyllabusTopic[];
  total_topics: number;
  completed_topics: number;
  readiness_percentage: number;
  days_remaining: number;
  hours_remaining: number;
  is_past: boolean;
  revision_plan?: RevisionPlan | null;
  created_at: string;
  updated_at: string;
}

export interface ExamCreate {
  subject_id: string;
  title: string;
  exam_date: string;
  location?: string | null;
  target_score?: number | null;
  syllabus_topics: string[] | SyllabusTopic[];
}

export interface ExamUpdate {
  subject_id?: string;
  title?: string;
  exam_date?: string;
  location?: string | null;
  target_score?: number | null;
  achieved_score?: number | null;
  syllabus_topics?: string[] | SyllabusTopic[];
}

export interface ExamListResponse {
  items: Exam[];
  total: number;
  upcoming_count: number;
  average_readiness: number;
}

export interface ExamUpcomingSummaryResponse {
  next_exam?: Exam | null;
  total_upcoming: number;
  average_readiness: number;
}

export type ExamUpcomingSummary = ExamUpcomingSummaryResponse;
