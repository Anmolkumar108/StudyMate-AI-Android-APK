import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge, Button, Card, ScreenWrapper } from '@/components/ui';
import { BorderRadius, MinTouchTarget, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { authApi, userSecurityApi } from '@/services/api/client';
import {
  BiometricCapability,
  authenticateWithBiometrics,
  checkBiometricCapability,
  isBiometricLockEnabled,
  setBiometricLockEnabled,
} from '@/services/biometrics';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  NotificationPreferences,
  cancelAllReminders,
  loadNotificationPreferences,
  registerForPushNotificationsAsync,
  saveNotificationPreferences,
  sendTestNotification,
} from '@/services/notifications';

/**
 * Safely resolves the project version from Expo configuration or fallback.
 */
function getAppVersion(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Constants = require('expo-constants').default || require('expo-constants');
    return Constants?.expoConfig?.version || '1.0.0';
  } catch {
    return '1.0.0';
  }
}

export default function SettingsScreen() {
  const router = useRouter();
  const { user, logout, logoutAll } = useAuth();
  const theme = useTheme();
  const colorScheme = useColorScheme();

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isLoggingOutAll, setIsLoggingOutAll] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>(
    DEFAULT_NOTIFICATION_PREFERENCES
  );

  useEffect(() => {
    loadNotificationPreferences()
      .then((loaded) => {
        if (user) {
          setNotifPrefs({
            ...loaded,
            pushNotificationsEnabled:
              user.push_notifications_enabled ?? loaded.pushNotificationsEnabled,
            quietHoursStart: user.quiet_hours_start
              ? user.quiet_hours_start.slice(0, 5)
              : loaded.quietHoursStart,
            quietHoursEnd: user.quiet_hours_end
              ? user.quiet_hours_end.slice(0, 5)
              : loaded.quietHoursEnd,
          });
        } else {
          setNotifPrefs(loaded);
        }
      })
      .catch(() => {});
  }, [user]);

  const handleToggleMasterPush = async (enabled: boolean) => {
    const updated = { ...notifPrefs, pushNotificationsEnabled: enabled };
    setNotifPrefs(updated);
    await saveNotificationPreferences({ pushNotificationsEnabled: enabled });

    if (!enabled) {
      await cancelAllReminders();
    } else {
      await registerForPushNotificationsAsync();
    }

    try {
      await authApi.updatePreferences({ push_notifications_enabled: enabled });
    } catch {
      // Offline fallback
    }
  };

  const handleUpdatePref = async <K extends keyof NotificationPreferences>(
    key: K,
    val: NotificationPreferences[K]
  ) => {
    const updated = { ...notifPrefs, [key]: val };
    setNotifPrefs(updated);
    await saveNotificationPreferences({ [key]: val });
  };

  const handleTriggerTest = async (type: 'class' | 'task' | 'streak' | 'exam') => {
    try {
      await sendTestNotification(type);
      Alert.alert(
        '🔔 Real Notification Sent',
        `A real ${type.toUpperCase()} test notification has been sent! Check your Android notification shade / status bar banner.`
      );
    } catch (err: any) {
      if (err?.message === 'PERMISSION_NOT_GRANTED') {
        Alert.alert(
          'Notification Permission Required',
          'Android on your device has blocked notifications for StudyMate AI. Tap "Open Settings" to enable Notifications.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => {
                Linking.openSettings().catch(() => {});
              },
            },
          ]
        );
      } else {
        Alert.alert(
          'Notification Alert',
          err?.message || 'Could not send test notification. Please verify notification permissions.'
        );
      }
    }
  };

  // Biometric state
  const [biometricCap, setBiometricCap] = useState<BiometricCapability | null>(null);
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);

  // Change password modal state
  const [changePassModalVisible, setChangePassModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [isChangingPass, setIsChangingPass] = useState(false);

  // GDPR export & account delete state
  const [isExportingData, setIsExportingData] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  useEffect(() => {
    checkBiometricCapability()
      .then(setBiometricCap)
      .catch(() => {});
    isBiometricLockEnabled()
      .then(setIsBiometricEnabled)
      .catch(() => {});
  }, []);

  const handleToggleBiometricLock = async (enabled: boolean) => {
    if (enabled) {
      const authRes = await authenticateWithBiometrics('Verify fingerprint to activate Biometric Lock');
      if (!authRes.success) {
        Alert.alert(
          'Biometric Verification Failed',
          authRes.error || 'Could not verify your biometric credentials. Lock was not enabled.'
        );
        return;
      }
      await setBiometricLockEnabled(true);
      setIsBiometricEnabled(true);
      Alert.alert(
        '🔒 Biometric Lock Enabled',
        'StudyMate AI will now require fingerprint or biometric confirmation to open.'
      );
    } else {
      const authRes = await authenticateWithBiometrics('Verify fingerprint to disable Biometric Lock');
      if (!authRes.success) {
        Alert.alert(
          'Biometric Verification Failed',
          authRes.error || 'Authentication required to disable lock.'
        );
        return;
      }
      await setBiometricLockEnabled(false);
      setIsBiometricEnabled(false);
      Alert.alert('Unlocked', 'Biometric app lock has been turned off.');
    }
  };

  const handleTestBiometricSensor = async () => {
    const authRes = await authenticateWithBiometrics('StudyMate AI Fingerprint Sensor Test');
    if (authRes.success) {
      Alert.alert('✅ Biometric Sensor Verified', 'Fingerprint matched successfully! Hardware and enrollment are in perfect working order.');
    } else {
      Alert.alert('Biometric Test', authRes.error || 'Verification canceled or failed.');
    }
  };

  const handleChangePasswordSubmit = async () => {
    if (!currentPassword) {
      Alert.alert('Validation Error', 'Please enter your current password.');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Password Policy', 'New password must contain at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Mismatch', 'New password and confirmation do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      Alert.alert('Invalid Password', 'New password cannot be identical to current password.');
      return;
    }

    try {
      setIsChangingPass(true);
      const res = await userSecurityApi.changePassword(currentPassword, newPassword);
      setChangePassModalVisible(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Success', res.message || 'Password updated successfully with Argon2id encryption.');
    } catch (err: any) {
      Alert.alert('Change Password Error', err?.message || 'Could not update password. Please check your current password.');
    } finally {
      setIsChangingPass(false);
    }
  };

  const handleExportAllData = async () => {
    try {
      setIsExportingData(true);
      const data = await userSecurityApi.exportUserData();
      const analytics = (data.analytics as Record<string, number>) || {};
      Alert.alert(
        '📦 Student Data Export Ready',
        `Your complete academic data archive has been generated successfully!\n\n` +
          `• Profile: ${data.user_profile?.email || 'Active'}\n` +
          `• Subjects: ${data.subjects?.length || 0}\n` +
          `• Notes: ${data.notes?.length || 0}\n` +
          `• Tasks: ${data.tasks?.length || 0}\n` +
          `• Flashcards: ${data.flashcards?.length || 0} decks\n` +
          `• Exams: ${data.exams?.length || 0}\n` +
          `• Focus Time: ${analytics.total_focus_minutes || 0} minutes\n\n` +
          `All student intellectual property and revision records are fully preserved under GDPR compliance.`,
        [{ text: 'Great!' }]
      );
    } catch (err: any) {
      Alert.alert('Export Error', err?.message || 'Failed to generate data export.');
    } finally {
      setIsExportingData(false);
    }
  };

  const handleDeleteAccountSubmit = async () => {
    if (!deletePassword) {
      Alert.alert('Password Required', 'Please enter your password to confirm permanent account deletion.');
      return;
    }

    Alert.alert(
      'FINAL WARNING: Delete Account',
      'This action is irreversible. All your notes, study schedules, flashcards, exams, and focus history will be permanently wiped.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Permanently Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeletingAccount(true);
              await userSecurityApi.deleteAccount(deletePassword, deleteReason);
              await cancelAllReminders();
              await setBiometricLockEnabled(false);
              setDeleteModalVisible(false);
              Alert.alert('Account Deleted', 'Your account and data have been permanently removed.');
              await logout();
              router.replace('/(auth)/login');
            } catch (err: any) {
              Alert.alert('Deletion Error', err?.message || 'Incorrect password. Account deletion failed.');
            } finally {
              setIsDeletingAccount(false);
            }
          },
        },
      ]
    );
  };

  const appVersion = useMemo(() => getAppVersion(), []);

  // User display helpers
  const displayName = user?.full_name?.trim() || 'Student';
  const displayEmail = user?.email || 'student@studymate.ai';
  const roleName = (user?.role || 'student').toUpperCase();
  const isAccountActive = user?.status === 'active';
  const statusLabel = isAccountActive
    ? 'Active'
    : user?.status === 'suspended'
      ? 'Suspended'
      : 'Unverified';
  const statusVariant = isAccountActive
    ? 'success'
    : user?.status === 'suspended'
      ? 'danger'
      : 'warning';
  const studyGoal = user?.daily_study_goal_minutes ?? 60;
  const institution = user?.institution?.trim() || 'Not specified';
  const major = user?.major?.trim() || 'General Studies';

  const userCreatedAt = user?.created_at;
  const memberSince = useMemo(() => {
    if (!userCreatedAt) return 'Recently joined';
    try {
      return new Date(userCreatedAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return 'Active Member';
    }
  }, [userCreatedAt]);

  const userInitials = useMemo(() => {
    const parts = displayName.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'S';
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [displayName]);

  // Safe navigation back to Home
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  // Sign out of this current device session
  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to log out. Please try again.';
      Alert.alert('Logout Error', message);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const confirmLogout = () => {
    Alert.alert(
      'Log Out?',
      'Are you sure you want to log out of StudyMate AI on this device?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: handleLogout,
        },
      ]
    );
  };

  // Revoke all device refresh tokens
  const handleLogoutAll = async () => {
    setIsLoggingOutAll(true);
    try {
      await logoutAll();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to revoke device sessions. Please try again.';
      Alert.alert('Session Error', message);
    } finally {
      setIsLoggingOutAll(false);
    }
  };

  const confirmLogoutAll = () => {
    Alert.alert(
      'Log Out of All Devices?',
      'This will revoke active sessions across all your registered devices. You will need to log in again everywhere.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out Everywhere',
          style: 'destructive',
          onPress: handleLogoutAll,
        },
      ]
    );
  };

  return (
    <ScreenWrapper
      scrollable
      includeTopInset
      includeBottomInset
      includeTabInset={false}
      contentContainerStyle={styles.container}>
      {/* SECTION 1: Top Bar with Back Button */}
      <View style={styles.topBar}>
        <Pressable
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Go back to Home"
          accessibilityHint="Returns to the main dashboard"
          style={({ pressed }) => [
            styles.backButton,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.borderSubtle,
              opacity: pressed ? 0.75 : 1,
            },
          ]}>
          <Text style={[styles.backArrow, { color: theme.brandPrimary }]}>←</Text>
        </Pressable>

        <View style={styles.topBarText}>
          <ThemedText type="headlineLarge" style={styles.screenTitle}>
            Settings
          </ThemedText>
          <ThemedText type="bodySmall" style={{ color: theme.textSecondary }}>
            Account identity, security & preferences
          </ThemedText>
        </View>
      </View>

      {/* SECTION 2: Account Information */}
      <View style={styles.sectionBlock}>
        <ThemedText type="titleMedium" style={styles.sectionHeading}>
          Student Profile
        </ThemedText>

        <Card variant="default" style={styles.profileCard}>
          <View style={styles.profileHeader}>
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

            <View style={styles.profileHeaderContent}>
              <ThemedText type="headlineMedium" style={styles.profileName} numberOfLines={1}>
                {displayName}
              </ThemedText>
              <ThemedText type="bodyMedium" style={{ color: theme.textSecondary }} numberOfLines={1}>
                {displayEmail}
              </ThemedText>
              <View style={styles.badgeRow}>
                <Badge label={roleName} variant="brand" size="sm" />
                <Badge label={statusLabel} variant={statusVariant} size="sm" />
              </View>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.borderSubtle }]} />

          <View style={styles.infoList}>
            <View style={styles.infoRow}>
              <ThemedText type="bodyMedium" style={{ color: theme.textSecondary }}>
                Daily Study Goal
              </ThemedText>
              <ThemedText type="bodyMedium" style={styles.infoValue}>
                {studyGoal} mins / day
              </ThemedText>
            </View>

            <View style={styles.infoRow}>
              <ThemedText type="bodyMedium" style={{ color: theme.textSecondary }}>
                Institution
              </ThemedText>
              <ThemedText type="bodyMedium" style={styles.infoValue} numberOfLines={1}>
                {institution}
              </ThemedText>
            </View>

            <View style={styles.infoRow}>
              <ThemedText type="bodyMedium" style={{ color: theme.textSecondary }}>
                Major
              </ThemedText>
              <ThemedText type="bodyMedium" style={styles.infoValue} numberOfLines={1}>
                {major}
              </ThemedText>
            </View>

            <View style={styles.infoRow}>
              <ThemedText type="bodyMedium" style={{ color: theme.textSecondary }}>
                Member Since
              </ThemedText>
              <ThemedText type="bodyMedium" style={styles.infoValue}>
                {memberSince}
              </ThemedText>
            </View>
          </View>
        </Card>
      </View>

      {/* SECTION 3: Notifications & Reminders */}
      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeaderRow}>
          <ThemedText type="titleMedium" style={styles.sectionHeading}>
            Notifications & Reminders
          </ThemedText>
          <Badge
            label={notifPrefs.pushNotificationsEnabled ? 'Active' : 'Muted'}
            variant={notifPrefs.pushNotificationsEnabled ? 'success' : 'neutral'}
            size="sm"
          />
        </View>

        <Card variant="outlined" style={styles.notifCard}>
          {/* Master Push Toggle */}
          <View style={styles.notifHeaderRow}>
            <View style={[styles.iconBadge, { backgroundColor: theme.badgeBrandBackground }]}>
              <Text style={styles.sectionIcon}>🔔</Text>
            </View>
            <View style={styles.headerTextGroup}>
              <ThemedText type="titleMedium">Push Alerts & Alarms</ThemedText>
              <ThemedText type="bodySmall" style={{ color: theme.textSecondary }}>
                Master toggle for Android local & system notifications
              </ThemedText>
            </View>
            <Switch
              value={notifPrefs.pushNotificationsEnabled}
              onValueChange={handleToggleMasterPush}
              trackColor={{ false: theme.borderSubtle, true: theme.brandPrimary }}
              thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
            />
          </View>

          {notifPrefs.pushNotificationsEnabled && (
            <>
              <View style={[styles.divider, { backgroundColor: theme.borderSubtle }]} />

              {/* Granular Option 1: Class Schedule Reminders */}
              <View style={styles.prefRow}>
                <View style={styles.prefTextGroup}>
                  <ThemedText type="bodyMedium" style={{ fontWeight: '600' }}>
                    Class Schedule Alerts
                  </ThemedText>
                  <ThemedText type="bodySmall" style={{ color: theme.textSecondary }}>
                    Vibrate & ring before college lectures
                  </ThemedText>
                </View>
                <Switch
                  value={notifPrefs.classRemindersEnabled}
                  onValueChange={(val) => handleUpdatePref('classRemindersEnabled', val)}
                  trackColor={{ false: theme.borderSubtle, true: theme.brandPrimary }}
                  thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
                />
              </View>

              {notifPrefs.classRemindersEnabled && (
                <View style={styles.pillSelectorContainer}>
                  <ThemedText type="bodySmall" style={{ color: theme.textSecondary, marginBottom: 4 }}>
                    Alert advance timing:
                  </ThemedText>
                  <View style={styles.timingPillsRow}>
                    {[10, 15, 30].map((mins) => {
                      const isSelected = notifPrefs.classReminderAdvanceMinutes === mins;
                      return (
                        <Pressable
                          key={mins}
                          onPress={() => handleUpdatePref('classReminderAdvanceMinutes', mins)}
                          style={[
                            styles.timingPill,
                            {
                              backgroundColor: isSelected
                                ? theme.brandPrimary
                                : theme.backgroundElement,
                              borderColor: isSelected ? theme.brandPrimary : theme.borderSubtle,
                            },
                          ]}>
                          <Text
                            style={[
                              styles.timingPillText,
                              { color: isSelected ? '#FFFFFF' : theme.text },
                            ]}>
                            {mins} mins before
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}

              <View style={[styles.divider, { backgroundColor: theme.borderSubtle }]} />

              {/* Granular Option 2: Task Deadlines */}
              <View style={styles.prefRow}>
                <View style={styles.prefTextGroup}>
                  <ThemedText type="bodyMedium" style={{ fontWeight: '600' }}>
                    Task & Homework Deadlines
                  </ThemedText>
                  <ThemedText type="bodySmall" style={{ color: theme.textSecondary }}>
                    Urgent alerts 24h & 2h before assignment due time
                  </ThemedText>
                </View>
                <Switch
                  value={notifPrefs.taskDeadlinesEnabled}
                  onValueChange={(val) => handleUpdatePref('taskDeadlinesEnabled', val)}
                  trackColor={{ false: theme.borderSubtle, true: theme.brandPrimary }}
                  thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
                />
              </View>

              <View style={[styles.divider, { backgroundColor: theme.borderSubtle }]} />

              {/* Granular Option 3: Daily Streak Habit */}
              <View style={styles.prefRow}>
                <View style={styles.prefTextGroup}>
                  <ThemedText type="bodyMedium" style={{ fontWeight: '600' }}>
                    Daily Streak Protection
                  </ThemedText>
                  <ThemedText type="bodySmall" style={{ color: theme.textSecondary }}>
                    Evening nudge to log focus & maintain consistency
                  </ThemedText>
                </View>
                <Switch
                  value={notifPrefs.streakRemindersEnabled}
                  onValueChange={(val) => handleUpdatePref('streakRemindersEnabled', val)}
                  trackColor={{ false: theme.borderSubtle, true: theme.brandPrimary }}
                  thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
                />
              </View>

              {notifPrefs.streakRemindersEnabled && (
                <View style={styles.pillSelectorContainer}>
                  <ThemedText type="bodySmall" style={{ color: theme.textSecondary, marginBottom: 4 }}>
                    Evening reminder time:
                  </ThemedText>
                  <View style={styles.timingPillsRow}>
                    {[
                      { time: '18:00', label: '6:00 PM' },
                      { time: '19:00', label: '7:00 PM' },
                      { time: '20:00', label: '8:00 PM' },
                      { time: '21:00', label: '9:00 PM' },
                    ].map((slot) => {
                      const isSelected = notifPrefs.streakReminderTime === slot.time;
                      return (
                        <Pressable
                          key={slot.time}
                          onPress={() => handleUpdatePref('streakReminderTime', slot.time)}
                          style={[
                            styles.timingPill,
                            {
                              backgroundColor: isSelected
                                ? theme.brandPrimary
                                : theme.backgroundElement,
                              borderColor: isSelected ? theme.brandPrimary : theme.borderSubtle,
                            },
                          ]}>
                          <Text
                            style={[
                              styles.timingPillText,
                              { color: isSelected ? '#FFFFFF' : theme.text },
                            ]}>
                            {slot.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}

              <View style={[styles.divider, { backgroundColor: theme.borderSubtle }]} />

              {/* Granular Option 4: Exam Milestones */}
              <View style={styles.prefRow}>
                <View style={styles.prefTextGroup}>
                  <ThemedText type="bodyMedium" style={{ fontWeight: '600' }}>
                    Exam Milestone Countdowns
                  </ThemedText>
                  <ThemedText type="bodySmall" style={{ color: theme.textSecondary }}>
                    Priority alarms 3 days & 1 day prior to exams
                  </ThemedText>
                </View>
                <Switch
                  value={notifPrefs.examAlertsEnabled}
                  onValueChange={(val) => handleUpdatePref('examAlertsEnabled', val)}
                  trackColor={{ false: theme.borderSubtle, true: theme.brandPrimary }}
                  thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
                />
              </View>

              <View style={[styles.divider, { backgroundColor: theme.borderSubtle }]} />

              {/* Granular Option 5: Quiet Hours */}
              <View style={styles.prefRow}>
                <View style={styles.prefTextGroup}>
                  <ThemedText type="bodyMedium" style={{ fontWeight: '600' }}>
                    Quiet Hours (Do Not Disturb)
                  </ThemedText>
                  <ThemedText type="bodySmall" style={{ color: theme.textSecondary }}>
                    Mute all study reminders between 10:00 PM – 7:00 AM
                  </ThemedText>
                </View>
                <Switch
                  value={notifPrefs.quietHoursEnabled}
                  onValueChange={(val) => handleUpdatePref('quietHoursEnabled', val)}
                  trackColor={{ false: theme.borderSubtle, true: theme.brandPrimary }}
                  thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
                />
              </View>

              <View style={[styles.divider, { backgroundColor: theme.borderSubtle }]} />

              {/* Real Notification Test Center */}
              <View style={[styles.testCenterBox, { backgroundColor: theme.backgroundElement }]}>
                <View style={styles.testCenterHeader}>
                  <Text style={{ fontSize: 18 }}>⚡</Text>
                  <ThemedText type="bodyLarge" style={{ fontWeight: '700' }}>
                    Real Android Notification Test Center
                  </ThemedText>
                </View>
                <ThemedText type="bodySmall" style={{ color: theme.textSecondary, marginBottom: 8 }}>
                  Tap any button to instantly fire an authentic Android system alert into your status bar:
                </ThemedText>

                <View style={styles.testButtonsGrid}>
                  <Pressable
                    style={[styles.testActionBtn, { borderColor: theme.borderSubtle }]}
                    onPress={() => handleTriggerTest('class')}>
                    <Text style={styles.testActionBtnIcon}>🔔</Text>
                    <Text style={[styles.testActionBtnText, { color: theme.text }]}>
                      Class Alert
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[styles.testActionBtn, { borderColor: theme.borderSubtle }]}
                    onPress={() => handleTriggerTest('task')}>
                    <Text style={styles.testActionBtnIcon}>⏰</Text>
                    <Text style={[styles.testActionBtnText, { color: theme.text }]}>
                      Task Due
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[styles.testActionBtn, { borderColor: theme.borderSubtle }]}
                    onPress={() => handleTriggerTest('streak')}>
                    <Text style={styles.testActionBtnIcon}>🔥</Text>
                    <Text style={[styles.testActionBtnText, { color: theme.text }]}>
                      Streak Habit
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[styles.testActionBtn, { borderColor: theme.borderSubtle }]}
                    onPress={() => handleTriggerTest('exam')}>
                    <Text style={styles.testActionBtnIcon}>🎯</Text>
                    <Text style={[styles.testActionBtnText, { color: theme.text }]}>
                      Exam Alert
                    </Text>
                  </Pressable>
                </View>
              </View>
            </>
          )}
        </Card>
      </View>

      {/* SECTION 4: Biometric Security & App Lock */}
      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeaderRow}>
          <ThemedText type="titleMedium" style={styles.sectionHeading}>
            Biometric Security
          </ThemedText>
          <Badge
            label={
              !biometricCap?.hasHardware
                ? 'No Sensor'
                : !biometricCap?.isEnrolled
                ? 'Not Enrolled'
                : isBiometricEnabled
                ? 'Locked 🔒'
                : 'Sensor Ready'
            }
            variant={isBiometricEnabled ? 'success' : biometricCap?.hasHardware ? 'neutral' : 'warning'}
            size="sm"
          />
        </View>

        <Card variant="outlined" style={styles.securityCard}>
          <View style={styles.notifHeaderRow}>
            <View style={[styles.iconBadge, { backgroundColor: theme.badgeBrandBackground }]}>
              <Text style={styles.sectionIcon}>👆</Text>
            </View>
            <View style={styles.headerTextGroup}>
              <ThemedText type="titleMedium">
                {biometricCap?.biometricLabel || 'Fingerprint Lock'}
              </ThemedText>
              <ThemedText type="bodySmall" style={{ color: theme.textSecondary }}>
                Require biometric authentication on app launch
              </ThemedText>
            </View>
            <Switch
              value={isBiometricEnabled}
              onValueChange={handleToggleBiometricLock}
              disabled={!biometricCap?.hasHardware || !biometricCap?.isEnrolled}
              trackColor={{ false: theme.borderSubtle, true: theme.brandPrimary }}
              thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
            />
          </View>

          {biometricCap?.hasHardware && biometricCap?.isEnrolled && (
            <>
              <View style={[styles.divider, { backgroundColor: theme.borderSubtle }]} />
              <Button
                title="Test Biometric Sensor"
                variant="secondary"
                size="sm"
                fullWidth
                onPress={handleTestBiometricSensor}
              />
            </>
          )}
        </Card>
      </View>

      {/* SECTION 5: Account Password & Active Sessions */}
      <View style={styles.sectionBlock}>
        <ThemedText type="titleMedium" style={styles.sectionHeading}>
          Session & Security
        </ThemedText>

        <Card variant="outlined" style={styles.securityCard}>
          <View style={styles.securityHeader}>
            <View style={[styles.iconBadge, { backgroundColor: theme.badgeBrandBackground }]}>
              <Text style={styles.sectionIcon}>🔑</Text>
            </View>
            <View style={styles.securityHeaderText}>
              <ThemedText type="titleMedium">Account Password</ThemedText>
              <ThemedText type="bodySmall" style={{ color: theme.textSecondary }}>
                Protected with bank-grade Argon2id hashing
              </ThemedText>
            </View>
          </View>

          <Button
            title="Change Account Password"
            variant="secondary"
            size="md"
            fullWidth
            onPress={() => setChangePassModalVisible(true)}
          />

          <View style={[styles.divider, { backgroundColor: theme.borderSubtle }]} />

          <View style={styles.securityHeader}>
            <View style={[styles.iconBadge, { backgroundColor: theme.badgeBrandBackground }]}>
              <Text style={styles.sectionIcon}>🛡️</Text>
            </View>
            <View style={styles.securityHeaderText}>
              <ThemedText type="titleMedium">Session Control</ThemedText>
              <ThemedText type="bodySmall" style={{ color: theme.textSecondary }}>
                Revoke refresh tokens across devices
              </ThemedText>
            </View>
          </View>

          <View style={styles.securityActions}>
            <Button
              title="Log Out"
              variant="secondary"
              size="md"
              fullWidth
              loading={isLoggingOut}
              disabled={isLoggingOut || isLoggingOutAll}
              onPress={confirmLogout}
            />

            <Button
              title="Log Out All Devices"
              variant="danger"
              size="md"
              fullWidth
              loading={isLoggingOutAll}
              disabled={isLoggingOut || isLoggingOutAll}
              onPress={confirmLogoutAll}
            />
          </View>
        </Card>
      </View>

      {/* SECTION 6: Data Sovereignty & GDPR Privacy Rights */}
      <View style={styles.sectionBlock}>
        <ThemedText type="titleMedium" style={styles.sectionHeading}>
          Data Sovereignty & Privacy (GDPR)
        </ThemedText>

        <Card variant="outlined" style={styles.securityCard}>
          {/* Data Portability (Export) */}
          <View style={styles.securityHeader}>
            <View style={[styles.iconBadge, { backgroundColor: theme.badgeBrandBackground }]}>
              <Text style={styles.sectionIcon}>📦</Text>
            </View>
            <View style={styles.securityHeaderText}>
              <ThemedText type="titleMedium">Right to Data Portability</ThemedText>
              <ThemedText type="bodySmall" style={{ color: theme.textSecondary }}>
                Export an archive of all your subjects, notes, tasks, flashcards & exams
              </ThemedText>
            </View>
          </View>

          <Button
            title="Export All Study Data"
            variant="secondary"
            size="md"
            fullWidth
            loading={isExportingData}
            disabled={isExportingData}
            onPress={handleExportAllData}
          />

          <View style={[styles.divider, { backgroundColor: theme.borderSubtle }]} />

          {/* Right to be Forgotten (Account Deletion) */}
          <View style={styles.securityHeader}>
            <View style={[styles.iconBadge, { backgroundColor: theme.badgeDangerBackground }]}>
              <Text style={styles.sectionIcon}>⚠️</Text>
            </View>
            <View style={styles.securityHeaderText}>
              <ThemedText type="titleMedium" style={{ color: theme.statusDanger }}>
                Right to be Forgotten
              </ThemedText>
              <ThemedText type="bodySmall" style={{ color: theme.textSecondary }}>
                Permanently purge your account, study assets, and history
              </ThemedText>
            </View>
          </View>

          <Button
            title="Delete Account & Wipe Data"
            variant="danger"
            size="md"
            fullWidth
            onPress={() => setDeleteModalVisible(true)}
          />
        </Card>
      </View>

      {/* SECTION 4: Appearance & Theme */}
      <View style={styles.sectionBlock}>
        <ThemedText type="titleMedium" style={styles.sectionHeading}>
          Appearance
        </ThemedText>

        <Card variant="default" style={styles.appearanceCard}>
          <View style={styles.infoRow}>
            <View style={styles.appearanceLabelGroup}>
              <Text style={styles.appearanceIcon}>🌓</Text>
              <ThemedText type="titleMedium">Theme Mode</ThemedText>
            </View>
            <Badge
              label={colorScheme === 'dark' ? 'Dark Mode' : 'Light Mode'}
              variant="neutral"
              size="md"
            />
          </View>

          <ThemedText
            type="bodySmall"
            style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
            StudyMate AI automatically synchronizes with your Android system appearance settings.
          </ThemedText>
        </Card>
      </View>

      {/* SECTION 5: App Information */}
      <View style={styles.sectionBlock}>
        <ThemedText type="titleMedium" style={styles.sectionHeading}>
          About StudyMate AI
        </ThemedText>

        <Card variant="default" style={styles.aboutCard}>
          <View style={styles.aboutHeader}>
            <View style={styles.appNameRow}>
              <ThemedText type="headlineMedium" style={{ fontWeight: '700' }}>
                StudyMate AI
              </ThemedText>
              <Badge label={`v${appVersion}`} variant="brand" size="sm" />
            </View>
            <ThemedText type="bodySmall" style={{ color: theme.textSecondary }}>
              Student-first AI study companion & academic productivity suite.
            </ThemedText>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.borderSubtle }]} />

          <View style={styles.aboutMetaList}>
            <View style={styles.metaRow}>
              <ThemedText type="bodySmall" style={{ color: theme.textSecondary }}>
                Architecture
              </ThemedText>
              <ThemedText type="bodySmall" style={styles.metaValue}>
                FastAPI + PostgreSQL • Expo SDK 58
              </ThemedText>
            </View>

            <View style={styles.metaRow}>
              <ThemedText type="bodySmall" style={{ color: theme.textSecondary }}>
                Client Platform
              </ThemedText>
              <ThemedText type="bodySmall" style={styles.metaValue}>
                {Platform.OS.toUpperCase()} React Native
              </ThemedText>
            </View>

            <View style={styles.metaRow}>
              <ThemedText type="bodySmall" style={{ color: theme.textSecondary }}>
                Status
              </ThemedText>
              <Badge label="Production Ready" variant="success" size="sm" />
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.borderSubtle }]} />

          <ThemedText
            type="bodySmall"
            style={[styles.copyrightText, { color: theme.textTertiary }]}>
            © 2026 StudyMate AI. Built for students worldwide.
          </ThemedText>
        </Card>
      </View>

      {/* Change Password Modal */}
      <Modal
        visible={changePassModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setChangePassModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContentCard, { backgroundColor: theme.cardBackground }]}>
            <View style={styles.modalHeaderRow}>
              <ThemedText type="headlineMedium" style={{ fontWeight: '700' }}>
                Change Password
              </ThemedText>
              <Pressable
                onPress={() => setChangePassModalVisible(false)}
                style={styles.modalCloseBtn}>
                <Text style={{ fontSize: 18, color: theme.textSecondary }}>✕</Text>
              </Pressable>
            </View>

            <ThemedText type="bodySmall" style={{ color: theme.textSecondary }}>
              Enter your current password and choose a new secure password (minimum 8 characters).
            </ThemedText>

            <View style={styles.modalForm}>
              {/* Current Password */}
              <View style={styles.formGroup}>
                <ThemedText type="bodySmall" style={styles.formLabel}>
                  Current Password
                </ThemedText>
                <View style={[styles.inputRow, { borderColor: theme.borderSubtle, backgroundColor: theme.backgroundElement }]}>
                  <TextInput
                    style={[styles.modalTextInput, { color: theme.text }]}
                    secureTextEntry={!showCurrentPass}
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    placeholder="Enter current password"
                    placeholderTextColor={theme.textTertiary}
                    autoCapitalize="none"
                  />
                  <Pressable onPress={() => setShowCurrentPass(!showCurrentPass)} style={styles.eyeBtn}>
                    <Text style={{ fontSize: 16 }}>{showCurrentPass ? '👁️' : '🙈'}</Text>
                  </Pressable>
                </View>
              </View>

              {/* New Password */}
              <View style={styles.formGroup}>
                <ThemedText type="bodySmall" style={styles.formLabel}>
                  New Password (min 8 chars)
                </ThemedText>
                <View style={[styles.inputRow, { borderColor: theme.borderSubtle, backgroundColor: theme.backgroundElement }]}>
                  <TextInput
                    style={[styles.modalTextInput, { color: theme.text }]}
                    secureTextEntry={!showNewPass}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="Enter new password"
                    placeholderTextColor={theme.textTertiary}
                    autoCapitalize="none"
                  />
                  <Pressable onPress={() => setShowNewPass(!showNewPass)} style={styles.eyeBtn}>
                    <Text style={{ fontSize: 16 }}>{showNewPass ? '👁️' : '🙈'}</Text>
                  </Pressable>
                </View>
              </View>

              {/* Confirm New Password */}
              <View style={styles.formGroup}>
                <ThemedText type="bodySmall" style={styles.formLabel}>
                  Confirm New Password
                </ThemedText>
                <View style={[styles.inputRow, { borderColor: theme.borderSubtle, backgroundColor: theme.backgroundElement }]}>
                  <TextInput
                    style={[styles.modalTextInput, { color: theme.text }]}
                    secureTextEntry={!showNewPass}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Confirm new password"
                    placeholderTextColor={theme.textTertiary}
                    autoCapitalize="none"
                  />
                </View>
              </View>
            </View>

            <View style={styles.modalBtnColumn}>
              <Button
                title="Update Password"
                variant="primary"
                size="md"
                fullWidth
                loading={isChangingPass}
                disabled={isChangingPass}
                onPress={handleChangePasswordSubmit}
              />
              <Button
                title="Cancel"
                variant="secondary"
                size="md"
                fullWidth
                onPress={() => setChangePassModalVisible(false)}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Account Modal */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContentCard, { backgroundColor: theme.cardBackground }]}>
            <View style={styles.modalHeaderRow}>
              <ThemedText type="headlineMedium" style={{ fontWeight: '700', color: theme.statusDanger }}>
                Delete Account
              </ThemedText>
              <Pressable
                onPress={() => setDeleteModalVisible(false)}
                style={styles.modalCloseBtn}>
                <Text style={{ fontSize: 18, color: theme.textSecondary }}>✕</Text>
              </Pressable>
            </View>

            <ThemedText type="bodySmall" style={{ color: theme.statusDanger }}>
              ⚠️ Caution: This will permanently delete your student account, all courses, notes, timetable schedules, flashcard decks, and revision analytics.
            </ThemedText>

            <View style={styles.modalForm}>
              <View style={styles.formGroup}>
                <ThemedText type="bodySmall" style={styles.formLabel}>
                  Confirm Password
                </ThemedText>
                <View style={[styles.inputRow, { borderColor: theme.borderSubtle, backgroundColor: theme.backgroundElement }]}>
                  <TextInput
                    style={[styles.modalTextInput, { color: theme.text }]}
                    secureTextEntry
                    value={deletePassword}
                    onChangeText={setDeletePassword}
                    placeholder="Enter your account password"
                    placeholderTextColor={theme.textTertiary}
                    autoCapitalize="none"
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <ThemedText type="bodySmall" style={styles.formLabel}>
                  Reason (Optional)
                </ThemedText>
                <View style={[styles.inputRow, { borderColor: theme.borderSubtle, backgroundColor: theme.backgroundElement }]}>
                  <TextInput
                    style={[styles.modalTextInput, { color: theme.text }]}
                    value={deleteReason}
                    onChangeText={setDeleteReason}
                    placeholder="e.g. Graduated, finished semester"
                    placeholderTextColor={theme.textTertiary}
                  />
                </View>
              </View>
            </View>

            <View style={styles.modalBtnColumn}>
              <Button
                title="Permanently Delete"
                variant="danger"
                size="md"
                fullWidth
                loading={isDeletingAccount}
                disabled={isDeletingAccount}
                onPress={handleDeleteAccountSubmit}
              />
              <Button
                title="Keep Account"
                variant="secondary"
                size="md"
                fullWidth
                onPress={() => setDeleteModalVisible(false)}
              />
            </View>
          </View>
        </View>
      </Modal>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: Spacing.xxl,
    gap: Spacing.lg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  backButton: {
    minWidth: MinTouchTarget,
    minHeight: MinTouchTarget,
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backArrow: {
    fontSize: 22,
    fontWeight: '700',
  },
  topBarText: {
    flex: 1,
    gap: 2,
  },
  screenTitle: {
    letterSpacing: -0.3,
  },
  sectionBlock: {
    gap: Spacing.sm,
  },
  sectionHeading: {
    letterSpacing: 0.2,
  },
  profileCard: {
    padding: Spacing.cardPadding,
    gap: Spacing.md,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  profileHeaderContent: {
    flex: 1,
    gap: 3,
  },
  profileName: {
    fontWeight: '700',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  infoList: {
    gap: Spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  infoValue: {
    fontWeight: '600',
    textAlign: 'right',
    flexShrink: 1,
  },
  securityCard: {
    padding: Spacing.cardPadding,
    gap: Spacing.md,
  },
  securityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionIcon: {
    fontSize: 20,
  },
  securityHeaderText: {
    flex: 1,
    gap: 2,
  },
  securityNotice: {
    lineHeight: 18,
  },
  securityActions: {
    gap: Spacing.sm,
  },
  appearanceCard: {
    padding: Spacing.cardPadding,
    gap: Spacing.xs,
  },
  appearanceLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  appearanceIcon: {
    fontSize: 18,
  },
  aboutCard: {
    padding: Spacing.cardPadding,
    gap: Spacing.md,
  },
  aboutHeader: {
    gap: 4,
  },
  appNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  aboutMetaList: {
    gap: Spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  metaValue: {
    fontWeight: '500',
  },
  copyrightText: {
    textAlign: 'center',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notifCard: {
    padding: Spacing.cardPadding,
    gap: Spacing.md,
  },
  notifHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  headerTextGroup: {
    flex: 1,
    gap: 2,
  },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  prefTextGroup: {
    flex: 1,
    gap: 2,
  },
  pillSelectorContainer: {
    paddingLeft: Spacing.sm,
    gap: 4,
  },
  timingPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  timingPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  timingPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  testCenterBox: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.xs,
  },
  testCenterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  testButtonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: 4,
  },
  testActionBtn: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    minHeight: MinTouchTarget,
  },
  testActionBtnIcon: {
    fontSize: 16,
  },
  testActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  modalContentCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalCloseBtn: {
    padding: Spacing.xs,
    minWidth: MinTouchTarget,
    minHeight: MinTouchTarget,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalForm: {
    gap: Spacing.md,
    marginVertical: Spacing.xs,
  },
  formGroup: {
    gap: 6,
  },
  formLabel: {
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    minHeight: MinTouchTarget,
  },
  modalTextInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: Spacing.sm,
  },
  eyeBtn: {
    padding: Spacing.xs,
  },
  modalBtnColumn: {
    width: '100%',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
});
