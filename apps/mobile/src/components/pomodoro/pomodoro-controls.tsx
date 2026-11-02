import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui';
import { BorderRadius, MinTouchTarget, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { PomodoroMode, PomodoroStatus } from '@/types/pomodoro';

export interface PomodoroControlsProps {
  mode: PomodoroMode;
  status: PomodoroStatus;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  onSkip: () => void;
  onSwitchMode: (mode: PomodoroMode) => void;
}

export function PomodoroControls({
  mode,
  status,
  onStart,
  onPause,
  onResume,
  onReset,
  onSkip,
  onSwitchMode,
}: PomodoroControlsProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      {/* Mode Switcher Pills (when idle or paused) */}
      <View style={styles.modePillRow}>
        <Pressable
          onPress={() => onSwitchMode('focus')}
          accessibilityRole="button"
          accessibilityLabel="Switch to Focus Session"
          style={({ pressed }) => [
            styles.modePill,
            {
              backgroundColor:
                mode === 'focus'
                  ? theme.badgeBrandBackground
                  : theme.cardBackground,
              borderColor:
                mode === 'focus' ? theme.brandPrimary : theme.borderSubtle,
              opacity: pressed ? 0.75 : 1,
            },
          ]}>
          <ThemedText
            type="small"
            style={{
              color: mode === 'focus' ? theme.brandPrimary : theme.textSecondary,
              fontWeight: mode === 'focus' ? '700' : '500',
            }}>
            Focus
          </ThemedText>
        </Pressable>

        <Pressable
          onPress={() => onSwitchMode('short_break')}
          accessibilityRole="button"
          accessibilityLabel="Switch to Short Break"
          style={({ pressed }) => [
            styles.modePill,
            {
              backgroundColor:
                mode === 'short_break'
                  ? theme.badgeSuccessBackground
                  : theme.cardBackground,
              borderColor:
                mode === 'short_break' ? theme.statusSuccess : theme.borderSubtle,
              opacity: pressed ? 0.75 : 1,
            },
          ]}>
          <ThemedText
            type="small"
            style={{
              color:
                mode === 'short_break'
                  ? theme.statusSuccess
                  : theme.textSecondary,
              fontWeight: mode === 'short_break' ? '700' : '500',
            }}>
            Short Break
          </ThemedText>
        </Pressable>

        <Pressable
          onPress={() => onSwitchMode('long_break')}
          accessibilityRole="button"
          accessibilityLabel="Switch to Long Break"
          style={({ pressed }) => [
            styles.modePill,
            {
              backgroundColor:
                mode === 'long_break'
                  ? theme.badgeInfoBackground
                  : theme.cardBackground,
              borderColor:
                mode === 'long_break' ? theme.statusInfo : theme.borderSubtle,
              opacity: pressed ? 0.75 : 1,
            },
          ]}>
          <ThemedText
            type="small"
            style={{
              color: mode === 'long_break' ? theme.statusInfo : theme.textSecondary,
              fontWeight: mode === 'long_break' ? '700' : '500',
            }}>
            Long Break
          </ThemedText>
        </Pressable>
      </View>

      {/* Primary Action Buttons */}
      <View style={styles.actionsContainer}>
        {status === 'idle' ? (
          <Button
            title={mode === 'focus' ? 'Start Focus' : 'Start Break'}
            variant="primary"
            size="lg"
            fullWidth
            onPress={onStart}
            accessibilityLabel={
              mode === 'focus' ? 'Start Focus Session' : 'Start Break'
            }
          />
        ) : status === 'running' ? (
          <View style={styles.runningActionRow}>
            <Button
              title="Pause"
              variant="secondary"
              size="lg"
              onPress={onPause}
              style={{ flex: 2 }}
              accessibilityLabel="Pause Timer"
            />
            <Button
              title="Skip"
              variant="ghost"
              size="lg"
              onPress={onSkip}
              style={{ flex: 1 }}
              accessibilityLabel="Skip Session"
            />
          </View>
        ) : status === 'paused' ? (
          <View style={styles.pausedActionRow}>
            <Button
              title="Resume"
              variant="primary"
              size="lg"
              onPress={onResume}
              style={{ flex: 2 }}
              accessibilityLabel="Resume Timer"
            />
            <Button
              title="Reset"
              variant="secondary"
              size="lg"
              onPress={onReset}
              style={{ flex: 1.2 }}
              accessibilityLabel="Reset Timer"
            />
            <Button
              title="Skip"
              variant="ghost"
              size="lg"
              onPress={onSkip}
              style={{ flex: 1 }}
              accessibilityLabel="Skip Session"
            />
          </View>
        ) : (
          /* Completed state */
          <Button
            title="Start Next Session"
            variant="primary"
            size="lg"
            fullWidth
            onPress={onStart}
            accessibilityLabel="Start Next Session"
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.md,
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: Spacing.sm,
  },
  modePillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    width: '100%',
  },
  modePill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    minHeight: MinTouchTarget,
  },
  actionsContainer: {
    width: '100%',
  },
  runningActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    width: '100%',
  },
  pausedActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    width: '100%',
  },
});
