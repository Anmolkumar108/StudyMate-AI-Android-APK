import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge, Button, Card, ScreenWrapper } from '@/components/ui';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  loadPomodoroSettings,
  loadPomodoroStats,
} from '@/services/storage/pomodoro-storage';
import {
  DEFAULT_POMODORO_SETTINGS,
  DEFAULT_POMODORO_STATS,
  formatTimeRemaining,
  PomodoroSettings,
  PomodoroStats,
} from '@/types/pomodoro';

export type ToolCategory = 'all' | 'ai' | 'focus' | 'exams' | 'academic';

interface StudyToolItem {
  id: string;
  title: string;
  icon: string;
  category: 'ai' | 'focus' | 'exams' | 'academic';
  badgeLabel: string;
  badgeVariant: 'brand' | 'success' | 'warning' | 'info' | 'neutral';
  route: string;
  description: string;
  actionText: string;
  keywords: string[];
  isFeatured?: boolean;
  accentColor: string;
  accessibilityLabel: string;
  accessibilityHint: string;
}

const STUDY_TOOLS: StudyToolItem[] = [
  {
    id: 'study-planner',
    title: 'Smart Study Planner',
    icon: '📅',
    category: 'ai',
    badgeLabel: 'AI Powered',
    badgeVariant: 'brand',
    route: '/study-planner',
    description:
      'AI daily schedule and timeboxing. Calculates your study workload across upcoming exams, pending tasks, and university timetable gaps for a conflict-free study routine.',
    actionText: 'Open Study Planner →',
    keywords: ['planner', 'schedule', 'timeboxing', 'ai', 'calendar', 'workload', 'agenda'],
    isFeatured: true,
    accentColor: '#6366F1',
    accessibilityLabel: 'Open Smart Study Planner',
    accessibilityHint: 'Daily AI study schedule, timeboxing, and timetable balance',
  },
  {
    id: 'ai-tutor',
    title: 'AI Study Tutor',
    icon: '🤖',
    category: 'ai',
    badgeLabel: 'AI Powered',
    badgeVariant: 'brand',
    route: '/ai-chat',
    description:
      '24/7 conversational tutor. Ask questions, get Feynman ELI5 explanations, or toggle Socratic mode for guided problem-solving.',
    actionText: 'Chat with AI Tutor →',
    keywords: ['ai', 'chat', 'tutor', 'socratic', 'feynman', 'ask', 'doubt', 'explain', 'bot'],
    isFeatured: true,
    accentColor: '#8B5CF6',
    accessibilityLabel: 'Open AI Study Tutor',
    accessibilityHint: 'Navigates to 24/7 AI Tutor chat with Socratic learning',
  },
  {
    id: 'focus-timer',
    title: 'Focus Timer',
    icon: '⏱️',
    category: 'focus',
    badgeLabel: 'Active Tool',
    badgeVariant: 'success',
    route: '/pomodoro',
    description:
      'Timebox your study into deliberate, distraction-free sessions to reduce cognitive fatigue and sustain long study periods. Fully customizable with automated break cycles and local session tracking.',
    actionText: 'Open Focus Timer →',
    keywords: ['timer', 'pomodoro', 'focus', 'clock', 'interval', 'break', 'deep work', 'stopwatch'],
    accentColor: '#10B981',
    accessibilityLabel: 'Open Pomodoro Focus Timer',
    accessibilityHint: 'Navigates to the full Pomodoro Focus Timer workspace',
  },
  {
    id: 'analytics',
    title: 'Study Analytics & Heatmap',
    icon: '📊',
    category: 'focus',
    badgeLabel: 'Mastery Engine',
    badgeVariant: 'brand',
    route: '/analytics',
    description:
      '6-month GitHub-style consistency calendar grid, proportional subject study hours, weekly focus momentum, and academic quiz mastery curve.',
    actionText: 'View Full Analytics →',
    keywords: ['analytics', 'heatmap', 'stats', 'consistency', 'hours', 'graph', 'streak', 'charts'],
    accentColor: '#06B6D4',
    accessibilityLabel: 'Open Study Analytics & Heatmap',
    accessibilityHint: 'View 6-month GitHub consistency heatmap, subject distribution, and mastery trends',
  },
  {
    id: 'flashcards',
    title: 'Active Recall & Flashcards',
    icon: '🎴',
    category: 'exams',
    badgeLabel: 'Active Tool',
    badgeVariant: 'success',
    route: '/flashcards',
    description:
      'Master course definitions, core formulas, and key concepts using interactive flip-card recall sessions organized by subject.',
    actionText: 'Open Flashcards →',
    keywords: ['flashcards', 'recall', 'cards', 'anki', 'memorize', 'definitions', 'flip', 'formulas'],
    accentColor: '#F59E0B',
    accessibilityLabel: 'Open Active Recall & Flashcards',
    accessibilityHint: 'Navigates to your flashcard decks and study mode',
  },
  {
    id: 'quizzes',
    title: 'AI Quiz Hub & Exam Prep',
    icon: '🎯',
    category: 'exams',
    badgeLabel: 'AI Powered',
    badgeVariant: 'brand',
    route: '/quizzes',
    description:
      'Generate customized practice quizzes by topic or notes. Instant scoring, detailed explanations, and 1-tap conversion of missed questions into flashcards.',
    actionText: 'Take a Quiz →',
    keywords: ['quiz', 'test', 'practice', 'mcq', 'exam prep', 'questions', 'scoring', 'mock test'],
    accentColor: '#EC4899',
    accessibilityLabel: 'Open AI Quiz Hub',
    accessibilityHint: 'Test your knowledge with AI generated quizzes and spaced recall',
  },
  {
    id: 'exams',
    title: 'Exams & Revision Countdown',
    icon: '⏰',
    category: 'exams',
    badgeLabel: 'AI Powered',
    badgeVariant: 'brand',
    route: '/exams',
    description:
      'Never miss an exam. Real-time countdown clocks, interactive syllabus topic mastery, target score tracking, and automated 3-phase AI revision schedules.',
    actionText: 'Open Exam Prep →',
    keywords: ['exams', 'test', 'countdown', 'revision', 'syllabus', 'midterm', 'finals', 'deadline', 'dates'],
    accentColor: '#EF4444',
    accessibilityLabel: 'Open Exam Preparation & Revision Countdown',
    accessibilityHint: 'Track upcoming exams, syllabus completion, and AI revision plans',
  },
  {
    id: 'notes',
    title: 'Smart Lecture Notes',
    icon: '📝',
    category: 'academic',
    badgeLabel: 'AI Powered',
    badgeVariant: 'brand',
    route: '/notes',
    description:
      'Structured Cornell notes, Markdown editor, instant AI key takeaways, formula extraction, and semester subject organization.',
    actionText: 'Browse Notes →',
    keywords: ['notes', 'lecture', 'cornell', 'markdown', 'summary', 'text', 'study notes', 'formulas'],
    accentColor: '#3B82F6',
    accessibilityLabel: 'Open Smart Lecture Notes',
    accessibilityHint: 'Create, review, and AI-summarize your subject lecture notes',
  },
  {
    id: 'documents',
    title: 'Course Documents & PDFs',
    icon: '📑',
    category: 'academic',
    badgeLabel: 'AI Powered',
    badgeVariant: 'brand',
    route: '/documents',
    description:
      'Manage lecture slides and textbooks. Instant AI-generated Cornell summaries and key formulas for exam review.',
    actionText: 'View Documents →',
    keywords: ['pdf', 'documents', 'slides', 'textbook', 'upload', 'cornell', 'ingestion', 'reader'],
    accentColor: '#14B8A6',
    accessibilityLabel: 'Open Course Documents',
    accessibilityHint: 'View uploaded PDFs and AI lecture summaries',
  },
  {
    id: 'timetable',
    title: 'Class Timetable & Routine',
    icon: '📅',
    category: 'academic',
    badgeLabel: 'Active',
    badgeVariant: 'success',
    route: '/timetable',
    description:
      'Manage your weekly lectures, room numbers, professors, and class reminder alerts. Automatic time-clash detection.',
    actionText: 'Open Timetable →',
    keywords: ['timetable', 'schedule', 'routine', 'lectures', 'classes', 'professor', 'room', 'attendance'],
    accentColor: '#84CC16',
    accessibilityLabel: 'Open Class Timetable',
    accessibilityHint: 'Track your weekly lecture routine and class schedules',
  },
  {
    id: 'tasks',
    title: 'Tasks & Deadlines',
    icon: '📋',
    category: 'academic',
    badgeLabel: 'Active',
    badgeVariant: 'success',
    route: '/tasks',
    description:
      'Track coursework, homework deadlines, and subtask checklists. Automatic overdue alerts and 1-tap completion.',
    actionText: 'Manage Tasks →',
    keywords: ['tasks', 'todo', 'deadlines', 'assignment', 'homework', 'checklist', 'due date', 'reminders'],
    accentColor: '#F97316',
    accessibilityLabel: 'Open Tasks & Deadlines',
    accessibilityHint: 'Track your assignments, homework, and checklists',
  },
  {
    id: 'subjects',
    title: 'Academic Subjects & Courses',
    icon: '📚',
    category: 'academic',
    badgeLabel: 'Active',
    badgeVariant: 'success',
    route: '/subjects',
    description:
      'Create and organize your university courses, semester codes, lecture notes, and syllabus tracking.',
    actionText: 'Manage & Add Subjects →',
    keywords: ['subjects', 'courses', 'university', 'syllabus', 'semester', 'credits', 'curriculum', 'degrees'],
    accentColor: '#A855F7',
    accessibilityLabel: 'Manage Academic Subjects',
    accessibilityHint: 'Add and organize enrolled subjects and courses',
  },
];

export default function StudyHubScreen() {
  const router = useRouter();
  const theme = useTheme();

  const [settings, setSettings] = useState<PomodoroSettings>(DEFAULT_POMODORO_SETTINGS);
  const [stats, setStats] = useState<PomodoroStats>(DEFAULT_POMODORO_STATS);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<ToolCategory>('all');

  // Synchronize timer durations & focus stats whenever Study Hub is focused
  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      Promise.all([loadPomodoroSettings(), loadPomodoroStats()])
        .then(([loadedSettings, loadedStats]) => {
          if (isMounted) {
            setSettings(loadedSettings);
            setStats(loadedStats);
          }
        })
        .catch(() => {});

      return () => {
        isMounted = false;
      };
    }, [])
  );

  // Live intelligent filtering across title, description, and keywords
  const filteredTools = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return STUDY_TOOLS.filter((tool) => {
      const matchesCategory =
        activeCategory === 'all' || tool.category === activeCategory;
      if (!matchesCategory) return false;

      if (!query) return true;

      const titleMatch = tool.title.toLowerCase().includes(query);
      const descMatch = tool.description.toLowerCase().includes(query);
      const keywordMatch = tool.keywords.some((k) => k.toLowerCase().includes(query));

      return titleMatch || descMatch || keywordMatch;
    });
  }, [searchQuery, activeCategory]);

  const categories: { id: ToolCategory; label: string; icon: string }[] = [
    { id: 'all', label: 'All Tools', icon: '🔥' },
    { id: 'ai', label: 'AI Intelligence', icon: '✨' },
    { id: 'focus', label: 'Focus & Habits', icon: '⚡' },
    { id: 'exams', label: 'Exams & Recall', icon: '🎯' },
    { id: 'academic', label: 'Organization', icon: '📚' },
  ];

  return (
    <ScreenWrapper
      scrollable
      includeTopInset
      includeBottomInset
      includeTabInset
      contentContainerStyle={styles.container}>
      {/* 1. Header & Live Sub-badge */}
      <View style={styles.header}>
        <View style={styles.headerBadgeRow}>
          <Badge label="STUDY TOOLS & ACCELERATORS" variant="brand" size="sm" />
          <View style={[styles.pulsePill, { backgroundColor: 'rgba(99, 102, 241, 0.12)' }]}>
            <View style={styles.pulseDot} />
            <Text style={styles.pulseText}>12 Academic Super-Tools</Text>
          </View>
        </View>

        <ThemedText type="headlineLarge" style={styles.title}>
          Study Hub
        </ThemedText>
        <ThemedText type="bodyMedium" style={{ color: theme.textSecondary }}>
          Your integrated workspace to learn, focus, retain and accelerate.
        </ThemedText>
      </View>

      {/* 2. Smart Instant Search Bar */}
      <View
        style={[
          styles.searchBox,
          {
            backgroundColor: theme.inputBackground,
            borderColor: searchQuery ? theme.brandPrimary : theme.borderSubtle,
          },
        ]}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search all tools, AI features, exams, notes..."
          placeholderTextColor={theme.textTertiary}
          style={[styles.searchInput, { color: theme.text }]}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Search study tools"
        />
        {searchQuery.length > 0 && (
          <Pressable
            onPress={() => setSearchQuery('')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Clear search text">
            <View style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>✕</Text>
            </View>
          </Pressable>
        )}
      </View>

      {/* 3. Category Filter Chips (Horizontal Scroll) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryScroll}
        style={styles.categoryWrapper}>
        {categories.map((cat) => {
          const isActive = activeCategory === cat.id;
          return (
            <Pressable
              key={cat.id}
              onPress={() => setActiveCategory(cat.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`Filter by ${cat.label}`}
              style={[
                styles.categoryChip,
                {
                  backgroundColor: isActive
                    ? theme.brandPrimary
                    : theme.cardBackground,
                  borderColor: isActive
                    ? theme.brandPrimary
                    : theme.borderSubtle,
                },
              ]}>
              <Text style={styles.categoryIcon}>{cat.icon}</Text>
              <ThemedText
                type="small"
                style={[
                  styles.categoryText,
                  { color: isActive ? '#FFFFFF' : theme.textSecondary },
                ]}>
                {cat.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* 4. "Academic Pulse" Glassmorphism Hero Card (shown when no search filter active) */}
      {!searchQuery && activeCategory === 'all' && (
        <View
          style={[
            styles.pulseCard,
            {
              backgroundColor: theme.cardBackground,
              borderColor: 'rgba(99, 102, 241, 0.3)',
            },
          ]}>
          <View style={styles.pulseHeaderRow}>
            <View style={styles.pulseHeaderLeft}>
              <Text style={styles.pulseEmoji}>⚡</Text>
              <View style={{ flex: 1 }}>
                <ThemedText type="titleMedium" style={{ color: theme.text, fontWeight: '700' }}>
                  Today's Study Momentum
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  Configured cycle: {settings.focusDuration}m focus • {settings.shortBreakDuration}m break
                </ThemedText>
              </View>
            </View>
            <Badge
              label={`${stats.todayCompletedSessions} Today`}
              variant={stats.todayCompletedSessions > 0 ? 'success' : 'brand'}
              size="sm"
            />
          </View>

          <View style={styles.pulseMetricsRow}>
            <View style={[styles.pulseMetricItem, { backgroundColor: theme.inputBackground }]}>
              <ThemedText type="small" style={{ color: theme.textTertiary }}>
                Time Remaining / Cycle
              </ThemedText>
              <Text style={[styles.pulseMetricVal, { color: theme.brandPrimary }]}>
                {formatTimeRemaining(settings.focusDuration * 60)}
              </Text>
            </View>

            <View style={[styles.pulseMetricItem, { backgroundColor: theme.inputBackground }]}>
              <ThemedText type="small" style={{ color: theme.textTertiary }}>
                Today's Focus
              </ThemedText>
              <Text style={[styles.pulseMetricVal, { color: '#10B981' }]}>
                {stats.todayCompletedSessions * settings.focusDuration}m
              </Text>
            </View>
          </View>

          <Pressable
            onPress={() => router.push('/pomodoro' as never)}
            style={({ pressed }) => [
              styles.quickLaunchBtn,
              { opacity: pressed ? 0.85 : 1 },
            ]}
            accessibilityLabel="Launch Quick Pomodoro Focus Session">
            <Text style={styles.quickLaunchBtnText}>⏱️ Quick Start 25m Focus Session →</Text>
          </Pressable>
        </View>
      )}

      {/* 5. Results Counter if Searching */}
      {searchQuery.length > 0 && (
        <View style={styles.resultsInfoRow}>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            Showing {filteredTools.length} {filteredTools.length === 1 ? 'tool' : 'tools'} for "{searchQuery}"
          </ThemedText>
          <Pressable onPress={() => setSearchQuery('')}>
            <ThemedText type="small" style={{ color: theme.brandPrimary, fontWeight: '600' }}>
              Reset Search
            </ThemedText>
          </Pressable>
        </View>
      )}

      {/* 6. Tools Catalog Rendering */}
      {filteredTools.length === 0 ? (
        <View
          style={[
            styles.emptyBox,
            { backgroundColor: theme.cardBackground, borderColor: theme.borderSubtle },
          ]}>
          <Text style={styles.emptyIcon}>🔍</Text>
          <ThemedText type="titleMedium" style={{ color: theme.text, marginTop: Spacing.xs }}>
            No tools found
          </ThemedText>
          <ThemedText
            type="bodySmall"
            style={{ color: theme.textSecondary, textAlign: 'center', marginTop: Spacing.xs }}>
            We couldn't find any study tools matching "{searchQuery}". Try exploring our popular categories:
          </ThemedText>

          <View style={styles.emptyPillsRow}>
            {['AI Tutor', 'Focus Timer', 'Flashcards', 'Notes', 'Exams'].map((term) => (
              <Pressable
                key={term}
                onPress={() => setSearchQuery(term)}
                style={[
                  styles.emptySuggestionPill,
                  { backgroundColor: theme.inputBackground, borderColor: theme.borderSubtle },
                ]}>
                <ThemedText type="small" style={{ color: theme.brandPrimary, fontWeight: '600' }}>
                  {term}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <View style={styles.cardsList}>
          {filteredTools.map((tool) => {
            const isFlashcards = tool.id === 'flashcards';
            const isFocusTimer = tool.id === 'focus-timer';

            return (
              <Card
                key={tool.id}
                variant="default"
                onPress={() =>
                  isFlashcards
                    ? router.push('/flashcards' as never)
                    : isFocusTimer
                    ? router.push('/pomodoro' as never)
                    : router.push(tool.route as never)
                }
                accessibilityLabel={tool.accessibilityLabel}
                accessibilityHint={tool.accessibilityHint}
                style={[
                  styles.card,
                  tool.isFeatured && {
                    borderColor: 'rgba(99, 102, 241, 0.4)',
                    shadowColor: tool.accentColor,
                    shadowOpacity: 0.15,
                    shadowRadius: 10,
                  },
                ]}>
                {/* Card Header Row */}
                <View style={styles.cardHeaderRow}>
                  <View style={styles.cardHeaderLeft}>
                    <View
                      style={[
                        styles.iconContainer,
                        {
                          backgroundColor: `${tool.accentColor}18`,
                          borderColor: `${tool.accentColor}35`,
                        },
                      ]}>
                      <Text style={styles.cardHeaderIcon}>{tool.icon}</Text>
                    </View>
                    <View style={styles.cardTitleContainer}>
                      <ThemedText type="titleMedium" style={styles.cardTitle}>
                        {tool.title}
                      </ThemedText>
                    </View>
                  </View>
                  <Badge label={tool.badgeLabel} variant={tool.badgeVariant} size="sm" />
                </View>

                {/* Live Pomodoro Preview Box specifically for Focus Timer */}
                {isFocusTimer && (
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
                )}

                {/* Description */}
                <ThemedText type="bodyMedium" style={{ color: theme.textSecondary, lineHeight: 21 }}>
                  {tool.description}
                </ThemedText>

                {/* Action Button */}
                <Button
                  title={isFlashcards ? 'Open Flashcards →' : tool.actionText}
                  variant={tool.isFeatured ? 'primary' : 'secondary'}
                  size="md"
                  onPress={() => router.push(tool.route as never)}
                  accessibilityLabel={tool.accessibilityLabel}
                  style={{ marginTop: Spacing.xs }}
                />
              </Card>
            );
          })}
        </View>
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 130,
  },
  header: {
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  headerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  pulsePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.25)',
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#6366F1',
  },
  pulseText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#818CF8',
  },
  title: {
    marginTop: Spacing.xs,
    letterSpacing: -0.5,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    height: 48,
    marginBottom: Spacing.md,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  clearBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearBtnText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#94A3B8',
  },
  categoryWrapper: {
    marginBottom: Spacing.lg,
  },
  categoryScroll: {
    gap: Spacing.xs,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  categoryIcon: {
    fontSize: 14,
  },
  categoryText: {
    fontWeight: '600',
  },
  pulseCard: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.cardPadding,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
    shadowColor: '#6366F1',
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  pulseHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pulseHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  pulseEmoji: {
    fontSize: 24,
  },
  pulseMetricsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  pulseMetricItem: {
    flex: 1,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    gap: 2,
  },
  pulseMetricVal: {
    fontSize: 18,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  quickLaunchBtn: {
    backgroundColor: '#4F46E5',
    paddingVertical: 12,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4F46E5',
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  quickLaunchBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  resultsInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  cardsList: {
    gap: Spacing.lg,
  },
  card: {
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
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderIcon: {
    fontSize: 22,
  },
  cardTitleContainer: {
    flex: 1,
  },
  cardTitle: {
    fontWeight: '700',
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
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  emptyIcon: {
    fontSize: 36,
  },
  emptyPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    justifyContent: 'center',
    marginTop: Spacing.md,
  },
  emptySuggestionPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
});
