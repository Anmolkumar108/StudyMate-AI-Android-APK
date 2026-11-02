/**
 * Task domain types for StudyMate AI Tasks & Assignment Management (FR-09 & Advanced Upgrade).
 */

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export type TaskStatus = 'todo' | 'in_progress' | 'completed' | 'cancelled';

export interface Subtask {
  id: string;
  title: string;
  is_completed: boolean;
  order?: number;
}

export interface TaskAttachment {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_key: string;
  created_at: string;
}

export interface TaskSubject {
  id: string;
  name: string;
  color: string;
  course_code?: string | null;
}

export interface TaskDependencyNested {
  id: string;
  title: string;
  status: TaskStatus;
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description?: string | null;
  subject_id?: string | null;
  subject?: TaskSubject | null;
  depends_on_task_id?: string | null;
  depends_on?: TaskDependencyNested | null;
  due_datetime?: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  estimated_minutes?: number | null;
  subtasks: Subtask[];
  recurrence_pattern?: string | null; // 'daily' | 'weekly' | 'monthly' | 'custom'
  recurrence_interval?: number | null;
  recurrence_end_date?: string | null;
  attachments?: TaskAttachment[];
  focus_minutes?: number;
  focus_sessions_count?: number;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskCreate {
  title: string;
  description?: string | null;
  subject_id?: string | null;
  depends_on_task_id?: string | null;
  due_datetime?: string | null;
  priority?: TaskPriority;
  status?: TaskStatus;
  estimated_minutes?: number | null;
  subtasks?: { id?: string; title: string; is_completed?: boolean; order?: number }[];
  recurrence_pattern?: string | null;
  recurrence_interval?: number | null;
  recurrence_end_date?: string | null;
}

export interface TaskUpdate {
  title?: string;
  description?: string | null;
  subject_id?: string | null;
  depends_on_task_id?: string | null;
  due_datetime?: string | null;
  priority?: TaskPriority;
  status?: TaskStatus;
  estimated_minutes?: number | null;
  subtasks?: Subtask[];
  recurrence_pattern?: string | null;
  recurrence_interval?: number | null;
  recurrence_end_date?: string | null;
}

export interface TaskListParams {
  status?: TaskStatus;
  priority?: TaskPriority;
  subject_id?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface TaskListResponse {
  items: Task[];
  total: number;
  completed_count: number;
  pending_count: number;
  overdue_count: number;
}

// Template Types
export interface TaskTemplate {
  id: string;
  user_id?: string | null;
  title: string;
  description?: string | null;
  default_priority: TaskPriority;
  estimated_minutes?: number | null;
  subtasks: Subtask[];
  category: string;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface TaskTemplateCreate {
  title: string;
  description?: string | null;
  default_priority?: TaskPriority;
  estimated_minutes?: number | null;
  subtasks?: Subtask[];
  category?: string;
}

export interface CreateTaskFromTemplateRequest {
  template_id: string;
  subject_id?: string | null;
  due_datetime?: string | null;
  custom_title?: string | null;
}

// Analytics Types
export interface WeeklyTrendItem {
  day: string;
  completed: number;
  created: number;
}

export interface SubjectWorkloadItem {
  subject_id: string | null;
  subject_name: string;
  color: string;
  total_tasks: number;
  completed_tasks: number;
  pending_tasks: number;
}

export interface TaskAnalyticsResponse {
  total_tasks: number;
  completed_tasks: number;
  pending_tasks: number;
  overdue_tasks: number;
  completion_rate: number;
  total_focus_minutes: number;
  total_focus_sessions: number;
  weekly_trends: WeeklyTrendItem[];
  subject_workload: SubjectWorkloadItem[];
}

// AI Task Assistance Types
export interface TaskBreakdownResponse {
  subtasks: { title: string; estimated_minutes?: number | null }[];
}

export interface SchedulePlanItem {
  task_id: string;
  task_title: string;
  priority: TaskPriority;
  suggested_date: string;
  suggested_minutes: number;
  rationale: string;
}

export interface TaskScheduleSuggestionResponse {
  summary: string;
  plan: SchedulePlanItem[];
}

export interface TaskParseNaturalResponse {
  title: string;
  description?: string | null;
  priority: TaskPriority;
  due_datetime?: string | null;
  estimated_minutes?: number | null;
  suggested_subtasks: string[];
}

export interface TaskDailyBriefingResponse {
  date: string;
  greeting: string;
  summary: string;
  urgent_tasks: { id: string; title: string; priority: string; due: string }[];
  recommended_focus_order: string[];
}
