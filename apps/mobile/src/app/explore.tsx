import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge, Button, Card, ScreenWrapper } from '@/components/ui';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { loadPomodoroSettings } from '@/services/storage/pomodoro-storage';
import {
  DEFAULT_POMODORO_SETTINGS,
  formatTimeRemaining,
  PomodoroSettings,
} from '@/types/pomodoro';

/**
 * Study Hub Screen
 * Provides functional entry point to the Pomodoro Focus Timer and honest
 * preview entry point for upcoming Active Recall & Flashcards feature.
 * Fully responsive across all Android screen sizes and orientations.
 */
export default function StudyHubScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [settings, setSettings] = useState<PomodoroSettings>(DEFAULT_POMODORO_SETTINGS);

  // Synchronize configured timer durations whenever Study Hub is focused
  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      loadPomodoroSettings()
        .then((loaded) => {
          if (isMounted) {
            setSettings(loaded);
          }
        })
        .catch(() => {});

      return () => {
        isMounted = false;
      };
    }, [])
  );

  return (
    <ScreenWrapper
      scrollable
      includeTopInset
      includeBottomInset
      includeTabInset
      contentContainerStyle={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Badge
          label="STUDY TOOLS & ACCELERATORS"
          variant="brand"
          size="sm"
        />
        <ThemedText type="headlineLarge" style={styles.title}>
          Study Hub
        </ThemedText>
        <ThemedText type="bodyMedium" style={{ color: theme.textSecondary }}>
          Your space to learn, focus and grow.
        </ThemedText>
      </View>

      {/* Focus Timer Card (Active Tool) */}
      <Card
        variant="default"
        onPress={() => router.push('/pomodoro' as never)}
        accessibilityLabel="Open Pomodoro Focus Timer"
        accessibilityHint="Navigates to the full Pomodoro Focus Timer workspace"
        style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardHeaderLeft}>
            <Text style={styles.cardHeaderIcon}>⏱️</Text>
            <ThemedText type="headlineMedium" style={styles.cardTitle}>
              Focus Timer
            </ThemedText>
          </View>
          <Badge label="Active Tool" variant="success" size="sm" />
        </View>

        {/* Live Configured Timer Preview Box */}
        <View
          style={[
            styles.previewBox,
            { backgroundColor: theme.inputBackground, borderColor: theme.borderSubtle },
          ]}>
          <Text style={[styles.timerDisplay, { color: theme.brandPrimary }]}>
            {formatTimeRemaining(settings.focusDuration * 60)}
          </Text>
          <ThemedText
            type="bodySmall"
            style={{ color: theme.textSecondary, textAlign: 'center' }}>
            Academic Interval Timer ({settings.focusDuration}m Focus • {settings.shortBreakDuration}m Short Break • {settings.longBreakDuration}m Long Break)
          </ThemedText>

          <View style={styles.intervalPillRow}>
            <View
              style={[
                styles.intervalPill,
                { backgroundColor: theme.cardBackground, borderColor: theme.borderSubtle },
              ]}>
              <ThemedText type="small" style={{ color: theme.text }}>
                {settings.focusDuration}m Focus
              </ThemedText>
            </View>
            <View
              style={[
                styles.intervalPill,
                { backgroundColor: theme.cardBackground, borderColor: theme.borderSubtle },
              ]}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {settings.shortBreakDuration}m Short Break
              </ThemedText>
            </View>
            <View
              style={[
                styles.intervalPill,
                { backgroundColor: theme.cardBackground, borderColor: theme.borderSubtle },
              ]}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {settings.longBreakDuration}m Long Break
              </ThemedText>
            </View>
            <View
              style={[
                styles.intervalPill,
                { backgroundColor: theme.cardBackground, borderColor: theme.borderSubtle },
              ]}>
              <ThemedText type="small" style={{ color: theme.brandPrimary }}>
                {settings.longBreakInterval} Cycles
              </ThemedText>
            </View>
          </View>
        </View>

        <ThemedText type="bodyMedium" style={{ color: theme.textSecondary }}>
          Timebox your study into deliberate, distraction-free sessions to reduce
          cognitive fatigue and sustain long study periods. Fully customizable with automated
          break cycles and local session tracking.
        </ThemedText>

        <Button
          title="Open Focus Timer →"
          variant="primary"
          size="md"
          onPress={() => router.push('/pomodoro' as never)}
          accessibilityLabel="Launch Focus Timer"
          style={{ marginTop: Spacing.xs }}
        />
      </Card>

      {/* Active Recall & Flashcards Card (Working Entry Point) */}
      <Card
        variant="default"
        onPress={() => router.push('/flashcards' as never)}
        accessibilityLabel="Open Active Recall & Flashcards"
        accessibilityHint="Navigates to your flashcard decks and study mode"
        style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardHeaderLeft}>
            <Text style={styles.cardHeaderIcon}>🎴</Text>
            <ThemedText type="headlineMedium" style={styles.cardTitle}>
              Active Recall & Flashcards
            </ThemedText>
          </View>
          <Badge label="Active Tool" variant="success" size="sm" />
        </View>

        <ThemedText type="bodyMedium" style={{ color: theme.textSecondary }}>
          Master course definitions, core formulas, and key concepts using interactive
          flip-card recall sessions organized by subject.
        </ThemedText>

        <Button
          title="Open Flashcards →"
          variant="primary"
          size="md"
          onPress={() => router.push('/flashcards' as never)}
          accessibilityLabel="Launch Flashcards"
          style={{ marginTop: Spacing.xs }}
        />
      </Card>

      {/* AI Study Tutor Card */}
      <Card
        variant="default"
        onPress={() => router.push('/ai-chat' as never)}
        accessibilityLabel="Open AI Study Tutor"
        accessibilityHint="Navigates to 24/7 AI Tutor chat with Socratic learning"
        style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardHeaderLeft}>
            <Text style={styles.cardHeaderIcon}>🤖</Text>
            <ThemedText type="headlineMedium" style={styles.cardTitle}>
              AI Study Tutor
            </ThemedText>
          </View>
          <Badge label="AI Powered" variant="brand" size="sm" />
        </View>

        <ThemedText type="bodyMedium" style={{ color: theme.textSecondary }}>
          24/7 conversational tutor. Ask questions, get Feynman ELI5 explanations, or toggle Socratic mode for guided problem-solving.
        </ThemedText>

        <Button
          title="Chat with AI Tutor →"
          variant="primary"
          size="md"
          onPress={() => router.push('/ai-chat' as never)}
          accessibilityLabel="Launch AI Tutor"
          style={{ marginTop: Spacing.xs }}
        />
      </Card>

      {/* Course Documents & PDF Ingestion Card */}
      <Card
        variant="default"
        onPress={() => router.push('/documents' as never)}
        accessibilityLabel="Open Course Documents"
        accessibilityHint="View uploaded PDFs and AI lecture summaries"
        style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardHeaderLeft}>
            <Text style={styles.cardHeaderIcon}>📑</Text>
            <ThemedText type="headlineMedium" style={styles.cardTitle}>
              Course Documents & PDFs
            </ThemedText>
          </View>
          <Badge label="AI Powered" variant="brand" size="sm" />
        </View>

        <ThemedText type="bodyMedium" style={{ color: theme.textSecondary }}>
          Manage lecture slides and textbooks. Instant AI-generated Cornell summaries and key formulas for exam review.
        </ThemedText>

        <Button
          title="View Documents →"
          variant="secondary"
          size="md"
          onPress={() => router.push('/documents' as never)}
          accessibilityLabel="Launch Documents"
          style={{ marginTop: Spacing.xs }}
        />
      </Card>

      {/* AI Quiz Hub Card */}
      <Card
        variant="default"
        onPress={() => router.push('/quizzes' as never)}
        accessibilityLabel="Open AI Quiz Hub"
        accessibilityHint="Test your knowledge with AI generated quizzes and spaced recall"
        style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardHeaderLeft}>
            <Text style={styles.cardHeaderIcon}>🎯</Text>
            <ThemedText type="headlineMedium" style={styles.cardTitle}>
              AI Quiz Hub & Exam Prep
            </ThemedText>
          </View>
          <Badge label="AI Powered" variant="brand" size="sm" />
        </View>

        <ThemedText type="bodyMedium" style={{ color: theme.textSecondary }}>
          Generate customized practice quizzes by topic or notes. Instant scoring, detailed explanations, and 1-tap conversion of missed questions into flashcards.
        </ThemedText>

        <Button
          title="Take a Quiz →"
          variant="primary"
          size="md"
          onPress={() => router.push('/quizzes' as never)}
          accessibilityLabel="Launch AI Quiz Hub"
          style={{ marginTop: Spacing.xs }}
        />
      </Card>

      {/* Tasks & Assignments Card */}
      <Card
        variant="default"
        onPress={() => router.push('/tasks' as never)}
        accessibilityLabel="Open Tasks & Deadlines"
        accessibilityHint="Track your assignments, homework, and checklists"
        style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardHeaderLeft}>
            <Text style={styles.cardHeaderIcon}>📋</Text>
            <ThemedText type="headlineMedium" style={styles.cardTitle}>
              Tasks & Deadlines
            </ThemedText>
          </View>
          <Badge label="Active" variant="success" size="sm" />
        </View>

        <ThemedText type="bodyMedium" style={{ color: theme.textSecondary }}>
          Track coursework, homework deadlines, and subtask checklists. Automatic overdue alerts and 1-tap completion.
        </ThemedText>

        <Button
          title="Manage Tasks →"
          variant="secondary"
          size="md"
          onPress={() => router.push('/tasks' as never)}
          accessibilityLabel="Launch Tasks & Deadlines"
          style={{ marginTop: Spacing.xs }}
        />
      </Card>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: Spacing.xl,
  },
  header: {
    gap: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  title: {
    marginTop: Spacing.xs,
  },
  card: {
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  cardHeaderIcon: {
    fontSize: 22,
  },
  cardTitle: {
    flexShrink: 1,
  },
  previewBox: {
    padding: Spacing.cardPadding,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  timerDisplay: {
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
  intervalPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  intervalPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  comingSoonBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.md,
  },
  comingSoonIcon: {
    fontSize: 24,
  },
  comingSoonTextContainer: {
    flex: 1,
    gap: 2,
  },
});
