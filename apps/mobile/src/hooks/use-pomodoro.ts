import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, AppStateStatus, Vibration } from 'react-native';

import {
  loadPomodoroData,
  loadPomodoroSettings,
  loadPomodoroStats,
  recordFocusSessionCompletion,
  savePomodoroData,
  savePomodoroSettings,
} from '../services/storage/pomodoro-storage';
import {
  DEFAULT_POMODORO_SETTINGS,
  DEFAULT_POMODORO_STATS,
  PomodoroMode,
  PomodoroSettings,
  PomodoroState,
  PomodoroStats,
  PomodoroStatus,
  validatePomodoroSettings,
} from '../types/pomodoro';

function getDurationSecondsForMode(
  mode: PomodoroMode,
  settings: PomodoroSettings
): number {
  switch (mode) {
    case 'short_break':
      return settings.shortBreakDuration * 60;
    case 'long_break':
      return settings.longBreakDuration * 60;
    case 'focus':
    default:
      return settings.focusDuration * 60;
  }
}

export function usePomodoro() {
  const [settings, setSettings] = useState<PomodoroSettings>(DEFAULT_POMODORO_SETTINGS);
  const [stats, setStats] = useState<PomodoroStats>(DEFAULT_POMODORO_STATS);

  const [mode, setMode] = useState<PomodoroMode>('focus');
  const [status, setStatus] = useState<PomodoroStatus>('idle');
  const [remainingSeconds, setRemainingSeconds] = useState<number>(
    DEFAULT_POMODORO_SETTINGS.focusDuration * 60
  );
  const [targetDurationSeconds, setTargetDurationSeconds] = useState<number>(
    DEFAULT_POMODORO_SETTINGS.focusDuration * 60
  );
  const [deadlineTimestamp, setDeadlineTimestamp] = useState<number | null>(null);
  const [currentCycle, setCurrentCycle] = useState<number>(1);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [completedMode, setCompletedMode] = useState<PomodoroMode | null>(null);

  // Guard flag to prevent duplicate completion executions (e.g. interval + AppState resume)
  const isCompletingRef = useRef<boolean>(false);

  // References for event listener callbacks without tearing
  const statusRef = useRef(status);
  const deadlineRef = useRef(deadlineTimestamp);
  const modeRef = useRef(mode);
  const cycleRef = useRef(currentCycle);
  const settingsRef = useRef(settings);
  const statsRef = useRef(stats);

  useEffect(() => {
    statusRef.current = status;
    deadlineRef.current = deadlineTimestamp;
    modeRef.current = mode;
    cycleRef.current = currentCycle;
    settingsRef.current = settings;
    statsRef.current = stats;
  }, [status, deadlineTimestamp, mode, currentCycle, settings, stats]);

  // Persist current state whenever key properties change
  const persistState = useCallback(
    async (
      overrideState?: Partial<PomodoroState>,
      overrideSettings?: PomodoroSettings,
      overrideStats?: PomodoroStats
    ) => {
      const activeState: PomodoroState = {
        mode: overrideState?.mode ?? modeRef.current,
        status: overrideState?.status ?? statusRef.current,
        remainingSeconds: overrideState?.remainingSeconds ?? remainingSeconds,
        targetDurationSeconds:
          overrideState?.targetDurationSeconds ?? targetDurationSeconds,
        deadlineTimestamp:
          overrideState?.deadlineTimestamp !== undefined
            ? overrideState.deadlineTimestamp
            : deadlineRef.current,
        currentCycle: overrideState?.currentCycle ?? cycleRef.current,
      };

      await savePomodoroData({
        state: activeState,
        settings: overrideSettings ?? settingsRef.current,
        stats: overrideStats ?? statsRef.current,
        lastSavedTimestamp: Date.now(),
      });
    },
    [remainingSeconds, targetDurationSeconds]
  );

  // Initial load from storage
  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const [savedSettings, savedStats, savedData] = await Promise.all([
          loadPomodoroSettings(),
          loadPomodoroStats(),
          loadPomodoroData(),
        ]);

        if (!mounted) return;

        setSettings(savedSettings);
        setStats(savedStats);
        statsRef.current = savedStats;

        if (savedData && savedData.state) {
          const s = savedData.state;
          const currentSettings = savedData.settings || savedSettings;

          setMode(s.mode);
          setCurrentCycle(s.currentCycle || 1);
          setTargetDurationSeconds(
            s.targetDurationSeconds ||
              getDurationSecondsForMode(s.mode, currentSettings)
          );

          if (s.status === 'running' && s.deadlineTimestamp) {
            const now = Date.now();
            const diffSeconds = Math.round((s.deadlineTimestamp - now) / 1000);

            if (diffSeconds <= 0) {
              // Timer finished while app was closed/suspended - complete exactly once
              isCompletingRef.current = true;
              setStatus('completed');
              setRemainingSeconds(0);
              setDeadlineTimestamp(null);
              setCompletedMode(s.mode);

              if (s.mode === 'focus') {
                const updatedStats = await recordFocusSessionCompletion(
                  currentSettings.focusDuration
                );
                if (mounted) {
                  setStats(updatedStats);
                  statsRef.current = updatedStats;
                }
              }
            } else {
              // Timer is still running
              setStatus('running');
              setRemainingSeconds(diffSeconds);
              setDeadlineTimestamp(s.deadlineTimestamp);
            }
          } else {
            // Idle or paused state
            setStatus(s.status === 'running' ? 'paused' : s.status);
            setRemainingSeconds(
              s.remainingSeconds ??
                getDurationSecondsForMode(s.mode, currentSettings)
            );
            setDeadlineTimestamp(null);
          }
        } else {
          // Fresh default
          const defaultSeconds = savedSettings.focusDuration * 60;
          setRemainingSeconds(defaultSeconds);
          setTargetDurationSeconds(defaultSeconds);
        }
      } finally {
        if (mounted) setIsLoaded(true);
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, []);

  // Completion handler
  const handleSessionCompleted = useCallback(
    async (finishedMode: PomodoroMode) => {
      // Prevent duplicate completion invocations
      if (isCompletingRef.current) {
        return;
      }
      isCompletingRef.current = true;

      // Trigger tactile haptic feedback if enabled
      if (settingsRef.current.vibrateEnabled) {
        try {
          Vibration.vibrate([0, 500, 200, 500]);
        } catch {
          // Ignore
        }
      }

      let updatedStats = statsRef.current;
      let nextMode: PomodoroMode = 'focus';
      let nextCycle = cycleRef.current;

      if (finishedMode === 'focus') {
        updatedStats = await recordFocusSessionCompletion(
          settingsRef.current.focusDuration
        );
        setStats(updatedStats);
        statsRef.current = updatedStats;

        if (cycleRef.current >= settingsRef.current.longBreakInterval) {
          nextMode = 'long_break';
          nextCycle = 1;
        } else {
          nextMode = 'short_break';
          nextCycle = cycleRef.current + 1;
        }
      } else {
        // Break completed -> Next is focus
        nextMode = 'focus';
      }

      const nextDuration = getDurationSecondsForMode(
        nextMode,
        settingsRef.current
      );

      // Update state immediately for UI synchronization
      setCompletedMode(finishedMode);
      setStatus('completed');
      setMode(nextMode);
      setCurrentCycle(nextCycle);
      setRemainingSeconds(nextDuration);
      setTargetDurationSeconds(nextDuration);
      setDeadlineTimestamp(null);

      await persistState(
        {
          mode: nextMode,
          status: 'completed',
          remainingSeconds: nextDuration,
          targetDurationSeconds: nextDuration,
          deadlineTimestamp: null,
          currentCycle: nextCycle,
        },
        settingsRef.current,
        updatedStats
      );
    },
    [persistState]
  );

  // Active running timer interval using timestamp calculation
  useEffect(() => {
    if (status !== 'running' || !deadlineTimestamp) {
      return;
    }

    const intervalId = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(
        0,
        Math.round((deadlineTimestamp - now) / 1000)
      );

      if (remaining <= 0) {
        clearInterval(intervalId);
        if (!isCompletingRef.current) {
          handleSessionCompleted(modeRef.current);
        }
      } else {
        setRemainingSeconds(remaining);
      }
    }, 500);

    return () => clearInterval(intervalId);
  }, [status, deadlineTimestamp, handleSessionCompleted]);

  // AppState listener for background / foreground accuracy
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        nextAppState === 'active' &&
        statusRef.current === 'running' &&
        deadlineRef.current
      ) {
        const now = Date.now();
        const remaining = Math.max(
          0,
          Math.round((deadlineRef.current - now) / 1000)
        );

        if (remaining <= 0) {
          if (!isCompletingRef.current) {
            handleSessionCompleted(modeRef.current);
          }
        } else {
          setRemainingSeconds(remaining);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [handleSessionCompleted]);

  // Public Actions
  const start = useCallback(() => {
    isCompletingRef.current = false;

    const duration =
      remainingSeconds > 0
        ? remainingSeconds
        : getDurationSecondsForMode(mode, settings);

    const deadline = Date.now() + duration * 1000;

    setStatus('running');
    setRemainingSeconds(duration);
    setDeadlineTimestamp(deadline);
    setCompletedMode(null);

    persistState({
      status: 'running',
      remainingSeconds: duration,
      deadlineTimestamp: deadline,
    });
  }, [remainingSeconds, mode, settings, persistState]);

  const pause = useCallback(() => {
    if (statusRef.current !== 'running' || !deadlineRef.current) return;

    const remaining = Math.max(
      0,
      Math.round((deadlineRef.current - Date.now()) / 1000)
    );

    setStatus('paused');
    setRemainingSeconds(remaining);
    setDeadlineTimestamp(null);

    persistState({
      status: 'paused',
      remainingSeconds: remaining,
      deadlineTimestamp: null,
    });
  }, [persistState]);

  const resume = useCallback(() => {
    if (statusRef.current !== 'paused') return;

    isCompletingRef.current = false;
    const deadline = Date.now() + remainingSeconds * 1000;

    setStatus('running');
    setDeadlineTimestamp(deadline);

    persistState({
      status: 'running',
      remainingSeconds,
      deadlineTimestamp: deadline,
    });
  }, [remainingSeconds, persistState]);

  const reset = useCallback(() => {
    isCompletingRef.current = false;
    const duration = getDurationSecondsForMode(mode, settings);

    setStatus('idle');
    setRemainingSeconds(duration);
    setTargetDurationSeconds(duration);
    setDeadlineTimestamp(null);
    setCompletedMode(null);

    persistState({
      status: 'idle',
      remainingSeconds: duration,
      targetDurationSeconds: duration,
      deadlineTimestamp: null,
    });
  }, [mode, settings, persistState]);

  const skip = useCallback(() => {
    isCompletingRef.current = false;

    // Advance session without counting as a completed session
    let nextMode: PomodoroMode = 'focus';
    let nextCycle = currentCycle;

    if (mode === 'focus') {
      if (currentCycle >= settings.longBreakInterval) {
        nextMode = 'long_break';
        nextCycle = 1;
      } else {
        nextMode = 'short_break';
        nextCycle = currentCycle + 1;
      }
    } else {
      nextMode = 'focus';
    }

    const nextDuration = getDurationSecondsForMode(nextMode, settings);

    setMode(nextMode);
    setCurrentCycle(nextCycle);
    setStatus('idle');
    setRemainingSeconds(nextDuration);
    setTargetDurationSeconds(nextDuration);
    setDeadlineTimestamp(null);
    setCompletedMode(null);

    persistState({
      mode: nextMode,
      status: 'idle',
      remainingSeconds: nextDuration,
      targetDurationSeconds: nextDuration,
      deadlineTimestamp: null,
      currentCycle: nextCycle,
    });
  }, [mode, currentCycle, settings, persistState]);

  const switchMode = useCallback(
    (newMode: PomodoroMode) => {
      isCompletingRef.current = false;

      if (status === 'running') {
        pause();
      }

      const newDuration = getDurationSecondsForMode(newMode, settings);

      setMode(newMode);
      setStatus('idle');
      setRemainingSeconds(newDuration);
      setTargetDurationSeconds(newDuration);
      setDeadlineTimestamp(null);
      setCompletedMode(null);

      persistState({
        mode: newMode,
        status: 'idle',
        remainingSeconds: newDuration,
        targetDurationSeconds: newDuration,
        deadlineTimestamp: null,
      });
    },
    [status, pause, settings, persistState]
  );

  const updateSettings = useCallback(
    async (newSettings: Partial<PomodoroSettings>) => {
      const merged: PomodoroSettings = {
        ...settingsRef.current,
        ...newSettings,
      };
      const validation = validatePomodoroSettings(merged);
      if (!validation.isValid) {
        throw new Error(Object.values(validation.errors)[0] || 'Invalid settings');
      }

      setSettings(merged);
      settingsRef.current = merged;
      await savePomodoroSettings(merged);

      // If timer is idle or completed, adjust current duration immediately
      if (statusRef.current === 'idle' || statusRef.current === 'completed') {
        const newDuration = getDurationSecondsForMode(modeRef.current, merged);
        setRemainingSeconds(newDuration);
        setTargetDurationSeconds(newDuration);

        await persistState(
          {
            remainingSeconds: newDuration,
            targetDurationSeconds: newDuration,
          },
          merged
        );
      } else {
        // If timer is running or paused, DO NOT reset the active timer
        // Just persist the settings safely for subsequent sessions
        await persistState({}, merged);
      }
    },
    [persistState]
  );

  const dismissCompletion = useCallback(() => {
    isCompletingRef.current = false;
    setCompletedMode(null);
    setStatus('idle');
    persistState({ status: 'idle' });
  }, [persistState]);

  const adjustTime = useCallback(
    (deltaSeconds: number) => {
      if (status === 'completed') return;
      const newRemaining = Math.max(60, remainingSeconds + deltaSeconds);
      const newTarget = Math.max(newRemaining, targetDurationSeconds + (deltaSeconds > 0 ? deltaSeconds : 0));
      setRemainingSeconds(newRemaining);
      setTargetDurationSeconds(newTarget);
      if (status === 'running' && deadlineTimestamp) {
        setDeadlineTimestamp(deadlineTimestamp + deltaSeconds * 1000);
      }
      persistState({
        remainingSeconds: newRemaining,
        targetDurationSeconds: newTarget,
        deadlineTimestamp:
          status === 'running' && deadlineTimestamp
            ? deadlineTimestamp + deltaSeconds * 1000
            : null,
      });
    },
    [status, remainingSeconds, targetDurationSeconds, deadlineTimestamp, persistState]
  );

  const setCustomFocusDuration = useCallback(
    async (minutes: number) => {
      const clamped = Math.max(1, Math.min(90, Math.round(minutes)));
      await updateSettings({ focusDuration: clamped });
      if (mode !== 'focus') {
        switchMode('focus');
      }
    },
    [mode, updateSettings, switchMode]
  );

  // Derived progress (0 to 1)
  const progress = useMemo(() => {
    if (targetDurationSeconds <= 0) return 0;
    const elapsed = targetDurationSeconds - remainingSeconds;
    return Math.min(1, Math.max(0, elapsed / targetDurationSeconds));
  }, [targetDurationSeconds, remainingSeconds]);

  return {
    mode,
    status,
    remainingSeconds,
    targetDurationSeconds,
    progress,
    currentCycle,
    settings,
    stats,
    isLoaded,
    completedMode,
    start,
    pause,
    resume,
    reset,
    skip,
    switchMode,
    updateSettings,
    dismissCompletion,
    adjustTime,
    setCustomFocusDuration,
  };
}
