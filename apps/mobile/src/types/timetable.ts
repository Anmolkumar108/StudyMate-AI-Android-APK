export interface TimetableEntry {
  id: string;
  user_id: string;
  subject_id: string;
  day_of_week: number; // 1=Monday ... 7=Sunday
  start_time: string; // "09:30:00" or "09:30"
  end_time: string;
  room?: string | null;
  building?: string | null;
  professor?: string | null;
  color?: string | null;
  is_online: boolean;
  virtual_url?: string | null;
  reminder_minutes_before: number;
  start_date?: string | null;
  end_date?: string | null;
  subject_name?: string | null;
  subject_color?: string | null;
  subject_code?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TimetableEntryCreate {
  day_of_week: number;
  start_time: string;
  end_time: string;
  subject_id: string;
  room?: string | null;
  building?: string | null;
  professor?: string | null;
  color?: string | null;
  is_online?: boolean;
  virtual_url?: string | null;
  reminder_minutes_before?: number;
  start_date?: string | null;
  end_date?: string | null;
}

export interface TimetableEntryUpdate {
  day_of_week?: number;
  start_time?: string;
  end_time?: string;
  subject_id?: string;
  room?: string | null;
  building?: string | null;
  professor?: string | null;
  color?: string | null;
  is_online?: boolean;
  virtual_url?: string | null;
  reminder_minutes_before?: number;
  start_date?: string | null;
  end_date?: string | null;
}

export interface TimetableEntryBatchCreate {
  days_of_week: number[];
  start_time: string;
  end_time: string;
  subject_id: string;
  room?: string | null;
  building?: string | null;
  professor?: string | null;
  color?: string | null;
  is_online?: boolean;
  virtual_url?: string | null;
  reminder_minutes_before?: number;
  start_date?: string | null;
  end_date?: string | null;
}

export type AttendanceStatus = 'present' | 'absent' | 'late';

export interface AttendanceRecord {
  id: string;
  user_id: string;
  timetable_entry_id?: string | null;
  subject_id: string;
  attendance_date: string; // "YYYY-MM-DD"
  status: AttendanceStatus;
  notes?: string | null;
  subject_name?: string | null;
  subject_color?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AttendanceMarkRequest {
  timetable_entry_id?: string | null;
  subject_id: string;
  attendance_date: string;
  status: AttendanceStatus;
  notes?: string | null;
}

export interface SubjectAttendanceStats {
  subject_id: string;
  subject_name: string;
  subject_color?: string | null;
  total_classes: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  percentage: number;
  is_low_attendance: boolean;
}

export interface AttendanceSummaryResponse {
  total_classes: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  overall_percentage: number;
  minimum_required_percentage: number;
  is_overall_low: boolean;
  subjects: SubjectAttendanceStats[];
}

export interface TimetableConflictCheckRequest {
  day_of_week: number;
  start_time: string;
  end_time: string;
  exclude_id?: string;
}

export interface TimetableConflictResponse {
  has_conflict: boolean;
  conflicting_entries: TimetableEntry[];
}

export interface WeeklyTimetableResponse {
  entries: TimetableEntry[];
  by_day: Record<number, TimetableEntry[]>;
  total_classes: number;
}

export const DAYS_OF_WEEK = [
  { day: 1, name: 'Monday', short: 'Mon' },
  { day: 2, name: 'Tuesday', short: 'Tue' },
  { day: 3, name: 'Wednesday', short: 'Wed' },
  { day: 4, name: 'Thursday', short: 'Thu' },
  { day: 5, name: 'Friday', short: 'Fri' },
  { day: 6, name: 'Saturday', short: 'Sat' },
  { day: 7, name: 'Sunday', short: 'Sun' },
] as const;

