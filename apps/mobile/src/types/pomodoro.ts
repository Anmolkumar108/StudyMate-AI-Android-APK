/**
 * Pomodoro Focus Timer domain models, state definitions, and validation rules.
 */

export type PomodoroMode = 'focus' | 'short_break' | 'long_break';

export type PomodoroStatus = 'idle' | 'running' | 'paused' | 'completed';

export interface PomodoroSettings {
  /** Focus session duration in minutes (1 - 90) */
  focusDuration: number;
  /** Short break duration in minutes (1 - 30) */
  shortBreakDuration: number;
  /** Long break duration in minutes (1 - 60) */
  longBreakDuration: number;
  /** Number of focus sessions before a long break (2 - 8) */
  longBreakInterval: number;
  /** Whether to trigger vibration feedback on completion */
  vibrateEnabled: boolean;
  /** Whether to auto-start break after focus session */
  autoStartBreaks: boolean;
  /** Whether to auto-start focus after break */
  autoStartFocus: boolean;
}

export interface PomodoroStats {
  /** Total all-time completed focus sessions */
  totalCompletedSessions: number;
  /** Total all-time focus minutes accumulated */
  totalFocusMinutes: number;
  /** Number of focus sessions completed today */
  todayCompletedSessions: number;
  /** Last completed session ISO date string */
  lastCompletedDate: string | null;
}

export interface PomodoroState {
  /** Current mode */
  mode: PomodoroMode;
  /** Timer status */
  status: PomodoroStatus;
  /** Remaining time in seconds */
  remainingSeconds: number;
  /** Target duration of the current session in seconds */
  targetDurationSeconds: number;
  /**
   * Absolute deadline timestamp in ms (Date.now() + remainingSeconds * 1000).
   * Populated only when status === 'running'.
   * Used for drift-free timestamp-based accuracy across app backgrounding.
   */
  deadlineTimestamp: number | null;
  /** Current cycle index (1 to longBreakInterval) */
  currentCycle: number;
}

export interface PomodoroPersistedData {
  state: PomodoroState;
  settings: PomodoroSettings;
  stats: PomodoroStats;
  lastSavedTimestamp: number;
}

export const DEFAULT_POMODORO_SETTINGS: PomodoroSettings = {
  focusDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  longBreakInterval: 4,
  vibrateEnabled: true,
  autoStartBreaks: false,
  autoStartFocus: false,
};

export const DEFAULT_POMODORO_STATS: PomodoroStats = {
  totalCompletedSessions: 0,
  totalFocusMinutes: 0,
  todayCompletedSessions: 0,
  lastCompletedDate: null,
};

export const POMODORO_LIMITS = {
  focus: { min: 1, max: 90 },
  shortBreak: { min: 1, max: 30 },
  longBreak: { min: 1, max: 60 },
  interval: { min: 2, max: 8 },
} as const;

export interface ValidationResult<T> {
  isValid: boolean;
  errors: Partial<Record<keyof T, string>>;
}

/**
 * Validates custom Pomodoro settings with sensible bounds.
 */
export function validatePomodoroSettings(
  settings: Partial<PomodoroSettings>
): ValidationResult<PomodoroSettings> {
  const errors: Partial<Record<keyof PomodoroSettings, string>> = {};

  if (settings.focusDuration !== undefined) {
    if (
      !Number.isInteger(settings.focusDuration) ||
      settings.focusDuration < POMODORO_LIMITS.focus.min ||
      settings.focusDuration > POMODORO_LIMITS.focus.max
    ) {
      errors.focusDuration = `Focus duration must be between ${POMODORO_LIMITS.focus.min} and ${POMODORO_LIMITS.focus.max} minutes.`;
    }
  }

  if (settings.shortBreakDuration !== undefined) {
    if (
      !Number.isInteger(settings.shortBreakDuration) ||
      settings.shortBreakDuration < POMODORO_LIMITS.shortBreak.min ||
      settings.shortBreakDuration > POMODORO_LIMITS.shortBreak.max
    ) {
      errors.shortBreakDuration = `Short break must be between ${POMODORO_LIMITS.shortBreak.min} and ${POMODORO_LIMITS.shortBreak.max} minutes.`;
    }
  }

  if (settings.longBreakDuration !== undefined) {
    if (
      !Number.isInteger(settings.longBreakDuration) ||
      settings.longBreakDuration < POMODORO_LIMITS.longBreak.min ||
      settings.longBreakDuration > POMODORO_LIMITS.longBreak.max
    ) {
      errors.longBreakDuration = `Long break must be between ${POMODORO_LIMITS.longBreak.min} and ${POMODORO_LIMITS.longBreak.max} minutes.`;
    }
  }

  if (settings.longBreakInterval !== undefined) {
    if (
      !Number.isInteger(settings.longBreakInterval) ||
      settings.longBreakInterval < POMODORO_LIMITS.interval.min ||
      settings.longBreakInterval > POMODORO_LIMITS.interval.max
    ) {
      errors.longBreakInterval = `Long break cycle must be between ${POMODORO_LIMITS.interval.min} and ${POMODORO_LIMITS.interval.max} sessions.`;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Formats a duration in seconds to MM:SS string.
 */
export function formatTimeRemaining(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
