/**
 * Study Analytics & Consistency Heatmap Types (FR-16 & FR-12)
 */

export interface StudySessionCreateRequest {
  duration_minutes: number;
  actual_seconds_spent: number;
  session_type?: 'focus' | 'short_break' | 'long_break';
  subject_id?: string | null;
  task_id?: string | null;
  completed_successfully?: boolean;
  rating_focus?: number | null;
  notes?: string | null;
  started_at: string;
  ended_at: string;
}

export interface StudySessionResponse {
  id: string;
  user_id: string;
  subject_id?: string | null;
  task_id?: string | null;
  duration_minutes: number;
  actual_seconds_spent: number;
  session_type: string;
  completed_successfully: boolean;
  rating_focus?: number | null;
  notes?: string | null;
  started_at: string;
  ended_at: string;
  created_at: string;
  subject_name?: string | null;
  subject_color?: string | null;
  task_title?: string | null;
}

export interface TodayStudySummary {
  total_focus_minutes: number;
  total_focus_sessions: number;
  daily_goal_minutes: number;
  goal_progress_percent: number;
  current_streak_days: number;
}

export interface SubjectTimeDistributionItem {
  subject_id?: string | null;
  subject_name: string;
  subject_code?: string | null;
  color_hex: string;
  total_minutes: number;
  total_hours: number;
  percentage: number;
  session_count: number;
}

export interface DailyActivityItem {
  date: string; // YYYY-MM-DD
  focus_minutes: number;
  sessions_count: number;
  tasks_completed: number;
  quizzes_taken: number;
  level: number; // 0, 1, 2, 3, 4
}

export interface MilestoneBadge {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  progress_text: string;
}

export interface QuizMasteryItem {
  date: string;
  quiz_title: string;
  score_percentage: number;
  total_questions: number;
}

export interface AnalyticsOverviewResponse {
  total_focus_hours: number;
  total_sessions: number;
  current_streak_days: number;
  longest_streak_days: number;
  tasks_completed_count: number;
  quizzes_taken_count: number;
  average_quiz_score: number;
  flashcards_reviewed_count: number;
  productivity_score: number;
  subject_distribution: SubjectTimeDistributionItem[];
  weekly_trends: DailyActivityItem[];
  quiz_mastery_curve: QuizMasteryItem[];
  milestones: MilestoneBadge[];
}

export interface AnalyticsHeatmapResponse {
  start_date: string;
  end_date: string;
  total_days: number;
  total_active_days: number;
  total_focus_minutes: number;
  current_streak_days: number;
  longest_streak_days: number;
  matrix: DailyActivityItem[];
}

