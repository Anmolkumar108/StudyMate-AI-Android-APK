import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge, Button, Card, EmptyState, ScreenWrapper } from '@/components/ui';
import { BorderRadius, MinTouchTarget, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useNotes } from '@/hooks/use-notes';
import { useSubjects } from '@/hooks/use-subjects';
import { useTheme } from '@/hooks/use-theme';

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const theme = useTheme();

  // Real backend data sources
  const {
    subjects,
    isLoading: isLoadingSubjects,
    error: subjectsError,
    fetchSubjects,
  } = useSubjects();

  const {
    notes,
    isLoading: isLoadingNotes,
    error: notesError,
    fetchNotes,
  } = useNotes();

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.allSettled([
        fetchSubjects(true),
        fetchNotes(undefined, true),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  // User display helpers
  const displayName = user?.full_name?.trim() || 'Student';
  const firstName = displayName.split(/\s+/)[0] || 'Student';
  const displayEmail = user?.email || 'student@studymate.ai';
  const studyGoal = user?.daily_study_goal_minutes ?? 60;
  const roleName = (user?.role || 'student').toUpperCase();

  const userInitials = useMemo(() => {
    const parts = displayName.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'S';
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [displayName]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  // Lookup map for notes' subject associations
  const subjectsMap = useMemo(() => {
    const map = new Map<string, { name: string; color: string | null }>();
    subjects.forEach((s) => {
      map.set(s.id, { name: s.name, color: s.color });
    });
    return map;
  }, [subjects]);

  // Real statistics
  const totalSubjectsCount = subjects.length;
  const totalNotesCount = notes.length;
  const pinnedNotesCount = notes.filter((n) => n.is_pinned).length;

  // Previews
  const recentSubjects = useMemo(() => subjects.slice(0, 3), [subjects]);
  const recentNotes = useMemo(() => notes.slice(0, 3), [notes]);

  return (
    <ScreenWrapper
      scrollable
      includeTopInset
      includeBottomInset
      includeTabInset
      refreshing={isRefreshing}
      onRefresh={handleRefresh}
      contentContainerStyle={styles.container}>
      {/* SECTION A: Welcome Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerTextGroup}>
          <View style={styles.tagRow}>
            <Badge label="STUDYMATE AI" variant="brand" size="sm" />
            <Badge
              label={user?.status === 'active' ? 'Active' : 'Unverified'}
              variant={user?.status === 'active' ? 'success' : 'warning'}
              size="sm"
            />
          </View>
          <ThemedText type="headlineLarge" style={styles.welcomeTitle}>
            {greeting}, {firstName}
          </ThemedText>
          <ThemedText type="bodyMedium" style={{ color: theme.textSecondary }}>
            {displayEmail}
          </ThemedText>
        </View>

        {/* Header Right Actions: Settings Button & Profile Avatar */}
        <View style={styles.headerRightActions}>
          <Pressable
            onPress={() => router.push('/settings' as never)}
            accessibilityRole="button"
            accessibilityLabel="Settings"
            accessibilityHint="Navigates to application settings and session management"
            style={({ pressed }) => [
              styles.settingsButton,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.borderSubtle,
                opacity: pressed ? 0.75 : 1,
              },
            ]}>
            <Text style={styles.settingsIcon}>⚙️</Text>
          </Pressable>

          <View
            style={[
              styles.avatarCircle,
              {
                backgroundColor: theme.badgeBrandBackground,
                borderColor: theme.borderFocus,
              },
            ]}>
            <Text style={[styles.avatarText, { color: theme.brandPrimary }]}>
              {userInitials}
            </Text>
          </View>
        </View>
      </View>

      {/* SECTION B: Study Overview (Real Metrics Only) */}
      <View style={styles.metricsGrid}>
        {/* Metric 1: Subjects */}
        <Card variant="default" style={styles.metricCard}>
          <View style={styles.metricHeader}>
            <View
              style={[
                styles.metricIconBox,
                { backgroundColor: theme.badgeBrandBackground },
              ]}>
              <Text style={styles.metricIcon}>📚</Text>
            </View>
            <ThemedText type="bodySmall" style={{ color: theme.textSecondary }}>
              Courses
            </ThemedText>
          </View>
          {isLoadingSubjects && !isRefreshing ? (
            <ActivityIndicator size="small" color={theme.brandPrimary} />
          ) : (
            <ThemedText type="headlineLarge" style={styles.metricValue}>
              {totalSubjectsCount}
            </ThemedText>
          )}
          <ThemedText type="bodySmall" style={{ color: theme.textTertiary }}>
            Enrolled subjects
          </ThemedText>
        </Card>

        {/* Metric 2: Notes */}
        <Card variant="default" style={styles.metricCard}>
          <View style={styles.metricHeader}>
            <View
              style={[
                styles.metricIconBox,
                { backgroundColor: theme.badgeSuccessBackground },
              ]}>
              <Text style={styles.metricIcon}>📝</Text>
            </View>
            <ThemedText type="bodySmall" style={{ color: theme.textSecondary }}>
              Notes
            </ThemedText>
          </View>
          {isLoadingNotes && !isRefreshing ? (
            <ActivityIndicator size="small" color={theme.brandPrimary} />
          ) : (
            <ThemedText type="headlineLarge" style={styles.metricValue}>
              {totalNotesCount}
            </ThemedText>
          )}
          <ThemedText type="bodySmall" style={{ color: theme.textTertiary }}>
            {pinnedNotesCount} pinned to top
          </ThemedText>
        </Card>

        {/* Metric 3: Daily Target */}
        <Card variant="default" style={styles.metricCard}>
          <View style={styles.metricHeader}>
            <View
              style={[
                styles.metricIconBox,
                { backgroundColor: theme.badgeWarningBackground },
              ]}>
              <Text style={styles.metricIcon}>🎯</Text>
            </View>
            <ThemedText type="bodySmall" style={{ color: theme.textSecondary }}>
              Target
            </ThemedText>
          </View>
          <ThemedText type="headlineLarge" style={styles.metricValue}>
            {studyGoal}m
          </ThemedText>
          <ThemedText type="bodySmall" style={{ color: theme.textTertiary }}>
            Daily study goal
          </ThemedText>
        </Card>

        {/* Metric 4: Role */}
        <Card variant="default" style={styles.metricCard}>
          <View style={styles.metricHeader}>
            <View
              style={[
                styles.metricIconBox,
                { backgroundColor: theme.badgeBrandBackground },
              ]}>
              <Text style={styles.metricIcon}>🎓</Text>
            </View>
            <ThemedText type="bodySmall" style={{ color: theme.textSecondary }}>
              Role
            </ThemedText>
          </View>
          <ThemedText type="titleMedium" style={[styles.metricValue, styles.roleValue]}>
            {roleName}
          </ThemedText>
          <ThemedText type="bodySmall" style={{ color: theme.textTertiary }}>
            Account tier
          </ThemedText>
        </Card>
      </View>

      {/* SECTION C: Quick Actions */}
      <View style={styles.sectionBlock}>
        <ThemedText type="titleMedium" style={styles.sectionHeading}>
          Quick Actions
        </ThemedText>

        <View style={styles.actionsRow}>
          <Card
            variant="default"
            onPress={() => router.push('/subjects' as never)}
            accessibilityLabel="Open Subjects"
            accessibilityHint="Navigates to academic subjects"
            style={styles.actionCard}>
            <View
              style={[
                styles.actionIconBox,
                { backgroundColor: theme.badgeBrandBackground },
              ]}>
              <Text style={styles.actionIcon}>📚</Text>
            </View>
            <View style={styles.actionTextBox}>
              <ThemedText type="titleMedium" style={styles.actionTitle}>
                Academic Courses
              </ThemedText>
              <ThemedText type="bodySmall" style={{ color: theme.textSecondary }}>
                Manage enrolled subjects
              </ThemedText>
            </View>
            <ThemedText
              type="headlineMedium"
              style={{ color: theme.brandPrimary, marginLeft: 'auto' }}>
              →
            </ThemedText>
          </Card>

          <Card
            variant="default"
            onPress={() => router.push('/notes' as never)}
            accessibilityLabel="Open Notes"
            accessibilityHint="Navigates to notes library"
            style={styles.actionCard}>
            <View
              style={[
                styles.actionIconBox,
                { backgroundColor: theme.badgeSuccessBackground },
              ]}>
              <Text style={styles.actionIcon}>📝</Text>
            </View>
            <View style={styles.actionTextBox}>
              <ThemedText type="titleMedium" style={styles.actionTitle}>
                Study Notes
              </ThemedText>
              <ThemedText type="bodySmall" style={{ color: theme.textSecondary }}>
                Lecture notes & summaries
              </ThemedText>
            </View>
            <ThemedText
              type="headlineMedium"
              style={{ color: theme.brandPrimary, marginLeft: 'auto' }}>
              →
            </ThemedText>
          </Card>

          <Card
            variant="default"
            onPress={() => router.push('/tasks' as never)}
            accessibilityLabel="Open Tasks"
            accessibilityHint="Navigates to tasks and assignments"
            style={styles.actionCard}>
            <View
              style={[
                styles.actionIconBox,
                { backgroundColor: theme.badgeWarningBackground },
              ]}>
              <Text style={styles.actionIcon}>📋</Text>
            </View>
            <View style={styles.actionTextBox}>
              <ThemedText type="titleMedium" style={styles.actionTitle}>
                Tasks & Deadlines
              </ThemedText>
              <ThemedText type="bodySmall" style={{ color: theme.textSecondary }}>
                Assignments & checklists
              </ThemedText>
            </View>
            <ThemedText
              type="headlineMedium"
              style={{ color: theme.brandPrimary, marginLeft: 'auto' }}>
              →
            </ThemedText>
          </Card>
        </View>
      </View>

      {/* SECTION D: My Subjects (Real Data Preview) */}
      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeaderRow}>
          <ThemedText type="titleMedium" style={styles.sectionHeading}>
            My Subjects
          </ThemedText>
          <Pressable
            onPress={() => router.push('/subjects' as never)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="View all subjects">
            <ThemedText type="smallBold" style={{ color: theme.brandPrimary }}>
              View All ({totalSubjectsCount}) →
            </ThemedText>
          </Pressable>
        </View>

        {subjectsError ? (
          <Card variant="outlined" style={styles.alertCard}>
            <ThemedText type="bodyMedium" style={{ color: theme.statusDanger }}>
              {subjectsError}
            </ThemedText>
            <Button
              title="Retry"
              size="sm"
              variant="secondary"
              onPress={() => fetchSubjects(true)}
            />
          </Card>
        ) : isLoadingSubjects && !isRefreshing ? (
          <Card variant="default" style={styles.loadingCard}>
            <ActivityIndicator size="small" color={theme.brandPrimary} />
            <ThemedText type="bodySmall" style={{ color: theme.textSecondary, marginTop: 8 }}>
              Loading enrolled courses...
            </ThemedText>
          </Card>
        ) : recentSubjects.length === 0 ? (
          <EmptyState
            icon="📚"
            title="No subjects added yet"
            description="Add your university courses to organize notes and exams."
            actionLabel="+ Add First Subject"
            onAction={() => router.push('/subjects' as never)}
            actionVariant="primary"
          />
        ) : (
          <View style={styles.previewList}>
            {recentSubjects.map((subject) => {
              const subjectColor = subject.color || theme.brandPrimary;
              return (
                <Card
                  key={subject.id}
                  variant="default"
                  onPress={() => router.push('/subjects' as never)}
                  accessibilityLabel={`Subject: ${subject.name}`}
                  accessibilityHint="Navigates to subjects"
                  style={styles.previewCard}>
                  <View style={[styles.subjectColorBar, { backgroundColor: subjectColor }]} />
                  <View style={styles.previewItemContent}>
                    <View style={styles.previewMetaRow}>
                      {subject.code ? (
                        <Badge label={subject.code} variant="neutral" size="sm" />
                      ) : null}
                      {subject.semester ? (
                        <ThemedText type="bodySmall" style={{ color: theme.textSecondary }}>
                          Sem {subject.semester}
                        </ThemedText>
                      ) : null}
                    </View>
                    <ThemedText type="headlineMedium" style={styles.previewItemTitle} numberOfLines={1}>
                      {subject.name}
                    </ThemedText>
                  </View>
                  <ThemedText
                    type="titleMedium"
                    style={{ color: theme.textTertiary, marginRight: 12 }}>
                    ›
                  </ThemedText>
                </Card>
              );
            })}
          </View>
        )}
      </View>

      {/* SECTION E: Recent Notes (Real Data Preview) */}
      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeaderRow}>
          <ThemedText type="titleMedium" style={styles.sectionHeading}>
            Recent Notes
          </ThemedText>
          <Pressable
            onPress={() => router.push('/notes' as never)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="View all notes">
            <ThemedText type="smallBold" style={{ color: theme.brandPrimary }}>
              View All ({totalNotesCount}) →
            </ThemedText>
          </Pressable>
        </View>

        {notesError ? (
          <Card variant="outlined" style={styles.alertCard}>
            <ThemedText type="bodyMedium" style={{ color: theme.statusDanger }}>
              {notesError}
            </ThemedText>
            <Button
              title="Retry"
              size="sm"
              variant="secondary"
              onPress={() => fetchNotes(undefined, true)}
            />
          </Card>
        ) : isLoadingNotes && !isRefreshing ? (
          <Card variant="default" style={styles.loadingCard}>
            <ActivityIndicator size="small" color={theme.brandPrimary} />
            <ThemedText type="bodySmall" style={{ color: theme.textSecondary, marginTop: 8 }}>
              Loading study notes...
            </ThemedText>
          </Card>
        ) : recentNotes.length === 0 ? (
          <EmptyState
            icon="📝"
            title="No notes written yet"
            description="Capture lectures, formulas, and summaries for quick revision."
            actionLabel="+ Create First Note"
            onAction={() => router.push('/notes' as never)}
            actionVariant="primary"
          />
        ) : (
          <View style={styles.previewList}>
            {recentNotes.map((note) => {
              const linkedSubject = note.subject_id
                ? subjectsMap.get(note.subject_id)
                : null;
              const accentColor =
                linkedSubject?.color ||
                (note.is_pinned ? theme.statusWarning : theme.brandPrimary);

              const formattedDate = new Date(
                note.updated_at || note.created_at
              ).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              });

              return (
                <Card
                  key={note.id}
                  variant="default"
                  onPress={() => router.push('/notes' as never)}
                  accessibilityLabel={`Note: ${note.title}`}
                  accessibilityHint="Navigates to notes"
                  style={styles.previewCard}>
                  <View style={[styles.subjectColorBar, { backgroundColor: accentColor }]} />
                  <View style={styles.previewItemContent}>
                    <View style={styles.previewMetaRow}>
                      {note.is_pinned ? (
                        <Badge label="📌 Pinned" variant="warning" size="sm" />
                      ) : null}
                      {linkedSubject ? (
                        <Badge
                          label={linkedSubject.name}
                          dotColor={linkedSubject.color || undefined}
                          variant="neutral"
                          size="sm"
                        />
                      ) : null}
                      <ThemedText type="bodySmall" style={{ color: theme.textTertiary, marginLeft: 'auto' }}>
                        {formattedDate}
                      </ThemedText>
                    </View>
                    <ThemedText type="headlineMedium" style={styles.previewItemTitle} numberOfLines={1}>
                      {note.title}
                    </ThemedText>
                    <ThemedText
                      type="bodySmall"
                      style={{ color: theme.textSecondary, marginTop: 2 }}
                      numberOfLines={1}>
                      {note.content.replace(/\n+/g, ' ')}
                    </ThemedText>
                  </View>
                  <ThemedText
                    type="titleMedium"
                    style={{ color: theme.textTertiary, marginRight: 12 }}>
                    ›
                  </ThemedText>
                </Card>
              );
            })}
          </View>
        )}
      </View>

      {/* SECTION F: Upcoming Productivity Tools */}
      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeaderRow}>
          <ThemedText type="titleMedium" style={styles.sectionHeading}>
            Upcoming Productivity Tools
          </ThemedText>
          <Pressable
            onPress={() => router.push('/explore' as never)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Explore tools">
            <ThemedText type="smallBold" style={{ color: theme.brandPrimary }}>
              Explore Hub →
            </ThemedText>
          </Pressable>
        </View>

        <Card variant="default" style={styles.upcomingCard}>
          <View style={styles.upcomingItem}>
            <Text style={styles.upcomingIcon}>⏱️</Text>
            <View style={styles.upcomingTextGroup}>
              <View style={styles.upcomingHeaderRow}>
                <ThemedText type="titleMedium">Pomodoro Focus Timer</ThemedText>
                <Badge label="Upcoming V1.1" variant="warning" size="sm" />
              </View>
              <ThemedText type="bodySmall" style={{ color: theme.textSecondary }}>
                25-minute academic timeboxing linked to subjects.
              </ThemedText>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.borderSubtle }]} />

          <View style={styles.upcomingItem}>
            <Text style={styles.upcomingIcon}>🎴</Text>
            <View style={styles.upcomingTextGroup}>
              <View style={styles.upcomingHeaderRow}>
                <ThemedText type="titleMedium">Active Recall Flashcards</ThemedText>
                <Badge label="Upcoming V1.1" variant="warning" size="sm" />
              </View>
              <ThemedText type="bodySmall" style={{ color: theme.textSecondary }}>
                Spaced repetition revision decks built from your notes.
              </ThemedText>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.borderSubtle }]} />

          <View style={styles.upcomingItem}>
            <Text style={styles.upcomingIcon}>✨</Text>
            <View style={styles.upcomingTextGroup}>
              <View style={styles.upcomingHeaderRow}>
                <ThemedText type="titleMedium">AI Study Companion</ThemedText>
                <Badge label="Upcoming V1.2" variant="warning" size="sm" />
              </View>
              <ThemedText type="bodySmall" style={{ color: theme.textSecondary }}>
                Grounded Q&A and exam quiz synthesis via secure backend.
              </ThemedText>
            </View>
          </View>
        </Card>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: Spacing.xl,
    gap: Spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
  },
  headerTextGroup: {
    flex: 1,
    gap: 4,
    marginRight: Spacing.md,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: 2,
  },
  welcomeTitle: {
    letterSpacing: -0.2,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  settingsButton: {
    minWidth: MinTouchTarget,
    minHeight: MinTouchTarget,
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsIcon: {
    fontSize: 20,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  metricCard: {
    flex: 1,
    minWidth: '47%',
    padding: Spacing.cardPadding,
    gap: 4,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  metricIconBox: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricIcon: {
    fontSize: 14,
  },
  metricValue: {
    fontWeight: '700',
    marginTop: 2,
  },
  roleValue: {
    fontSize: 17,
  },
  sectionBlock: {
    gap: Spacing.sm,
  },
  sectionHeading: {
    letterSpacing: 0.2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionsRow: {
    gap: Spacing.sm,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.cardPadding,
    minHeight: 56,
    gap: Spacing.md,
  },
  actionIconBox: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionIcon: {
    fontSize: 20,
  },
  actionTextBox: {
    flex: 1,
    gap: 2,
  },
  actionTitle: {
    fontWeight: '600',
  },
  previewList: {
    gap: Spacing.sm,
  },
  previewCard: {
    padding: 0,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    minHeight: 56,
  },
  subjectColorBar: {
    width: 6,
    alignSelf: 'stretch',
  },
  previewItemContent: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    gap: 3,
  },
  previewMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  previewItemTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  alertCard: {
    padding: Spacing.md,
    gap: Spacing.sm,
    alignItems: 'flex-start',
  },
  loadingCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  upcomingCard: {
    padding: Spacing.cardPadding,
    gap: Spacing.md,
  },
  upcomingItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  upcomingIcon: {
    fontSize: 22,
    marginTop: 2,
  },
  upcomingTextGroup: {
    flex: 1,
    gap: 2,
  },
  upcomingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
});
