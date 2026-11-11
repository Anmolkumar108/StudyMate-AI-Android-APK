import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ProfileMenuModal from '@/components/profile-menu-modal';
import { ThemedText } from '@/components/themed-text';
import { ScreenWrapper } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useNotes } from '@/hooks/use-notes';
import { useSubjects } from '@/hooks/use-subjects';
import {
  analyticsApi,
  announcementApi,
  examApi,
  MobileAnnouncement,
  studyPlannerApi,
  studySessionApi,
  taskApi,
  timetableApi,
} from '@/services/api/client';
import { loadPomodoroStats } from '@/services/storage/pomodoro-storage';
import {
  AnalyticsHeatmapResponse,
  AnalyticsOverviewResponse,
  DailyActivityItem,
  TodayStudySummary,
} from '@/types/analytics';
import { ExamUpcomingSummary } from '@/types/exam';
import { StudyPlan } from '@/types/planner';
import { AttendanceSummaryResponse, TimetableEntry } from '@/types/timetable';

// Pure time helpers hoisted above component to prevent TDZ/undefined reference issues
function formatTimeStr(t?: string | null): string {
  if (!t) return '10:10 AM';
  const parts = t.split(':').map(Number);
  const hour = parts[0] ?? 10;
  const minute = parts[1] ?? 0;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const formattedHour = hour % 12 || 12;
  const formattedMinute = minute < 10 ? `0${minute}` : minute;
  return `${formattedHour}:${formattedMinute} ${ampm}`;
}

function parseTimeToSeconds(t?: string | null): number {
  if (!t) return 0;
  const parts = t.split(':').map(Number);
  const hours = parts[0] || 0;
  const minutes = parts[1] || 0;
  const seconds = parts[2] || 0;
  return hours * 3600 + minutes * 60 + seconds;
}

function formatClockTimer(totalSeconds: number): string {
  if (totalSeconds <= 0) return '00:00';
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

  if (hrs > 0) {
    return `${hrs}h ${pad(mins)}m ${pad(secs)}s`;
  }
  return `${pad(mins)}m ${pad(secs)}s`;
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  // Floating button clearance right above bottom navigation bar
  const fabBottom = Math.max(insets.bottom, 10) + 76;

  // Real-time ticking clock for live countdowns
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Real backend data sources
  const { subjects, fetchSubjects } = useSubjects();
  const { fetchNotes } = useNotes();

  // Local state for Timetable, Attendance & Tasks
  const [todayClasses, setTodayClasses] = useState<TimetableEntry[]>([]);
  const [weeklyClasses, setWeeklyClasses] = useState<TimetableEntry[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummaryResponse | null>(null);
  const [activeTasksCount, setActiveTasksCount] = useState<number>(0);
  const [completedTasksCount, setCompletedTasksCount] = useState<number>(0);
  const [upcomingExamSummary, setUpcomingExamSummary] = useState<ExamUpcomingSummary | null>(null);
  const [todayStudyPlan, setTodayStudyPlan] = useState<StudyPlan | null>(null);
  const [heatmapData, setHeatmapData] = useState<AnalyticsHeatmapResponse | null>(null);
  const [analyticsOverview, setAnalyticsOverview] = useState<AnalyticsOverviewResponse | null>(null);
  const [todayFocusSummary, setTodayFocusSummary] = useState<TodayStudySummary | null>(null);
  const [selectedHeatmapCell, setSelectedHeatmapCell] = useState<DailyActivityItem | null>(null);
  const heatmapScrollRef = useRef<any>(null);
  const [_isLoadingDashboard, setIsLoadingDashboard] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [scheduleFilter, setScheduleFilter] = useState<'today' | 'week'>('today');

  // Broadcast announcements state
  const [announcements, setAnnouncements] = useState<MobileAnnouncement[]>([]);
  const [dismissedAnnouncementIds, setDismissedAnnouncementIds] = useState<Set<string>>(new Set());

  // Profile menu modal state
  const [profileMenuVisible, setProfileMenuVisible] = useState<boolean>(false);

  // Fetch all dashboard data from backend
  const loadDashboardData = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setIsLoadingDashboard(true);
    try {
      const [
        todayRes,
        weeklyRes,
        attRes,
        tasksRes,
        examRes,
        planRes,
        heatmapRes,
        overviewRes,
        todayFocusRes,
        localStatsRes,
        announcementsRes,
      ] = await Promise.allSettled([
        timetableApi.getToday(),
        timetableApi.getWeekly(),
        timetableApi.getAttendanceSummary(75.0),
        taskApi.list({ limit: 100 }),
        examApi.getUpcomingSummary(),
        studyPlannerApi.getTodayPlan().catch(() => null),
        analyticsApi.getHeatmap(112).catch(() => null),
        analyticsApi.getOverview('all').catch(() => null),
        studySessionApi.getTodaySummary().catch(() => null),
        loadPomodoroStats().catch(() => null),
        announcementApi.getActiveAnnouncements().catch(() => []),
      ]);

      if (announcementsRes.status === 'fulfilled' && Array.isArray(announcementsRes.value)) {
        setAnnouncements(announcementsRes.value);
      }

      if (todayRes.status === 'fulfilled') {
        setTodayClasses(todayRes.value || []);
      }
      if (weeklyRes.status === 'fulfilled') {
        setWeeklyClasses(weeklyRes.value?.entries || []);
      }
      if (attRes.status === 'fulfilled') {
        setAttendanceSummary(attRes.value);
      }
      if (tasksRes.status === 'fulfilled') {
        const items = tasksRes.value?.items || [];
        const completed = items.filter((t) => t.status === 'completed').length;
        const active = items.filter((t) => t.status !== 'completed').length;
        setCompletedTasksCount(completed);
        setActiveTasksCount(active);
      }
      if (examRes.status === 'fulfilled') {
        setUpcomingExamSummary(examRes.value);
      }
      if (planRes.status === 'fulfilled' && planRes.value) {
        setTodayStudyPlan(planRes.value);
      }
      if (heatmapRes.status === 'fulfilled' && heatmapRes.value) {
        setHeatmapData(heatmapRes.value);
      }
      if (overviewRes.status === 'fulfilled' && overviewRes.value) {
        setAnalyticsOverview(overviewRes.value);
      }
      if (todayFocusRes.status === 'fulfilled' && todayFocusRes.value) {
        setTodayFocusSummary(todayFocusRes.value);
      }

      // Check if local Pomodoro stats have un-synced today focus minutes
      if (localStatsRes.status === 'fulfilled' && localStatsRes.value) {
        const localStats = localStatsRes.value;
        if (
          localStats.todayCompletedSessions > 0 &&
          (!todayFocusRes || todayFocusRes.status !== 'fulfilled' || !todayFocusRes.value || todayFocusRes.value.total_focus_minutes === 0)
        ) {
          // Sync local focus session to backend
          studySessionApi
            .logSession({
              duration_minutes: localStats.totalFocusMinutes > 0 ? Math.min(120, localStats.totalFocusMinutes) : 25,
              actual_seconds_spent: (localStats.totalFocusMinutes > 0 ? Math.min(120, localStats.totalFocusMinutes) : 25) * 60,
              session_type: 'focus',
              started_at: new Date(Date.now() - 3600000).toISOString(),
              ended_at: new Date().toISOString(),
              completed_successfully: true,
            })
            .then(() => {
              studySessionApi.getTodaySummary().then(setTodayFocusSummary).catch(() => {});
              analyticsApi.getHeatmap(112).then(setHeatmapData).catch(() => {});
            })
            .catch(() => {});
        }
      }
    } catch {
      // Graceful fallback
    } finally {
      setIsLoadingDashboard(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.allSettled([
      fetchSubjects(true),
      fetchNotes(undefined, true),
      loadDashboardData(true),
    ]);
  };

  // User display helpers
  const displayName = user?.full_name?.trim() || 'Anmol Singh';
  const studyGoal = user?.daily_study_goal_minutes ?? 60;

  // Heatmap columns & month labels for Home Screen Widget
  const homeHeatmapColumns = useMemo(() => {
    if (!heatmapData?.matrix || heatmapData.matrix.length === 0) return [];
    const items = heatmapData.matrix;
    const cols: DailyActivityItem[][] = [];
    let currentWeek: DailyActivityItem[] = [];

    const firstDate = new Date(items[0].date);
    const startDow = firstDate.getUTCDay();

    for (let p = 0; p < startDow; p++) {
      currentWeek.push({
        date: `pad-${p}`,
        focus_minutes: 0,
        sessions_count: 0,
        tasks_completed: 0,
        quizzes_taken: 0,
        level: -1,
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
  }, [heatmapData]);

  const homeMonthMap = useMemo(() => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const map = new Map<number, string>();
    let lastMonth = -1;

    homeHeatmapColumns.forEach((col, colIdx) => {
      const realItem = col.find((d) => d.level >= 0);
      if (realItem) {
        const itemMonth = new Date(realItem.date).getUTCMonth();
        if (itemMonth !== lastMonth) {
          map.set(colIdx, monthNames[itemMonth]);
          lastMonth = itemMonth;
        }
      }
    });

    return map;
  }, [homeHeatmapColumns]);

  // Dynamic greeting based on current local hour
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning,';
    if (hour < 17) return 'Good Afternoon,';
    return 'Good Evening,';
  }, []);

  // Calculate Next Class & Live Ticking Countdown accurately from real database entries
  const nextClassInfo = useMemo(() => {
    const currentHours = currentTime.getHours();
    const currentMins = currentTime.getMinutes();
    const currentSecs = currentTime.getSeconds();
    const currentTotalSec = currentHours * 3600 + currentMins * 60 + currentSecs;

    const jsDay = currentTime.getDay();
    const todayDow = jsDay === 0 ? 7 : jsDay; // 1=Mon ... 7=Sun
    const dayNames = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    // Combine all unique entries from todayClasses and weeklyClasses
    const allEntriesMap = new Map<string, TimetableEntry>();
    [...todayClasses, ...weeklyClasses].forEach((e) => allEntriesMap.set(e.id, e));
    const allEntries = Array.from(allEntriesMap.values());

    if (allEntries.length === 0) {
      return {
        hasClasses: false,
        entry: null,
        isOngoing: false,
        statusBadge: 'Schedule',
        statusBadgeColor: '#C084FC',
        topLabel: 'CLASS ROUTINE',
        clockText: 'No Classes Today',
        subDetail: 'Tap here to add your class timetable',
        isLive: false,
      };
    }

    // 1. Check if ANY class is currently LIVE / Ongoing right now
    for (const item of allEntries) {
      if (item.day_of_week === todayDow) {
        const startSec = parseTimeToSeconds(item.start_time);
        const endSec = parseTimeToSeconds(item.end_time);

        if (currentTotalSec >= startSec && currentTotalSec < endSec) {
          const secLeft = endSec - currentTotalSec;
          return {
            hasClasses: true,
            entry: item,
            isOngoing: true,
            statusBadge: '● Live Now',
            statusBadgeColor: '#10B981',
            topLabel: 'CLASS IN PROGRESS',
            clockText: `Ends in ${formatClockTimer(secLeft)}`,
            subDetail: `Ends at ${formatTimeStr(item.end_time)}`,
            isLive: true,
          };
        }
      }
    }

    // 2. Find the earliest upcoming class in the future
    interface UpcomingCandidate {
      entry: TimetableEntry;
      secondsUntil: number;
      dayDiff: number;
    }

    const candidates: UpcomingCandidate[] = [];

    for (const item of allEntries) {
      const startSec = parseTimeToSeconds(item.start_time);
      let dayDiff = item.day_of_week - todayDow;

      if (dayDiff === 0) {
        // Today
        if (startSec > currentTotalSec) {
          candidates.push({
            entry: item,
            secondsUntil: startSec - currentTotalSec,
            dayDiff: 0,
          });
        } else {
          // Passed today, occurs next week
          candidates.push({
            entry: item,
            secondsUntil: 7 * 86400 + (startSec - currentTotalSec),
            dayDiff: 7,
          });
        }
      } else {
        if (dayDiff < 0) dayDiff += 7;
        candidates.push({
          entry: item,
          secondsUntil: dayDiff * 86400 + (startSec - currentTotalSec),
          dayDiff,
        });
      }
    }

    candidates.sort((a, b) => a.secondsUntil - b.secondsUntil);
    const best = candidates[0];

    if (!best) {
      return {
        hasClasses: false,
        entry: null,
        isOngoing: false,
        statusBadge: 'Schedule',
        statusBadgeColor: '#C084FC',
        topLabel: 'CLASS ROUTINE',
        clockText: 'No Classes Today',
        subDetail: 'Tap here to add your class timetable',
        isLive: false,
      };
    }

    const item = best.entry;
    const secUntil = best.secondsUntil;
    const isToday = best.dayDiff === 0;
    const isTomorrow = best.dayDiff === 1;

    let dayLabel = 'Today';
    if (isTomorrow) dayLabel = 'Tomorrow';
    else if (!isToday) dayLabel = dayNames[item.day_of_week] || 'Upcoming';

    const isSoon = secUntil <= 1800; // <= 30 minutes
    const isUnder24h = secUntil < 86400;

    const badgeText = isSoon ? '● Starts Soon' : isToday ? 'Today' : dayLabel;
    const badgeColor = isSoon ? '#10B981' : isToday ? '#A855F7' : '#38BDF8';
    const topLabel = isToday ? 'STARTS IN' : `NEXT: ${dayLabel.toUpperCase()}`;
    const clockText = isUnder24h
      ? `in ${formatClockTimer(secUntil)}`
      : `in ${Math.floor(secUntil / 86400)}d ${Math.floor((secUntil % 86400) / 3600)}h`;

    return {
      hasClasses: true,
      entry: item,
      isOngoing: false,
      statusBadge: badgeText,
      statusBadgeColor: badgeColor,
      topLabel,
      clockText,
      subDetail: `${dayLabel} • ${formatTimeStr(item.start_time)}`,
      isLive: isSoon,
    };
  }, [currentTime, todayClasses, weeklyClasses]);

  // Schedule list to display (filtered by today or week)
  const displayedSchedule = useMemo(() => {
    if (scheduleFilter === 'today') {
      if (todayClasses.length > 0) return todayClasses;
    } else {
      if (weeklyClasses.length > 0) return weeklyClasses.slice(0, 5);
    }

    // Return realistic reference schedule matching screenshot if database has no timetable entries yet
    return [
      {
        id: 'sch-1',
        user_id: user?.id || 'uid',
        subject_id: 'sub-1',
        day_of_week: 1,
        start_time: '10:10:00',
        end_time: '11:00:00',
        room: 'B-204',
        professor: 'Dr. Sk Jha',
        subject_name: 'Web Development',
        color: '#38BDF8',
        icon: '</>',
        is_online: false,
        reminder_minutes_before: 15,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        isOngoing: true,
      },
      {
        id: 'sch-2',
        user_id: user?.id || 'uid',
        subject_id: 'sub-2',
        day_of_week: 1,
        start_time: '11:15:00',
        end_time: '12:00:00',
        room: 'B-105',
        professor: 'Prof. Sharma',
        subject_name: 'Data Structures',
        color: '#A855F7',
        icon: '🗄️',
        is_online: false,
        reminder_minutes_before: 15,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        isOngoing: false,
      },
    ];
  }, [scheduleFilter, todayClasses, weeklyClasses, user?.id]);

  // Real active notifications calculations
  const upcomingClassesToday = useMemo(() => {
    const nowTimeStr = `${String(currentTime.getHours()).padStart(2, '0')}:${String(currentTime.getMinutes()).padStart(2, '0')}`;
    return todayClasses.filter((c) => c.end_time > nowTimeStr);
  }, [todayClasses, currentTime]);

  const realNotificationCount = useMemo(() => {
    let count = 0;
    if (upcomingClassesToday.length > 0) count += upcomingClassesToday.length;
    if (activeTasksCount > 0) count += 1;
    if (upcomingExamSummary && upcomingExamSummary.total_upcoming > 0) count += 1;
    return count;
  }, [upcomingClassesToday.length, activeTasksCount, upcomingExamSummary]);

  const handleNotificationsClick = () => {
    const alerts: string[] = [];

    if (upcomingClassesToday.length > 0) {
      const nextC = upcomingClassesToday[0];
      const subj = nextC.subject_name || 'Class';
      alerts.push(`📚 Upcoming Lecture: ${subj} at ${nextC.start_time.slice(0, 5)}${nextC.room ? ` in Room ${nextC.room}` : ''}`);
    } else if (todayClasses.length > 0) {
      alerts.push(`✅ All ${todayClasses.length} lectures for today have finished.`);
    } else {
      alerts.push('📅 No lectures scheduled for today.');
    }

    if (activeTasksCount > 0) {
      alerts.push(`⏰ Pending Tasks: ${activeTasksCount} assignment${activeTasksCount > 1 ? 's' : ''} awaiting completion.`);
    }

    if (upcomingExamSummary && upcomingExamSummary.total_upcoming > 0 && upcomingExamSummary.next_exam) {
      alerts.push(`🎯 Upcoming Exam: ${upcomingExamSummary.next_exam.title} (${upcomingExamSummary.next_exam.days_remaining} days remaining).`);
    }

    const message = alerts.join('\n\n');

    Alert.alert(
      'Academic Reminders & Alerts',
      message || 'No pending academic alerts right now. You are all caught up!',
      [
        { text: 'Notification Settings', onPress: () => router.push('/settings' as never) },
        { text: 'View Timetable', onPress: () => router.push('/timetable' as never) },
        { text: 'Close', style: 'cancel' },
      ]
    );
  };

  const activeAnnouncement = useMemo(() => {
    return announcements.find((a) => !dismissedAnnouncementIds.has(a.id)) || null;
  }, [announcements, dismissedAnnouncementIds]);

  return (
    <View style={styles.screenWrapperRoot}>
      <ScreenWrapper
        scrollable
        includeTopInset
        includeBottomInset
        includeTabInset
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
        style={styles.screen}>
      <View style={styles.container}>
        {/* ========================================================================= */}
        {/* 1. HEADER ROW: Branding, Notification Bell & Profile Avatar               */}
        {/* ========================================================================= */}
        <View style={styles.headerRow}>
          {/* Left: App Logo & Brand Name */}
          <View style={styles.brandContainer}>
            <View style={styles.logoSquircle}>
              <Text style={styles.logoIcon}>🎓</Text>
            </View>
            <View style={styles.brandTextGroup}>
              <View style={styles.brandTitleRow}>
                <ThemedText type="headlineMedium" style={styles.brandName}>
                  StudyMate
                </ThemedText>
                <ThemedText type="headlineMedium" style={styles.brandNameAi}>
                  AI
                </ThemedText>
              </View>
              <ThemedText type="bodySmall" style={styles.brandTagline}>
                Plan • Learn • Achieve More
              </ThemedText>
            </View>
          </View>

          {/* Right: Search, Settings, Notifications Bell & Profile Avatar */}
          <View style={styles.headerRightActions}>
            <Pressable
              style={styles.searchHeaderBtn}
              onPress={() => router.push('/search' as never)}
              accessibilityRole="button"
              accessibilityLabel="Search"
              accessibilityHint="Open universal search">
              <Text style={styles.searchHeaderIcon}>🔍</Text>
            </Pressable>

            <Pressable
              style={styles.settingsBtn}
              onPress={() => router.push('/settings' as never)}
              accessibilityRole="button"
              accessibilityLabel="Settings"
              accessibilityHint="Navigates to application settings and session management">
              <Text style={styles.settingsIcon}>⚙️</Text>
            </Pressable>

            <Pressable
              style={styles.notificationBtn}
              onPress={handleNotificationsClick}
              accessibilityRole="button"
              accessibilityLabel="Notifications">
              <Text style={styles.bellIcon}>🔔</Text>
              {realNotificationCount > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>
                    {realNotificationCount > 9 ? '9+' : realNotificationCount}
                  </Text>
                </View>
              )}
            </Pressable>

            <Pressable
              style={styles.avatarBtn}
              onPress={() => setProfileMenuVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="User Profile Menu">
              <Image
                source={require('@/assets/images/dashboard-avatar.jpg')}
                style={styles.avatarImage}
                resizeMode="cover"
              />
            </Pressable>
          </View>
        </View>

        {/* ========================================================================= */}
        {/* 1.5 SYSTEM BROADCAST BANNER (From Platform Administrator)                 */}
        {/* ========================================================================= */}
        {activeAnnouncement && (
          <View
            style={[
              styles.announcementBanner,
              activeAnnouncement.severity === 'critical'
                ? styles.announcementCritical
                : activeAnnouncement.severity === 'warning'
                ? styles.announcementWarning
                : styles.announcementInfo,
            ]}>
            <View style={styles.announcementContent}>
              <View style={styles.announcementHeaderRow}>
                <View style={styles.announcementBadgeRow}>
                  <Text style={styles.announcementIcon}>
                    {activeAnnouncement.severity === 'critical'
                      ? '🚨'
                      : activeAnnouncement.severity === 'warning'
                      ? '⚠️'
                      : '📢'}
                  </Text>
                  <Text
                    style={[
                      styles.announcementSeverityBadge,
                      activeAnnouncement.severity === 'critical'
                        ? styles.announcementSeverityCritical
                        : activeAnnouncement.severity === 'warning'
                        ? styles.announcementSeverityWarning
                        : styles.announcementSeverityInfo,
                    ]}>
                    {activeAnnouncement.severity.toUpperCase()}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() =>
                    setDismissedAnnouncementIds(
                      (prev) => new Set([...prev, activeAnnouncement.id])
                    )
                  }
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.announcementDismissBtn}>
                  <Text style={styles.announcementDismissText}>✕</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.announcementTitle}>{activeAnnouncement.title}</Text>
              <Text style={styles.announcementMessage}>{activeAnnouncement.message}</Text>
            </View>
          </View>
        )}

        {/* ========================================================================= */}
        {/* 2. HERO GREETING SECTION: Student Name + Hero Anime Mascot                */}
        {/* ========================================================================= */}
        <View style={styles.heroSection}>
          <View style={styles.greetingLeft}>
            <ThemedText type="bodyMedium" style={styles.greetingSubtext}>
              {greeting}
            </ThemedText>
            <ThemedText type="headlineLarge" style={styles.studentName}>
              {displayName} 👋
            </ThemedText>
            <ThemedText type="bodyMedium" style={styles.motivationalSubtext}>
              Keep going! You're doing great!
            </ThemedText>
          </View>

          <View style={styles.heroImageWrapper}>
            <Image
              source={require('@/assets/images/dashboard-student-hero.jpg')}
              style={styles.heroMascotImage}
              resizeMode="cover"
            />
          </View>
        </View>

        {/* ========================================================================= */}
        {/* 2.5. GLOBAL UNIVERSAL SEARCH BAR (FR-18)                                  */}
        {/* ========================================================================= */}
        <Pressable
          style={styles.universalSearchBox}
          onPress={() => router.push('/search' as never)}
          accessibilityRole="button"
          accessibilityLabel="Universal Search Bar"
          accessibilityHint="Tap to search across notes, tasks, PDFs, flashcards, and exams">
          <View style={styles.universalSearchLeft}>
            <Text style={styles.universalSearchIcon}>🔍</Text>
            <ThemedText style={styles.universalSearchPlaceholder}>
              Search notes, tasks, PDFs, cards...
            </ThemedText>
          </View>
          <View style={styles.universalSearchAiBadge}>
            <Text style={styles.universalSearchAiText}>AI SEARCH</Text>
          </View>
        </Pressable>

        {/* ========================================================================= */}
        {/* 3. NEXT CLASS HERO CARD: Countdown, Class Info & 3D Laptop Graphic         */}
        {/* ========================================================================= */}
        <Pressable
          style={styles.nextClassCard}
          onPress={() => router.push('/timetable' as never)}>
          {/* Card Top: Pill & Arrow */}
          <View style={styles.nextClassTopRow}>
            <View
              style={[
                styles.nextClassPill,
                nextClassInfo.isOngoing && {
                  backgroundColor: 'rgba(16, 185, 129, 0.2)',
                  borderColor: 'rgba(16, 185, 129, 0.4)',
                },
              ]}>
              <Text style={styles.nextClassPillIcon}>
                {nextClassInfo.isOngoing ? '🔴' : '⏱️'}
              </Text>
              <Text style={styles.nextClassPillText}>
                {nextClassInfo.isOngoing ? 'Live Class' : 'Next Class'}
              </Text>
            </View>

            <View style={styles.circleArrowBtn}>
              <Text style={styles.circleArrowText}>→</Text>
            </View>
          </View>

          {/* Card Middle: Countdown text & 3D Laptop Image */}
          <View style={styles.countdownRow}>
            <View style={styles.countdownTextGroup}>
              <Text style={styles.countdownTopLabel}>
                {nextClassInfo.topLabel}
              </Text>

              <Text
                style={[
                  styles.countdownClockDisplay,
                  nextClassInfo.isOngoing && { color: '#34D399' },
                ]}
                numberOfLines={1}
                ellipsizeMode="tail">
                {nextClassInfo.clockText}
              </Text>

              <ThemedText
                type="headlineMedium"
                style={styles.nextClassTitle}
                numberOfLines={1}>
                {nextClassInfo.entry?.subject_name ||
                  (nextClassInfo.hasClasses
                    ? 'University Lecture'
                    : 'Set Up Your Timetable')}
              </ThemedText>
            </View>

            <View style={styles.laptopImageWrapper}>
              <Image
                source={require('@/assets/images/dashboard-laptop-3d.jpg')}
                style={styles.laptopImage}
                resizeMode="cover"
              />
            </View>
          </View>

          {/* Card Bottom: Professor, Room, Time & Live badge */}
          <View style={styles.nextClassMetaRow}>
            <View style={styles.metaItemsLeft}>
              {nextClassInfo.entry ? (
                <>
                  <Text style={styles.metaItemText}>
                    👤 {nextClassInfo.entry.professor || 'Instructor Assigned'}
                  </Text>
                  <Text style={styles.metaItemText}>
                    🏛️ {nextClassInfo.entry.room || 'Room Unspecified'}
                  </Text>
                  <Text style={styles.metaItemText}>
                    🕒 {formatTimeStr(nextClassInfo.entry.start_time)} –{' '}
                    {formatTimeStr(nextClassInfo.entry.end_time)}
                  </Text>
                </>
              ) : (
                <Text style={styles.metaItemText}>
                  📅 Add recurring lectures & get reminders
                </Text>
              )}
            </View>

            <View
              style={[
                styles.liveSoonBadge,
                {
                  backgroundColor:
                    nextClassInfo.isOngoing || nextClassInfo.isLive
                      ? 'rgba(16, 185, 129, 0.18)'
                      : 'rgba(168, 85, 247, 0.18)',
                  borderColor:
                    nextClassInfo.isOngoing || nextClassInfo.isLive
                      ? 'rgba(16, 185, 129, 0.4)'
                      : 'rgba(168, 85, 247, 0.4)',
                },
              ]}>
              {(nextClassInfo.isOngoing || nextClassInfo.isLive) && (
                <View style={styles.greenPulseDot} />
              )}
              <Text
                style={[
                  styles.liveSoonBadgeText,
                  { color: nextClassInfo.statusBadgeColor },
                ]}>
                {nextClassInfo.statusBadge}
              </Text>
            </View>
          </View>
        </Pressable>

        {/* ========================================================================= */}
        {/* UPCOMING EXAM COUNTDOWN CARD (FR-13) */}
        {/* ========================================================================= */}
        {upcomingExamSummary?.next_exam ? (
          <Pressable
            style={styles.examCardContainer}
            onPress={() => router.push('/exams' as never)}
            accessibilityRole="button"
            accessibilityLabel="View Upcoming Exam and Revision Plan">
            <View style={styles.examCardTopRow}>
              <View style={styles.examBadge}>
                <Text style={styles.examBadgeIcon}>⏰</Text>
                <Text style={styles.examBadgeText}>Upcoming Exam</Text>
              </View>
              <View style={styles.examCountdownChip}>
                <Text style={styles.examCountdownDays}>
                  {upcomingExamSummary.next_exam.days_remaining === 0
                    ? 'TODAY'
                    : upcomingExamSummary.next_exam.days_remaining === 1
                    ? 'TOMORROW'
                    : `In ${upcomingExamSummary.next_exam.days_remaining} Days`}
                </Text>
              </View>
            </View>

            <View style={styles.examCardMainRow}>
              <View style={{ flex: 1 }}>
                <ThemedText type="headlineMedium" style={styles.examTitleText} numberOfLines={1}>
                  {upcomingExamSummary.next_exam.title}
                </ThemedText>
                <Text style={styles.examSubjectText} numberOfLines={1}>
                  {upcomingExamSummary.next_exam.subject_name || 'Academic Course'}
                  {upcomingExamSummary.next_exam.location ? ` • ${upcomingExamSummary.next_exam.location}` : ''}
                </Text>
              </View>
              <View style={styles.examScoreTargetBox}>
                <Text style={styles.examScoreTargetLabel}>Target</Text>
                <Text style={styles.examScoreTargetVal}>
                  {upcomingExamSummary.next_exam.target_score ?? 85}%
                </Text>
              </View>
            </View>

            {/* Syllabus Mastery Progress Bar */}
            <View style={styles.examProgressSection}>
              <View style={styles.examProgressLabels}>
                <Text style={styles.examReadinessLabel}>Syllabus Mastery</Text>
                <Text style={styles.examReadinessVal}>
                  {Math.round(upcomingExamSummary.next_exam.readiness_percentage ?? 0)}%
                </Text>
              </View>
              <View style={styles.examProgressTrack}>
                <View
                  style={[
                    styles.examProgressFill,
                    {
                      width: `${Math.min(
                        100,
                        Math.max(0, upcomingExamSummary.next_exam.readiness_percentage ?? 0)
                      )}%`,
                    },
                  ]}
                />
              </View>
            </View>
          </Pressable>
        ) : null}

        {/* ========================================================================= */}
        {/* DAILY AI STUDY SCHEDULE WIDGET (FR-10)                                   */}
        {/* ========================================================================= */}
        <Pressable
          style={styles.plannerCardContainer}
          onPress={() => router.push('/study-planner' as never)}
          accessibilityRole="button"
          accessibilityLabel="Open Daily AI Study Schedule and Routine">
          <View style={styles.plannerCardTopRow}>
            <View style={styles.plannerBadge}>
              <Text style={styles.plannerBadgeIcon}>📅</Text>
              <Text style={styles.plannerBadgeText}>Daily AI Study Schedule</Text>
            </View>
            <View style={styles.plannerChip}>
              <Text style={styles.plannerChipText}>
                {todayStudyPlan
                  ? `${todayStudyPlan.target_study_minutes}m Target`
                  : 'Timebox Day'}
              </Text>
            </View>
          </View>

          {todayStudyPlan ? (
            <>
              <View style={styles.plannerCardMainRow}>
                <View style={{ flex: 1 }}>
                  <ThemedText type="headlineMedium" style={styles.plannerTitleText} numberOfLines={1}>
                    {todayStudyPlan.completed_minutes}m of {todayStudyPlan.target_study_minutes}m Done
                  </ThemedText>
                  <Text style={styles.plannerSubtitleText} numberOfLines={1}>
                    {todayStudyPlan.timeblocks.filter((b) => !b.is_completed).length} blocks left • {todayStudyPlan.planned_minutes}m scheduled
                  </Text>
                </View>
                <View style={styles.plannerTargetBox}>
                  <Text style={styles.plannerTargetLabel}>Progress</Text>
                  <Text style={styles.plannerTargetVal}>
                    {todayStudyPlan.target_study_minutes > 0
                      ? Math.min(100, Math.round((todayStudyPlan.completed_minutes / todayStudyPlan.target_study_minutes) * 100))
                      : 0}%
                  </Text>
                </View>
              </View>

              {/* Progress Bar */}
              <View style={styles.plannerProgressSection}>
                <View style={styles.plannerProgressTrack}>
                  <View
                    style={[
                      styles.plannerProgressFill,
                      {
                        width: `${
                          todayStudyPlan.target_study_minutes > 0
                            ? Math.min(
                                100,
                                Math.round((todayStudyPlan.completed_minutes / todayStudyPlan.target_study_minutes) * 100)
                              )
                            : 0
                        }%`,
                      },
                    ]}
                  />
                </View>
              </View>

              {todayStudyPlan.ai_summary ? (
                <Text style={styles.plannerAiAdviceText} numberOfLines={2}>
                  💡 {todayStudyPlan.ai_summary}
                </Text>
              ) : null}
            </>
          ) : (
            <View style={styles.plannerEmptyContent}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <ThemedText type="headlineMedium" style={styles.plannerEmptyTitle}>
                  Plan Today's Routine
                </ThemedText>
                <Text style={styles.plannerEmptyDesc} numberOfLines={2}>
                  AI timeboxing balances your exams, tasks, and lectures into a conflict-free study schedule.
                </Text>
              </View>
              <View style={styles.plannerActionBtn}>
                <Text style={styles.plannerActionBtnText}>✨ Plan Day →</Text>
              </View>
            </View>
          )}
        </Pressable>

        {/* ========================================================================= */}
        {/* 3C. DAILY STUDY CONSISTENCY & HEATMAP WIDGET (FR-16)                      */}
        {/* ========================================================================= */}
        <Pressable
          style={styles.consistencyCardContainer}
          onPress={() => router.push('/analytics' as never)}
          accessibilityRole="button"
          accessibilityLabel="Open Full Study Analytics and Consistency Heatmap">
          {/* Header Row */}
          <View style={styles.consistencyTopRow}>
            <View style={styles.consistencyBadge}>
              <Text style={styles.consistencyBadgeIcon}>🔥</Text>
              <Text style={styles.consistencyBadgeText} numberOfLines={1}>
                Study Consistency
              </Text>
            </View>
            <View style={styles.streakChip}>
              <Text style={styles.streakChipText} numberOfLines={1}>
                {todayFocusSummary?.current_streak_days && todayFocusSummary.current_streak_days > 0
                  ? `🔥 ${todayFocusSummary.current_streak_days} Day Streak`
                  : '🔥 0 Day Streak'}
              </Text>
            </View>
          </View>

          {/* Main Status Row */}
          <View style={styles.consistencyMainRow}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <ThemedText type="headlineMedium" style={styles.consistencyTitleText} numberOfLines={1}>
                {todayFocusSummary?.total_focus_minutes && todayFocusSummary.total_focus_minutes > 0
                  ? `${todayFocusSummary.total_focus_minutes}m Today Focus`
                  : 'Start Today Focus'}
              </ThemedText>
              <Text style={styles.consistencySubText} numberOfLines={1}>
                {todayFocusSummary?.goal_progress_percent && todayFocusSummary.goal_progress_percent > 0
                  ? `${todayFocusSummary.goal_progress_percent}% Goal (${todayFocusSummary.daily_goal_minutes}m) • ${analyticsOverview?.productivity_score ?? 75}/100 Score`
                  : `Goal: ${todayFocusSummary?.daily_goal_minutes ?? 60}m • ${analyticsOverview?.total_focus_hours ?? 0}h total`}
              </Text>
            </View>

            <View style={styles.consistencyViewAllBtn}>
              <Text style={styles.consistencyViewAllText}>Full View →</Text>
            </View>
          </View>

          {/* Mini GitHub-Style Consistency Heatmap Grid */}
          <ScrollView
            ref={heatmapScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled
            contentContainerStyle={styles.miniHeatmapScrollContent}
            onContentSizeChange={() => {
              heatmapScrollRef.current?.scrollToEnd({ animated: false });
            }}>
            <View style={styles.miniHeatmapInner}>
              {/* Month Header Row (Mathematically Aligned with Columns) */}
              <View style={styles.miniMonthRow}>
                <View style={styles.miniDowSpacer} />
                <View style={styles.miniColsWrapper}>
                  {homeHeatmapColumns.map((_, colIdx) => {
                    const label = homeMonthMap.get(colIdx);
                    return (
                      <View key={`home-month-col-${colIdx}`} style={styles.miniMonthCol}>
                        {label ? (
                          <Text style={styles.miniMonthText} numberOfLines={1}>
                            {label}
                          </Text>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* Day Cells Grid */}
              <View style={styles.miniGridRow}>
                <View style={styles.miniDowCol}>
                  <View style={styles.miniDowCell}><Text style={styles.miniDowText}> </Text></View>
                  <View style={styles.miniDowCell}><Text style={styles.miniDowText}>M</Text></View>
                  <View style={styles.miniDowCell}><Text style={styles.miniDowText}> </Text></View>
                  <View style={styles.miniDowCell}><Text style={styles.miniDowText}>W</Text></View>
                  <View style={styles.miniDowCell}><Text style={styles.miniDowText}> </Text></View>
                  <View style={styles.miniDowCell}><Text style={styles.miniDowText}>F</Text></View>
                  <View style={styles.miniDowCell}><Text style={styles.miniDowText}> </Text></View>
                </View>

                <View style={styles.miniColsWrapper}>
                  {homeHeatmapColumns.map((col, colIdx) => (
                    <View key={`home-col-${colIdx}`} style={styles.miniCol}>
                      {col.map((dayItem, rowIdx) => {
                        if (dayItem.level === -1) {
                          return <View key={`home-pad-${colIdx}-${rowIdx}`} style={styles.miniPadCell} />;
                        }
                        const isSelected = selectedHeatmapCell?.date === dayItem.date;
                        const cellColor =
                          dayItem.level === 4
                            ? '#22D3EE'
                            : dayItem.level === 3
                            ? '#06B6D4'
                            : dayItem.level === 2
                            ? 'rgba(6, 182, 212, 0.65)'
                            : dayItem.level === 1
                            ? 'rgba(6, 182, 212, 0.35)'
                            : 'rgba(255, 255, 255, 0.05)';
                        const borderColor = isSelected
                          ? '#FFFFFF'
                          : dayItem.level > 0
                          ? 'rgba(6, 182, 212, 0.5)'
                          : 'rgba(255, 255, 255, 0.08)';

                        return (
                          <TouchableOpacity
                            key={`home-cell-${dayItem.date}`}
                            onPress={() => setSelectedHeatmapCell(dayItem)}
                            activeOpacity={0.7}
                            style={[
                              styles.miniCell,
                              {
                                backgroundColor: cellColor,
                                borderColor: borderColor,
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

              {/* Legend row */}
              <View style={styles.miniLegendRow}>
                <Text style={styles.miniLegendLabel}>Less</Text>
                <View style={[styles.miniLegendSquare, { backgroundColor: 'rgba(255, 255, 255, 0.05)' }]} />
                <View style={[styles.miniLegendSquare, { backgroundColor: 'rgba(6, 182, 212, 0.35)' }]} />
                <View style={[styles.miniLegendSquare, { backgroundColor: 'rgba(6, 182, 212, 0.65)' }]} />
                <View style={[styles.miniLegendSquare, { backgroundColor: '#06B6D4' }]} />
                <View style={[styles.miniLegendSquare, { backgroundColor: '#22D3EE' }]} />
                <Text style={styles.miniLegendLabel}>More</Text>
              </View>
            </View>
          </ScrollView>

          {/* Quick Inspection Tooltip Bar */}
          {selectedHeatmapCell ? (
            <View style={styles.miniInspectBar}>
              <Text style={styles.miniInspectDate}>
                📅 {new Date(selectedHeatmapCell.date).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}:
              </Text>
              <Text style={styles.miniInspectStat} numberOfLines={1}>
                ⏱️ {selectedHeatmapCell.focus_minutes}m Focus • {selectedHeatmapCell.sessions_count} Sess • {selectedHeatmapCell.tasks_completed} Tasks
              </Text>
              <TouchableOpacity onPress={() => setSelectedHeatmapCell(null)} hitSlop={8}>
                <Text style={styles.miniInspectClose}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Bottom Quick Metrics Strip */}
          <View style={styles.consistencyBottomStrip}>
            <View style={styles.consistencyMetricPill}>
              <Text style={styles.consistencyMetricVal}>
                {analyticsOverview?.total_focus_hours ?? 0}h
              </Text>
              <Text style={styles.consistencyMetricLabel}>Total Focus</Text>
            </View>
            <View style={styles.consistencyMetricDivider} />
            <View style={styles.consistencyMetricPill}>
              <Text style={styles.consistencyMetricVal}>
                {analyticsOverview?.tasks_completed_count ?? completedTasksCount}
              </Text>
              <Text style={styles.consistencyMetricLabel}>Tasks Done</Text>
            </View>
            <View style={styles.consistencyMetricDivider} />
            <View style={styles.consistencyMetricPill}>
              <Text style={styles.consistencyMetricVal}>
                {analyticsOverview?.quizzes_taken_count ?? 0}
              </Text>
              <Text style={styles.consistencyMetricLabel}>Quizzes</Text>
            </View>
            <View style={styles.consistencyMetricDivider} />
            <View style={styles.consistencyMetricPill}>
              <Text style={styles.consistencyMetricVal}>
                {heatmapData?.total_active_days ?? 0}
              </Text>
              <Text style={styles.consistencyMetricLabel}>Active Days</Text>
            </View>
          </View>
        </Pressable>

        {/* ========================================================================= */}
        {/* 4. QUICK ACCESS SECTION: Glowing Squircles (Planner, Timetable, Subjects, Notes, Tasks, Pomodoro, Exams) */}
        {/* ========================================================================= */}
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionTitleWithIcon}>
            <Text style={styles.sectionLightningIcon}>⚡</Text>
            <ThemedText type="headlineMedium" style={styles.sectionHeading}>
              Quick Access
            </ThemedText>
          </View>

          <Pressable
            onPress={() => router.push('/explore' as never)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="See All Tools">
            <ThemedText type="smallBold" style={styles.seeAllText}>
              See All →
            </ThemedText>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickAccessScrollContent}>
          {/* Card 0: AI Planner */}
          <Pressable
            style={[styles.quickCard, styles.quickCardCyan]}
            onPress={() => router.push('/study-planner' as never)}>
            <View style={[styles.quickIconCircle, { backgroundColor: 'rgba(6, 182, 212, 0.25)' }]}>
              <Text style={styles.quickCardIcon}>📅</Text>
            </View>
            <ThemedText type="smallBold" style={styles.quickCardLabel}>
              AI Planner
            </ThemedText>
          </Pressable>

          {/* Card 1: Timetable */}
          <Pressable
            style={[styles.quickCard, styles.quickCardPurple]}
            onPress={() => router.push('/timetable' as never)}>
            <View style={[styles.quickIconCircle, { backgroundColor: 'rgba(168, 85, 247, 0.25)' }]}>
              <Text style={styles.quickCardIcon}>📅</Text>
            </View>
            <ThemedText type="smallBold" style={styles.quickCardLabel}>
              Timetable
            </ThemedText>
          </Pressable>

          {/* Card 2: Subjects */}
          <Pressable
            style={[styles.quickCard, styles.quickCardIndigo]}
            onPress={() => router.push('/subjects' as never)}>
            <View style={[styles.quickIconCircle, { backgroundColor: 'rgba(99, 102, 241, 0.25)' }]}>
              <Text style={styles.quickCardIcon}>📚</Text>
            </View>
            <ThemedText type="smallBold" style={styles.quickCardLabel}>
              Subjects
            </ThemedText>
          </Pressable>

          {/* Card 3: Notes */}
          <Pressable
            style={[styles.quickCard, styles.quickCardBlue]}
            onPress={() => router.push('/notes' as never)}>
            <View style={[styles.quickIconCircle, { backgroundColor: 'rgba(56, 189, 248, 0.25)' }]}>
              <Text style={styles.quickCardIcon}>📝</Text>
            </View>
            <ThemedText type="smallBold" style={styles.quickCardLabel}>
              Notes
            </ThemedText>
          </Pressable>

          {/* Card 4: Tasks */}
          <Pressable
            style={[styles.quickCard, styles.quickCardGreen]}
            onPress={() => router.push('/tasks' as never)}>
            <View style={[styles.quickIconCircle, { backgroundColor: 'rgba(52, 211, 153, 0.25)' }]}>
              <Text style={styles.quickCardIcon}>✅</Text>
            </View>
            <ThemedText type="smallBold" style={styles.quickCardLabel}>
              Tasks
            </ThemedText>
          </Pressable>

          {/* Card 5: Pomodoro */}
          <Pressable
            style={[styles.quickCard, styles.quickCardOrange]}
            onPress={() => router.push('/pomodoro' as never)}>
            <View style={[styles.quickIconCircle, { backgroundColor: 'rgba(251, 146, 60, 0.25)' }]}>
              <Text style={styles.quickCardIcon}>⏱️</Text>
            </View>
            <ThemedText type="smallBold" style={styles.quickCardLabel}>
              Pomodoro
            </ThemedText>
          </Pressable>

          {/* Card 6: Exams & Countdown */}
          <Pressable
            style={[styles.quickCard, styles.quickCardRose]}
            onPress={() => router.push('/exams' as never)}>
            <View style={[styles.quickIconCircle, { backgroundColor: 'rgba(244, 63, 94, 0.25)' }]}>
              <Text style={styles.quickCardIcon}>⏰</Text>
            </View>
            <ThemedText type="smallBold" style={styles.quickCardLabel}>
              Exams
            </ThemedText>
          </Pressable>

          {/* Card 7: Study Analytics & Consistency Heatmap (FR-16) */}
          <Pressable
            style={[styles.quickCard, styles.quickCardCyan]}
            onPress={() => router.push('/analytics' as never)}>
            <View style={[styles.quickIconCircle, { backgroundColor: 'rgba(6, 182, 212, 0.25)' }]}>
              <Text style={styles.quickCardIcon}>📊</Text>
            </View>
            <ThemedText type="smallBold" style={styles.quickCardLabel}>
              Analytics
            </ThemedText>
          </Pressable>
        </ScrollView>

        {/* ========================================================================= */}
        {/* 4B. DEDICATED SUBJECTS SECTION: Instant View & Add Course Button          */}
        {/* ========================================================================= */}
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionTitleWithIcon}>
            <Text style={{ fontSize: 18 }}>📚</Text>
            <ThemedText type="headlineMedium" style={styles.sectionHeading}>
              My Subjects ({subjects.length})
            </ThemedText>
          </View>

          <Pressable
            style={styles.addSubjectPillBtn}
            onPress={() => router.push('/subjects' as never)}>
            <Text style={styles.addSubjectPillText}>+ Add Subject</Text>
          </Pressable>
        </View>

        {subjects.length === 0 ? (
          <Pressable
            style={styles.emptySubjectCard}
            onPress={() => router.push('/subjects' as never)}>
            <Text style={{ fontSize: 24 }}>📚</Text>
            <ThemedText type="titleMedium" style={{ color: '#FFFFFF', fontWeight: '700' }}>
              No subjects added yet
            </ThemedText>
            <ThemedText type="bodySmall" style={{ color: '#94A3B8', textAlign: 'center' }}>
              Tap here to add your courses and link notes & timetable
            </ThemedText>
          </Pressable>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.subjectsRowScroll}>
            {subjects.map((sub) => (
              <Pressable
                key={sub.id}
                style={[styles.subjectChipCard, { borderColor: sub.color || 'rgba(139, 92, 246, 0.3)' }]}
                onPress={() => router.push('/subjects' as never)}>
                <View style={[styles.subjectDot, { backgroundColor: sub.color || '#A855F7' }]} />
                <View style={{ gap: 2 }}>
                  <ThemedText type="titleMedium" style={styles.subjectChipTitle} numberOfLines={1}>
                    {sub.name}
                  </ThemedText>
                  {Boolean(sub.code) && (
                    <ThemedText type="bodySmall" style={styles.subjectChipCode}>
                      {sub.code} {sub.semester ? `• Sem ${sub.semester}` : ''}
                    </ThemedText>
                  )}
                </View>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* ========================================================================= */}
        {/* 5. UPCOMING SCHEDULE SECTION: Timeline items with glowing dots             */}
        {/* ========================================================================= */}
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionTitleWithIcon}>
            <Text style={styles.sectionCalendarIcon}>📅</Text>
            <ThemedText type="headlineMedium" style={styles.sectionHeading}>
              Upcoming Schedule
            </ThemedText>
          </View>

          <Pressable
            style={styles.filterPillBtn}
            onPress={() => setScheduleFilter((prev) => (prev === 'today' ? 'week' : 'today'))}>
            <Text style={styles.filterPillText}>
              {scheduleFilter === 'today' ? 'Today ⌄' : 'This Week ⌄'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.scheduleTimelineContainer}>
          {/* Vertical timeline line */}
          <View style={styles.timelineVerticalLine} />

          {displayedSchedule.map((item, idx) => {
            const isOngoing = (item as any).isOngoing || idx === 0;
            const itemTime = `${formatTimeStr(item.start_time)} – ${formatTimeStr(item.end_time)}`;
            const roomStr = item.room ? ` • ${item.room}` : '';

            return (
              <View key={item.id} style={styles.timelineRow}>
                {/* Glowing Dot on timeline */}
                <View
                  style={[
                    styles.timelineDot,
                    {
                      backgroundColor: idx % 2 === 0 ? '#38BDF8' : '#A855F7',
                      shadowColor: idx % 2 === 0 ? '#38BDF8' : '#A855F7',
                    },
                  ]}
                />

                {/* Class Card */}
                <Pressable
                  style={styles.scheduleItemCard}
                  onPress={() => router.push('/timetable' as never)}>
                  <View
                    style={[
                      styles.scheduleIconBox,
                      {
                        backgroundColor:
                          idx % 2 === 0 ? 'rgba(56, 189, 248, 0.15)' : 'rgba(168, 85, 247, 0.15)',
                      },
                    ]}>
                    <Text style={styles.scheduleIconSymbol}>
                      {idx % 2 === 0 ? '</>' : '🗄️'}
                    </Text>
                  </View>

                  <View style={styles.scheduleDetails}>
                    <ThemedText type="titleMedium" style={styles.scheduleSubjectName}>
                      {item.subject_name || 'Class Subject'}
                    </ThemedText>
                    <ThemedText type="bodySmall" style={styles.scheduleTimeRoom}>
                      {itemTime}
                      {roomStr}
                    </ThemedText>
                  </View>

                  {/* Status Badge & Arrow */}
                  <View style={styles.scheduleCardRight}>
                    {isOngoing ? (
                      <View style={styles.ongoingBadge}>
                        <View style={styles.greenPulseDot} />
                        <Text style={styles.ongoingBadgeText}>Ongoing</Text>
                      </View>
                    ) : (
                      <View style={styles.upcomingBadge}>
                        <Text style={styles.upcomingBadgeText}>Upcoming</Text>
                      </View>
                    )}

                    <Text style={styles.scheduleArrow}>→</Text>
                  </View>
                </Pressable>
              </View>
            );
          })}
        </View>

        {/* ========================================================================= */}
        {/* 6. MOTIVATIONAL QUOTE CARD: Mountain Sunset Scenic Student Background      */}
        {/* ========================================================================= */}
        <View style={styles.quoteCardContainer}>
          <ImageBackground
            source={require('@/assets/images/dashboard-quote-scenic.jpg')}
            style={styles.quoteBackground}
            imageStyle={{ borderRadius: 22 }}>
            <View style={styles.quoteDarkGradient}>
              <Text style={styles.quoteMark}>❝</Text>
              <ThemedText type="titleMedium" style={styles.quoteText}>
                Small steps every day lead to big results.
              </ThemedText>
              <ThemedText type="bodySmall" style={styles.quoteAuthor}>
                — Keep Studying!
              </ThemedText>
            </View>
          </ImageBackground>
        </View>

        {/* ========================================================================= */}
        {/* 7. PROGRESS OVERVIEW: Attendance, Active Tasks & Study Goal Real Metrics   */}
        {/* ========================================================================= */}
        <View style={styles.sectionHeaderRow}>
          <ThemedText type="headlineMedium" style={styles.sectionHeading}>
            Academic Progress
          </ThemedText>
          <Pressable
            onPress={() => router.push('/profile' as never)}
            hitSlop={8}>
            <ThemedText type="smallBold" style={styles.seeAllText}>
              Details →
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.metricsGrid}>
          {/* Metric 1: Attendance */}
          <Pressable
            style={styles.metricCard}
            onPress={() => router.push('/timetable' as never)}>
            <View style={styles.metricHeaderRow}>
              <Text style={{ fontSize: 18 }}>📊</Text>
              <ThemedText type="bodySmall" style={styles.metricSubtitle}>
                Attendance
              </ThemedText>
            </View>
            <ThemedText type="headlineLarge" style={[styles.metricVal, { color: '#38BDF8' }]}>
              {attendanceSummary ? `${attendanceSummary.overall_percentage}%` : '85%'}
            </ThemedText>
            <ThemedText type="bodySmall" style={styles.metricFootnote}>
              Min 75% required
            </ThemedText>
          </Pressable>

          {/* Metric 2: Active Tasks */}
          <Pressable
            style={styles.metricCard}
            onPress={() => router.push('/tasks' as never)}>
            <View style={styles.metricHeaderRow}>
              <Text style={{ fontSize: 18 }}>📋</Text>
              <ThemedText type="bodySmall" style={styles.metricSubtitle}>
                Active Tasks
              </ThemedText>
            </View>
            <ThemedText type="headlineLarge" style={[styles.metricVal, { color: '#34D399' }]}>
              {activeTasksCount}
            </ThemedText>
            <ThemedText type="bodySmall" style={styles.metricFootnote}>
              {completedTasksCount} completed
            </ThemedText>
          </Pressable>

          {/* Metric 3: Subjects Enrolled */}
          <Pressable
            style={styles.metricCard}
            onPress={() => router.push('/subjects' as never)}>
            <View style={styles.metricHeaderRow}>
              <Text style={{ fontSize: 18 }}>📚</Text>
              <ThemedText type="bodySmall" style={styles.metricSubtitle}>
                Courses
              </ThemedText>
            </View>
            <ThemedText type="headlineLarge" style={[styles.metricVal, { color: '#C084FC' }]}>
              {subjects.length}
            </ThemedText>
            <ThemedText type="bodySmall" style={styles.metricFootnote}>
              Enrolled subjects
            </ThemedText>
          </Pressable>

          {/* Metric 4: Daily Goal */}
          <Pressable
            style={styles.metricCard}
            onPress={() => router.push('/pomodoro' as never)}>
            <View style={styles.metricHeaderRow}>
              <Text style={{ fontSize: 18 }}>🎯</Text>
              <ThemedText type="bodySmall" style={styles.metricSubtitle}>
                Daily Goal
              </ThemedText>
            </View>
            <ThemedText type="headlineLarge" style={[styles.metricVal, { color: '#FB923C' }]}>
              {studyGoal}m
            </ThemedText>
            <ThemedText type="bodySmall" style={styles.metricFootnote}>
              Target study time
            </ThemedText>
          </Pressable>
        </View>
      </View>

      {/* Profile Menu Dropdown Modal */}
      <ProfileMenuModal
        visible={profileMenuVisible}
        onClose={() => setProfileMenuVisible(false)}
      />
    </ScreenWrapper>

    {/* ========================================================================= */}
    {/* 9. STICKY FLOATING ACTION BUTTON (FAB): AI ASSISTANT CHATBOT             */}
    {/* ========================================================================= */}
    <Pressable
      style={({ pressed }) => [
        styles.aiAssistantFab,
        { bottom: fabBottom },
        pressed && styles.aiAssistantFabPressed,
      ]}
      onPress={() => router.push('/ai-chat' as never)}
      accessibilityRole="button"
      accessibilityLabel="Ask StudyMate AI Assistant"
      testID="ai-assistant-fab">
      <View style={styles.aiFabInner}>
        <Text style={styles.aiFabFallbackEmoji}>🤖</Text>
        <Image
          source={require('@/assets/images/ai-robot-fab.jpg')}
          style={styles.aiFabImage}
          resizeMode="cover"
        />
      </View>
      <View style={styles.aiFabBadge}>
        <Text style={styles.aiFabBadgeText}>AI</Text>
      </View>
    </Pressable>
  </View>
  );
}

const styles = StyleSheet.create({
  screenWrapperRoot: {
    flex: 1,
    backgroundColor: '#080B16',
    position: 'relative',
  },
  screen: {
    backgroundColor: '#080B16',
    flex: 1,
  },
  container: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xl * 3,
    gap: 20,
  },

  // 1. Header Styles
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoSquircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#1E1B4B',
    borderWidth: 1.5,
    borderColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 4,
  },
  logoIcon: {
    fontSize: 22,
  },
  brandTextGroup: {
    gap: 1,
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandName: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 20,
    letterSpacing: -0.3,
  },
  brandNameAi: {
    color: '#C084FC',
    fontWeight: '900',
    fontSize: 20,
    marginLeft: 4,
  },
  brandTagline: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '500',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  settingsBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsIcon: {
    fontSize: 18,
  },
  notificationBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  bellIcon: {
    fontSize: 18,
  },
  notifBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: '#080B16',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  avatarBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#A855F7',
    overflow: 'hidden',
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 4,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },

  // 2. Hero Section Styles
  heroSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  greetingLeft: {
    flex: 1,
    gap: 3,
    paddingRight: 12,
  },
  greetingSubtext: {
    color: '#94A3B8',
    fontSize: 15,
  },
  studentName: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 24,
    letterSpacing: -0.4,
  },
  motivationalSubtext: {
    color: '#C084FC',
    fontStyle: 'italic',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  heroImageWrapper: {
    width: 110,
    height: 110,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(168, 85, 247, 0.4)',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  heroMascotImage: {
    width: '100%',
    height: '100%',
  },

  // 2.5. Universal Search Bar Styles (FR-18)
  searchHeaderBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchHeaderIcon: {
    fontSize: 16,
  },
  universalSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(19, 27, 46, 0.92)',
    borderRadius: 16,
    borderWidth: 1.2,
    borderColor: 'rgba(56, 189, 248, 0.28)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginVertical: 4,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 3,
  },
  universalSearchLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  universalSearchIcon: {
    fontSize: 16,
  },
  universalSearchPlaceholder: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '500',
  },
  universalSearchAiBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  universalSearchAiText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },

  // 3. Next Class Hero Card Styles
  nextClassCard: {
    backgroundColor: 'rgba(16, 24, 48, 0.85)',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(139, 92, 246, 0.35)',
    padding: 16,
    gap: 12,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 5,
  },
  nextClassTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nextClassPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.35)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  nextClassPillIcon: {
    fontSize: 13,
  },
  nextClassPillText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  circleArrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleArrowText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  countdownTextGroup: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  countdownTopLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  countdownClockDisplay: {
    color: '#C084FC',
    fontSize: 24,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.2,
  },
  nextClassTitle: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 18,
    marginTop: 2,
  },
  laptopImageWrapper: {
    width: 82,
    height: 70,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    flexShrink: 0,
  },
  laptopImage: {
    width: '100%',
    height: '100%',
  },
  nextClassMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  metaItemsLeft: {
    gap: 3,
    flex: 1,
  },
  metaItemText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '500',
  },
  liveSoonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  greenPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  liveSoonBadgeText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '700',
  },

  // 4. Quick Access Styles
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sectionTitleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionLightningIcon: {
    fontSize: 18,
  },
  sectionCalendarIcon: {
    fontSize: 18,
  },
  sectionHeading: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 18,
  },
  seeAllText: {
    color: '#C084FC',
    fontSize: 13,
  },
  quickAccessScrollContent: {
    gap: 12,
    paddingVertical: 4,
    paddingRight: 10,
  },
  quickCard: {
    width: 82,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  quickCardPurple: {
    backgroundColor: 'rgba(124, 58, 237, 0.25)',
    borderColor: '#8B5CF6',
    shadowColor: '#8B5CF6',
  },
  quickCardIndigo: {
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
    borderColor: '#6366F1',
    shadowColor: '#6366F1',
  },
  quickCardBlue: {
    backgroundColor: 'rgba(2, 132, 199, 0.25)',
    borderColor: '#38BDF8',
    shadowColor: '#38BDF8',
  },
  quickCardGreen: {
    backgroundColor: 'rgba(5, 150, 105, 0.25)',
    borderColor: '#10B981',
    shadowColor: '#10B981',
  },
  quickCardOrange: {
    backgroundColor: 'rgba(234, 88, 12, 0.25)',
    borderColor: '#F97316',
    shadowColor: '#F97316',
  },
  quickCardRose: {
    backgroundColor: 'rgba(225, 29, 72, 0.25)',
    borderColor: '#F43F5E',
    shadowColor: '#F43F5E',
  },
  quickCardCyan: {
    backgroundColor: 'rgba(6, 182, 212, 0.25)',
    borderColor: '#06B6D4',
    shadowColor: '#06B6D4',
  },
  quickIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickCardIcon: {
    fontSize: 18,
  },
  quickCardLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },

  // Exam Countdown Card Styles (FR-13)
  examCardContainer: {
    backgroundColor: '#0E1322',
    borderWidth: 1.5,
    borderColor: 'rgba(244, 63, 94, 0.35)',
    borderRadius: 22,
    padding: 16,
    gap: 12,
    shadowColor: '#F43F5E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  examCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  examBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(244, 63, 94, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.35)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  examBadgeIcon: {
    fontSize: 12,
  },
  examBadgeText: {
    color: '#FB7185',
    fontSize: 12,
    fontWeight: '700',
  },
  examCountdownChip: {
    backgroundColor: 'rgba(244, 63, 94, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F43F5E',
  },
  examCountdownDays: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  examCardMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  examTitleText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  examSubjectText: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  examScoreTargetBox: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  examScoreTargetLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  examScoreTargetVal: {
    color: '#38BDF8',
    fontSize: 14,
    fontWeight: '800',
  },
  examProgressSection: {
    gap: 6,
  },
  examProgressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  examReadinessLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  examReadinessVal: {
    color: '#FB7185',
    fontSize: 12,
    fontWeight: '800',
  },
  examProgressTrack: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  examProgressFill: {
    height: '100%',
    backgroundColor: '#F43F5E',
    borderRadius: 3,
  },

  // Daily AI Study Planner Widget Styles (FR-10)
  plannerCardContainer: {
    backgroundColor: '#0A1326',
    borderWidth: 1.5,
    borderColor: 'rgba(6, 182, 212, 0.4)',
    borderRadius: 22,
    padding: 16,
    gap: 12,
    shadowColor: '#06B6D4',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  plannerCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  plannerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(6, 182, 212, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.35)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  plannerBadgeIcon: {
    fontSize: 12,
  },
  plannerBadgeText: {
    color: '#22D3EE',
    fontSize: 12,
    fontWeight: '700',
  },
  plannerChip: {
    backgroundColor: 'rgba(6, 182, 212, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#06B6D4',
  },
  plannerChipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  plannerCardMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  plannerTitleText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  plannerSubtitleText: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  plannerTargetBox: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  plannerTargetLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  plannerTargetVal: {
    color: '#22D3EE',
    fontSize: 14,
    fontWeight: '800',
  },
  plannerProgressSection: {
    gap: 6,
  },
  plannerProgressTrack: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  plannerProgressFill: {
    height: '100%',
    backgroundColor: '#06B6D4',
    borderRadius: 3,
  },
  plannerAiAdviceText: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 16,
    fontStyle: 'italic',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    padding: 8,
    borderRadius: 8,
    borderLeftWidth: 2,
    borderLeftColor: '#06B6D4',
  },
  plannerEmptyContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  plannerEmptyTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  plannerEmptyDesc: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  plannerActionBtn: {
    backgroundColor: '#06B6D4',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    shadowColor: '#06B6D4',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 3,
  },
  plannerActionBtnText: {
    color: '#061325',
    fontWeight: '800',
    fontSize: 12,
  },

  // 4B. Subjects Section Styles
  addSubjectPillBtn: {
    backgroundColor: 'rgba(168, 85, 247, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.4)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  addSubjectPillText: {
    color: '#C084FC',
    fontSize: 13,
    fontWeight: '700',
  },
  emptySubjectCard: {
    backgroundColor: 'rgba(15, 22, 42, 0.85)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 18,
    alignItems: 'center',
    gap: 6,
  },
  subjectsRowScroll: {
    gap: 12,
    paddingVertical: 4,
    paddingRight: 10,
  },
  subjectChipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 22, 42, 0.85)',
    borderRadius: 16,
    borderWidth: 1.5,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
    minWidth: 140,
  },
  subjectDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  subjectChipTitle: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  subjectChipCode: {
    color: '#94A3B8',
    fontSize: 12,
  },

  // 5. Upcoming Schedule Timeline Styles
  filterPillBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  filterPillText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  scheduleTimelineContainer: {
    position: 'relative',
    gap: 12,
    paddingLeft: 18,
  },
  timelineVerticalLine: {
    position: 'absolute',
    top: 14,
    bottom: 14,
    left: 4,
    width: 2,
    backgroundColor: 'rgba(139, 92, 246, 0.35)',
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  timelineDot: {
    position: 'absolute',
    left: -18,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#080B16',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 3,
  },
  scheduleItemCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 22, 42, 0.85)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 12,
    gap: 12,
  },
  scheduleIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scheduleIconSymbol: {
    fontSize: 18,
  },
  scheduleDetails: {
    flex: 1,
    gap: 2,
  },
  scheduleSubjectName: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  scheduleTimeRoom: {
    color: '#94A3B8',
    fontSize: 12,
  },
  scheduleCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ongoingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  ongoingBadgeText: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '700',
  },
  upcomingBadge: {
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  upcomingBadgeText: {
    color: '#C084FC',
    fontSize: 11,
    fontWeight: '700',
  },
  scheduleArrow: {
    color: '#64748B',
    fontSize: 16,
    fontWeight: '700',
  },

  // 6. Motivational Quote Card Styles
  quoteCardContainer: {
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  quoteBackground: {
    width: '100%',
    height: 130,
    justifyContent: 'center',
  },
  quoteDarkGradient: {
    flex: 1,
    backgroundColor: 'rgba(8, 11, 22, 0.65)',
    paddingHorizontal: 20,
    paddingVertical: 14,
    justifyContent: 'center',
    gap: 4,
  },
  quoteMark: {
    color: '#A78BFA',
    fontSize: 26,
    lineHeight: 28,
  },
  quoteText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
    maxWidth: '80%',
    lineHeight: 20,
  },
  quoteAuthor: {
    color: '#C084FC',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },

  // 7. Progress Overview Styles
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: 'rgba(15, 22, 42, 0.85)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 14,
    gap: 4,
  },
  metricHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
  },
  metricVal: {
    fontSize: 24,
    fontWeight: '900',
    marginTop: 2,
  },
  metricFootnote: {
    color: '#64748B',
    fontSize: 11,
  },

  // 8. Sticky AI Assistant Floating Action Button (FAB)
  aiAssistantFab: {
    position: 'absolute',
    right: 20,
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#12111A',
    borderWidth: 2.2,
    borderColor: '#F97316',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    elevation: 16,
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.65,
    shadowRadius: 12,
  },
  aiAssistantFabPressed: {
    transform: [{ scale: 0.92 }],
    opacity: 0.88,
  },
  aiFabInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: '#0A0A0E',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  aiFabFallbackEmoji: {
    fontSize: 28,
    position: 'absolute',
  },
  aiFabImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  aiFabBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#F97316',
    borderRadius: 9,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderWidth: 1.5,
    borderColor: '#080B16',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 6,
  },
  aiFabBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  // Consistency Heatmap Widget Styles (FR-16) - Optimized for Mobile Responsiveness
  consistencyCardContainer: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.25)',
    shadowColor: '#06B6D4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 4,
    overflow: 'hidden',
  },
  consistencyTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 10,
  },
  consistencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)',
    flexShrink: 1,
  },
  consistencyBadgeIcon: {
    fontSize: 12,
  },
  consistencyBadgeText: {
    color: '#22D3EE',
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  streakChip: {
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.4)',
    flexShrink: 0,
  },
  streakChipText: {
    color: '#FB923C',
    fontSize: 11,
    fontWeight: '800',
  },
  consistencyMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  consistencyTitleText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  consistencySubText: {
    fontSize: 11.5,
    color: '#94A3B8',
    marginTop: 2,
  },
  consistencyViewAllBtn: {
    backgroundColor: 'rgba(6, 182, 212, 0.18)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.4)',
    flexShrink: 0,
  },
  consistencyViewAllText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
  },
  miniHeatmapScrollContent: {
    paddingVertical: 2,
    paddingRight: 8,
  },
  miniHeatmapInner: {
    flexDirection: 'column',
  },
  miniMonthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    height: 14,
  },
  miniDowSpacer: {
    width: 16,
    marginRight: 4,
  },
  miniMonthCol: {
    width: 12.5,
    overflow: 'visible',
  },
  miniMonthText: {
    color: '#64748B',
    fontSize: 9.5,
    fontWeight: '700',
  },
  miniGridRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  miniDowCol: {
    width: 16,
    marginRight: 4,
    flexDirection: 'column',
    gap: 3,
  },
  miniDowCell: {
    height: 12.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniDowText: {
    color: '#64748B',
    fontSize: 8.5,
    fontWeight: '700',
    lineHeight: 10,
  },
  miniColsWrapper: {
    flexDirection: 'row',
    gap: 3,
  },
  miniCol: {
    flexDirection: 'column',
    gap: 3,
  },
  miniCell: {
    width: 12.5,
    height: 12.5,
    borderRadius: 3,
  },
  miniPadCell: {
    width: 12.5,
    height: 12.5,
    backgroundColor: 'transparent',
  },
  miniLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 3.5,
    marginTop: 8,
  },
  miniLegendLabel: {
    fontSize: 8.5,
    color: '#64748B',
    fontWeight: '600',
  },
  miniLegendSquare: {
    width: 9,
    height: 9,
    borderRadius: 2,
  },
  miniInspectBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 5,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.35)',
  },
  miniInspectDate: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#E2E8F0',
  },
  miniInspectStat: {
    fontSize: 10,
    color: '#38BDF8',
    flex: 1,
    marginHorizontal: 6,
  },
  miniInspectClose: {
    fontSize: 11,
    color: '#94A3B8',
    paddingHorizontal: 4,
  },
  consistencyBottomStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(2, 6, 23, 0.6)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  consistencyMetricPill: {
    alignItems: 'center',
    flex: 1,
  },
  consistencyMetricDivider: {
    width: 1,
    height: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  consistencyMetricVal: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#F1F5F9',
  },
  consistencyMetricLabel: {
    fontSize: 9,
    color: '#64748B',
    marginTop: 1,
  },
  announcementBanner: {
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
  },
  announcementInfo: {
    backgroundColor: 'rgba(30, 27, 75, 0.7)',
    borderColor: 'rgba(99, 102, 241, 0.35)',
  },
  announcementWarning: {
    backgroundColor: 'rgba(69, 26, 3, 0.7)',
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  announcementCritical: {
    backgroundColor: 'rgba(76, 5, 25, 0.75)',
    borderColor: 'rgba(244, 63, 94, 0.45)',
  },
  announcementContent: {
    gap: 4,
  },
  announcementHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  announcementBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  announcementIcon: {
    fontSize: 14,
  },
  announcementSeverityBadge: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  announcementSeverityInfo: {
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
    color: '#A5B4FC',
  },
  announcementSeverityWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
    color: '#FCD34D',
  },
  announcementSeverityCritical: {
    backgroundColor: 'rgba(244, 63, 94, 0.25)',
    color: '#FDA4AF',
  },
  announcementDismissBtn: {
    padding: 4,
  },
  announcementDismissText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '700',
  },
  announcementTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 2,
  },
  announcementMessage: {
    fontSize: 12,
    color: '#CBD5E1',
    lineHeight: 16,
  },
});
