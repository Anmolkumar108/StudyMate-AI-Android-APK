import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/context/auth-context';

export default function PendingVerificationScreen() {
  const router = useRouter();
  const { user, refreshProfile, resendVerification, logout, status } = useAuth();

  const [isChecking, setIsChecking] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [resendSuccess, setResendSuccess] = useState<string | null>(null);

  const handleCheckStatus = async () => {
    setIsChecking(true);
    setFeedback(null);
    setResendSuccess(null);
    try {
      await refreshProfile();
      if (status === 'authenticated') {
        router.replace('/');
      } else {
        setFeedback('Verification is still pending. Please click the link in your email and tap this button again.');
      }
    } catch {
      setFeedback('Unable to check verification status right now. Please try again.');
    } finally {
      setIsChecking(false);
    }
  };

  const handleResend = async () => {
    if (!user?.email) return;
    setIsResending(true);
    setFeedback(null);
    setResendSuccess(null);
    try {
      await resendVerification(user.email);
      setResendSuccess('A new verification email has been sent! Please check your inbox.');
    } catch (err) {
      setFeedback((err as Error).message || 'Failed to resend verification email.');
    } finally {
      setIsResending(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/login' as never);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.mascotWrapper}>
          <Image
            source={require('../../../assets/images/auth-robot-signup.png')}
            style={styles.mascotImage}
            resizeMode="contain"
          />
        </View>

        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Text style={styles.iconEmoji}>✉️</Text>
          </View>

          <ThemedText type="headlineMedium" style={styles.cardTitle}>
            Verification Pending
          </ThemedText>

          <Text style={styles.cardSubtitle}>
            We sent an email verification confirmation to:
          </Text>

          <View style={styles.emailPill}>
            <Text style={styles.emailText}>{user?.email || 'your email'}</Text>
          </View>

          <Text style={styles.instructionsText}>
            Please confirm your email address to unlock your full StudyMate AI dashboard and academic tools.
          </Text>

          {feedback && (
            <View style={styles.feedbackBanner}>
              <Text style={styles.feedbackText}>{feedback}</Text>
            </View>
          )}

          {resendSuccess && (
            <View style={styles.successBanner}>
              <Text style={styles.successIcon}>✓</Text>
              <Text style={styles.successText}>{resendSuccess}</Text>
            </View>
          )}

          {/* Primary Action: I Have Verified */}
          <Pressable
            style={[styles.primaryButton, isChecking && styles.buttonDisabled]}
            onPress={handleCheckStatus}
            disabled={isChecking}
            accessibilityRole="button"
            accessibilityLabel="Check verification status">
            {isChecking ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>I have verified my email</Text>
            )}
          </Pressable>

          {/* Enter Code Option */}
          <Pressable
            style={styles.codeButton}
            onPress={() =>
              router.push({
                pathname: '/verify-email' as never,
                params: { email: user?.email },
              })
            }
            accessibilityRole="button"
            accessibilityLabel="Enter verification code">
            <Text style={styles.codeButtonText}>Enter verification code manually  →</Text>
          </Pressable>

          {/* Resend Email Button */}
          <Pressable
            style={styles.resendButton}
            onPress={handleResend}
            disabled={isResending}
            accessibilityRole="button"
            accessibilityLabel="Resend email">
            {isResending ? (
              <ActivityIndicator size="small" color="#A855F7" />
            ) : (
              <Text style={styles.resendButtonText}>Resend verification email</Text>
            )}
          </Pressable>

          {/* Switch Account */}
          <Pressable
            style={styles.logoutButton}
            onPress={handleLogout}
            accessibilityRole="button"
            accessibilityLabel="Sign in with another account">
            <Text style={styles.logoutButtonText}>Sign in with another account</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#070514',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
    paddingVertical: 30,
  },
  mascotWrapper: {
    alignItems: 'center',
    marginBottom: 12,
  },
  mascotImage: {
    width: 140,
    height: 140,
    borderRadius: 28,
  },
  card: {
    backgroundColor: 'rgba(20, 15, 45, 0.85)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    padding: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 8,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(124, 58, 237, 0.3)',
    borderWidth: 1,
    borderColor: '#A855F7',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  iconEmoji: {
    fontSize: 26,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 6,
  },
  cardSubtitle: {
    textAlign: 'center',
    color: '#94A3B8',
    fontSize: 13,
  },
  emailPill: {
    backgroundColor: 'rgba(13, 10, 30, 0.85)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.4)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignSelf: 'center',
    marginVertical: 12,
  },
  emailText: {
    color: '#C084FC',
    fontWeight: '600',
    fontSize: 14,
  },
  instructionsText: {
    color: '#94A3B8',
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 18,
  },
  feedbackBanner: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.4)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  feedbackText: {
    color: '#93C5FD',
    fontSize: 13,
    textAlign: 'center',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(6, 78, 59, 0.35)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.5)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  successIcon: {
    color: '#34D399',
    fontSize: 16,
    fontWeight: 'bold',
  },
  successText: {
    color: '#6EE7B7',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  primaryButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 6,
    marginBottom: 12,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  codeButton: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  codeButtonText: {
    color: '#818CF8',
    fontSize: 13,
    fontWeight: '600',
  },
  resendButton: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  resendButtonText: {
    color: '#C084FC',
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  logoutButton: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.15)',
    paddingTop: 12,
  },
  logoutButtonText: {
    color: '#94A3B8',
    fontSize: 13,
  },
});
