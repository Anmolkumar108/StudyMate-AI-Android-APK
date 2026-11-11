import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  PomodoroCompletionModal,
  PomodoroControls,
  PomodoroSettingsModal,
  PomodoroStatsCard,
  PomodoroTimerRing,
} from '@/components/pomodoro';
import { ThemedText } from '@/components/themed-text';
import { ScreenWrapper } from '@/components/ui';
import { BorderRadius, MinTouchTarget, Spacing } from '@/constants/theme';
import { usePomodoro } from '@/hooks/use-pomodoro';
import { useTheme } from '@/hooks/use-theme';
import { studySessionApi, taskApi } from '@/services/api/client';
import { ambientSoundEngine } from '@/services/audio/ambient-player';

const FOCUS_PRESETS = [15, 25, 30, 45, 60, 90] as const;
const SHORT_BREAK_PRESETS = [3, 5, 10, 15] as const;
const LONG_BREAK_PRESETS = [10, 15, 20, 30] as const;

interface AmbientSound {
  id: 'rain' | 'whitenoise' | 'cafe' | 'forest' | 'mute';
  icon: string;
  name: string;
  tagline: string;
}

const AMBIENT_SOUNDS: AmbientSound[] = [
  { id: 'rain', icon: '🌧️', name: 'Rainfall', tagline: 'Calming rainy window ambience' },
  { id: 'whitenoise', icon: '🌊', name: 'White Noise', tagline: 'Consistent cognitive focus frequencies' },
  { id: 'cafe', icon: '☕', name: 'Study Cafe', tagline: 'Gentle espresso shop chatter' },
  { id: 'forest', icon: '🌲', name: 'Pine Forest', tagline: 'Breezy leaves and birds' },
  { id: 'mute', icon: '🔇', name: 'Mute', tagline: 'Silent focus' },
];

export default function PomodoroScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { taskId, taskTitle, duration, subject, subjectColor } = useLocalSearchParams<{
    taskId?: string;
    taskTitle?: string;
    duration?: string;
    subject?: string;
    subjectColor?: string;
  }>();

  const {
    mode,
    status,
    remainingSeconds,
    targetDurationSeconds,
    progress,
    currentCycle,
    settings,
    stats,
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
  } = usePomodoro();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [customInputMins, setCustomInputMins] = useState<number>(settings.focusDuration);
  const [activeSound, setActiveSound] = useState<AmbientSound['id']>('rain');
  const [isZenMode, setIsZenMode] = useState<boolean>(false);

  // Auto-apply query param duration from Study Planner / Task (e.g. C++ 60 min session!)
  const initializedDurationRef = useRef(false);
  useEffect(() => {
    if (!initializedDurationRef.current && duration) {
      const parsedMins = parseInt(duration, 10);
      if (!isNaN(parsedMins) && parsedMins >= 1 && parsedMins <= 90) {
        initializedDurationRef.current = true;
        setCustomFocusDuration(parsedMins);
      }
    }
  }, [duration, setCustomFocusDuration]);

  // Synchronize custom input with current settings
  useEffect(() => {
    if (mode === 'focus') {
      setCustomInputMins(settings.focusDuration);
    } else if (mode === 'short_break') {
      setCustomInputMins(settings.shortBreakDuration);
    } else {
      setCustomInputMins(settings.longBreakDuration);
    }
  }, [mode, settings]);

  // Automatically log focus minutes to task and PostgreSQL backend when a focus session completes
  useEffect(() => {
    if (status === 'completed' && completedMode === 'focus') {
      const focusMins = Math.max(1, Math.round(targetDurationSeconds / 60));
      if (taskId) {
        taskApi.logFocus(taskId, focusMins, 1).catch(() => {});
      }
      studySessionApi
        .logSession({
          duration_minutes: focusMins,
          actual_seconds_spent: targetDurationSeconds,
          session_type: 'focus',
          task_id: taskId || null,
          started_at: new Date(Date.now() - targetDurationSeconds * 1000).toISOString(),
          ended_at: new Date().toISOString(),
          completed_successfully: true,
        })
        .catch(() => {});
    }
  }, [status, completedMode, taskId, targetDurationSeconds]);

  // Control Ambient Background Audio based on Timer Status & Selected Sound
  useEffect(() => {
    if (status === 'running' && activeSound !== 'mute') {
      ambientSoundEngine.setTrack(activeSound, true);
    } else {
      ambientSoundEngine.pause();
    }
  }, [status, activeSound]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      ambientSoundEngine.stop();
    };
  }, []);

  const handleSelectSound = (soundId: AmbientSound['id']) => {
    setActiveSound(soundId);
    if (status === 'running') {
      ambientSoundEngine.setTrack(soundId, true);
    } else {
      ambientSoundEngine.setTrack(soundId, false);
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/explore' as never);
    }
  };

  const handleApplyPreset = (minutes: number) => {
    if (mode === 'focus') {
      updateSettings({ focusDuration: minutes });
    } else if (mode === 'short_break') {
      updateSettings({ shortBreakDuration: minutes });
    } else {
      updateSettings({ longBreakDuration: minutes });
    }
  };

  const handleSaveCustomMinutes = () => {
    const clamped = Math.max(1, Math.min(90, Math.round(customInputMins)));
    if (mode === 'focus') {
      updateSettings({ focusDuration: clamped });
    } else if (mode === 'short_break') {
      updateSettings({ shortBreakDuration: Math.min(30, clamped) });
    } else {
      updateSettings({ longBreakDuration: Math.min(60, clamped) });
    }
    setIsCustomModalOpen(false);
  };

  // Active duration label based on current mode
  const currentDurationMinutes = useMemo(() => {
    if (mode === 'short_break') return settings.shortBreakDuration;
    if (mode === 'long_break') return settings.longBreakDuration;
    return settings.focusDuration;
  }, [mode, settings]);

  // Selected ambient sound metadata
  const currentSoundMeta = useMemo(() => {
    return AMBIENT_SOUNDS.find((s) => s.id === activeSound) || AMBIENT_SOUNDS[0];
  }, [activeSound]);

  return (
    <ScreenWrapper
      scrollable
      includeTopInset
      includeBottomInset
      includeTabInset={false}
      contentContainerStyle={styles.container}>
      {/* Top Navigation Bar */}
      <View style={styles.topBar}>
        <Pressable
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Go back to Study Hub"
          accessibilityHint="Returns to the Study Hub explore tab"
          style={({ pressed }) => [
            styles.iconButton,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.borderSubtle,
              opacity: pressed ? 0.75 : 1,
            },
          ]}>
          <Text style={[styles.backArrow, { color: theme.brandPrimary }]}>←</Text>
        </Pressable>

        <View style={styles.titleContainer}>
          <ThemedText
            type="smallBold"
            style={{ color: theme.brandPrimary, letterSpacing: 0.8 }}>
            POMODORO TECHNIQUE
          </ThemedText>
          <ThemedText type="headlineLarge" style={styles.screenTitle}>
            Focus Timer
          </ThemedText>
        </View>

        <View style={styles.headerRightActions}>
          {/* Zen Fullscreen Mode Toggle */}
          <Pressable
            onPress={() => setIsZenMode((prev) => !prev)}
            accessibilityRole="button"
            accessibilityLabel="Toggle Zen Focus Mode"
            style={[
              styles.zenButton,
              isZenMode && styles.zenButtonActive,
            ]}>
            <Text style={styles.zenButtonIcon}>{isZenMode ? '🧘' : '👁️'}</Text>
            <Text style={[styles.zenButtonText, isZenMode && styles.zenButtonTextActive]}>
              {isZenMode ? 'Zen' : 'Zen'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setIsSettingsOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Timer Settings"
            accessibilityHint="Configure focus and break interval durations"
            style={({ pressed }) => [
              styles.iconButton,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.borderSubtle,
                opacity: pressed ? 0.75 : 1,
              },
            ]}>
            <Text style={styles.settingsIcon}>⚙️</Text>
          </Pressable>
        </View>
      </View>

      {/* Linked Task or Study Routine Banner */}
      {taskTitle || subject ? (
        <View
          style={[
            styles.linkedGoalBanner,
            {
              borderLeftColor: subjectColor || theme.brandPrimary,
              backgroundColor: theme.surfaceSubtle,
            },
          ]}>
          <Text style={{ fontSize: 20 }}>🎯</Text>
          <View style={{ flex: 1 }}>
            <View style={styles.linkedBadgeRow}>
              <Text style={[styles.linkedBadgeText, { color: subjectColor || theme.brandPrimary }]}>
                {subject ? `${subject.toUpperCase()} • ` : ''}FOCUS GOAL
              </Text>
              <View style={styles.linkedTargetChip}>
                <Text style={styles.linkedTargetChipText}>
                  {currentDurationMinutes}m Routine Target
                </Text>
              </View>
            </View>
            <Text
              numberOfLines={1}
              style={[styles.linkedGoalTitle, { color: theme.text }]}>
              {taskTitle || 'Academic Deep Work'}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Quick Duration Preset Selector Strip (User Requested Custom Flexibility!) */}
      {!isZenMode ? (
        <View style={styles.presetSection}>
          <View style={styles.presetHeaderRow}>
            <Text style={styles.presetSectionLabel}>
              {mode === 'focus'
                ? '⚡ FOCUS SESSION DURATION'
                : mode === 'short_break'
                ? '☕ SHORT BREAK DURATION'
                : '🏖️ LONG BREAK DURATION'}
            </Text>
            <TouchableOpacity
              onPress={() => setIsCustomModalOpen(true)}
              hitSlop={6}
              accessibilityLabel="Enter custom duration">
              <Text style={styles.customPresetLink}>+ Custom Time</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.presetScrollContent}>
            {(mode === 'focus'
              ? FOCUS_PRESETS
              : mode === 'short_break'
              ? SHORT_BREAK_PRESETS
              : LONG_BREAK_PRESETS
            ).map((mins) => {
              const isSelected = currentDurationMinutes === mins;
              return (
                <TouchableOpacity
                  key={mins}
                  onPress={() => handleApplyPreset(mins)}
                  style={[
                    styles.presetChip,
                    isSelected && styles.presetChipActive,
                    {
                      borderColor: isSelected
                        ? mode === 'focus'
                          ? '#06B6D4'
                          : theme.statusSuccess
                        : 'rgba(255, 255, 255, 0.1)',
                    },
                  ]}>
                  <Text
                    style={[
                      styles.presetChipText,
                      isSelected && styles.presetChipTextActive,
                    ]}>
                    {mins}m
                  </Text>
                  {isSelected ? <View style={styles.presetActiveDot} /> : null}
                </TouchableOpacity>
              );
            })}

            {/* Custom Minutes Quick Pill */}
            <TouchableOpacity
              onPress={() => setIsCustomModalOpen(true)}
              style={[
                styles.presetChip,
                styles.presetChipCustom,
                !FOCUS_PRESETS.includes(currentDurationMinutes as any) &&
                  styles.presetChipActive,
              ]}>
              <Text
                style={[
                  styles.presetChipText,
                  styles.presetChipCustomText,
                  !FOCUS_PRESETS.includes(currentDurationMinutes as any) &&
                    styles.presetChipTextActive,
                ]}>
                {!FOCUS_PRESETS.includes(currentDurationMinutes as any)
                  ? `${currentDurationMinutes}m (Custom)`
                  : '⚡ Custom...'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      ) : null}

      {/* Center Circular Progress Ring */}
      <PomodoroTimerRing
        mode={mode}
        status={status}
        remainingSeconds={remainingSeconds}
        targetDurationSeconds={targetDurationSeconds}
        progress={progress}
        currentCycle={currentCycle}
        totalCycleCount={settings.longBreakInterval}
      />

      {/* Quick Fine-Tune Steppers (-5m / +5m) */}
      <View style={styles.stepperContainer}>
        <TouchableOpacity
          onPress={() => adjustTime(-300)}
          style={styles.stepperBtn}
          accessibilityLabel="Subtract 5 minutes">
          <Text style={styles.stepperBtnText}>- 5m</Text>
        </TouchableOpacity>

        <View style={styles.stepperCenterPill}>
          <Text style={styles.stepperCenterLabel}>
            {status === 'running' ? 'Active Focus' : 'Quick Adjust'}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => adjustTime(300)}
          style={styles.stepperBtn}
          accessibilityLabel="Add 5 minutes">
          <Text style={styles.stepperBtnText}>+ 5m</Text>
        </TouchableOpacity>
      </View>

      {/* Ambient Audio Atmosphere Studio */}
      {!isZenMode ? (
        <View style={styles.ambientStudioCard}>
          <View style={styles.ambientHeaderRow}>
            <View style={styles.ambientTitleWrap}>
              <Text style={styles.ambientIcon}>{currentSoundMeta.icon}</Text>
              <View>
                <Text style={styles.ambientTitleText}>AMBIENT STUDY SOUNDS</Text>
                <Text style={styles.ambientSubtitleText}>
                  {activeSound === 'mute'
                    ? 'Silent concentration'
                    : `${currentSoundMeta.name} • ${status === 'running' ? 'Active Playing' : 'Ready'}`}
                </Text>
              </View>
            </View>

            {/* Simulated Audio Equalizer Bars */}
            {activeSound !== 'mute' ? (
              <View style={styles.equalizerWrap}>
                <View
                  style={[
                    styles.equalizerBar,
                    styles.eqBar1,
                    status === 'running' && styles.eqBarAnimated1,
                  ]}
                />
                <View
                  style={[
                    styles.equalizerBar,
                    styles.eqBar2,
                    status === 'running' && styles.eqBarAnimated2,
                  ]}
                />
                <View
                  style={[
                    styles.equalizerBar,
                    styles.eqBar3,
                    status === 'running' && styles.eqBarAnimated3,
                  ]}
                />
                <View
                  style={[
                    styles.equalizerBar,
                    styles.eqBar4,
                    status === 'running' && styles.eqBarAnimated4,
                  ]}
                />
              </View>
            ) : null}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.ambientButtonsRow}>
            {AMBIENT_SOUNDS.map((snd) => {
              const isCurrent = activeSound === snd.id;
              return (
                <TouchableOpacity
                  key={snd.id}
                  onPress={() => handleSelectSound(snd.id)}
                  style={[
                    styles.soundChip,
                    isCurrent && styles.soundChipActive,
                  ]}>
                  <Text style={styles.soundChipIcon}>{snd.icon}</Text>
                  <Text
                    style={[
                      styles.soundChipText,
                      isCurrent && styles.soundChipTextActive,
                    ]}>
                    {snd.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ) : (
        /* Zen Motivational Quote */
        <View style={styles.zenQuoteContainer}>
          <Text style={styles.zenQuoteText}>
            "Deep concentration is the superpower of modern learning."
          </Text>
          <Text style={styles.zenQuoteAuthor}>— Cal Newport, Deep Work</Text>
        </View>
      )}

      {/* Control Buttons & Mode Selectors */}
      <PomodoroControls
        mode={mode}
        status={status}
        onStart={start}
        onPause={pause}
        onResume={resume}
        onReset={reset}
        onSkip={skip}
        onSwitchMode={switchMode}
      />

      {/* Session Statistics Card */}
      {!isZenMode ? (
        <PomodoroStatsCard
          stats={stats}
          currentCycle={currentCycle}
          totalCycleCount={settings.longBreakInterval}
        />
      ) : null}

      {/* Custom Duration Picker Modal */}
      <Modal
        visible={isCustomModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCustomModalOpen(false)}>
        <View style={styles.customModalBackdrop}>
          <View style={styles.customModalCard}>
            <View style={styles.customModalHeader}>
              <Text style={{ fontSize: 24 }}>⏱️</Text>
              <View style={{ flex: 1 }}>
                <ThemedText type="headlineMedium" style={styles.customModalTitle}>
                  Custom Focus Duration
                </ThemedText>
                <Text style={styles.customModalSubtitle}>
                  Set any focus period from 1 to 90 minutes.
                </Text>
              </View>
            </View>

            {/* Big Number Stepper */}
            <View style={styles.stepperDisplayRow}>
              <TouchableOpacity
                onPress={() => setCustomInputMins((prev) => Math.max(1, prev - 5))}
                style={styles.largeStepBtn}>
                <Text style={styles.largeStepBtnText}>- 5</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setCustomInputMins((prev) => Math.max(1, prev - 1))}
                style={styles.smallStepBtn}>
                <Text style={styles.smallStepBtnText}>- 1</Text>
              </TouchableOpacity>

              <View style={styles.stepperNumberBox}>
                <Text style={styles.stepperNumberVal}>{customInputMins}</Text>
                <Text style={styles.stepperNumberLabel}>MINUTES</Text>
              </View>

              <TouchableOpacity
                onPress={() => setCustomInputMins((prev) => Math.min(90, prev + 1))}
                style={styles.smallStepBtn}>
                <Text style={styles.smallStepBtnText}>+ 1</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setCustomInputMins((prev) => Math.min(90, prev + 5))}
                style={styles.largeStepBtn}>
                <Text style={styles.largeStepBtnText}>+ 5</Text>
              </TouchableOpacity>
            </View>

            {/* Quick shortcuts */}
            <View style={styles.shortcutsRow}>
              {[20, 35, 50, 60, 75, 90].map((quickM) => (
                <TouchableOpacity
                  key={quickM}
                  onPress={() => setCustomInputMins(quickM)}
                  style={[
                    styles.shortcutChip,
                    customInputMins === quickM && styles.shortcutChipActive,
                  ]}>
                  <Text
                    style={[
                      styles.shortcutChipText,
                      customInputMins === quickM && styles.shortcutChipTextActive,
                    ]}>
                    {quickM}m
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Actions */}
            <View style={styles.customModalActions}>
              <TouchableOpacity
                onPress={() => setIsCustomModalOpen(false)}
                style={styles.customModalCancelBtn}>
                <Text style={styles.customModalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSaveCustomMinutes}
                style={styles.customModalSaveBtn}>
                <Text style={styles.customModalSaveText}>Apply Duration</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Settings Modal */}
      <PomodoroSettingsModal
        visible={isSettingsOpen}
        settings={settings}
        onClose={() => setIsSettingsOpen(false)}
        onSave={updateSettings}
      />

      {/* Session Completion Celebration Modal */}
      <PomodoroCompletionModal
        visible={status === 'completed' && completedMode !== null}
        completedMode={completedMode}
        onDismiss={dismissCompletion}
        onStartNext={start}
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: Spacing.xl,
    gap: 14,
    alignItems: 'center',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: Spacing.xs,
  },
  titleContainer: {
    alignItems: 'center',
    gap: 2,
  },
  screenTitle: {
    letterSpacing: -0.3,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  zenButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  zenButtonActive: {
    backgroundColor: 'rgba(6, 182, 212, 0.22)',
    borderColor: '#06B6D4',
  },
  zenButtonIcon: {
    fontSize: 13,
  },
  zenButtonText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  zenButtonTextActive: {
    color: '#22D3EE',
  },
  iconButton: {
    minWidth: MinTouchTarget,
    minHeight: MinTouchTarget,
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backArrow: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 24,
  },
  settingsIcon: {
    fontSize: 22,
    lineHeight: 26,
  },

  // Linked Goal Banner
  linkedGoalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    width: '100%',
    gap: 12,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  linkedBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  linkedBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  linkedTargetChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  linkedTargetChipText: {
    color: '#E2E8F0',
    fontSize: 10,
    fontWeight: '700',
  },
  linkedGoalTitle: {
    fontSize: 14,
    fontWeight: '700',
  },

  // Preset Section
  presetSection: {
    width: '100%',
    gap: 8,
  },
  presetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  presetSectionLabel: {
    color: '#94A3B8',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  customPresetLink: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
  },
  presetScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.2,
  },
  presetChipActive: {
    backgroundColor: 'rgba(6, 182, 212, 0.2)',
  },
  presetChipText: {
    color: '#94A3B8',
    fontSize: 12.5,
    fontWeight: '700',
  },
  presetChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  presetActiveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#22D3EE',
  },
  presetChipCustom: {
    borderStyle: 'dashed',
  },
  presetChipCustomText: {
    color: '#38BDF8',
  },

  // Quick Stepper (-5m / +5m)
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: -4,
  },
  stepperBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
  },
  stepperBtnText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '800',
  },
  stepperCenterPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
  },
  stepperCenterLabel: {
    color: '#22D3EE',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Ambient Sound Studio
  ambientStudioCard: {
    width: '100%',
    backgroundColor: 'rgba(10, 16, 30, 0.95)',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 10,
  },
  ambientHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ambientTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ambientIcon: {
    fontSize: 22,
  },
  ambientTitleText: {
    color: '#67E8F9',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  ambientSubtitleText: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 1,
  },
  equalizerWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 18,
  },
  equalizerBar: {
    width: 3.5,
    backgroundColor: '#06B6D4',
    borderRadius: 2,
  },
  eqBar1: { height: 6 },
  eqBar2: { height: 14 },
  eqBar3: { height: 10 },
  eqBar4: { height: 16 },
  eqBarAnimated1: { height: 14 },
  eqBarAnimated2: { height: 8 },
  eqBarAnimated3: { height: 16 },
  eqBarAnimated4: { height: 11 },
  ambientButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  soundChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  soundChipActive: {
    backgroundColor: 'rgba(6, 182, 212, 0.2)',
    borderColor: '#06B6D4',
  },
  soundChipIcon: {
    fontSize: 13,
  },
  soundChipText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  soundChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  // Zen Mode Quote
  zenQuoteContainer: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 4,
  },
  zenQuoteText: {
    color: '#E2E8F0',
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 20,
  },
  zenQuoteAuthor: {
    color: '#06B6D4',
    fontSize: 11,
    fontWeight: '700',
  },

  // Custom Duration Modal
  customModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  customModalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#09101F',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(6, 182, 212, 0.4)',
    gap: 16,
  },
  customModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  customModalTitle: {
    color: '#F8FAFC',
    fontSize: 17,
  },
  customModalSubtitle: {
    color: '#94A3B8',
    fontSize: 11.5,
    marginTop: 2,
  },
  stepperDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  largeStepBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  largeStepBtnText: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '800',
  },
  smallStepBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  smallStepBtnText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
  },
  stepperNumberBox: {
    alignItems: 'center',
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    borderWidth: 1.5,
    borderColor: '#06B6D4',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
    minWidth: 95,
  },
  stepperNumberVal: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '900',
  },
  stepperNumberLabel: {
    color: '#67E8F9',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  shortcutsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  shortcutChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  shortcutChipActive: {
    backgroundColor: 'rgba(6, 182, 212, 0.25)',
    borderColor: '#06B6D4',
  },
  shortcutChipText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  shortcutChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  customModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 6,
  },
  customModalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  customModalCancelText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
  },
  customModalSaveBtn: {
    backgroundColor: '#0891B2',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
  },
  customModalSaveText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
