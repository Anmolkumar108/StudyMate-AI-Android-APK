import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge, Button, Card, ScreenWrapper } from '@/components/ui';
import { BorderRadius, MinTouchTarget, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/hooks/use-theme';

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

      {/* SECTION 3: Session & Account Security */}
      <View style={styles.sectionBlock}>
        <ThemedText type="titleMedium" style={styles.sectionHeading}>
          Session & Security
        </ThemedText>

        <Card variant="outlined" style={styles.securityCard}>
          <View style={styles.securityHeader}>
            <View
              style={[
                styles.iconBadge,
                { backgroundColor: theme.badgeBrandBackground },
              ]}>
              <Text style={styles.sectionIcon}>🛡️</Text>
            </View>
            <View style={styles.securityHeaderText}>
              <ThemedText type="titleMedium">Session Control</ThemedText>
              <ThemedText type="bodySmall" style={{ color: theme.textSecondary }}>
                Manage authentication and active tokens
              </ThemedText>
            </View>
          </View>

          <ThemedText type="bodySmall" style={[styles.securityNotice, { color: theme.textSecondary }]}>
            When signing out of all devices, all high-entropy refresh tokens will be immediately
            revoked across your registered mobile and web clients.
          </ThemedText>

          <View style={[styles.divider, { backgroundColor: theme.borderSubtle }]} />

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
});
