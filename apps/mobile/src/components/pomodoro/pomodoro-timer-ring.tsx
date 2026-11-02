import React, { useMemo } from 'react';
import {
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge } from '@/components/ui';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatTimeRemaining, PomodoroMode, PomodoroStatus } from '@/types/pomodoro';

export interface PomodoroTimerRingProps {
  mode: PomodoroMode;
  status: PomodoroStatus;
  remainingSeconds: number;
  targetDurationSeconds: number;
  progress: number;
  currentCycle: number;
  totalCycleCount?: number;
}

export function PomodoroTimerRing({
  mode,
  status,
  remainingSeconds,
  progress,
  currentCycle,
  totalCycleCount = 4,
}: PomodoroTimerRingProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();

  // Responsive ring diameter based on screen width
  const ringSize = useMemo(() => {
    return Math.min(Math.max(width - 80, 220), 280);
  }, [width]);

  const strokeWidth = 12;

  // Mode visual identities
  const modeConfig = useMemo(() => {
    switch (mode) {
      case 'short_break':
        return {
          title: 'SHORT BREAK',
          subtitle: 'Rest your eyes & hydrate',
          accentColor: theme.statusSuccess,
          badgeVariant: 'success' as const,
          trackColor: theme.badgeSuccessBackground,
        };
      case 'long_break':
        return {
          title: 'LONG BREAK',
          subtitle: 'Walk, stretch & recharge',
          accentColor: theme.statusInfo,
          badgeVariant: 'info' as const,
          trackColor: theme.badgeInfoBackground,
        };
      case 'focus':
      default:
        return {
          title: 'FOCUS SESSION',
          subtitle: 'Deep academic concentration',
          accentColor: theme.brandPrimary,
          badgeVariant: 'brand' as const,
          trackColor: theme.badgeBrandBackground,
        };
    }
  }, [mode, theme]);

  const formattedTime = formatTimeRemaining(remainingSeconds);
  const percentage = Math.round(progress * 100);

  // Rotation angles for two semicircles progress ring
  const firstHalfAngle = Math.min(180, progress * 360);
  const secondHalfAngle = Math.max(0, (progress - 0.5) * 360);

  return (
    <View style={styles.container}>
      {/* Outer Circular Ring */}
      <View
        style={[
          styles.ringOuter,
          {
            width: ringSize,
            height: ringSize,
            borderRadius: ringSize / 2,
          },
        ]}>
        {/* Background Track Circle */}
        <View
          style={[
            styles.baseCircle,
            {
              width: ringSize,
              height: ringSize,
              borderRadius: ringSize / 2,
              borderWidth: strokeWidth,
              borderColor: modeConfig.trackColor,
            },
          ]}
        />

        {/* Right Half Progress Semicircle (0% -> 50%) */}
        <View
          style={[
            styles.halfMask,
            {
              width: ringSize / 2,
              height: ringSize,
              left: ringSize / 2,
            },
          ]}>
          <View
            style={[
              styles.semiCircle,
              {
                width: ringSize,
                height: ringSize,
                borderRadius: ringSize / 2,
                borderWidth: strokeWidth,
                borderColor: modeConfig.accentColor,
                left: -ringSize / 2,
                transform: [{ rotate: `${firstHalfAngle - 180}deg` }],
              },
            ]}
          />
        </View>

        {/* Left Half Progress Semicircle (50% -> 100%) */}
        {progress > 0.5 ? (
          <View
            style={[
              styles.halfMask,
              {
                width: ringSize / 2,
                height: ringSize,
                left: 0,
              },
            ]}>
            <View
              style={[
                styles.semiCircle,
                {
                  width: ringSize,
                  height: ringSize,
                  borderRadius: ringSize / 2,
                  borderWidth: strokeWidth,
                  borderColor: modeConfig.accentColor,
                  left: 0,
                  transform: [{ rotate: `${secondHalfAngle - 180}deg` }],
                },
              ]}
            />
          </View>
        ) : null}

        {/* Center Content Surface */}
        <View
          style={[
            styles.ringInner,
            {
              width: ringSize - strokeWidth * 2 - 8,
              height: ringSize - strokeWidth * 2 - 8,
              borderRadius: (ringSize - strokeWidth * 2 - 8) / 2,
              backgroundColor: theme.cardBackground,
            },
          ]}>
          {/* Mode Pill Badge */}
          <Badge
            label={modeConfig.title}
            variant={modeConfig.badgeVariant}
            size="sm"
          />

          {/* Large Countdown Display */}
          <ThemedText
            type="headlineLarge"
            style={[
              styles.timeText,
              {
                color: status === 'paused' ? theme.statusWarning : theme.text,
              },
            ]}>
            {formattedTime}
          </ThemedText>

          {/* Status or Percentage */}
          <View style={styles.statusRow}>
            {status === 'paused' ? (
              <Badge label="PAUSED" variant="warning" size="sm" />
            ) : status === 'completed' ? (
              <Badge label="DONE" variant="success" size="sm" />
            ) : (
              <ThemedText
                type="bodySmall"
                style={{ color: theme.textSecondary, fontWeight: '600' }}>
                {percentage}% elapsed
              </ThemedText>
            )}
          </View>

          {/* Session Cycle Dots (e.g. Session 2 of 4) */}
          <View style={styles.cycleDotsRow}>
            {Array.from({ length: totalCycleCount }, (_, idx) => {
              const cycleNum = idx + 1;
              const isCompleted = cycleNum < currentCycle;
              const isActive = cycleNum === currentCycle;

              return (
                <View
                  key={cycleNum}
                  style={[
                    styles.cycleDot,
                    {
                      backgroundColor: isCompleted
                        ? modeConfig.accentColor
                        : isActive
                          ? modeConfig.accentColor
                          : theme.borderSubtle,
                      opacity: isActive ? 1 : isCompleted ? 0.8 : 0.4,
                      transform: [{ scale: isActive ? 1.25 : 1 }],
                    },
                  ]}
                />
              );
            })}
          </View>

          <ThemedText
            type="bodySmall"
            style={[styles.subtitleText, { color: theme.textTertiary }]}>
            Session {currentCycle} of {totalCycleCount}
          </ThemedText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: Spacing.md,
  },
  ringOuter: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  baseCircle: {
    position: 'absolute',
  },
  halfMask: {
    position: 'absolute',
    top: 0,
    overflow: 'hidden',
  },
  semiCircle: {
    position: 'absolute',
    top: 0,
  },
  ringInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  timeText: {
    fontSize: 44,
    lineHeight: 52,
    fontWeight: '800',
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
    marginVertical: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 22,
  },
  cycleDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  cycleDot: {
    width: 8,
    height: 8,
    borderRadius: BorderRadius.full,
  },
  subtitleText: {
    fontSize: 12,
    marginTop: 2,
  },
});
