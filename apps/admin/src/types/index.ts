export type UserRole = 'super_admin' | 'support_admin' | 'content_manager' | 'student';
export type UserStatus = 'active' | 'suspended' | 'pending_verification';

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  status: UserStatus;
  is_email_verified: boolean;
  created_at: string;
  last_login_at: string | null;
}

export interface AdminLoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: AdminUser;
}

export interface DashboardStats {
  total_students: number;
  active_students: number;
  suspended_students: number;
  pending_verification_students: number;
  total_focus_hours: number;
  total_notes: number;
  total_flashcard_decks: number;
  total_documents: number;
  total_quizzes: number;
  active_announcements_count: number;
  system_status: string;
}

export interface StudentDetail extends AdminUser {
  subjects_count: number;
  tasks_count: number;
  notes_count: number;
  flashcards_count: number;
  documents_count: number;
  study_sessions_count: number;
  total_focus_minutes: number;
  current_streak_days: number;
}

export interface AIMetrics {
  primary_provider: string;
  active_model_name: string;
  daily_budget_limit_usd: number;
  estimated_today_cost_usd: number;
  available_models: string[];
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  target_audience: 'all' | 'students';
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  expires_at: string | null;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  details: string | null;
  ip_address: string | null;
  created_at: string;
}

export interface SubjectTemplate {
  id: string;
  name: string;
  code: string | null;
  category: string;
  description: string | null;
  color: string;
  credits: number;
  difficulty_level: string;
  suggested_units: { title: string; weeks: number }[];
  is_active: boolean;
  enrolled_count: number;
  created_at: string;
  updated_at: string;
}

export interface SystemTaskTemplate {
  id: string;
  title: string;
  description: string | null;
  default_priority: string;
  estimated_minutes: number | null;
  category: string;
  subtasks: { title: string; is_completed?: boolean }[];
  is_system: boolean;
  created_at: string;
}

export interface DailyStudyTrendItem {
  date: string;
  focus_minutes: number;
  sessions_count: number;
  unique_students: number;
}

export interface TopSubjectItem {
  name: string;
  code: string | null;
  student_count: number;
  color: string;
}

export interface DatabaseTelemetryItem {
  status: string;
  latency_ms: number;
  version: string;
  total_rows: number;
  table_counts?: Record<string, number>;
}

export interface StorageTelemetryItem {
  total_files: number;
  total_size_mb: number;
  storage_backend: string;
}

export interface SecurityTelemetryItem {
  failed_logins_24h: number;
  rate_limit_blocks_24h: number;
  active_super_admins: number;
  is_maintenance_mode: boolean;
}

export interface SystemHealthAnalyticsResponse {
  dau: number;
  wau: number;
  mau: number;
  retention_rate_pct: number;
  daily_focus_trends: DailyStudyTrendItem[];
  top_subjects: TopSubjectItem[];
  database: DatabaseTelemetryItem;
  storage: StorageTelemetryItem;
  security: SecurityTelemetryItem;
}

export interface MaintenanceModeResponse {
  is_maintenance_mode: boolean;
  message: string;
}

export interface ForceLogoutResponse {
  students_logged_out: number;
  message: string;
}

export interface UserExportData {
  user: {
    id: string;
    email: string;
    full_name: string;
    created_at: string;
  };
  semesters: Array<{
    id: string;
    name: string;
    start_date: string;
    end_date: string;
  }>;
  subjects: Array<{
    id: string;
    name: string;
    code: string | null;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    is_completed: boolean;
  }>;
  study_sessions: Array<{
    id: string;
    duration_minutes: number;
    started_at: string;
  }>;
  documents: Array<{
    id: string;
    original_filename: string;
    file_size_bytes: number;
  }>;
  flashcard_decks: Array<{
    id: string;
    title: string;
    cards_count: number;
  }>;
  quizzes: Array<{
    id: string;
    title: string;
    total_questions: number;
  }>;
  exported_at: string;
}

export type TicketCategory =
  | 'bug'
  | 'complaint'
  | 'feature_request'
  | 'academic_query'
  | 'account_issue'
  | 'other';

export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface SupportTicket {
  id: string;
  ticket_number: string;
  user_id: string;
  user_email: string | null;
  user_name: string | null;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  description: string;
  admin_notes: string | null;
  assigned_to: string | null;
  resolution_summary: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface SupportTicketListResponse {
  items: SupportTicket[];
  total: number;
}

export interface AppConfigItem {
  id: string;
  key: string;
  value: any;
  category: string;
  description: string | null;
  is_secret: boolean;
  updated_at: string;
}

export interface AppConfigListResponse {
  items: AppConfigItem[];
}

export interface SubscriptionTier {
  tier_id: string;
  name: string;
  price_inr: number;
  features: string[];
}

// Device Intelligence & Live Telemetry Radar
export interface LiveTelemetryEvent {
  id: string;
  timestamp: string;
  event_type: 'signup' | 'login_success' | 'login_failed' | 'app_opened' | 'admin_action' | 'other';
  action: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
  device_name: string | null;
  device_os: string | null;
  ip_address: string | null;
  details: string | null;
  severity: 'info' | 'warning' | 'critical';
}

export interface BruteForceThreat {
  ip_address: string | null;
  target_email: string | null;
  failed_attempts: number;
  first_attempt_at: string;
  last_attempt_at: string;
}

export interface LiveTelemetryFeedResponse {
  events: LiveTelemetryEvent[];
  total_events: number;
  active_devices_24h: number;
  failed_logins_24h: number;
  new_signups_24h: number;
  brute_force_threats: BruteForceThreat[];
}

export interface UserSessionDetail {
  id: string;
  user_id: string;
  device_name: string | null;
  device_os: string | null;
  ip_address: string | null;
  created_at: string;
  expires_at: string;
  is_revoked: boolean;
}

export interface PasswordResetTriggerResult {
  success: boolean;
  message: string;
  user_email: string;
  reset_token_issued: boolean;
}




