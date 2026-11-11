import {
  AdminLoginResponse,
  AdminUser,
  AIMetrics,
  Announcement,
  AppConfigItem,
  AuditLog,
  DashboardStats,
  ForceLogoutResponse,
  LiveTelemetryFeedResponse,
  MaintenanceModeResponse,
  PasswordResetTriggerResult,
  StudentDetail,
  SubjectTemplate,
  SupportTicket,
  SupportTicketListResponse,
  SystemHealthAnalyticsResponse,
  SystemTaskTemplate,
  UserExportData,
  UserRole,
  UserSessionDetail,
  UserStatus,
} from '../types';

const TOKEN_KEY = 'studymate_admin_token';
const USER_KEY = 'studymate_admin_user';

export const authStorage = {
  getToken: (): string | null => localStorage.getItem(TOKEN_KEY),
  setToken: (token: string): void => localStorage.setItem(TOKEN_KEY, token),
  clear: (): void => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
  getUser: (): AdminUser | null => {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },
  setUser: (user: AdminUser): void => localStorage.setItem(USER_KEY, JSON.stringify(user)),
};

async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = authStorage.getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`/api/v1${endpoint}`, {
    ...options,
    headers,
  });

  if (res.status === 401 && endpoint !== '/admin/auth/login') {
    authStorage.clear();
    window.location.reload();
    throw new Error('Session expired. Please log in again.');
  }

  if (res.status === 204) {
    return {} as T;
  }

  if (!res.ok) {
    let errorMsg = 'An error occurred';
    try {
      const data = await res.json();
      if (typeof data.detail === 'string') {
        errorMsg = data.detail;
      } else if (Array.isArray(data.detail)) {
        errorMsg = data.detail.map((d: any) => d.msg || d.message || JSON.stringify(d)).join('; ');
      } else if (data.detail && typeof data.detail === 'object') {
        errorMsg = data.detail.msg || data.detail.message || JSON.stringify(data.detail);
      } else if (data.message) {
        errorMsg = data.message;
      }
    } catch {
      // use fallback
    }
    throw new Error(errorMsg);
  }

  return res.json();
}

export const adminApi = {
  login: async (email: string, password: string, security_pin?: string): Promise<AdminLoginResponse> => {
    const res = await apiFetch<AdminLoginResponse>('/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, security_pin }),
    });
    authStorage.setToken(res.access_token);
    authStorage.setUser(res.user);
    return res;
  },

  getMe: async (): Promise<AdminUser> => {
    return apiFetch<AdminUser>('/admin/auth/me');
  },

  getDashboardStats: async (): Promise<DashboardStats> => {
    return apiFetch<DashboardStats>('/admin/dashboard/stats');
  },

  getUsers: async (params?: {
    search?: string;
    role?: UserRole;
    status?: UserStatus;
    limit?: number;
    offset?: number;
  }): Promise<{ items: AdminUser[]; total: number }> => {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.role) query.append('role', params.role);
    if (params?.status) query.append('status', params.status);
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.offset) query.append('offset', String(params.offset));

    const qs = query.toString();
    return apiFetch<{ items: AdminUser[]; total: number }>(`/admin/users${qs ? `?${qs}` : ''}`);
  },

  getUserDetail: async (userId: string): Promise<StudentDetail> => {
    return apiFetch<StudentDetail>(`/admin/users/${userId}`);
  },

  suspendUser: async (userId: string, reason?: string): Promise<AdminUser> => {
    return apiFetch<AdminUser>(`/admin/users/${userId}/suspend`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  reactivateUser: async (userId: string): Promise<AdminUser> => {
    return apiFetch<AdminUser>(`/admin/users/${userId}/reactivate`, {
      method: 'POST',
    });
  },

  resetStudentPassword: async (
    userId: string
  ): Promise<{ success: boolean; message: string; email: string; temporary_token?: string }> => {
    return apiFetch<{ success: boolean; message: string; email: string; temporary_token?: string }>(
      `/admin/users/${userId}/reset-password`,
      {
        method: 'POST',
      }
    );
  },

  getAIMetrics: async (): Promise<AIMetrics> => {
    return apiFetch<AIMetrics>('/admin/ai/metrics');
  },

  updateAIConfig: async (modelName: string, dailyBudgetLimitUsd?: number): Promise<AIMetrics> => {
    return apiFetch<AIMetrics>('/admin/ai/config', {
      method: 'POST',
      body: JSON.stringify({
        model_name: modelName,
        daily_budget_limit_usd: dailyBudgetLimitUsd,
      }),
    });
  },

  getAnnouncements: async (limit = 50, offset = 0): Promise<{ items: Announcement[]; total: number }> => {
    return apiFetch<{ items: Announcement[]; total: number }>(
      `/admin/announcements?limit=${limit}&offset=${offset}`
    );
  },

  createAnnouncement: async (payload: {
    title: string;
    message: string;
    severity: 'info' | 'warning' | 'critical';
    target_audience: 'all' | 'students';
    expires_at?: string | null;
  }): Promise<Announcement> => {
    return apiFetch<Announcement>('/admin/announcements', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  toggleAnnouncement: async (id: string): Promise<Announcement> => {
    return apiFetch<Announcement>(`/admin/announcements/${id}/toggle`, {
      method: 'PATCH',
    });
  },

  deleteAnnouncement: async (id: string): Promise<void> => {
    return apiFetch<void>(`/admin/announcements/${id}`, {
      method: 'DELETE',
    });
  },

  getAuditLogs: async (params?: {
    action?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: AuditLog[]; total: number }> => {
    const query = new URLSearchParams();
    if (params?.action) query.append('action', params.action);
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.offset) query.append('offset', String(params.offset));

    const qs = query.toString();
    return apiFetch<{ items: AuditLog[]; total: number }>(`/admin/audit-logs${qs ? `?${qs}` : ''}`);
  },

  // Curated Subject Templates (AR-05)
  getSubjectTemplates: async (params?: {
    category?: string;
    activeOnly?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ items: SubjectTemplate[]; total: number; categories: string[] }> => {
    const query = new URLSearchParams();
    if (params?.category) query.append('category', params.category);
    if (params?.activeOnly) query.append('active_only', 'true');
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.offset) query.append('offset', String(params.offset));
    const qs = query.toString();
    return apiFetch<{ items: SubjectTemplate[]; total: number; categories: string[] }>(
      `/admin/templates/subjects${qs ? `?${qs}` : ''}`
    );
  },

  createSubjectTemplate: async (payload: {
    name: string;
    code?: string | null;
    category: string;
    description?: string | null;
    color: string;
    credits: number;
    difficulty_level: string;
    suggested_units: { title: string; weeks: number }[];
    is_active?: boolean;
  }): Promise<SubjectTemplate> => {
    return apiFetch<SubjectTemplate>('/admin/templates/subjects', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateSubjectTemplate: async (
    id: string,
    payload: Partial<{
      name: string;
      code: string | null;
      category: string;
      description: string | null;
      color: string;
      credits: number;
      difficulty_level: string;
      suggested_units: { title: string; weeks: number }[];
      is_active: boolean;
    }>
  ): Promise<SubjectTemplate> => {
    return apiFetch<SubjectTemplate>(`/admin/templates/subjects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  deleteSubjectTemplate: async (id: string): Promise<void> => {
    return apiFetch<void>(`/admin/templates/subjects/${id}`, {
      method: 'DELETE',
    });
  },

  seedDefaultSubjectTemplates: async (): Promise<SubjectTemplate[]> => {
    return apiFetch<SubjectTemplate[]>('/admin/templates/subjects/seed-defaults', {
      method: 'POST',
    });
  },

  // System Task Templates & Workflows
  getSystemTaskTemplates: async (): Promise<SystemTaskTemplate[]> => {
    return apiFetch<SystemTaskTemplate[]>('/admin/templates/tasks');
  },

  createSystemTaskTemplate: async (payload: {
    title: string;
    description?: string | null;
    default_priority: string;
    estimated_minutes?: number | null;
    category: string;
    subtasks: { title: string; is_completed?: boolean }[];
  }): Promise<SystemTaskTemplate> => {
    return apiFetch<SystemTaskTemplate>('/admin/templates/tasks', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  deleteSystemTaskTemplate: async (id: string): Promise<void> => {
    return apiFetch<void>(`/admin/templates/tasks/${id}`, {
      method: 'DELETE',
    });
  },

  // Staff & Team Management (AR-01)
  getStaffUsers: async (): Promise<AdminUser[]> => {
    return apiFetch<AdminUser[]>('/admin/staff');
  },

  createStaffUser: async (payload: {
    email: string;
    full_name: string;
    role: string;
    password: string;
  }): Promise<AdminUser> => {
    return apiFetch<AdminUser>('/admin/staff', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateStaffStatus: async (id: string, status: UserStatus): Promise<AdminUser> => {
    return apiFetch<AdminUser>(`/admin/staff/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  updateStaffRole: async (id: string, role: UserRole): Promise<AdminUser> => {
    return apiFetch<AdminUser>(`/admin/staff/${id}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  },

  resetStaffPassword: async (id: string, new_password: string): Promise<AdminUser> => {
    return apiFetch<AdminUser>(`/admin/staff/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ new_password }),
    });
  },

  deleteStaffUser: async (id: string): Promise<void> => {
    return apiFetch<void>(`/admin/staff/${id}`, {
      method: 'DELETE',
    });
  },

  // Platform Analytics & Operational Health Monitoring (AR-04 & AR-02)
  getSystemAnalytics: async (): Promise<SystemHealthAnalyticsResponse> => {
    return apiFetch<SystemHealthAnalyticsResponse>('/admin/analytics/overview');
  },

  toggleMaintenanceMode: async (
    is_maintenance_mode: boolean,
    reason?: string
  ): Promise<MaintenanceModeResponse> => {
    return apiFetch<MaintenanceModeResponse>('/admin/system/maintenance', {
      method: 'POST',
      body: JSON.stringify({ is_maintenance_mode, reason }),
    });
  },

  forceLogoutStudents: async (scope: 'students' | 'all' = 'students'): Promise<ForceLogoutResponse> => {
    return apiFetch<ForceLogoutResponse>('/admin/system/force-logout-students', {
      method: 'POST',
      body: JSON.stringify({ scope }),
    });
  },

  forceLogoutSingleStudent: async (userId: string): Promise<{ success: boolean; message: string }> => {
    return apiFetch<{ success: boolean; message: string }>(`/admin/users/${userId}/force-logout`, {
      method: 'POST',
    });
  },

  triggerDatabaseBackup: async (): Promise<{
    success: boolean;
    filename: string;
    snapshot: Record<string, any>;
    message: string;
  }> => {
    return apiFetch<{
      success: boolean;
      filename: string;
      snapshot: Record<string, any>;
      message: string;
    }>('/admin/system/backup', {
      method: 'POST',
    });
  },

  exportStudentData: async (userId: string): Promise<UserExportData> => {
    return apiFetch<UserExportData>(`/admin/users/${userId}/export`);
  },

  // Support & Complaints (Blueprint Section 8)
  getSupportTickets: async (params: {
    status?: string;
    priority?: string;
    category?: string;
    search?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<SupportTicketListResponse> => {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.priority) query.set('priority', params.priority);
    if (params.category) query.set('category', params.category);
    if (params.search) query.set('search', params.search);
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));
    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiFetch<SupportTicketListResponse>(`/admin/support/tickets${qs}`);
  },

  updateSupportTicket: async (
    ticketId: string,
    payload: {
      status?: string;
      priority?: string;
      admin_notes?: string;
      resolution_summary?: string;
    }
  ): Promise<SupportTicket> => {
    return apiFetch<SupportTicket>(`/admin/support/tickets/${ticketId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  // Remote Configuration & Feature Flags (Blueprint Section 11 & Section 7)
  getAppConfigs: async (): Promise<{ items: AppConfigItem[] }> => {
    return apiFetch<{ items: AppConfigItem[] }>('/admin/config/app');
  },

  updateAppConfig: async (
    key: string,
    value: any,
    description?: string
  ): Promise<AppConfigItem> => {
    return apiFetch<AppConfigItem>(`/admin/config/app/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: JSON.stringify({ value, description }),
    });
  },

  // Device Intelligence & Live Telemetry Feed
  getTelemetryFeed: async (limit: number = 100): Promise<LiveTelemetryFeedResponse> => {
    return apiFetch<LiveTelemetryFeedResponse>(`/admin/telemetry/live-feed?limit=${limit}`);
  },

  getUserSessions: async (userId: string): Promise<UserSessionDetail[]> => {
    return apiFetch<UserSessionDetail[]>(`/admin/users/${userId}/sessions`);
  },

  revokeUserSession: async (sessionId: string): Promise<{ success: boolean; message: string }> => {
    return apiFetch<{ success: boolean; message: string }>(`/admin/sessions/${sessionId}`, {
      method: 'DELETE',
    });
  },

  triggerPasswordReset: async (userId: string): Promise<PasswordResetTriggerResult> => {
    return apiFetch<PasswordResetTriggerResult>(`/admin/users/${userId}/trigger-password-reset`, {
      method: 'POST',
    });
  },
};

export const apiClient = adminApi;

