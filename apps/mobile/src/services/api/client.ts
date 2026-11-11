import { API_CONFIG } from '../../config/env';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  saveTokens,
} from '../storage/token-storage';
import {
  ApiError,
  AuthError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
  ForgotPasswordOtpRequest,
  ForgotPasswordRequest,
  GoogleAuthRequest,
  InvalidResponseError,
  LoginRequest,
  LogoutRequest,
  MessageResponse,
  NetworkError,
  NotFoundError,
  OtpResponse,
  RefreshTokenRequest,
  RegisterRequest,
  ResendVerificationRequest,
  ResetPasswordOtpRequest,
  ResetPasswordRequest,
  ServerError,
  SessionResponse,
  TimeoutError,
  TokenResponse,
  UserPreferencesUpdateRequest,
  UserResponse,
  ValidationError,
  VerificationResponse,
  VerifyEmailRequest,
  isDev,
} from '../../types/auth';
import { Subject, SubjectCreate, SubjectUpdate } from '../../types/subject';
import { Note, NoteCreate, NoteListParams, NoteUpdate } from '../../types/note';
import {
  CardCreate,
  CardUpdate,
  DeckCreate,
  DeckListParams,
  DeckUpdate,
  Flashcard,
  FlashcardDeck,
  FlashcardDeckWithCards,
} from '../../types/flashcard';
import {
  Document,
  DocumentListParams,
  DocumentListResponse,
} from '../../types/document';
import {
  AIChatRequest,
  AIChatResponse,
  AIChatSession,
  AIExplanationRequest,
  AIExplanationResponse,
  AINoteGenerationRequest,
  AINoteGenerationResponse,
} from '../../types/ai';
import {
  Exam,
  ExamCreate,
  ExamListResponse,
  ExamUpcomingSummaryResponse,
  ExamUpdate,
} from '../../types/exam';
import {
  StudyBlockToggleRequest,
  StudyPlan,
  StudyPlanGenerateRequest,
  StudyPlanRebalanceRequest,
} from '../../types/planner';
import {
  ConvertMissedToCardsRequest,
  ConvertMissedToCardsResponse,
  Quiz,
  QuizAttempt,
  QuizGenerateRequest,
  QuizSubmitRequest,
} from '../../types/quiz';
import {
  AnalyticsHeatmapResponse,
  AnalyticsOverviewResponse,
  StudySessionCreateRequest,
  StudySessionResponse,
  TodayStudySummary,
} from '../../types/analytics';
import {
  UniversalSearchParams,
  UniversalSearchResponse,
} from '../../types/search';
import {
  CreateTaskFromTemplateRequest,
  Task,
  TaskAnalyticsResponse,
  TaskBreakdownResponse,
  TaskCreate,
  TaskDailyBriefingResponse,
  TaskListParams,
  TaskListResponse,
  TaskParseNaturalResponse,
  TaskScheduleSuggestionResponse,
  TaskTemplate,
  TaskTemplateCreate,
  TaskUpdate,
} from '../../types/task';
import {
    AttendanceMarkRequest,
    AttendanceRecord,
    AttendanceSummaryResponse,
    TimetableConflictCheckRequest,
    TimetableConflictResponse,
    TimetableEntry,
    TimetableEntryBatchCreate,
    TimetableEntryCreate,
    TimetableEntryUpdate,
    WeeklyTimetableResponse,
} from '../../types/timetable';

/**
 * Robust, typed API Client for StudyMate AI.
 *
 * Implements:
 * - Single-flight refresh token rotation with concurrency locking.
 * - Max 1 retry per 401 request.
 * - Origin validation to ensure Authorization headers are never sent to unintended hosts.
 * - Race-condition prevention between logout and token refresh.
 * - Standardized, safe error mappings without credential or token leakage.
 */

export interface RequestOptions extends RequestInit {
  requiresAuth?: boolean;
  timeoutMs?: number;
  _retry?: boolean;
}

// Single-flight refresh coordination
let refreshPromise: Promise<string | null> | null = null;
let refreshAbortController: AbortController | null = null;
let isLogoutInProgress = false;

export function notifyLogoutStarted(): void {
  isLogoutInProgress = true;
  if (refreshAbortController) {
    refreshAbortController.abort();
    refreshAbortController = null;
  }
  refreshPromise = null;
}

export function notifyLogoutFinished(): void {
  isLogoutInProgress = false;
}

export function _resetRefreshState(): void {
  refreshPromise = null;
  refreshAbortController = null;
  isLogoutInProgress = false;
}

function parseErrorMessage(data: unknown, fallback: string): string {
  if (!data || typeof data !== 'object') {
    return fallback;
  }

  const obj = data as Record<string, unknown>;
  if (typeof obj.detail === 'string') {
    return obj.detail;
  }

  if (Array.isArray(obj.detail) && obj.detail.length > 0) {
    const firstErr = obj.detail[0];
    if (typeof firstErr === 'object' && firstErr !== null && 'msg' in firstErr) {
      return String((firstErr as Record<string, unknown>).msg);
    }
  }

  if (typeof obj.message === 'string') {
    return obj.message;
  }

  return fallback;
}

function handleHttpError(status: number, data: unknown): never {
  const message = parseErrorMessage(data, `Request failed with status ${status}`);

  switch (status) {
    case 400:
      throw new BadRequestError(message, data);
    case 401:
      throw new AuthError(message, data);
    case 403:
      throw new ForbiddenError(message, 'FORBIDDEN', data);
    case 404:
      throw new NotFoundError(message, data);
    case 409:
      throw new ConflictError(message, data);
    case 422:
      throw new ValidationError(message, data);
    default:
      if (status >= 500) {
        throw new ServerError(
          typeof (data as Record<string, unknown>)?.detail === 'string'
            ? String((data as Record<string, unknown>).detail)
            : undefined,
          status,
          data
        );
      }
      throw new ApiError(message, status, undefined, data);
  }
}

async function executeSingleFlightRefresh(): Promise<string | null> {
  if (isLogoutInProgress) {
    return null;
  }

  if (refreshPromise) {
    return refreshPromise;
  }

  refreshAbortController = new AbortController();
  const currentController = refreshAbortController;

  refreshPromise = (async () => {
    try {
      const storedRefreshToken = await getRefreshToken();
      if (!storedRefreshToken) {
        await clearTokens();
        return null;
      }

      if (isLogoutInProgress || currentController.signal.aborted) {
        return null;
      }

      const url = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.refresh}`;
      if (isDev()) {
        console.log(`[StudyMate API] --> POST ${url} (Token Refresh)`);
      }
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ refresh_token: storedRefreshToken } satisfies RefreshTokenRequest),
        signal: currentController.signal,
      });

      if (isDev()) {
        console.log(`[StudyMate API] <-- POST ${url} [${response.status}] (Token Refresh)`);
      }

      if (isLogoutInProgress || currentController.signal.aborted) {
        // Late refresh response: discard immediately to avoid undoing logout
        return null;
      }

      if (!response.ok) {
        // Terminal refresh failure: clear stored credentials
        await clearTokens();
        return null;
      }

      const data = (await response.json()) as TokenResponse;
      if (!data.access_token || !data.refresh_token) {
        await clearTokens();
        return null;
      }

      // Token rotation: store the new token pair
      await saveTokens({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
      });

      return data.access_token;
    } catch (refreshErr) {
      if (isDev()) {
        console.warn(
          `[StudyMate API] xx- POST ${API_CONFIG.baseUrl}${API_CONFIG.endpoints.refresh} (Token Refresh failed: ${(refreshErr as Error)?.message || 'network error'})`
        );
      }
      await clearTokens();
      return null;
    } finally {
      refreshPromise = null;
      if (refreshAbortController === currentController) {
        refreshAbortController = null;
      }
    }
  })();

  return refreshPromise;
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const {
    requiresAuth = true,
    timeoutMs = API_CONFIG.timeoutMs,
    _retry = false,
    headers: customHeaders = {},
    ...fetchOptions
  } = options;

  const url = endpoint.startsWith('http') ? endpoint : `${API_CONFIG.baseUrl}${endpoint}`;

  // Security Guard: Only attach authorization header to configured base origin
  const isTargetingBaseOrigin = url.startsWith(API_CONFIG.baseUrl);

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(customHeaders as Record<string, string>),
  };

  if (fetchOptions.body && typeof fetchOptions.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (requiresAuth && isTargetingBaseOrigin) {
    const token = await getAccessToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const method = (fetchOptions.method || 'GET').toUpperCase();

  const controller = new AbortController();
  let isTimeout = false;
  const timer = setTimeout(() => {
    isTimeout = true;
    try {
      controller.abort('timeout');
    } catch {
      controller.abort();
    }
  }, timeoutMs);

  const callerSignal = fetchOptions.signal;
  let callerAbortListener: (() => void) | null = null;
  if (callerSignal) {
    if (callerSignal.aborted) {
      try {
        controller.abort(callerSignal.reason);
      } catch {
        controller.abort();
      }
    } else {
      callerAbortListener = () => {
        try {
          controller.abort(callerSignal.reason);
        } catch {
          controller.abort();
        }
      };
      callerSignal.addEventListener('abort', callerAbortListener, { once: true });
    }
  }

  if (isDev()) {
    console.log(`[StudyMate API] --> ${method} ${url}`);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...fetchOptions,
      headers,
      signal: controller.signal,
    });
  } catch (error) {
    if (callerSignal && callerAbortListener) {
      callerSignal.removeEventListener('abort', callerAbortListener);
    }
    clearTimeout(timer);

    const err = error as Error;
    const didTimeout = isTimeout || controller.signal.reason === 'timeout';

    if (didTimeout) {
      if (isDev()) {
        console.warn(
          `[StudyMate API] xx- ${method} ${url} (Timed out after ${timeoutMs}ms)`
        );
      }
      throw new TimeoutError(undefined, url, timeoutMs);
    }

    const isCallerAborted = Boolean(callerSignal?.aborted);
    const isFetchCanceled =
      err?.name === 'AbortError' ||
      controller.signal.aborted ||
      (typeof err?.message === 'string' &&
        (err.message.toLowerCase().includes('canceled') ||
          err.message.toLowerCase().includes('cancelled') ||
          err.message.toLowerCase().includes('aborted')));

    if (isCallerAborted || isFetchCanceled) {
      const cancelReason =
        callerSignal?.reason ||
        controller.signal.reason ||
        err?.message ||
        'Request canceled by client';
      const formattedReason = typeof cancelReason === 'string' ? cancelReason : 'aborted';

      if (isDev()) {
        console.log(
          `[StudyMate API] --x ${method} ${url} (Canceled: ${formattedReason})`
        );
      }
      throw new NetworkError(`Request canceled: ${formattedReason}`, url, error);
    }

    if (isDev()) {
      console.warn(
        `[StudyMate API] xx- ${method} ${url} (Network failure: ${err?.message || 'connection failed'})`
      );
    }
    throw new NetworkError(undefined, url, error);
  } finally {
    if (callerSignal && callerAbortListener) {
      callerSignal.removeEventListener('abort', callerAbortListener);
    }
    clearTimeout(timer);
  }

  if (isDev()) {
    console.log(
      `[StudyMate API] <-- ${method} ${url} [${response.status}${response.statusText ? ` ${response.statusText}` : ''}]`
    );
  }

  // Handle 401 Unauthorized for authenticated endpoints
  if (response.status === 401 && requiresAuth) {
    if (!_retry && !isLogoutInProgress) {
      const newAccessToken = await executeSingleFlightRefresh();
      if (newAccessToken && !isLogoutInProgress) {
        // Retry the request once with new token
        return apiRequest<T>(endpoint, {
          ...options,
          _retry: true,
        });
      }
    }

    // Refresh failed or retried request failed again: terminal failure, clear stored credentials
    await clearTokens();
    throw new AuthError('Session expired. Please log in again.');
  }

  // Handle 204 No Content & 205 Reset Content (endpoints with empty response bodies)
  if (response.status === 204 || response.status === 205) {
    return null as T;
  }

  let responseData: unknown = null;
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  if (isJson) {
    try {
      const text = await response.text();
      responseData = text && text.trim().length > 0 ? JSON.parse(text) : null;
    } catch {
      if (response.ok) {
        // If HTTP 2xx succeeded but returned empty or non-JSON body, don't crash
        responseData = null;
      } else {
        responseData = null;
      }
    }
  } else {
    try {
      const text = await response.text();
      responseData = text ? { detail: text } : null;
    } catch {
      responseData = null;
    }
  }

  if (!response.ok) {
    if (isDev()) {
      console.warn(
        `[StudyMate API] HTTP ${response.status} calling: ${fetchOptions.method || 'GET'} ${url}`
      );
    }
    handleHttpError(response.status, responseData);
  }

  // For successful responses, verify application/json was received (unless 204 No Content)
  if (response.ok && response.status !== 204 && !isJson) {
    throw new InvalidResponseError(
      `Unexpected content-type '${contentType || 'unknown'}' received from server. Expected application/json.`,
      response.status
    );
  }

  return responseData as T;
}

/**
 * Authentication API Service methods.
 */
export const authApi = {
  async register(payload: RegisterRequest, autoActivate: boolean = false): Promise<UserResponse> {
    const endpoint = autoActivate
      ? `${API_CONFIG.endpoints.register}?auto_activate=true`
      : API_CONFIG.endpoints.register;
    return apiRequest<UserResponse>(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
      requiresAuth: false,
    });
  },

  async login(payload: LoginRequest): Promise<TokenResponse> {
    const tokens = await apiRequest<TokenResponse>(API_CONFIG.endpoints.login, {
      method: 'POST',
      body: JSON.stringify(payload),
      requiresAuth: false,
    });

    await saveTokens({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
    });

    return tokens;
  },

  async loginWithGoogle(payload: GoogleAuthRequest): Promise<TokenResponse> {
    const tokens = await apiRequest<TokenResponse>(API_CONFIG.endpoints.googleAuth, {
      method: 'POST',
      body: JSON.stringify(payload),
      requiresAuth: false,
    });

    await saveTokens({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
    });

    return tokens;
  },

  async verifyEmail(token: string): Promise<VerificationResponse> {
    return apiRequest<VerificationResponse>(API_CONFIG.endpoints.verifyEmail, {
      method: 'POST',
      body: JSON.stringify({ token } satisfies VerifyEmailRequest),
      requiresAuth: false,
    });
  },

  async resendVerification(email: string): Promise<MessageResponse> {
    return apiRequest<MessageResponse>(API_CONFIG.endpoints.resendVerification, {
      method: 'POST',
      body: JSON.stringify({ email } satisfies ResendVerificationRequest),
      requiresAuth: false,
    });
  },

  async forgotPassword(email: string): Promise<MessageResponse> {
    return apiRequest<MessageResponse>(API_CONFIG.endpoints.forgotPassword, {
      method: 'POST',
      body: JSON.stringify({ email } satisfies ForgotPasswordRequest),
      requiresAuth: false,
    });
  },

  async requestPasswordResetOtp(email: string): Promise<OtpResponse> {
    return apiRequest<OtpResponse>(API_CONFIG.endpoints.forgotPasswordOtp, {
      method: 'POST',
      body: JSON.stringify({ email } satisfies ForgotPasswordOtpRequest),
      requiresAuth: false,
    });
  },

  async resetPasswordWithOtp(payload: ResetPasswordOtpRequest): Promise<MessageResponse> {
    return apiRequest<MessageResponse>(API_CONFIG.endpoints.resetPasswordOtp, {
      method: 'POST',
      body: JSON.stringify(payload),
      requiresAuth: false,
    });
  },

  async resetPassword(payload: ResetPasswordRequest): Promise<MessageResponse> {
    return apiRequest<MessageResponse>(API_CONFIG.endpoints.resetPassword, {
      method: 'POST',
      body: JSON.stringify(payload),
      requiresAuth: false,
    });
  },

  async refresh(refreshToken: string): Promise<TokenResponse> {
    const tokens = await apiRequest<TokenResponse>(API_CONFIG.endpoints.refresh, {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken } satisfies RefreshTokenRequest),
      requiresAuth: false,
    });

    await saveTokens({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
    });

    return tokens;
  },

  async getMe(): Promise<UserResponse> {
    return apiRequest<UserResponse>(API_CONFIG.endpoints.me, {
      method: 'GET',
      requiresAuth: true,
    });
  },

  async updatePreferences(payload: UserPreferencesUpdateRequest): Promise<UserResponse> {
    return apiRequest<UserResponse>(API_CONFIG.endpoints.userPreferences, {
      method: 'PATCH',
      body: JSON.stringify(payload),
      requiresAuth: true,
    });
  },

  async logout(refreshToken: string): Promise<MessageResponse> {
    notifyLogoutStarted();
    try {
      const response = await apiRequest<MessageResponse>(API_CONFIG.endpoints.logout, {
        method: 'POST',
        body: JSON.stringify({ refresh_token: refreshToken } satisfies LogoutRequest),
        requiresAuth: true,
      });
      return response;
    } finally {
      await clearTokens();
      notifyLogoutFinished();
    }
  },

  async logoutAll(): Promise<MessageResponse> {
    notifyLogoutStarted();
    try {
      const response = await apiRequest<MessageResponse>(API_CONFIG.endpoints.logoutAll, {
        method: 'POST',
        requiresAuth: true,
      });
      return response;
    } finally {
      await clearTokens();
      notifyLogoutFinished();
    }
  },

  async listSessions(): Promise<SessionResponse[]> {
    return apiRequest<SessionResponse[]>(API_CONFIG.endpoints.sessions, {
      method: 'GET',
      requiresAuth: true,
    });
  },

  async revokeSession(sessionId: string): Promise<MessageResponse> {
    return apiRequest<MessageResponse>(API_CONFIG.endpoints.revokeSession(sessionId), {
      method: 'DELETE',
      requiresAuth: true,
    });
  },
};

/**
 * Subjects API Service methods.
 */
export const subjectApi = {
  async list(): Promise<Subject[]> {
    return apiRequest<Subject[]>(API_CONFIG.endpoints.subjects, {
      method: 'GET',
      requiresAuth: true,
    });
  },

  async getById(subjectId: string): Promise<Subject> {
    return apiRequest<Subject>(API_CONFIG.endpoints.subjectById(subjectId), {
      method: 'GET',
      requiresAuth: true,
    });
  },

  async create(payload: SubjectCreate): Promise<Subject> {
    return apiRequest<Subject>(API_CONFIG.endpoints.subjects, {
      method: 'POST',
      body: JSON.stringify(payload),
      requiresAuth: true,
    });
  },

  async update(subjectId: string, payload: SubjectUpdate): Promise<Subject> {
    return apiRequest<Subject>(API_CONFIG.endpoints.subjectById(subjectId), {
      method: 'PATCH',
      body: JSON.stringify(payload),
      requiresAuth: true,
    });
  },

  async delete(subjectId: string): Promise<void> {
    return apiRequest<void>(API_CONFIG.endpoints.subjectById(subjectId), {
      method: 'DELETE',
      requiresAuth: true,
    });
  },
};

/**
 * Notes API Service methods.
 */
export const noteApi = {
  async list(params?: NoteListParams): Promise<Note[]> {
    let endpoint = API_CONFIG.endpoints.notes;
    if (params) {
      const searchParams = new URLSearchParams();
      if (params.search && params.search.trim()) {
        searchParams.append('search', params.search.trim());
      }
      if (params.subject_id) {
        searchParams.append('subject_id', params.subject_id);
      }
      if (typeof params.is_pinned === 'boolean') {
        searchParams.append('is_pinned', String(params.is_pinned));
      }
      if (typeof params.limit === 'number') {
        searchParams.append('limit', String(params.limit));
      }
      if (typeof params.offset === 'number') {
        searchParams.append('offset', String(params.offset));
      }
      const qs = searchParams.toString();
      if (qs) {
        endpoint += `?${qs}`;
      }
    }

    return apiRequest<Note[]>(endpoint, {
      method: 'GET',
      requiresAuth: true,
    });
  },

  async getById(noteId: string): Promise<Note> {
    return apiRequest<Note>(API_CONFIG.endpoints.noteById(noteId), {
      method: 'GET',
      requiresAuth: true,
    });
  },

  async create(payload: NoteCreate): Promise<Note> {
    return apiRequest<Note>(API_CONFIG.endpoints.notes, {
      method: 'POST',
      body: JSON.stringify(payload),
      requiresAuth: true,
    });
  },

  async update(noteId: string, payload: NoteUpdate): Promise<Note> {
    return apiRequest<Note>(API_CONFIG.endpoints.noteById(noteId), {
      method: 'PATCH',
      body: JSON.stringify(payload),
      requiresAuth: true,
    });
  },

  async delete(noteId: string): Promise<void> {
    return apiRequest<void>(API_CONFIG.endpoints.noteById(noteId), {
      method: 'DELETE',
      requiresAuth: true,
    });
  },
};

/**
 * Tasks API Service methods (FR-09).
 */
export const taskApi = {
  async list(params?: TaskListParams): Promise<TaskListResponse> {
    let endpoint: string = API_CONFIG.endpoints.tasks;
    if (params) {
      const qp: string[] = [];
      if (params.status) qp.push(`status=${encodeURIComponent(params.status)}`);
      if (params.priority) qp.push(`priority=${encodeURIComponent(params.priority)}`);
      if (params.subject_id) qp.push(`subject_id=${encodeURIComponent(params.subject_id)}`);
      if (params.search && params.search.trim()) {
        qp.push(`search=${encodeURIComponent(params.search.trim())}`);
      }
      if (params.limit) qp.push(`limit=${params.limit}`);
      if (params.offset) qp.push(`offset=${params.offset}`);
      if (qp.length > 0) {
        endpoint += `?${qp.join('&')}`;
      }
    }
    return apiRequest<TaskListResponse>(endpoint, {
      method: 'GET',
      requiresAuth: true,
    });
  },

  async getById(taskId: string): Promise<Task> {
    return apiRequest<Task>(API_CONFIG.endpoints.taskById(taskId), {
      method: 'GET',
      requiresAuth: true,
    });
  },

  async create(payload: TaskCreate): Promise<Task> {
    return apiRequest<Task>(API_CONFIG.endpoints.tasks, {
      method: 'POST',
      body: JSON.stringify(payload),
      requiresAuth: true,
    });
  },

  async update(taskId: string, payload: TaskUpdate): Promise<Task> {
    return apiRequest<Task>(API_CONFIG.endpoints.taskById(taskId), {
      method: 'PATCH',
      body: JSON.stringify(payload),
      requiresAuth: true,
    });
  },

  async toggleComplete(taskId: string, currentStatus: string): Promise<Task> {
    const newStatus = currentStatus === 'completed' ? 'todo' : 'completed';
    return apiRequest<Task>(API_CONFIG.endpoints.taskById(taskId), {
      method: 'PATCH',
      body: JSON.stringify({ status: newStatus }),
      requiresAuth: true,
    });
  },

  async delete(taskId: string): Promise<void> {
    return apiRequest<void>(API_CONFIG.endpoints.taskById(taskId), {
      method: 'DELETE',
      requiresAuth: true,
    });
  },

  async getAnalytics(): Promise<TaskAnalyticsResponse> {
    return apiRequest<TaskAnalyticsResponse>(API_CONFIG.endpoints.taskAnalytics, {
      method: 'GET',
      requiresAuth: true,
    });
  },

  async listTemplates(): Promise<TaskTemplate[]> {
    return apiRequest<TaskTemplate[]>(API_CONFIG.endpoints.taskTemplates, {
      method: 'GET',
      requiresAuth: true,
    });
  },

  async createTemplate(payload: TaskTemplateCreate): Promise<TaskTemplate> {
    return apiRequest<TaskTemplate>(API_CONFIG.endpoints.taskTemplates, {
      method: 'POST',
      body: JSON.stringify(payload),
      requiresAuth: true,
    });
  },

  async deleteTemplate(templateId: string): Promise<void> {
    return apiRequest<void>(API_CONFIG.endpoints.taskTemplateById(templateId), {
      method: 'DELETE',
      requiresAuth: true,
    });
  },

  async createFromTemplate(payload: CreateTaskFromTemplateRequest): Promise<Task> {
    return apiRequest<Task>(API_CONFIG.endpoints.taskFromTemplate, {
      method: 'POST',
      body: JSON.stringify(payload),
      requiresAuth: true,
    });
  },

  async logFocus(taskId: string, minutes: number, sessionCount = 1): Promise<Task> {
    return apiRequest<Task>(API_CONFIG.endpoints.taskLogFocus(taskId), {
      method: 'POST',
      body: JSON.stringify({ minutes, session_count: sessionCount }),
      requiresAuth: true,
    });
  },

  async uploadAttachment(
    taskId: string,
    file: { uri: string; name: string; type: string }
  ): Promise<Task> {
    const formData = new FormData();
    formData.append('file', file as unknown as Blob);
    return apiRequest<Task>(API_CONFIG.endpoints.taskAttachments(taskId), {
      method: 'POST',
      body: formData,
      requiresAuth: true,
      timeoutMs: 60000,
    });
  },

  async uploadAttachmentBase64(
    taskId: string,
    payload: { filename: string; file_type?: string; file_base64: string }
  ): Promise<Task> {
    return apiRequest<Task>(API_CONFIG.endpoints.taskAttachmentBase64(taskId), {
      method: 'POST',
      body: JSON.stringify(payload),
      requiresAuth: true,
      timeoutMs: 60000,
    });
  },

  async deleteAttachment(taskId: string, attachmentId: string): Promise<Task> {
    return apiRequest<Task>(API_CONFIG.endpoints.taskAttachmentDelete(taskId, attachmentId), {
      method: 'DELETE',
      requiresAuth: true,
    });
  },

  async aiBreakdown(
    title: string,
    description?: string,
    estimatedMinutes?: number
  ): Promise<TaskBreakdownResponse> {
    return apiRequest<TaskBreakdownResponse>(API_CONFIG.endpoints.taskAiBreakdown, {
      method: 'POST',
      body: JSON.stringify({
        title,
        description,
        estimated_minutes: estimatedMinutes,
      }),
      requiresAuth: true,
    });
  },

  async aiSuggestSchedule(
    availableHoursPerDay = 3.0
  ): Promise<TaskScheduleSuggestionResponse> {
    return apiRequest<TaskScheduleSuggestionResponse>(API_CONFIG.endpoints.taskAiSuggestSchedule, {
      method: 'POST',
      body: JSON.stringify({ available_hours_per_day: availableHoursPerDay }),
      requiresAuth: true,
    });
  },

  async aiParseNatural(prompt: string): Promise<TaskParseNaturalResponse> {
    return apiRequest<TaskParseNaturalResponse>(API_CONFIG.endpoints.taskAiParseNatural, {
      method: 'POST',
      body: JSON.stringify({ prompt }),
      requiresAuth: true,
    });
  },

  async aiDailyBriefing(): Promise<TaskDailyBriefingResponse> {
    return apiRequest<TaskDailyBriefingResponse>(API_CONFIG.endpoints.taskAiDailyBriefing, {
      method: 'GET',
      requiresAuth: true,
    });
  },
};

/**
 * Flashcards & Decks API Service methods.
 */
export const flashcardApi = {
  async listDecks(params?: DeckListParams): Promise<FlashcardDeck[]> {
    let endpoint = API_CONFIG.endpoints.decks;
    if (params) {
      const searchParams = new URLSearchParams();
      if (params.search && params.search.trim()) {
        searchParams.append('search', params.search.trim());
      }
      if (params.subject_id) {
        searchParams.append('subject_id', params.subject_id);
      }
      if (typeof params.limit === 'number') {
        searchParams.append('limit', String(params.limit));
      }
      if (typeof params.offset === 'number') {
        searchParams.append('offset', String(params.offset));
      }
      const qs = searchParams.toString();
      if (qs) {
        endpoint += `?${qs}`;
      }
    }

    return apiRequest<FlashcardDeck[]>(endpoint, {
      method: 'GET',
      requiresAuth: true,
    });
  },

  async getDeck(deckId: string): Promise<FlashcardDeckWithCards> {
    return apiRequest<FlashcardDeckWithCards>(API_CONFIG.endpoints.deckById(deckId), {
      method: 'GET',
      requiresAuth: true,
    });
  },

  async createDeck(payload: DeckCreate): Promise<FlashcardDeck> {
    return apiRequest<FlashcardDeck>(API_CONFIG.endpoints.decks, {
      method: 'POST',
      body: JSON.stringify(payload),
      requiresAuth: true,
    });
  },

  async updateDeck(deckId: string, payload: DeckUpdate): Promise<FlashcardDeck> {
    return apiRequest<FlashcardDeck>(API_CONFIG.endpoints.deckById(deckId), {
      method: 'PATCH',
      body: JSON.stringify(payload),
      requiresAuth: true,
    });
  },

  async deleteDeck(deckId: string): Promise<void> {
    return apiRequest<void>(API_CONFIG.endpoints.deckById(deckId), {
      method: 'DELETE',
      requiresAuth: true,
    });
  },

  async listCards(deckId: string): Promise<Flashcard[]> {
    return apiRequest<Flashcard[]>(API_CONFIG.endpoints.cards(deckId), {
      method: 'GET',
      requiresAuth: true,
    });
  },

  async getCard(deckId: string, cardId: string): Promise<Flashcard> {
    return apiRequest<Flashcard>(API_CONFIG.endpoints.cardById(deckId, cardId), {
      method: 'GET',
      requiresAuth: true,
    });
  },

  async createCard(deckId: string, payload: CardCreate): Promise<Flashcard> {
    return apiRequest<Flashcard>(API_CONFIG.endpoints.cards(deckId), {
      method: 'POST',
      body: JSON.stringify(payload),
      requiresAuth: true,
    });
  },

  async updateCard(
    deckId: string,
    cardId: string,
    payload: CardUpdate
  ): Promise<Flashcard> {
    return apiRequest<Flashcard>(API_CONFIG.endpoints.cardById(deckId, cardId), {
      method: 'PATCH',
      body: JSON.stringify(payload),
      requiresAuth: true,
    });
  },

  async deleteCard(deckId: string, cardId: string): Promise<void> {
    return apiRequest<void>(API_CONFIG.endpoints.cardById(deckId, cardId), {
      method: 'DELETE',
      requiresAuth: true,
    });
  },
};

export const documentApi = {
  async listDocuments(params?: DocumentListParams): Promise<DocumentListResponse> {
    let endpoint: string = API_CONFIG.endpoints.documents;
    if (params) {
      const qp: string[] = [];
      if (params.subject_id) qp.push(`subject_id=${encodeURIComponent(params.subject_id)}`);
      if (params.status) qp.push(`status_filter=${encodeURIComponent(params.status)}`);
      if (params.search) qp.push(`search=${encodeURIComponent(params.search)}`);
      if (params.limit) qp.push(`limit=${params.limit}`);
      if (params.offset) qp.push(`offset=${params.offset}`);
      if (qp.length > 0) {
        endpoint += `?${qp.join('&')}`;
      }
    }
    return apiRequest<DocumentListResponse>(endpoint, {
      method: 'GET',
      requiresAuth: true,
    });
  },

  async getDocument(documentId: string): Promise<Document> {
    return apiRequest<Document>(API_CONFIG.endpoints.documentById(documentId), {
      method: 'GET',
      requiresAuth: true,
    });
  },

  async uploadDocument(formData: FormData): Promise<Document> {
    return apiRequest<Document>(API_CONFIG.endpoints.documentUpload, {
      method: 'POST',
      body: formData,
      requiresAuth: true,
      timeoutMs: 60000,
    });
  },

  async uploadBase64Document(payload: {
    title: string;
    filename: string;
    file_base64: string;
    subject_id?: string;
  }): Promise<Document> {
    return apiRequest<Document>('/api/v1/documents/upload-base64', {
      method: 'POST',
      body: JSON.stringify(payload),
      requiresAuth: true,
      timeoutMs: 60000,
    });
  },

  async createDocument(payload: {
    title: string;
    content: string;
    subject_id?: string;
  }): Promise<Document> {
    return apiRequest<Document>('/api/v1/documents/create', {
      method: 'POST',
      body: JSON.stringify(payload),
      requiresAuth: true,
      timeoutMs: 60000,
    });
  },

  async deleteDocument(documentId: string): Promise<void> {
    return apiRequest<void>(API_CONFIG.endpoints.documentById(documentId), {
      method: 'DELETE',
      requiresAuth: true,
    });
  },
};

export const aiApi = {
  async listChatSessions(subjectId?: string): Promise<{ items: AIChatSession[]; total: number }> {
    let endpoint: string = API_CONFIG.endpoints.aiChatSessions;
    if (subjectId) {
      endpoint += `?subject_id=${encodeURIComponent(subjectId)}`;
    }
    return apiRequest<{ items: AIChatSession[]; total: number }>(endpoint, {
      method: 'GET',
      requiresAuth: true,
    });
  },

  async getChatSession(sessionId: string): Promise<AIChatSession> {
    return apiRequest<AIChatSession>(API_CONFIG.endpoints.aiChatSessionById(sessionId), {
      method: 'GET',
      requiresAuth: true,
    });
  },

  async deleteChatSession(sessionId: string): Promise<void> {
    return apiRequest<void>(API_CONFIG.endpoints.aiChatSessionById(sessionId), {
      method: 'DELETE',
      requiresAuth: true,
    });
  },

  async explainTopic(payload: AIExplanationRequest): Promise<AIExplanationResponse> {
    return apiRequest<AIExplanationResponse>(API_CONFIG.endpoints.aiExplain, {
      method: 'POST',
      body: JSON.stringify(payload),
      requiresAuth: true,
    });
  },

  async sendMessage(payload: AIChatRequest): Promise<AIChatResponse> {
    return apiRequest<AIChatResponse>(API_CONFIG.endpoints.aiChat, {
      method: 'POST',
      body: JSON.stringify(payload),
      requiresAuth: true,
    });
  },

  async generateAINotes(payload: AINoteGenerationRequest): Promise<AINoteGenerationResponse> {
    return apiRequest<AINoteGenerationResponse>(API_CONFIG.endpoints.aiGenerateNotes, {
      method: 'POST',
      body: JSON.stringify(payload),
      requiresAuth: true,
    });
  },
};

export const quizApi = {
  async list(subjectId?: string): Promise<{ items: Quiz[]; total: number }> {
    let endpoint: string = API_CONFIG.endpoints.quizzes;
    if (subjectId) {
      endpoint += `?subject_id=${encodeURIComponent(subjectId)}`;
    }
    return apiRequest<{ items: Quiz[]; total: number }>(endpoint, {
      method: 'GET',
      requiresAuth: true,
    });
  },

  async getById(quizId: string): Promise<Quiz> {
    return apiRequest<Quiz>(API_CONFIG.endpoints.quizById(quizId), {
      method: 'GET',
      requiresAuth: true,
    });
  },

  async generate(payload: QuizGenerateRequest): Promise<Quiz> {
    return apiRequest<Quiz>(API_CONFIG.endpoints.quizGenerate, {
      method: 'POST',
      body: JSON.stringify(payload),
      requiresAuth: true,
    });
  },

  async submit(quizId: string, payload: QuizSubmitRequest): Promise<QuizAttempt> {
    return apiRequest<QuizAttempt>(API_CONFIG.endpoints.quizSubmit(quizId), {
      method: 'POST',
      body: JSON.stringify(payload),
      requiresAuth: true,
    });
  },

  async convertMissedToFlashcards(
    quizId: string,
    attemptId: string,
    payload?: ConvertMissedToCardsRequest
  ): Promise<ConvertMissedToCardsResponse> {
    return apiRequest<ConvertMissedToCardsResponse>(
      API_CONFIG.endpoints.quizConvertMissed(quizId, attemptId),
      {
        method: 'POST',
        body: JSON.stringify(payload ?? {}),
        requiresAuth: true,
      }
    );
  },

  async delete(quizId: string): Promise<void> {
    return apiRequest<void>(API_CONFIG.endpoints.quizById(quizId), {
      method: 'DELETE',
      requiresAuth: true,
    });
  },
};

export const timetableApi = {
  async list(params?: { day_of_week?: number; subject_id?: string }): Promise<TimetableEntry[]> {
    let endpoint: string = API_CONFIG.endpoints.timetable;
    if (params) {
      const qp: string[] = [];
      if (params.day_of_week) qp.push(`day_of_week=${encodeURIComponent(params.day_of_week)}`);
      if (params.subject_id) qp.push(`subject_id=${encodeURIComponent(params.subject_id)}`);
      if (qp.length > 0) endpoint += `?${qp.join('&')}`;
    }
    return apiRequest<TimetableEntry[]>(endpoint, { requiresAuth: true });
  },

  async getWeekly(): Promise<WeeklyTimetableResponse> {
    return apiRequest<WeeklyTimetableResponse>(API_CONFIG.endpoints.timetableWeekly, { requiresAuth: true });
  },

  async getToday(): Promise<TimetableEntry[]> {
    return apiRequest<TimetableEntry[]>(API_CONFIG.endpoints.timetableToday, { requiresAuth: true });
  },

  async checkConflict(payload: TimetableConflictCheckRequest): Promise<TimetableConflictResponse> {
    return apiRequest<TimetableConflictResponse>(API_CONFIG.endpoints.timetableCheckConflict, {
      method: 'POST',
      body: JSON.stringify(payload),
      requiresAuth: true,
    });
  },

  async getById(id: string): Promise<TimetableEntry> {
    return apiRequest<TimetableEntry>(API_CONFIG.endpoints.timetableById(id), { requiresAuth: true });
  },

  async create(payload: TimetableEntryCreate): Promise<TimetableEntry> {
    return apiRequest<TimetableEntry>(API_CONFIG.endpoints.timetable, {
      method: 'POST',
      body: JSON.stringify(payload),
      requiresAuth: true,
    });
  },

  async update(id: string, payload: TimetableEntryUpdate): Promise<TimetableEntry> {
    return apiRequest<TimetableEntry>(API_CONFIG.endpoints.timetableById(id), {
      method: 'PATCH',
      body: JSON.stringify(payload),
      requiresAuth: true,
    });
  },

  async batchCreate(payload: TimetableEntryBatchCreate): Promise<TimetableEntry[]> {
    return apiRequest<TimetableEntry[]>(API_CONFIG.endpoints.timetableBatch, {
      method: 'POST',
      body: JSON.stringify(payload),
      requiresAuth: true,
    });
  },

  async delete(id: string): Promise<void> {
    return apiRequest<void>(API_CONFIG.endpoints.timetableById(id), {
      method: 'DELETE',
      requiresAuth: true,
    });
  },

  async markAttendance(payload: AttendanceMarkRequest): Promise<AttendanceRecord> {
    return apiRequest<AttendanceRecord>(API_CONFIG.endpoints.timetableAttendance, {
      method: 'POST',
      body: JSON.stringify(payload),
      requiresAuth: true,
    });
  },

  async listAttendance(params?: { attendance_date?: string; subject_id?: string }): Promise<AttendanceRecord[]> {
    let endpoint: string = API_CONFIG.endpoints.timetableAttendance;
    if (params) {
      const qp: string[] = [];
      if (params.attendance_date) qp.push(`attendance_date=${encodeURIComponent(params.attendance_date)}`);
      if (params.subject_id) qp.push(`subject_id=${encodeURIComponent(params.subject_id)}`);
      if (qp.length > 0) endpoint += `?${qp.join('&')}`;
    }
    return apiRequest<AttendanceRecord[]>(endpoint, { requiresAuth: true });
  },

  async getAttendanceSummary(minimumRequired: number = 75.0): Promise<AttendanceSummaryResponse> {
    const endpoint = `${API_CONFIG.endpoints.timetableAttendanceSummary}?minimum_required=${encodeURIComponent(minimumRequired)}`;
    return apiRequest<AttendanceSummaryResponse>(endpoint, { requiresAuth: true });
  },
};

export const examApi = {
  async list(params?: { subject_id?: string; upcoming_only?: boolean }): Promise<ExamListResponse> {
    let endpoint: string = API_CONFIG.endpoints.exams;
    const qp: string[] = [];
    if (params?.subject_id) qp.push(`subject_id=${encodeURIComponent(params.subject_id)}`);
    if (params?.upcoming_only) qp.push('upcoming_only=true');
    if (qp.length > 0) endpoint += `?${qp.join('&')}`;
    return apiRequest<ExamListResponse>(endpoint, { requiresAuth: true });
  },

  async getById(id: string): Promise<Exam> {
    return apiRequest<Exam>(API_CONFIG.endpoints.examById(id), { requiresAuth: true });
  },

  async create(payload: ExamCreate): Promise<Exam> {
    return apiRequest<Exam>(API_CONFIG.endpoints.exams, {
      method: 'POST',
      body: JSON.stringify(payload),
      requiresAuth: true,
    });
  },

  async update(id: string, payload: ExamUpdate): Promise<Exam> {
    return apiRequest<Exam>(API_CONFIG.endpoints.examById(id), {
      method: 'PATCH',
      body: JSON.stringify(payload),
      requiresAuth: true,
    });
  },

  async delete(id: string): Promise<void> {
    return apiRequest<void>(API_CONFIG.endpoints.examById(id), {
      method: 'DELETE',
      requiresAuth: true,
    });
  },

  async toggleTopic(
    id: string,
    topicId: string,
    payload?: { is_completed?: boolean; confidence?: string }
  ): Promise<Exam> {
    return apiRequest<Exam>(API_CONFIG.endpoints.examToggleTopic(id, topicId), {
      method: 'PATCH',
      body: payload ? JSON.stringify(payload) : undefined,
      requiresAuth: true,
    });
  },

  async generateRevisionPlan(id: string): Promise<Exam> {
    return apiRequest<Exam>(API_CONFIG.endpoints.examGeneratePlan(id), {
      method: 'POST',
      requiresAuth: true,
    });
  },

  async getUpcomingSummary(): Promise<ExamUpcomingSummaryResponse> {
    return apiRequest<ExamUpcomingSummaryResponse>(API_CONFIG.endpoints.examUpcomingSummary, {
      requiresAuth: true,
    });
  },
};

/**
 * Smart Study Planner API Service methods (FR-10).
 */
export const studyPlannerApi = {
  async getTodayPlan(): Promise<StudyPlan | null> {
    return apiRequest<StudyPlan | null>(API_CONFIG.endpoints.studyPlannerToday, {
      method: 'GET',
      requiresAuth: true,
    });
  },

  async getPlanByDate(planDate: string): Promise<StudyPlan | null> {
    return apiRequest<StudyPlan | null>(API_CONFIG.endpoints.studyPlannerByDate(planDate), {
      method: 'GET',
      requiresAuth: true,
    });
  },

  async getPlanById(id: string): Promise<StudyPlan> {
    return apiRequest<StudyPlan>(API_CONFIG.endpoints.studyPlannerById(id), {
      method: 'GET',
      requiresAuth: true,
    });
  },

  async generate(payload: StudyPlanGenerateRequest = {}): Promise<StudyPlan> {
    return apiRequest<StudyPlan>(API_CONFIG.endpoints.studyPlannerGenerate, {
      method: 'POST',
      body: JSON.stringify(payload),
      requiresAuth: true,
    });
  },

  async toggleBlock(id: string, blockId: string, payload: StudyBlockToggleRequest): Promise<StudyPlan> {
    return apiRequest<StudyPlan>(API_CONFIG.endpoints.studyPlannerToggleBlock(id, blockId), {
      method: 'PATCH',
      body: JSON.stringify(payload),
      requiresAuth: true,
    });
  },

  async rebalance(id: string, payload: StudyPlanRebalanceRequest = {}): Promise<StudyPlan> {
    return apiRequest<StudyPlan>(API_CONFIG.endpoints.studyPlannerRebalance(id), {
      method: 'POST',
      body: JSON.stringify(payload),
      requiresAuth: true,
    });
  },
};

/**
 * Study Sessions API Service (FR-12 & FR-16).
 */
export const studySessionApi = {
  async logSession(payload: StudySessionCreateRequest): Promise<StudySessionResponse> {
    return apiRequest<StudySessionResponse>(API_CONFIG.endpoints.studySessionsLog, {
      method: 'POST',
      body: JSON.stringify(payload),
      requiresAuth: true,
    });
  },

  async getTodaySummary(): Promise<TodayStudySummary> {
    return apiRequest<TodayStudySummary>(API_CONFIG.endpoints.studySessionsToday, {
      method: 'GET',
      requiresAuth: true,
    });
  },
};

/**
 * Study Analytics & Heatmap API Service (FR-16).
 */
export const analyticsApi = {
  async getOverview(timeframe: 'week' | 'month' | 'all' = 'all'): Promise<AnalyticsOverviewResponse> {
    const url = `${API_CONFIG.endpoints.analyticsOverview}?timeframe=${encodeURIComponent(timeframe)}`;
    return apiRequest<AnalyticsOverviewResponse>(url, {
      method: 'GET',
      requiresAuth: true,
    });
  },

  async getHeatmap(days: number = 180): Promise<AnalyticsHeatmapResponse> {
    const url = `${API_CONFIG.endpoints.analyticsHeatmap}?days=${days}`;
    return apiRequest<AnalyticsHeatmapResponse>(url, {
      method: 'GET',
      requiresAuth: true,
    });
  },
};

/**
 * Universal Search API Service (FR-18).
 */
export const searchApi = {
  async universalSearch(params: UniversalSearchParams): Promise<UniversalSearchResponse> {
    const qp: string[] = [`q=${encodeURIComponent(params.query.trim())}`];
    if (params.category && params.category !== 'all') {
      qp.push(`category=${encodeURIComponent(params.category)}`);
    }
    if (params.subjectId) {
      qp.push(`subject_id=${encodeURIComponent(params.subjectId)}`);
    }
    if (params.limit !== undefined) {
      qp.push(`limit=${params.limit}`);
    }
    if (params.offset !== undefined) {
      qp.push(`offset=${params.offset}`);
    }
    const url = `${API_CONFIG.endpoints.search}?${qp.join('&')}`;
    return apiRequest<UniversalSearchResponse>(url, {
      method: 'GET',
      requiresAuth: true,
    });
  },
};

/**
 * User Security & GDPR Privacy API Service (FR-01, FR-02 & GDPR Compliance).
 */
export interface ChangePasswordResponse {
  message: string;
  access_token?: string | null;
  refresh_token?: string | null;
  token_type?: string;
}

export const userSecurityApi = {
  async changePassword(currentPassword: string, newPassword: string): Promise<ChangePasswordResponse> {
    const res = await apiRequest<ChangePasswordResponse>(API_CONFIG.endpoints.changePassword, {
      method: 'POST',
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
      requiresAuth: true,
    });
    if (res?.access_token && res?.refresh_token) {
      await saveTokens({
        accessToken: res.access_token,
        refreshToken: res.refresh_token,
      });
    }
    return res;
  },

  async exportUserData(): Promise<Record<string, any>> {
    return apiRequest<Record<string, any>>(API_CONFIG.endpoints.exportData, {
      method: 'POST',
      requiresAuth: true,
    });
  },

  async registerPushToken(
    pushToken: string,
    platform: string = 'android',
    deviceName?: string
  ): Promise<MessageResponse> {
    return apiRequest<MessageResponse>(API_CONFIG.endpoints.pushToken, {
      method: 'POST',
      body: JSON.stringify({
        push_token: pushToken,
        platform,
        device_name: deviceName,
      }),
      requiresAuth: true,
    });
  },

  async deleteAccount(password: string, reason?: string): Promise<MessageResponse> {
    const res = await apiRequest<MessageResponse>(API_CONFIG.endpoints.deleteAccount, {
      method: 'DELETE',
      body: JSON.stringify({
        password,
        reason: reason || 'User requested account closure',
      }),
      requiresAuth: true,
    });
    await clearTokens();
    return res;
  },
};

/**
 * System Broadcast Announcements API (Admin -> Mobile Students)
 */
export interface MobileAnnouncement {
  id: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  target_audience: 'all' | 'students';
  is_active: boolean;
  created_at: string;
  expires_at?: string | null;
}

export const announcementApi = {
  async getActiveAnnouncements(): Promise<MobileAnnouncement[]> {
    return apiRequest<MobileAnnouncement[]>(API_CONFIG.endpoints.activeAnnouncements, {
      method: 'GET',
      requiresAuth: false,
    });
  },
};

/**
 * Curated Subject Templates API (1-Click University Subject Enrollment)
 */
export interface MobileSubjectTemplate {
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
}

export interface SubjectTemplateListResult {
  items: MobileSubjectTemplate[];
  total: number;
  categories: string[];
}

export interface SubjectEnrollResult {
  subject_id: string;
  name: string;
  code: string | null;
  color: string | null;
  message: string;
}

export const subjectTemplateApi = {
  async list(category?: string): Promise<SubjectTemplateListResult> {
    const qp = category ? `?category=${encodeURIComponent(category)}` : '';
    return apiRequest<SubjectTemplateListResult>(
      `${API_CONFIG.endpoints.subjectTemplates}${qp}`,
      {
        method: 'GET',
        requiresAuth: false,
      }
    );
  },

  async enroll(templateId: string): Promise<SubjectEnrollResult> {
    return apiRequest<SubjectEnrollResult>(
      API_CONFIG.endpoints.subjectTemplateEnroll(templateId),
      {
        method: 'POST',
        requiresAuth: true,
      }
    );
  },
};

export interface DevicePingPayload {
  device_name?: string;
  device_os?: string;
  app_version?: string;
  is_first_launch?: boolean;
  user_id?: string;
}

export const telemetryApi = {
  async devicePing(payload: DevicePingPayload): Promise<{ status: string; action: string }> {
    return apiRequest<{ status: string; action: string }>(
      API_CONFIG.endpoints.devicePing,
      {
        method: 'POST',
        body: JSON.stringify(payload),
        requiresAuth: false,
      }
    );
  },
};
