import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ScreenWrapper } from '@/components/ui';
import { BorderRadius, MinTouchTarget, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { analyticsApi, studySessionApi } from '@/services/api/client';
import {
  AnalyticsHeatmapResponse,
  AnalyticsOverviewResponse,
  DailyActivityItem,
  TodayStudySummary,
} from '@/types/analytics';

type TimeframeFilter = 'week' | 'month' | 'all';

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function AnalyticsScreen() {
  const router = useRouter();
  const theme = useTheme();

  const [timeframe, setTimeframe] = useState<TimeframeFilter>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const [overview, setOverview] = useState<AnalyticsOverviewResponse | null>(null);
  const [heatmap, setHeatmap] = useState<AnalyticsHeatmapResponse | null>(null);
  const [todaySummary, setTodaySummary] = useState<TodayStudySummary | null>(null);

  // Selected date cell in the heatmap for inspection
  const [selectedDay, setSelectedDay] = useState<DailyActivityItem | null>(null);

  const loadData = useCallback(async (selectedTimeframe: TimeframeFilter) => {
    try {
      const [overviewData, heatmapData, todayData] = await Promise.all([
        analyticsApi.getOverview(selectedTimeframe),
        analyticsApi.getHeatmap(180),
        studySessionApi.getTodaySummary(),
      ]);
      setOverview(overviewData);
      setHeatmap(heatmapData);
      setTodaySummary(todayData);
    } catch {
      // Graceful fallback: screen remains functional even with partial network delay
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData(timeframe);
  }, [timeframe, loadData]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadData(timeframe);
  }, [timeframe, loadData]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/explore' as never);
    }
  };

  // Group heatmap matrix into weeks (columns of 7 days)
  const heatmapColumns = useMemo(() => {
    if (!heatmap?.matrix || heatmap.matrix.length === 0) return [];
    const items = heatmap.matrix;
    const cols: DailyActivityItem[][] = [];
    let currentWeek: DailyActivityItem[] = [];

    // Identify first day's day-of-week to align column correctly
    const firstDate = new Date(items[0].date);
    const startDow = firstDate.getUTCDay();

    // Pad beginning of first week
    for (let p = 0; p < startDow; p++) {
      currentWeek.push({
        date: `pad-${p}`,
        focus_minutes: 0,
        sessions_count: 0,
        tasks_completed: 0,
        quizzes_taken: 0,
        level: -1, // padding
      });
    }

    for (const item of items) {
      currentWeek.push(item);
      if (currentWeek.length === 7) {
        cols.push(currentWeek);
        currentWeek = [];
      }
    }
    if (currentWeek.length > 0) {
      // Pad end of last week
      while (currentWeek.length < 7) {
        currentWeek.push({
          date: `pad-end-${currentWeek.length}`,
          focus_minutes: 0,
          sessions_count: 0,
          tasks_completed: 0,
          quizzes_taken: 0,
          level: -1,
        });
      }
      cols.push(currentWeek);
    }

    return cols;
  }, [heatmap]);

  // Distinct month label headers calculated across heatmap columns
  const monthLabels = useMemo(() => {
    const labels: { text: string; colIndex: number }[] = [];
    let lastMonth = -1;

    heatmapColumns.forEach((col, colIdx) => {
      const realItem = col.find((d) => d.level >= 0);
      if (realItem) {
        const itemMonth = new Date(realItem.date).getUTCMonth();
        if (itemMonth !== lastMonth) {
          labels.push({ text: MONTH_NAMES[itemMonth], colIndex: colIdx });
          lastMonth = itemMonth;
        }
      }
    });

    return labels;
  }, [heatmapColumns]);

  // Color generator for heatmap levels
  const getCellColor = (level: number): string => {
    switch (level) {
      case 1:
        return 'rgba(6, 182, 212, 0.35)'; // Cyan Light (1-25m)
      case 2:
        return 'rgba(6, 182, 212, 0.65)'; // Cyan Medium (26-55m)
      case 3:
        return '#06B6D4'; // Cyan Strong (56-110m)
      case 4:
        return '#22D3EE'; // Cyan Neon (110m+)
      case 0:
        return 'rgba(255, 255, 255, 0.05)';
      default:
        return 'transparent'; // Padding
    }
  };

  const getBorderColor = (level: number, isSelected: boolean): string => {
    if (isSelected) return '#FFFFFF';
    if (level === 4) return '#67E8F9';
    if (level > 0) return 'rgba(6, 182, 212, 0.4)';
    return 'rgba(255, 255, 255, 0.08)';
  };

  // Max weekly focus minutes for bar chart normalization
  const maxWeeklyMinutes = useMemo(() => {
    if (!overview?.weekly_trends || overview.weekly_trends.length === 0) return 60;
    const maxVal = Math.max(...overview.weekly_trends.map((w) => w.focus_minutes));
    return Math.max(60, maxVal);
  }, [overview]);

  return (
    <ScreenWrapper
      scrollable
      includeTopInset
      includeBottomInset
      includeTabInset={false}
      refreshing={isRefreshing}
      onRefresh={handleRefresh}
      contentContainerStyle={styles.container}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <Pressable
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
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
            ACADEMIC PERFORMANCE & MASTERY
          </ThemedText>
          <ThemedText type="headlineLarge" style={styles.screenTitle}>
            Study Analytics
          </ThemedText>
        </View>

        <View style={{ width: 44 }} />
      </View>

      {/* Timeframe Filter Pills */}
      <View style={styles.timeframeRow}>
        {(['week', 'month', 'all'] as TimeframeFilter[]).map((tf) => {
          const isActive = timeframe === tf;
          return (
            <TouchableOpacity
              key={tf}
              onPress={() => setTimeframe(tf)}
              style={[
                styles.timeframePill,
                isActive && styles.timeframePillActive,
              ]}>
              <Text
                style={[
                  styles.timeframeText,
                  isActive && styles.timeframeTextActive,
                ]}>
                {tf === 'week' ? 'Past 7 Days' : tf === 'month' ? 'Past 30 Days' : 'All-Time'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#06B6D4" />
          <Text style={styles.loadingText}>Synthesizing study records & heatmap...</Text>
        </View>
      ) : (
        <>
          {/* Hero Overview Grid */}
          <View style={styles.statsGrid}>
            {/* 1. Streak Card */}
            <View style={styles.statCard}>
              <View style={styles.statHeaderRow}>
                <Text style={styles.statEmoji}>🔥</Text>
                <View style={styles.statBadge}>
                  <Text style={styles.statBadgeText}>CONSISTENCY</Text>
                </View>
              </View>
              <Text style={styles.statMainVal}>
                {overview?.current_streak_days ?? 0}
                <Text style={styles.statUnit}> Days</Text>
              </Text>
              <Text style={styles.statSubtitle}>
                Longest: {overview?.longest_streak_days ?? 0} days streak
              </Text>
            </View>

            {/* 2. Total Focus Time */}
            <View style={styles.statCard}>
              <View style={styles.statHeaderRow}>
                <Text style={styles.statEmoji}>⏱️</Text>
                <View style={styles.statBadge}>
                  <Text style={styles.statBadgeText}>DEEP WORK</Text>
                </View>
              </View>
              <Text style={styles.statMainVal}>
                {overview?.total_focus_hours ?? 0}
                <Text style={styles.statUnit}> hrs</Text>
              </Text>
              <Text style={styles.statSubtitle}>
                {overview?.total_sessions ?? 0} focus sessions logged
              </Text>
            </View>

            {/* 3. Today's Target Goal */}
            <View style={styles.statCard}>
              <View style={styles.statHeaderRow}>
                <Text style={styles.statEmoji}>🎯</Text>
                <View style={styles.statBadge}>
                  <Text style={styles.statBadgeText}>TODAY GOAL</Text>
                </View>
              </View>
              <Text style={styles.statMainVal}>
                {todaySummary?.goal_progress_percent ?? 0}
                <Text style={styles.statUnit}>%</Text>
              </Text>
              <Text style={styles.statSubtitle}>
                {todaySummary?.total_focus_minutes ?? 0}m of {todaySummary?.daily_goal_minutes ?? 60}m target
              </Text>
            </View>

            {/* 4. Productivity Composite Score */}
            <View style={styles.statCard}>
              <View style={styles.statHeaderRow}>
                <Text style={styles.statEmoji}>🏆</Text>
                <View style={styles.statBadge}>
                  <Text style={styles.statBadgeText}>SCHOLAR SCORE</Text>
                </View>
              </View>
              <Text style={styles.statMainVal}>
                {overview?.productivity_score ?? 75}
                <Text style={styles.statUnit}> / 100</Text>
              </Text>
              <Text style={styles.statSubtitle}>
                {overview?.productivity_score && overview.productivity_score >= 80
                  ? 'Mastery Level: Elite'
                  : 'Mastery Level: Focused'}
              </Text>
            </View>
          </View>

          {/* GitHub-Style 6-Month Consistency Heatmap Card */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <View style={{ gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 16 }}>🗓️</Text>
                  <Text style={styles.sectionTitle}>STUDY CONSISTENCY HEATMAP</Text>
                </View>
                <Text style={styles.sectionSubtitle}>
                  {heatmap?.total_active_days ?? 0} active study days across past 6 months
                </Text>
              </View>
            </View>

            {/* Heatmap Grid */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.heatmapScroll}>
              <View style={styles.heatmapContainer}>
                {/* Month labels row */}
                <View style={styles.monthLabelsRow}>
                  {monthLabels.map((lbl, idx) => (
                    <Text
                      key={`${lbl.text}-${idx}`}
                      style={[styles.monthLabelText, { left: lbl.colIndex * 15 }]}>
                      {lbl.text}
                    </Text>
                  ))}
                </View>

                {/* Day grid with week column layout */}
                <View style={styles.gridRow}>
                  {/* Weekday indicators on the left */}
                  <View style={styles.dowColumn}>
                    <Text style={styles.dowLabel}>M</Text>
                    <Text style={styles.dowLabel}>W</Text>
                    <Text style={styles.dowLabel}>F</Text>
                  </View>

                  {/* Columns of 7 days */}
                  <View style={styles.columnsWrapper}>
                    {heatmapColumns.map((col, colIdx) => (
                      <View key={`col-${colIdx}`} style={styles.heatmapCol}>
                        {col.map((dayItem, rowIdx) => {
                          if (dayItem.level === -1) {
                            return <View key={`pad-${colIdx}-${rowIdx}`} style={styles.heatmapPadCell} />;
                          }
                          const isSelected = selectedDay?.date === dayItem.date;
                          return (
                            <TouchableOpacity
                              key={dayItem.date}
                              onPress={() => setSelectedDay(dayItem)}
                              activeOpacity={0.7}
                              style={[
                                styles.heatmapCell,
                                {
                                  backgroundColor: getCellColor(dayItem.level),
                                  borderColor: getBorderColor(dayItem.level, isSelected),
                                  borderWidth: isSelected ? 1.5 : 1,
                                },
                              ]}
                            />
                          );
                        })}
                      </View>
                    ))}
                  </View>
                </View>

                {/* Legend bar */}
                <View style={styles.legendRow}>
                  <Text style={styles.legendLabel}>Less</Text>
                  <View style={[styles.legendCell, { backgroundColor: 'rgba(255, 255, 255, 0.05)' }]} />
                  <View style={[styles.legendCell, { backgroundColor: 'rgba(6, 182, 212, 0.35)' }]} />
                  <View style={[styles.legendCell, { backgroundColor: 'rgba(6, 182, 212, 0.65)' }]} />
                  <View style={[styles.legendCell, { backgroundColor: '#06B6D4' }]} />
                  <View style={[styles.legendCell, { backgroundColor: '#22D3EE' }]} />
                  <Text style={styles.legendLabel}>More Focus</Text>
                </View>
              </View>
            </ScrollView>

            {/* Selected Day Inspection Modal Card */}
            {selectedDay ? (
              <View style={styles.dayInspectCard}>
                <View style={styles.dayInspectHeader}>
                  <Text style={styles.dayInspectDate}>
                    📅 {new Date(selectedDay.date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </Text>
                  <TouchableOpacity onPress={() => setSelectedDay(null)}>
                    <Text style={styles.dayInspectClose}>✕</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.dayInspectMetricsRow}>
                  <View style={styles.dayInspectPill}>
                    <Text style={styles.dayInspectPillVal}>{selectedDay.focus_minutes}m</Text>
                    <Text style={styles.dayInspectPillLabel}>Focus Time</Text>
                  </View>
                  <View style={styles.dayInspectPill}>
                    <Text style={styles.dayInspectPillVal}>{selectedDay.sessions_count}</Text>
                    <Text style={styles.dayInspectPillLabel}>Sessions</Text>
                  </View>
                  <View style={styles.dayInspectPill}>
                    <Text style={styles.dayInspectPillVal}>{selectedDay.tasks_completed}</Text>
                    <Text style={styles.dayInspectPillLabel}>Tasks Done</Text>
                  </View>
                  <View style={styles.dayInspectPill}>
                    <Text style={styles.dayInspectPillVal}>{selectedDay.quizzes_taken}</Text>
                    <Text style={styles.dayInspectPillLabel}>Quizzes</Text>
                  </View>
                </View>
              </View>
            ) : null}
          </View>

          {/* Subject Time Distribution */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <View style={{ gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 16 }}>📊</Text>
                  <Text style={styles.sectionTitle}>SUBJECT FOCUS DISTRIBUTION</Text>
                </View>
                <Text style={styles.sectionSubtitle}>
                  Proportional study hours allocated per academic subject
                </Text>
              </View>
            </View>

            {/* Multi-Segment Stacked Progress Bar */}
            {overview?.subject_distribution && overview.subject_distribution.length > 0 ? (
              <>
                <View style={styles.stackedBarContainer}>
                  {overview.subject_distribution.map((sub, idx) => (
                    <View
                      key={sub.subject_id || `sub-${idx}`}
                      style={[
                        styles.stackedBarSegment,
                        {
                          backgroundColor: sub.color_hex,
                          flex: Math.max(1, sub.percentage),
                        },
                      ]}
                    />
                  ))}
                </View>

                {/* Subject List Breakdown */}
                <View style={styles.subjectList}>
                  {overview.subject_distribution.map((sub, idx) => (
                    <View key={sub.subject_id || `sub-list-${idx}`} style={styles.subjectRow}>
                      <View style={[styles.subjectColorDot, { backgroundColor: sub.color_hex }]} />
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          {sub.subject_code ? (
                            <View style={styles.subjectCodeBadge}>
                              <Text style={styles.subjectCodeText}>{sub.subject_code}</Text>
                            </View>
                          ) : null}
                          <Text style={styles.subjectRowName} numberOfLines={1}>
                            {sub.subject_name}
                          </Text>
                        </View>
                        <Text style={styles.subjectRowSub}>
                          {sub.session_count} sessions • {sub.total_minutes} mins
                        </Text>
                      </View>

                      <View style={{ alignItems: 'flex-end', gap: 2 }}>
                        <Text style={styles.subjectHoursVal}>{sub.total_hours}h</Text>
                        <Text style={[styles.subjectPctBadge, { color: sub.color_hex }]}>
                          {sub.percentage}%
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <View style={styles.emptyCardBox}>
                <Text style={{ fontSize: 24 }}>📚</Text>
                <Text style={styles.emptyCardTitle}>No Subject Focus Logged Yet</Text>
                <Text style={styles.emptyCardSub}>
                  Start a Pomodoro session tagged with a subject to build your distribution!
                </Text>
              </View>
            )}
          </View>

          {/* Weekly Focus Trends (Past 7 Days Bar Chart) */}
          {overview?.weekly_trends && overview.weekly_trends.length > 0 ? (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <View style={{ gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 16 }}>📈</Text>
                    <Text style={styles.sectionTitle}>WEEKLY FOCUS MOMENTUM</Text>
                  </View>
                  <Text style={styles.sectionSubtitle}>
                    Daily hours studied over the past 7 days
                  </Text>
                </View>
              </View>

              <View style={styles.barChartContainer}>
                {overview.weekly_trends.map((item, idx) => {
                  const dateObj = new Date(item.date);
                  const dow = DAYS_OF_WEEK[dateObj.getUTCDay()];
                  const barHeightPct = Math.min(100, Math.round((item.focus_minutes / maxWeeklyMinutes) * 100));
                  const isToday = idx === overview.weekly_trends.length - 1;

                  return (
                    <View key={item.date} style={styles.barColumn}>
                      <Text style={styles.barTopVal}>
                        {item.focus_minutes > 0 ? `${item.focus_minutes}m` : '0'}
                      </Text>

                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barFill,
                            {
                              height: `${Math.max(6, barHeightPct)}%`,
                              backgroundColor: isToday ? '#22D3EE' : '#0891B2',
                            },
                          ]}
                        />
                      </View>

                      <Text style={[styles.barDowText, isToday && styles.barDowTextToday]}>
                        {dow}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* Academic Quiz Mastery Curve */}
          {overview?.quiz_mastery_curve && overview.quiz_mastery_curve.length > 0 ? (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <View style={{ gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 16 }}>🎯</Text>
                    <Text style={styles.sectionTitle}>QUIZ MASTERY PROGRESSION</Text>
                  </View>
                  <Text style={styles.sectionSubtitle}>
                    Average accuracy: {overview.average_quiz_score}% across {overview.quizzes_taken_count} quizzes
                  </Text>
                </View>
              </View>

              <View style={styles.quizList}>
                {overview.quiz_mastery_curve.map((q, idx) => {
                  const isHigh = q.score_percentage >= 80;
                  const isMed = q.score_percentage >= 60;
                  const badgeColor = isHigh ? '#34D399' : isMed ? '#FBBF24' : '#F87171';

                  return (
                    <View key={`quiz-${idx}`} style={styles.quizRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.quizTitleText} numberOfLines={1}>
                          {q.quiz_title}
                        </Text>
                        <Text style={styles.quizDateText}>{q.date} • {q.total_questions} Questions</Text>
                      </View>

                      <View style={[styles.quizScorePill, { borderColor: badgeColor }]}>
                        <Text style={[styles.quizScoreText, { color: badgeColor }]}>
                          {q.score_percentage}%
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* Academic Milestones & Badges Showcase */}
          {overview?.milestones && overview.milestones.length > 0 ? (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <View style={{ gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 16 }}>🏅</Text>
                    <Text style={styles.sectionTitle}>STUDY MILESTONES & ACHIEVEMENTS</Text>
                  </View>
                  <Text style={styles.sectionSubtitle}>
                    Badges unlocked through disciplined focus and academic rigor
                  </Text>
                </View>
              </View>

              <View style={styles.milestonesGrid}>
                {overview.milestones.map((m) => (
                  <View
                    key={m.id}
                    style={[
                      styles.milestoneCard,
                      m.unlocked ? styles.milestoneCardUnlocked : styles.milestoneCardLocked,
                    ]}>
                    <Text style={styles.milestoneIcon}>{m.icon}</Text>
                    <Text style={styles.milestoneTitle}>{m.title}</Text>
                    <Text style={styles.milestoneDesc}>{m.description}</Text>
                    <View
                      style={[
                        styles.milestoneProgressBadge,
                        m.unlocked && styles.milestoneProgressUnlocked,
                      ]}>
                      <Text
                        style={[
                          styles.milestoneProgressText,
                          m.unlocked && styles.milestoneProgressTextUnlocked,
                        ]}>
                        {m.unlocked ? '✓ UNLOCKED' : m.progress_text}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </>
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: Spacing.xl,
    gap: 16,
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
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backArrow: {
    fontSize: 20,
    fontWeight: '700',
  },

  // Timeframe selector
  timeframeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 14,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    width: '100%',
  },
  timeframePill: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 11,
  },
  timeframePillActive: {
    backgroundColor: '#0891B2',
  },
  timeframeText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  timeframeTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  loadingBox: {
    paddingVertical: 50,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 13,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    width: '100%',
  },
  statCard: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: '#09101F',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 4,
  },
  statHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  statEmoji: {
    fontSize: 20,
  },
  statBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statBadgeText: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statMainVal: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  statUnit: {
    color: '#67E8F9',
    fontSize: 14,
    fontWeight: '700',
  },
  statSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },

  // Section Cards
  sectionCard: {
    width: '100%',
    backgroundColor: '#09101F',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: '#67E8F9',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  sectionSubtitle: {
    color: '#94A3B8',
    fontSize: 11.5,
  },

  // Heatmap styles
  heatmapScroll: {
    width: '100%',
  },
  heatmapContainer: {
    paddingVertical: 6,
  },
  monthLabelsRow: {
    height: 16,
    position: 'relative',
    marginBottom: 6,
  },
  monthLabelText: {
    position: 'absolute',
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
  },
  gridRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dowColumn: {
    gap: 6,
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  dowLabel: {
    color: '#64748B',
    fontSize: 9.5,
    fontWeight: '700',
    height: 12,
  },
  columnsWrapper: {
    flexDirection: 'row',
    gap: 3.5,
  },
  heatmapCol: {
    gap: 3.5,
  },
  heatmapCell: {
    width: 12,
    height: 12,
    borderRadius: 2.5,
  },
  heatmapPadCell: {
    width: 12,
    height: 12,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    justifyContent: 'flex-end',
  },
  legendLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '600',
  },
  legendCell: {
    width: 10,
    height: 10,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },

  // Day inspection card
  dayInspectCard: {
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#06B6D4',
    gap: 8,
  },
  dayInspectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayInspectDate: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  dayInspectClose: {
    color: '#94A3B8',
    fontSize: 14,
    paddingHorizontal: 6,
  },
  dayInspectMetricsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dayInspectPill: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderRadius: 8,
    paddingVertical: 6,
    alignItems: 'center',
  },
  dayInspectPillVal: {
    color: '#22D3EE',
    fontSize: 13,
    fontWeight: '800',
  },
  dayInspectPillLabel: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '600',
    marginTop: 1,
  },

  // Stacked progress bar
  stackedBarContainer: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  stackedBarSegment: {
    height: '100%',
  },
  subjectList: {
    gap: 10,
  },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  subjectColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  subjectCodeBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  subjectCodeText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
  },
  subjectRowName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 1,
  },
  subjectRowSub: {
    color: '#94A3B8',
    fontSize: 10.5,
    marginTop: 1,
  },
  subjectHoursVal: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  subjectPctBadge: {
    fontSize: 11,
    fontWeight: '800',
  },

  // Weekly bar chart
  barChartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 130,
    paddingTop: 16,
    paddingHorizontal: 4,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
    gap: 6,
  },
  barTopVal: {
    color: '#94A3B8',
    fontSize: 9.5,
    fontWeight: '700',
  },
  barTrack: {
    width: 16,
    height: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 8,
  },
  barDowText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
  },
  barDowTextToday: {
    color: '#22D3EE',
    fontWeight: '900',
  },

  // Quiz list
  quizList: {
    gap: 8,
  },
  quizRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  quizTitleText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  quizDateText: {
    color: '#94A3B8',
    fontSize: 10.5,
    marginTop: 2,
  },
  quizScorePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1.2,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  quizScoreText: {
    fontSize: 12.5,
    fontWeight: '900',
  },

  // Milestones Grid
  milestonesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  milestoneCard: {
    flexBasis: '48%',
    flexGrow: 1,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.2,
    gap: 4,
  },
  milestoneCardUnlocked: {
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    borderColor: 'rgba(6, 182, 212, 0.5)',
  },
  milestoneCardLocked: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderColor: 'rgba(255, 255, 255, 0.06)',
    opacity: 0.65,
  },
  milestoneIcon: {
    fontSize: 22,
    marginBottom: 2,
  },
  milestoneTitle: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
  },
  milestoneDesc: {
    color: '#94A3B8',
    fontSize: 10.5,
    lineHeight: 14,
  },
  milestoneProgressBadge: {
    marginTop: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignSelf: 'flex-start',
  },
  milestoneProgressUnlocked: {
    backgroundColor: 'rgba(6, 182, 212, 0.25)',
  },
  milestoneProgressText: {
    color: '#94A3B8',
    fontSize: 9.5,
    fontWeight: '800',
  },
  milestoneProgressTextUnlocked: {
    color: '#67E8F9',
  },

  // Empty state box
  emptyCardBox: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 6,
  },
  emptyCardTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  emptyCardSub: {
    color: '#94A3B8',
    fontSize: 11.5,
    textAlign: 'center',
    maxWidth: 240,
  },
});
