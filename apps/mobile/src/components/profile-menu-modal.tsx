import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/context/auth-context';

interface ProfileMenuModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function ProfileMenuModal({ visible, onClose }: ProfileMenuModalProps) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const displayName = user?.full_name?.trim() || 'Anmol Singh';
  const displayEmail = user?.email || 'student@studymate.ai';
  const roleName = (user?.role || 'student').toUpperCase();
  const isAccountActive = user?.status === 'active';

  const handleNavigate = (route: string) => {
    onClose();
    setTimeout(() => {
      router.push(route as never);
    }, 150);
  };

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out of your StudyMate AI account on this device?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            setIsLoggingOut(true);
            try {
              onClose();
              await logout();
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : 'Failed to log out.';
              Alert.alert('Logout Error', msg);
            } finally {
              setIsLoggingOut(false);
            }
          },
        },
      ]
    );
  };

  const handleShowHelp = () => {
    Alert.alert(
      'StudyMate AI Support',
      'Need help with classes, notes, or your schedule?\n\n• Email: support@studymate.ai\n• Version: 1.0.0 (Production Build)\n• System Status: All services online\n\nStudy smart, grow smart! 🎓',
      [{ text: 'Close', style: 'default' }]
    );
  };

  const handleShowNotifications = () => {
    Alert.alert(
      'Notifications & Alerts',
      'You have 2 active academic reminders:\n\n1. Web Development class starts soon.\n2. Daily study goal reminder scheduled for 7:00 PM.\n\nYou can manage class reminders in the Timetable screen.',
      [{ text: 'View Timetable', onPress: () => handleNavigate('/timetable') }, { text: 'Done' }]
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
          {/* Header Profile Summary */}
          <View style={styles.headerBlock}>
            <View style={styles.avatarGlowRing}>
              <Image
                source={require('@/assets/images/dashboard-avatar.jpg')}
                style={styles.avatarImage}
                defaultSource={require('@/assets/images/dashboard-avatar.jpg')}
              />
            </View>

            <View style={styles.headerInfo}>
              <View style={styles.nameBadgeRow}>
                <ThemedText type="headlineMedium" style={styles.nameText} numberOfLines={1}>
                  {displayName}
                </ThemedText>
                <View style={styles.roleBadge}>
                  <Text style={styles.roleBadgeText}>{roleName}</Text>
                </View>
              </View>
              <Text style={styles.emailText} numberOfLines={1}>
                {displayEmail}
              </Text>
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, isAccountActive && styles.statusDotActive]} />
                <Text style={styles.statusLabel}>
                  {isAccountActive ? 'Account Active & Verified' : 'Account Verification Pending'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Quick Nav Action Items */}
          <ScrollView style={styles.menuScroll} showsVerticalScrollIndicator={false}>
            <Pressable
              style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
              onPress={() => handleNavigate('/profile')}>
              <View style={[styles.menuIconBox, { backgroundColor: 'rgba(168, 85, 247, 0.18)' }]}>
                <Text style={styles.menuIcon}>👤</Text>
              </View>
              <View style={styles.menuTextBox}>
                <Text style={styles.menuTitle}>My Student Profile</Text>
                <Text style={styles.menuSubtitle}>Academic details, institution & major</Text>
              </View>
              <Text style={styles.menuArrow}>›</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
              onPress={() => handleNavigate('/settings')}>
              <View style={[styles.menuIconBox, { backgroundColor: 'rgba(56, 189, 248, 0.18)' }]}>
                <Text style={styles.menuIcon}>⚙️</Text>
              </View>
              <View style={styles.menuTextBox}>
                <Text style={styles.menuTitle}>Settings & Security</Text>
                <Text style={styles.menuSubtitle}>Device sessions, theme & preferences</Text>
              </View>
              <Text style={styles.menuArrow}>›</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
              onPress={handleShowNotifications}>
              <View style={[styles.menuIconBox, { backgroundColor: 'rgba(234, 179, 8, 0.18)' }]}>
                <Text style={styles.menuIcon}>🔔</Text>
              </View>
              <View style={styles.menuTextBox}>
                <View style={styles.notifTitleRow}>
                  <Text style={styles.menuTitle}>Notifications</Text>
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadBadgeText}>2 New</Text>
                  </View>
                </View>
                <Text style={styles.menuSubtitle}>Class alarms & assignment deadlines</Text>
              </View>
              <Text style={styles.menuArrow}>›</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
              onPress={handleShowHelp}>
              <View style={[styles.menuIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.18)' }]}>
                <Text style={styles.menuIcon}>❓</Text>
              </View>
              <View style={styles.menuTextBox}>
                <Text style={styles.menuTitle}>Help & Support</Text>
                <Text style={styles.menuSubtitle}>FAQ, contact support & guidelines</Text>
              </View>
              <Text style={styles.menuArrow}>›</Text>
            </Pressable>
          </ScrollView>

          <View style={styles.divider} />

          {/* Logout Button */}
          <Pressable
            style={({ pressed }) => [
              styles.logoutButton,
              pressed && styles.logoutButtonPressed,
              isLoggingOut && styles.logoutButtonDisabled,
            ]}
            onPress={handleLogout}
            disabled={isLoggingOut}>
            <Text style={styles.logoutIcon}>🚪</Text>
            <Text style={styles.logoutText}>
              {isLoggingOut ? 'Signing out...' : 'Log Out from Device'}
            </Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(3, 7, 18, 0.82)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 68,
    paddingRight: 16,
  },
  modalCard: {
    width: 320,
    backgroundColor: '#0F1629',
    borderRadius: 24,
    borderWidth: 1.2,
    borderColor: 'rgba(168, 85, 247, 0.35)',
    padding: 18,
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 20,
  },
  headerBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingBottom: 14,
  },
  avatarGlowRing: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    borderColor: '#C084FC',
    padding: 2,
    backgroundColor: '#1E1B4B',
    shadowColor: '#C084FC',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 8,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
  },
  headerInfo: {
    flex: 1,
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nameText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    flexShrink: 1,
  },
  roleBadge: {
    backgroundColor: 'rgba(168, 85, 247, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.45)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleBadgeText: {
    color: '#E9D5FF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  emailText: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#EAB308',
  },
  statusDotActive: {
    backgroundColor: '#10B981',
  },
  statusLabel: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
    marginVertical: 10,
  },
  menuScroll: {
    maxHeight: 260,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 14,
    gap: 12,
  },
  menuItemPressed: {
    backgroundColor: 'rgba(168, 85, 247, 0.12)',
  },
  menuIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuIcon: {
    fontSize: 18,
  },
  menuTextBox: {
    flex: 1,
  },
  menuTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
  },
  menuSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 1,
  },
  notifTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  unreadBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  menuArrow: {
    color: '#64748B',
    fontSize: 18,
    fontWeight: '600',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 14,
    marginTop: 4,
  },
  logoutButtonPressed: {
    backgroundColor: 'rgba(239, 68, 68, 0.22)',
  },
  logoutButtonDisabled: {
    opacity: 0.5,
  },
  logoutIcon: {
    fontSize: 15,
  },
  logoutText: {
    color: '#FCA5A5',
    fontSize: 13,
    fontWeight: '700',
  },
});

