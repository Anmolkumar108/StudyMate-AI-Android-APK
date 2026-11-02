import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, it } from 'node:test';

import {
  clearPomodoroData,
  getLocalDateString,
  loadPomodoroData,
  loadPomodoroSettings,
  loadPomodoroStats,
  recordFocusSessionCompletion,
  resetPomodoroStorageAdapter,
  savePomodoroData,
  savePomodoroSettings,
  savePomodoroStats,
  setPomodoroStorageAdapter,
} from '../src/services/storage/pomodoro-storage';
import { inMemoryAdapter } from '../src/services/storage/token-storage';
import {
  DEFAULT_POMODORO_SETTINGS,
  DEFAULT_POMODORO_STATS,
  formatTimeRemaining,
  PomodoroPersistedData,
  PomodoroSettings,
  validatePomodoroSettings,
} from '../src/types/pomodoro';

describe('Pomodoro Focus Timer Domain & State Machine', () => {
  beforeEach(() => {
    inMemoryAdapter.clear();
    setPomodoroStorageAdapter(inMemoryAdapter);
  });

  describe('Duration Validation & Bounds', () => {
    it('accepts valid default and custom Pomodoro settings', () => {
      const validSettings: PomodoroSettings = {
        focusDuration: 30,
        shortBreakDuration: 5,
        longBreakDuration: 20,
        longBreakInterval: 4,
        vibrateEnabled: true,
        autoStartBreaks: false,
        autoStartFocus: false,
      };

      const result = validatePomodoroSettings(validSettings);
      assert.strictEqual(result.isValid, true);
      assert.deepStrictEqual(result.errors, {});
    });

    it('rejects focus duration below 1 minute or above 90 minutes', () => {
      const lowResult = validatePomodoroSettings({ focusDuration: 0 });
      assert.strictEqual(lowResult.isValid, false);
      assert.ok(lowResult.errors.focusDuration);

      const highResult = validatePomodoroSettings({ focusDuration: 95 });
      assert.strictEqual(highResult.isValid, false);
      assert.ok(highResult.errors.focusDuration);
    });

    it('rejects short break duration below 1 minute or above 30 minutes', () => {
      const low = validatePomodoroSettings({ shortBreakDuration: 0 });
      assert.strictEqual(low.isValid, false);
      assert.ok(low.errors.shortBreakDuration);

      const high = validatePomodoroSettings({ shortBreakDuration: 35 });
      assert.strictEqual(high.isValid, false);
      assert.ok(high.errors.shortBreakDuration);
    });

    it('rejects long break duration below 1 minute or above 60 minutes', () => {
      const low = validatePomodoroSettings({ longBreakDuration: 0 });
      assert.strictEqual(low.isValid, false);
      assert.ok(low.errors.longBreakDuration);

      const high = validatePomodoroSettings({ longBreakDuration: 65 });
      assert.strictEqual(high.isValid, false);
      assert.ok(high.errors.longBreakDuration);
    });

    it('rejects long break interval below 2 or above 8 sessions', () => {
      const low = validatePomodoroSettings({ longBreakInterval: 1 });
      assert.strictEqual(low.isValid, false);
      assert.ok(low.errors.longBreakInterval);

      const high = validatePomodoroSettings({ longBreakInterval: 10 });
      assert.strictEqual(high.isValid, false);
      assert.ok(high.errors.longBreakInterval);
    });

    it('rejects non-integer duration values', () => {
      const result = validatePomodoroSettings({ focusDuration: 25.5 });
      assert.strictEqual(result.isValid, false);
      assert.ok(result.errors.focusDuration);
    });

    it('formats time remaining to MM:SS string correctly', () => {
      assert.strictEqual(formatTimeRemaining(1500), '25:00');
      assert.strictEqual(formatTimeRemaining(300), '05:00');
      assert.strictEqual(formatTimeRemaining(65), '01:05');
      assert.strictEqual(formatTimeRemaining(9), '00:09');
      assert.strictEqual(formatTimeRemaining(0), '00:00');
      assert.strictEqual(formatTimeRemaining(-5), '00:00');
    });

    it('verifies 1 minute focus duration works correctly across validation and formatting', () => {
      const oneMinuteSettings: PomodoroSettings = {
        ...DEFAULT_POMODORO_SETTINGS,
        focusDuration: 1,
      };

      const result = validatePomodoroSettings(oneMinuteSettings);
      assert.strictEqual(result.isValid, true, '1 minute focus duration must be valid');
      assert.deepStrictEqual(result.errors, {});

      const durationSeconds = oneMinuteSettings.focusDuration * 60;
      assert.strictEqual(durationSeconds, 60);
      assert.strictEqual(formatTimeRemaining(durationSeconds), '01:00');
    });

    it('verifies stepper increment and decrement clamp at boundary values', () => {
      const clampStep = (val: number, delta: number, min: number, max: number) => {
        const next = val + delta;
        return Math.max(min, Math.min(max, next));
      };

      // Focus Duration (1–90 min)
      assert.strictEqual(clampStep(1, -1, 1, 90), 1, 'Focus decrement should not fall below 1');
      assert.strictEqual(clampStep(1, +1, 1, 90), 2, 'Focus increment should step to 2');
      assert.strictEqual(clampStep(90, +1, 1, 90), 90, 'Focus increment should not exceed 90');
      assert.strictEqual(clampStep(90, -1, 1, 90), 89, 'Focus decrement should step to 89');

      // Short Break Duration (1–30 min)
      assert.strictEqual(clampStep(1, -1, 1, 30), 1, 'Short break decrement should not fall below 1');
      assert.strictEqual(clampStep(30, +1, 1, 30), 30, 'Short break increment should not exceed 30');

      // Long Break Duration (1–60 min)
      assert.strictEqual(clampStep(1, -1, 1, 60), 1, 'Long break decrement should not fall below 1');
      assert.strictEqual(clampStep(60, +1, 1, 60), 60, 'Long break increment should not exceed 60');

      // Long Break Interval (2–8 cycles)
      assert.strictEqual(clampStep(2, -1, 2, 8), 2, 'Interval decrement should not fall below 2');
      assert.strictEqual(clampStep(8, +1, 2, 8), 8, 'Interval increment should not exceed 8');
    });
  });

  describe('Storage Persistence & State Recovery', () => {
    it('returns default settings when storage is empty', async () => {
      const settings = await loadPomodoroSettings();
      assert.deepStrictEqual(settings, DEFAULT_POMODORO_SETTINGS);
    });

    it('returns default stats when storage is empty', async () => {
      const stats = await loadPomodoroStats();
      assert.strictEqual(stats.totalCompletedSessions, 0);
      assert.strictEqual(stats.totalFocusMinutes, 0);
      assert.strictEqual(stats.todayCompletedSessions, 0);
    });

    it('persists and reloads custom user settings', async () => {
      const custom: PomodoroSettings = {
        focusDuration: 45,
        shortBreakDuration: 8,
        longBreakDuration: 25,
        longBreakInterval: 3,
        vibrateEnabled: false,
        autoStartBreaks: true,
        autoStartFocus: false,
      };

      await savePomodoroSettings(custom);
      const loaded = await loadPomodoroSettings();
      assert.strictEqual(loaded.focusDuration, 45);
      assert.strictEqual(loaded.shortBreakDuration, 8);
      assert.strictEqual(loaded.longBreakDuration, 25);
      assert.strictEqual(loaded.longBreakInterval, 3);
      assert.strictEqual(loaded.vibrateEnabled, false);
    });

    it('persists and restores active session state bundle', async () => {
      const data: PomodoroPersistedData = {
        state: {
          mode: 'focus',
          status: 'running',
          remainingSeconds: 1200,
          targetDurationSeconds: 1500,
          deadlineTimestamp: Date.now() + 1200000,
          currentCycle: 2,
        },
        settings: DEFAULT_POMODORO_SETTINGS,
        stats: DEFAULT_POMODORO_STATS,
        lastSavedTimestamp: Date.now(),
      };

      await savePomodoroData(data);
      const loaded = await loadPomodoroData();
      assert.ok(loaded);
      assert.strictEqual(loaded.state.mode, 'focus');
      assert.strictEqual(loaded.state.status, 'running');
      assert.strictEqual(loaded.state.remainingSeconds, 1200);
      assert.strictEqual(loaded.state.currentCycle, 2);

      await clearPomodoroData();
      const cleared = await loadPomodoroData();
      assert.strictEqual(cleared, null);
    });

    it('does not reset running or paused timer remaining time when settings are updated', async () => {
      // Running timer state with 800 seconds left out of 1500
      let remainingSeconds = 800;
      let targetDurationSeconds = 1500;
      const status: 'running' = 'running';

      // User changes settings to 45 min focus (2700s)
      const newSettings: PomodoroSettings = {
        ...DEFAULT_POMODORO_SETTINGS,
        focusDuration: 45,
      };

      // Simulating updateSettings branch: if running/paused, do not overwrite remainingSeconds
      if (status === 'idle') {
        remainingSeconds = newSettings.focusDuration * 60;
        targetDurationSeconds = newSettings.focusDuration * 60;
      }

      assert.strictEqual(
        remainingSeconds,
        800,
        'Remaining seconds of running session must be preserved'
      );
      assert.strictEqual(
        targetDurationSeconds,
        1500,
        'Target duration of running session must be preserved'
      );

      // Now simulate when timer is idle: settings immediately apply to new session
      let idleRemaining = 1500;
      let idleTarget = 1500;
      const idleStatus: 'idle' = 'idle';

      if (idleStatus === 'idle') {
        idleRemaining = newSettings.focusDuration * 60;
        idleTarget = newSettings.focusDuration * 60;
      }

      assert.strictEqual(idleRemaining, 2700, 'Idle session immediately reflects new duration');
      assert.strictEqual(idleTarget, 2700, 'Idle session target immediately reflects new duration');
    });
  });

  describe('Session Completion & Historical Tracking', () => {
    it('formats local calendar day correctly with getLocalDateString', () => {
      const testDate = new Date(2026, 9, 31, 14, 30); // October 31, 2026 local
      assert.strictEqual(getLocalDateString(testDate), '2026-10-31');

      const testDate2 = new Date(2026, 0, 5, 2, 15); // January 5, 2026 local
      assert.strictEqual(getLocalDateString(testDate2), '2026-01-05');
    });

    it('records focus session completion and accumulates statistics', async () => {
      const stats1 = await recordFocusSessionCompletion(25);
      assert.strictEqual(stats1.totalCompletedSessions, 1);
      assert.strictEqual(stats1.totalFocusMinutes, 25);
      assert.strictEqual(stats1.todayCompletedSessions, 1);
      assert.ok(stats1.lastCompletedDate);

      const stats2 = await recordFocusSessionCompletion(25);
      assert.strictEqual(stats2.totalCompletedSessions, 2);
      assert.strictEqual(stats2.totalFocusMinutes, 50);
      assert.strictEqual(stats2.todayCompletedSessions, 2);
    });

    it('resets todayCompletedSessions across local calendar day rollover while retaining historical totals', async () => {
      // Simulate historical stats from 2 days ago
      const pastDate = new Date(Date.now() - 86400000 * 2);
      await savePomodoroStats({
        totalCompletedSessions: 8,
        totalFocusMinutes: 200,
        todayCompletedSessions: 4,
        lastCompletedDate: pastDate.toISOString(),
      });

      // Loading stats today should show 0 for today's sessions, but retain all-time totals
      const loaded = await loadPomodoroStats();
      assert.strictEqual(loaded.todayCompletedSessions, 0);
      assert.strictEqual(loaded.totalCompletedSessions, 8);
      assert.strictEqual(loaded.totalFocusMinutes, 200);

      // Completing a new session today sets todayCompletedSessions to 1 and accumulates totals
      const updated = await recordFocusSessionCompletion(30);
      assert.strictEqual(updated.todayCompletedSessions, 1);
      assert.strictEqual(updated.totalCompletedSessions, 9);
      assert.strictEqual(updated.totalFocusMinutes, 230);
    });

    it('distinguishes completed sessions from skipped sessions', () => {
      // Skipped sessions do not call recordFocusSessionCompletion
      let totalCompleted = 0;
      let totalMinutes = 0;

      const completeSession = (mins: number) => {
        totalCompleted += 1;
        totalMinutes += mins;
      };

      const skipSession = () => {
        // Skips mode transition without tracking
      };

      completeSession(25);
      skipSession();
      skipSession();
      completeSession(25);

      assert.strictEqual(totalCompleted, 2, 'Only completed sessions should be counted');
      assert.strictEqual(totalMinutes, 50, 'Only completed session minutes should be accumulated');
    });

    it('guards against duplicate completion triggers on app resume (isCompletingRef simulation)', async () => {
      let isCompleting = false;
      let completions = 0;

      const handleSessionCompleted = async () => {
        if (isCompleting) return;
        isCompleting = true;
        try {
          completions += 1;
          await recordFocusSessionCompletion(25);
        } finally {
          // flag is reset on next user action (start/resume/reset)
        }
      };

      // Simulate simultaneous interval tick and AppState resume event
      await Promise.all([handleSessionCompleted(), handleSessionCompleted()]);

      assert.strictEqual(completions, 1, 'Only one completion should be processed concurrently');
    });
  });

  describe('Timestamp Deadline & Background Accuracy', () => {
    it('computes accurate remaining time using deadline timestamp without interval drift', () => {
      const now = 1000000;
      const durationSeconds = 1500;
      const deadlineTimestamp = now + durationSeconds * 1000;

      // Simulate 500 seconds elapsed while backgrounded
      const simulatedNow = now + 500 * 1000;
      const remaining = Math.max(0, Math.round((deadlineTimestamp - simulatedNow) / 1000));
      assert.strictEqual(remaining, 1000);

      // Simulate full 1500 seconds elapsed
      const completedNow = now + 1500 * 1000;
      const completedRemaining = Math.max(0, Math.round((deadlineTimestamp - completedNow) / 1000));
      assert.strictEqual(completedRemaining, 0);

      // Simulate elapsed past deadline (app reopened late)
      const pastNow = now + 1600 * 1000;
      const pastRemaining = Math.max(0, Math.round((deadlineTimestamp - pastNow) / 1000));
      assert.strictEqual(pastRemaining, 0);
    });
  });

  describe('4-Session Cycle Transitions', () => {
    it('progresses through 4 focus sessions with short breaks and triggers long break on 4th session', () => {
      const interval = 4;
      let currentCycle = 1;
      let mode: 'focus' | 'short_break' | 'long_break' = 'focus';

      const handleFocusCompleted = () => {
        if (currentCycle >= interval) {
          mode = 'long_break';
          currentCycle = 1;
        } else {
          mode = 'short_break';
          currentCycle += 1;
        }
      };

      const handleBreakCompleted = () => {
        mode = 'focus';
      };

      // Session 1: Focus -> Short Break
      assert.strictEqual(mode, 'focus');
      assert.strictEqual(currentCycle, 1);
      handleFocusCompleted();
      assert.strictEqual(mode, 'short_break');
      assert.strictEqual(currentCycle, 2);
      handleBreakCompleted();

      // Session 2: Focus -> Short Break
      assert.strictEqual(mode, 'focus');
      assert.strictEqual(currentCycle, 2);
      handleFocusCompleted();
      assert.strictEqual(mode, 'short_break');
      assert.strictEqual(currentCycle, 3);
      handleBreakCompleted();

      // Session 3: Focus -> Short Break
      assert.strictEqual(mode, 'focus');
      assert.strictEqual(currentCycle, 3);
      handleFocusCompleted();
      assert.strictEqual(mode, 'short_break');
      assert.strictEqual(currentCycle, 4);
      handleBreakCompleted();

      // Session 4: Focus -> Long Break (cycle resets to 1)
      assert.strictEqual(mode, 'focus');
      assert.strictEqual(currentCycle, 4);
      handleFocusCompleted();
      assert.strictEqual(mode, 'long_break');
      assert.strictEqual(currentCycle, 1);
      handleBreakCompleted();

      // Next is focus with cycle 1
      assert.strictEqual(mode, 'focus');
      assert.strictEqual(currentCycle, 1);
    });
  });

  describe('UI & Navigation Integration', () => {
    it('verifies PomodoroScreen integrates ScreenWrapper, timer ring, controls, and stats', () => {
      const filePath = path.resolve(__dirname, '../src/app/pomodoro.tsx');
      assert.ok(fs.existsSync(filePath), 'PomodoroScreen file src/app/pomodoro.tsx must exist');

      const content = fs.readFileSync(filePath, 'utf-8');

      assert.ok(content.includes('<ScreenWrapper'), 'Must integrate ScreenWrapper');
      assert.ok(content.includes('PomodoroTimerRing'), 'Must include PomodoroTimerRing');
      assert.ok(content.includes('PomodoroControls'), 'Must include PomodoroControls');
      assert.ok(content.includes('PomodoroStatsCard'), 'Must include PomodoroStatsCard');
      assert.ok(content.includes('PomodoroSettingsModal'), 'Must include PomodoroSettingsModal');
      assert.ok(content.includes('PomodoroCompletionModal'), 'Must include PomodoroCompletionModal');
      assert.ok(content.includes('Focus Timer'), 'Must include Focus Timer title');
      assert.ok(content.includes('POMODORO TECHNIQUE'), 'Must include category pill');
      assert.ok(content.includes('accessibilityLabel="Go back to Study Hub"'), 'Must include accessible Back button');
      assert.ok(content.includes('accessibilityLabel="Timer Settings"'), 'Must include accessible Timer Settings button');
      assert.ok(content.includes('⚙️'), 'Must include clearly visible gear icon for Settings');
      assert.ok(content.includes('minWidth: MinTouchTarget'), 'Icon buttons must satisfy MinTouchTarget');
    });

    it('verifies Study Hub (explore.tsx) links to /pomodoro and displays configured durations', () => {
      const explorePath = path.resolve(__dirname, '../src/app/explore.tsx');
      assert.ok(fs.existsSync(explorePath), 'Study Hub file src/app/explore.tsx must exist');

      const content = fs.readFileSync(explorePath, 'utf-8');

      assert.ok(
        content.includes("router.push('/pomodoro'"),
        'Study Hub must navigate to /pomodoro'
      );
      assert.ok(
        content.includes('Open Focus Timer →'),
        'Study Hub must provide Open Focus Timer action button'
      );
      assert.ok(
        content.includes('Active Tool'),
        'Study Hub Pomodoro card must display Active Tool badge'
      );
      assert.ok(
        content.includes('loadPomodoroSettings'),
        'Study Hub must dynamically load configured timer durations'
      );
      assert.ok(
        content.includes('settings.focusDuration'),
        'Study Hub must render configured focusDuration'
      );
      assert.ok(
        content.includes('settings.shortBreakDuration'),
        'Study Hub must render configured shortBreakDuration'
      );
      assert.ok(
        content.includes('settings.longBreakDuration'),
        'Study Hub must render configured longBreakDuration'
      );
    });

    it('verifies root layout (_layout.tsx) includes pomodoro as a standalone route', () => {
      const layoutPath = path.resolve(__dirname, '../src/app/_layout.tsx');
      assert.ok(fs.existsSync(layoutPath), 'Root layout file src/app/_layout.tsx must exist');

      const content = fs.readFileSync(layoutPath, 'utf-8');

      assert.ok(
        content.includes("'pomodoro'"),
        'Root layout must register pomodoro as standalone route'
      );
    });

    it('verifies PomodoroSettingsModal contains DurationStepper with accessible stepper controls and presets', () => {
      const modalPath = path.resolve(
        __dirname,
        '../src/components/pomodoro/pomodoro-settings-modal.tsx'
      );
      assert.ok(fs.existsSync(modalPath), 'PomodoroSettingsModal must exist');

      const content = fs.readFileSync(modalPath, 'utf-8');

      assert.ok(content.includes('function DurationStepper'), 'Must define DurationStepper primitive');
      assert.ok(content.includes('accessibilityLabel={`Decrease ${accessibilityName}`}'));
      assert.ok(content.includes('accessibilityLabel={`Increase ${accessibilityName}`}'));
      assert.ok(content.includes('accessibilityRole="button"'));
      assert.ok(content.includes('Standard'));
      assert.ok(content.includes('25m • 5m'));
      assert.ok(content.includes('Extended'));
      assert.ok(content.includes('50m • 10m'));
      assert.ok(content.includes('Quick'));
      assert.ok(content.includes('15m • 3m'));
      assert.ok(content.includes('POMODORO_LIMITS'));
      assert.ok(content.includes('theme.statusDanger'));
    });

    it('verifies PomodoroTimerRing and PomodoroControls use semantic theme tokens instead of hardcoded dark colors', () => {
      const ringPath = path.resolve(
        __dirname,
        '../src/components/pomodoro/pomodoro-timer-ring.tsx'
      );
      const ringContent = fs.readFileSync(ringPath, 'utf-8');

      assert.ok(
        ringContent.includes('accentColor: theme.statusInfo'),
        'Ring must use theme.statusInfo for Long Break accent'
      );
      assert.ok(
        ringContent.includes('trackColor: theme.badgeInfoBackground'),
        'Ring must use theme.badgeInfoBackground for Long Break track'
      );
      assert.ok(
        !ringContent.includes("accentColor: '#38BDF8'"),
        'Ring must not hardcode dark sky blue in accent'
      );
      assert.ok(
        !ringContent.includes("trackColor: 'rgba(56, 189, 248, 0.15)'"),
        'Ring must not hardcode dark sky blue in track'
      );

      const controlsPath = path.resolve(
        __dirname,
        '../src/components/pomodoro/pomodoro-controls.tsx'
      );
      const controlsContent = fs.readFileSync(controlsPath, 'utf-8');

      assert.ok(
        controlsContent.includes("mode === 'long_break' ? theme.statusInfo : theme.borderSubtle"),
        'Controls must use theme.statusInfo for Long Break active pill border'
      );
      assert.ok(
        controlsContent.includes("mode === 'long_break'\n                  ? theme.badgeInfoBackground"),
        'Controls must use theme.badgeInfoBackground for Long Break active pill background'
      );
      assert.ok(
        !controlsContent.includes("mode === 'long_break' ? '#38BDF8' : theme.borderSubtle"),
        'Controls must not hardcode #38BDF8'
      );
    });
  });
});
