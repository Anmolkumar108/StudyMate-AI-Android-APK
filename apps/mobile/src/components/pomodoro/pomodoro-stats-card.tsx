import React, { useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { PomodoroStats } from '@/types/pomodoro';

export interface PomodoroStatsCardProps {
  stats: PomodoroStats;
  currentCycle: number;
  totalCycleCount?: number;
}

export function PomodoroStatsCard({
  stats,
  currentCycle,
  totalCycleCount = 4,
}: PomodoroStatsCardProps) {
  const theme = useTheme();

  // Convert minutes into human readable hours + mins
  const formattedFocusTime = useMemo(() => {
    const mins = stats.totalFocusMinutes;
    if (mins < 60) {
      return `${mins}m`;
    }
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
  }, [stats.totalFocusMinutes]);

  return (
    <Card variant="default" style={styles.card}>
      <View style={styles.headerRow}>
        <ThemedText type="smallBold" style={{ color: theme.brandPrimary, letterSpacing: 0.5 }}>
          STUDY METRICS & SESSIONS
        </ThemedText>
        <ThemedText type="bodySmall" style={{ color: theme.textSecondary }}>
          Local Tracking
        </ThemedText>
      </View>

      <View style={styles.grid}>
        {/* Metric 1: Today's Sessions */}
        <View
          style={[
            styles.metricBox,
            {
              backgroundColor: theme.badgeBrandBackground,
              borderColor: theme.borderSubtle,
            },
          ]}>
          <Text style={styles.metricIcon}>🎯</Text>
          <ThemedText type="headlineMedium" style={styles.metricValue}>
            {stats.todayCompletedSessions}
          </ThemedText>
          <ThemedText type="bodySmall" style={{ color: theme.textSecondary }}>
            Today
          </ThemedText>
        </View>

        {/* Metric 2: Total Focus Time */}
        <View
          style={[
            styles.metricBox,
            {
              backgroundColor: theme.badgeSuccessBackground,
              borderColor: theme.borderSubtle,
            },
          ]}>
          <Text style={styles.metricIcon}>⏱️</Text>
          <ThemedText type="headlineMedium" style={styles.metricValue}>
            {formattedFocusTime}
          </ThemedText>
          <ThemedText type="bodySmall" style={{ color: theme.textSecondary }}>
            Total Focus
          </ThemedText>
        </View>

        {/* Metric 3: Current Cycle */}
        <View
          style={[
            styles.metricBox,
            {
              backgroundColor: theme.badgeNeutralBackground,
              borderColor: theme.borderSubtle,
            },
          ]}>
          <Text style={styles.metricIcon}>🔄</Text>
          <ThemedText type="headlineMedium" style={styles.metricValue}>
            {currentCycle}/{totalCycleCount}
          </ThemedText>
          <ThemedText type="bodySmall" style={{ color: theme.textSecondary }}>
            Cycle Progress
          </ThemedText>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.cardPadding,
    gap: Spacing.sm,
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  grid: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  metricBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: 4,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: 2,
  },
  metricIcon: {
    fontSize: 16,
  },
  metricValue: {
    fontWeight: '700',
    fontSize: 18,
    lineHeight: 22,
  },
});
