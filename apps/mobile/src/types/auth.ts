/**
 * Authentication type definitions matching the StudyMate AI FastAPI backend schemas.
 */

export type UserRole = 'student' | 'faculty' | 'admin';

export type UserStatus = 'active' | 'pending_verification' | 'suspended';

export interface UserResponse {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string | null;
  role: UserRole | string;
  status: UserStatus | string;
  institution?: string | null;
  major?: string | null;
  graduation_year?: number | null;
  daily_study_goal_minutes: number;
  theme_preference: string;
  push_notifications_enabled: boolean;
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
  created_at: string;
  updated_at: string;
  last_login_at?: string | null;
}

export interface UserPreferencesUpdateRequest {
  push_notifications_enabled?: boolean;
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
  daily_study_goal_minutes?: number;
  theme_preference?: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  device_name?: string;
  device_os?: string;
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface LogoutRequest {
  refresh_token: string;
}

export interface GoogleAuthRequest {
  id_token?: string;
  access_token?: string;
  device_name?: string;
  device_os?: string;
}

export interface VerifyEmailRequest {
  token: string;
}

export interface ResendVerificationRequest {
  email: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordOtpRequest {
  email: string;
}

export interface ResetPasswordOtpRequest {
  email: string;
  otp: string;
  new_password: string;
}

export interface OtpResponse {
  message: string;
  email: string;
  success: boolean;
}

export interface ResetPasswordRequest {
  token: string;
  new_password: string;
}

export interface VerificationResponse {
  message: string;
  verified: boolean;
  email?: string;
}

export interface MessageResponse {
  message: string;
}

export interface SessionResponse {
  id: string;
  user_id: string;
  device_name: string | null;
  device_os: string | null;
  ip_address: string | null;
  last_active_at: string;
  created_at: string;
  expires_at: string;
  is_current: boolean;
}

export type AuthStatus =
  | 'initializing'
  | 'unauthenticated'
  | 'authenticated'
  | 'pending_verification';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export function isDev(): boolean {
  if (typeof __DEV__ !== 'undefined') {
    return Boolean(__DEV__);
  }
  return process.env.NODE_ENV !== 'production';
}

/**
 * Standardized API Error structure.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export class BadRequestError extends ApiError {
  constructor(message: string = 'Bad request. Please check your submission.', details?: unknown) {
    super(message, 400, 'BAD_REQUEST', details);
    this.name = 'BadRequestError';
    Object.setPrototypeOf(this, BadRequestError.prototype);
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(message, 422, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class AuthError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(message, 401, 'UNAUTHORIZED', details);
    this.name = 'AuthError';
    Object.setPrototypeOf(this, AuthError.prototype);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message: string, code = 'FORBIDDEN', details?: unknown) {
    super(message, 403, code, details);
    this.name = 'ForbiddenError';
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}

export class NotFoundError extends ApiError {
  constructor(message: string = 'The requested resource was not found.', details?: unknown) {
    super(message, 404, 'NOT_FOUND', details);
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export class ConflictError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(message, 409, 'CONFLICT', details);
    this.name = 'ConflictError';
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

export class ServerError extends ApiError {
  constructor(
    message?: string,
    status: number = 500,
    details?: unknown
  ) {
    const defaultMsg = isDev()
      ? `Server error (${status}). Please check backend server logs.`
      : 'An unexpected server error occurred. Please try again later.';

    super(message || defaultMsg, status, 'SERVER_ERROR', details);
    this.name = 'ServerError';
    Object.setPrototypeOf(this, ServerError.prototype);
  }
}

export class InvalidResponseError extends ApiError {
  constructor(
    message: string = 'Invalid or non-JSON response received from server.',
    status: number = 200,
    details?: unknown
  ) {
    super(message, status, 'INVALID_RESPONSE', details);
    this.name = 'InvalidResponseError';
    Object.setPrototypeOf(this, InvalidResponseError.prototype);
  }
}

export class NetworkError extends ApiError {
  readonly targetUrl?: string;

  constructor(
    message?: string,
    targetUrl?: string,
    details?: unknown
  ) {
    const defaultMsg = isDev() && targetUrl
      ? `Unable to connect to backend at ${targetUrl}. Please ensure your backend server is running and accessible on this network.`
      : 'Network error. Please check your internet connection.';

    super(message || defaultMsg, 0, 'NETWORK_ERROR', details);
    this.name = 'NetworkError';
    this.targetUrl = targetUrl;
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

export class TimeoutError extends ApiError {
  readonly targetUrl?: string;
  readonly timeoutMs?: number;

  constructor(
    message?: string,
    targetUrl?: string,
    timeoutMs?: number
  ) {
    const seconds = timeoutMs ? Math.round(timeoutMs / 1000) : 15;
    const defaultMsg = isDev() && targetUrl
      ? `Request to ${targetUrl} timed out after ${seconds}s. Please verify your backend server is responsive.`
      : 'Request timed out. Please try again.';

    super(message || defaultMsg, 408, 'TIMEOUT_ERROR');
    this.name = 'TimeoutError';
    this.targetUrl = targetUrl;
    this.timeoutMs = timeoutMs;
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}
