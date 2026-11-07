import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ScreenWrapper } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useNotes } from '@/hooks/use-notes';
import { useSubjects } from '@/hooks/use-subjects';
import { taskApi, timetableApi } from '@/services/api/client';
import { AttendanceSummaryResponse } from '@/types/timetable';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { subjects } = useSubjects();
  const { notes } = useNotes();

  const [attendance, setAttendance] = useState<AttendanceSummaryResponse | null>(null);
  const [taskCount, setTaskCount] = useState<{ total: number; completed: number }>({ total: 0, completed: 0 });
  const [_isLoadingStats, setIsLoadingStats] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchStats = async () => {
      setIsLoadingStats(true);
      try {
        const [attRes, tasksRes] = await Promise.allSettled([
          timetableApi.getAttendanceSummary(75.0),
          taskApi.list({ limit: 100 }),
        ]);

        if (isMounted) {
          if (attRes.status === 'fulfilled') {
            setAttendance(attRes.value);
          }
          if (tasksRes.status === 'fulfilled') {
            const items = tasksRes.value.items || [];
            const completed = items.filter((t) => t.status === 'completed').length;
            setTaskCount({ total: items.length, completed });
          }
        }
      } finally {
        if (isMounted) setIsLoadingStats(false);
      }
    };

    fetchStats();
    return () => {
      isMounted = false;
    };
  }, []);

  const displayName = user?.full_name?.trim() || 'Anmol Singh';
  const displayEmail = user?.email || 'student@studymate.ai';
  const roleName = (user?.role || 'student').toUpperCase();
  const studyGoal = user?.daily_study_goal_minutes ?? 60;

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to sign out of StudyMate AI?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            setIsLoggingOut(true);
            try {
              await logout();
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : 'Failed to log out.';
              Alert.alert('Error', msg);
            } finally {
              setIsLoggingOut(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ScreenWrapper
      scrollable
      includeTopInset
      includeBottomInset
      includeTabInset
      style={styles.container}>
      <View style={styles.content}>
        {/* Header Title */}
        <View style={styles.topHeader}>
          <ThemedText type="headlineMedium" style={styles.pageTitle}>
            Student Profile
          </ThemedText>
          <Pressable
            style={styles.settingsIconBtn}
            onPress={() => router.push('/settings' as never)}>
            <Text style={{ fontSize: 18 }}>⚙️</Text>
          </Pressable>
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarWrapper}>
            <Image
              source={require('@/assets/images/dashboard-avatar.jpg')}
              style={styles.avatarImage}
              resizeMode="cover"
            />
            <View style={styles.onlineBadge} />
          </View>

          <ThemedText type="headlineLarge" style={styles.userName}>
            {displayName}
          </ThemedText>
          <ThemedText type="bodyMedium" style={styles.userEmail}>
            {displayEmail}
          </ThemedText>

          <View style={styles.rolePillRow}>
            <View style={styles.rolePill}>
              <Text style={styles.roleText}>{roleName}</Text>
            </View>
            <View style={styles.statusPill}>
              <View style={styles.greenDot} />
              <Text style={styles.statusText}>Active Account</Text>
            </View>
          </View>
        </View>

        {/* Academic Performance Metrics */}
        <View style={styles.sectionBlock}>
          <ThemedText type="titleMedium" style={styles.sectionTitle}>
            Academic Statistics
          </ThemedText>

          <View style={styles.statsGrid}>
            {/* Stat 1: Attendance */}
            <View style={[styles.statBox, { borderColor: 'rgba(56, 189, 248, 0.3)' }]}>
              <Text style={styles.statIcon}>📊</Text>
              <ThemedText type="headlineMedium" style={[styles.statNum, { color: '#38BDF8' }]}>
                {attendance ? `${attendance.overall_percentage}%` : '85%'}
              </ThemedText>
              <ThemedText type="bodySmall" style={styles.statLabel}>
                Attendance
              </ThemedText>
            </View>

            {/* Stat 2: Enrolled Courses */}
            <View style={[styles.statBox, { borderColor: 'rgba(168, 85, 247, 0.3)' }]}>
              <Text style={styles.statIcon}>📚</Text>
              <ThemedText type="headlineMedium" style={[styles.statNum, { color: '#C084FC' }]}>
                {subjects.length}
              </ThemedText>
              <ThemedText type="bodySmall" style={styles.statLabel}>
                Enrolled Subjects
              </ThemedText>
            </View>

            {/* Stat 3: Notes Count */}
            <View style={[styles.statBox, { borderColor: 'rgba(16, 185, 129, 0.3)' }]}>
              <Text style={styles.statIcon}>📝</Text>
              <ThemedText type="headlineMedium" style={[styles.statNum, { color: '#34D399' }]}>
                {notes.length}
              </ThemedText>
              <ThemedText type="bodySmall" style={styles.statLabel}>
                Study Notes
              </ThemedText>
            </View>

            {/* Stat 4: Tasks Progress */}
            <View style={[styles.statBox, { borderColor: 'rgba(249, 115, 22, 0.3)' }]}>
              <Text style={styles.statIcon}>🎯</Text>
              <ThemedText type="headlineMedium" style={[styles.statNum, { color: '#FB923C' }]}>
                {taskCount.completed}/{taskCount.total || 4}
              </ThemedText>
              <ThemedText type="bodySmall" style={styles.statLabel}>
                Tasks Finished
              </ThemedText>
            </View>
          </View>
        </View>

        {/* Study Goal Card */}
        <View style={styles.goalCard}>
          <View style={styles.goalLeft}>
            <Text style={styles.goalIcon}>⏱️</Text>
            <View>
              <ThemedText type="titleMedium" style={{ color: '#FFFFFF', fontWeight: '700' }}>
                Daily Study Target
              </ThemedText>
              <ThemedText type="bodySmall" style={{ color: '#94A3B8' }}>
                {studyGoal} minutes allocated daily
              </ThemedText>
            </View>
          </View>
          <Pressable
            style={styles.editGoalBtn}
            onPress={() => router.push('/settings' as never)}>
            <Text style={styles.editGoalBtnText}>Edit</Text>
          </Pressable>
        </View>

        {/* Menu Shortcuts */}
        <View style={styles.sectionBlock}>
          <ThemedText type="titleMedium" style={styles.sectionTitle}>
            Account & Preferences
          </ThemedText>

          <View style={styles.menuContainer}>
            <Pressable
              style={styles.menuRow}
              onPress={() => router.push('/settings' as never)}>
              <View style={[styles.menuIconBox, { backgroundColor: 'rgba(99, 102, 241, 0.15)' }]}>
                <Text style={{ fontSize: 18 }}>⚙️</Text>
              </View>
              <View style={styles.menuTextBox}>
                <ThemedText type="titleMedium" style={styles.menuTitle}>
                  Settings & Security
                </ThemedText>
                <ThemedText type="bodySmall" style={styles.menuSubtitle}>
                  Sessions, notifications & password
                </ThemedText>
              </View>
              <Text style={styles.menuArrow}>›</Text>
            </Pressable>

            <View style={styles.menuDivider} />

            <Pressable
              style={styles.menuRow}
              onPress={() => router.push('/subjects' as never)}>
              <View style={[styles.menuIconBox, { backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}>
                <Text style={{ fontSize: 18 }}>📚</Text>
              </View>
              <View style={styles.menuTextBox}>
                <ThemedText type="titleMedium" style={styles.menuTitle}>
                  Academic Subjects & Courses
                </ThemedText>
                <ThemedText type="bodySmall" style={styles.menuSubtitle}>
                  {subjects.length} enrolled • Manage syllabus & codes
                </ThemedText>
              </View>
              <Text style={styles.menuArrow}>›</Text>
            </Pressable>

            <View style={styles.menuDivider} />

            <Pressable
              style={styles.menuRow}
              onPress={() => router.push('/timetable' as never)}>
              <View style={[styles.menuIconBox, { backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}>
                <Text style={{ fontSize: 18 }}>📅</Text>
              </View>
              <View style={styles.menuTextBox}>
                <ThemedText type="titleMedium" style={styles.menuTitle}>
                  Class Timetable
                </ThemedText>
                <ThemedText type="bodySmall" style={styles.menuSubtitle}>
                  Weekly schedule & attendance
                </ThemedText>
              </View>
              <Text style={styles.menuArrow}>›</Text>
            </Pressable>

            <View style={styles.menuDivider} />

            <Pressable
              style={styles.menuRow}
              onPress={() => router.push('/explore' as never)}>
              <View style={[styles.menuIconBox, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}>
                <Text style={{ fontSize: 18 }}>✨</Text>
              </View>
              <View style={styles.menuTextBox}>
                <ThemedText type="titleMedium" style={styles.menuTitle}>
                  StudyHub
                </ThemedText>
                <ThemedText type="bodySmall" style={styles.menuSubtitle}>
                  Pomodoro, AI Tutor & Flashcards
                </ThemedText>
              </View>
              <Text style={styles.menuArrow}>›</Text>
            </Pressable>
          </View>
        </View>

        {/* Logout Action */}
        <Pressable
          style={({ pressed }) => [styles.logoutBtn, { opacity: pressed ? 0.75 : 1 }]}
          onPress={handleLogout}
          disabled={isLoggingOut}>
          {isLoggingOut ? (
            <ActivityIndicator size="small" color="#EF4444" />
          ) : (
            <>
              <Text style={styles.logoutIcon}>🚪</Text>
              <Text style={styles.logoutText}>Sign Out</Text>
            </>
          )}
        </Pressable>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#080B16',
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl * 2,
    gap: Spacing.lg,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
  },
  pageTitle: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 22,
  },
  settingsIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileCard: {
    backgroundColor: 'rgba(16, 22, 40, 0.85)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: Spacing.sm,
  },
  avatarImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: '#A855F7',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#10B981',
    borderWidth: 3,
    borderColor: '#080B16',
  },
  userName: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 22,
    textAlign: 'center',
  },
  userEmail: {
    color: '#94A3B8',
    fontSize: 14,
    marginTop: 2,
    marginBottom: Spacing.sm,
  },
  rolePillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rolePill: {
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  roleText: {
    color: '#C084FC',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  greenDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  statusText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '600',
  },
  sectionBlock: {
    gap: Spacing.sm,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  statBox: {
    flex: 1,
    minWidth: '46%',
    backgroundColor: 'rgba(15, 20, 36, 0.85)',
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.md,
    gap: 4,
  },
  statIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  statNum: {
    fontSize: 22,
    fontWeight: '800',
  },
  statLabel: {
    color: '#94A3B8',
    fontSize: 12,
  },
  goalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15, 20, 36, 0.85)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: Spacing.md,
  },
  goalLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  goalIcon: {
    fontSize: 24,
  },
  editGoalBtn: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  editGoalBtnText: {
    color: '#C084FC',
    fontWeight: '700',
    fontSize: 13,
  },
  menuContainer: {
    backgroundColor: 'rgba(15, 20, 36, 0.85)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: 12,
  },
  menuIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuTextBox: {
    flex: 1,
    gap: 2,
  },
  menuTitle: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
  menuSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
  },
  menuArrow: {
    color: '#64748B',
    fontSize: 20,
    fontWeight: '600',
  },
  menuDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginLeft: 64,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 16,
    paddingVertical: 14,
    gap: 8,
    marginTop: Spacing.sm,
  },
  logoutIcon: {
    fontSize: 18,
  },
  logoutText: {
    color: '#EF4444',
    fontWeight: '700',
    fontSize: 15,
  },
});

