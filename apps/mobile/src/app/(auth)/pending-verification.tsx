import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';

export default function PendingVerificationScreen() {
  const router = useRouter();
  const { user, refreshProfile, logout, status } = useAuth();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const [isChecking, setIsChecking] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleCheckStatus = async () => {
    setIsChecking(true);
    setFeedback(null);
    try {
      await refreshProfile();
      if (status === 'authenticated') {
        router.replace('/');
      } else {
        setFeedback('Verification is still pending. Please check your inbox and verify your email.');
      }
    } catch {
      setFeedback('Unable to check verification status right now. Please try again.');
    } finally {
      setIsChecking(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View style={styles.container}>
        <ThemedView style={styles.card}>
          <ThemedText type="headlineMedium" style={styles.title}>
            Verification Pending
          </ThemedText>
          <ThemedText type="bodyMedium" style={{ textAlign: 'center', color: colors.textSecondary }}>
            We sent a verification confirmation to{' '}
            <ThemedText type="code">{user?.email || 'your email'}</ThemedText>.
          </ThemedText>
          <ThemedText type="bodySmall" style={{ textAlign: 'center', color: colors.textSecondary }}>
            Please confirm your email address to unlock your full StudyMate AI dashboard.
          </ThemedText>

          {feedback && (
            <View
              style={[
                styles.feedbackBanner,
                { backgroundColor: colorScheme === 'dark' ? '#1E293B' : '#F1F5F9' },
              ]}>
              <ThemedText type="small" style={{ color: colors.textSecondary, textAlign: 'center' }}>
                {feedback}
              </ThemedText>
            </View>
          )}

          <Pressable
            style={[
              styles.primaryButton,
              { backgroundColor: colors.brandPrimary, opacity: isChecking ? 0.8 : 1 },
            ]}
            onPress={handleCheckStatus}
            disabled={isChecking}
            accessibilityRole="button"
            accessibilityLabel="Check verification status">
            {isChecking ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <ThemedText type="titleMedium" style={styles.primaryButtonText}>
                I have verified my email
              </ThemedText>
            )}
          </Pressable>

          <Pressable
            style={[styles.secondaryButton, { borderColor: colors.borderSubtle }]}
            onPress={handleLogout}
            accessibilityRole="button"
            accessibilityLabel="Switch account or sign in again">
            <ThemedText type="bodyMedium" style={{ color: colors.textSecondary }}>
              Sign in with another account
            </ThemedText>
          </Pressable>
        </ThemedView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '100%',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  feedbackBanner: {
    borderRadius: 8,
    padding: 12,
    width: '100%',
  },
  primaryButton: {
    height: 52,
    width: '100%',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  secondaryButton: {
    height: 48,
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
