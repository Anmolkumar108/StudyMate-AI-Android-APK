import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
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
import { taskApi } from '@/services/api/client';

export default function PomodoroScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { taskId, taskTitle } = useLocalSearchParams<{ taskId?: string; taskTitle?: string }>();

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
  } = usePomodoro();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Automatically log focus minutes to task when a focus session completes
  useEffect(() => {
    if (status === 'completed' && completedMode === 'focus' && taskId) {
      const focusMins = Math.max(1, Math.round(targetDurationSeconds / 60));
      taskApi.logFocus(taskId, focusMins, 1).catch(() => {});
    }
  }, [status, completedMode, taskId, targetDurationSeconds]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/explore' as never);
    }
  };

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

      {/* Linked Task Banner */}
      {taskTitle ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.surfaceSubtle,
            borderColor: theme.brandPrimary + '40',
            borderWidth: 1,
            borderRadius: BorderRadius.md,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.xs,
            width: '100%',
            gap: Spacing.xs,
          }}>
          <Text style={{ fontSize: 16 }}>🎯</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: theme.brandPrimary }}>
              FOCUSED TASK
            </Text>
            <Text
              numberOfLines={1}
              style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>
              {taskTitle}
            </Text>
          </View>
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
      <PomodoroStatsCard
        stats={stats}
        currentCycle={currentCycle}
        totalCycleCount={settings.longBreakInterval}
      />

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
    gap: Spacing.lg,
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
});
