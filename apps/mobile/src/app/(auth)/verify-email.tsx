import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/context/auth-context';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string; status?: string; email?: string }>();
  const { verifyEmail, resendVerification, refreshProfile, status: authStatus } = useAuth();

  const [tokenInput, setTokenInput] = useState(params.token || '');
  const [emailInput, setEmailInput] = useState(params.email || '');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(params.status === 'success');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resendFeedback, setResendFeedback] = useState<string | null>(null);

  const handleVerify = useCallback(async (codeToVerify?: string) => {
    const rawCode = (codeToVerify || tokenInput).trim();
    if (!rawCode) {
      setErrorMessage('Please enter the verification code or token from your email.');
      return;
    }

    setIsVerifying(true);
    setErrorMessage(null);
    setResendFeedback(null);

    try {
      await verifyEmail(rawCode);
      setIsSuccess(true);
      await refreshProfile();
    } catch (err) {
      setErrorMessage((err as Error).message || 'Invalid or expired verification link.');
    } finally {
      setIsVerifying(false);
    }
  }, [tokenInput, verifyEmail, refreshProfile]);

  // Automatically trigger verification if token was delivered via deep link URL
  useEffect(() => {
    if (params.token && !isSuccess) {
      handleVerify(params.token);
    }
  }, [params.token, isSuccess, handleVerify]);

  const handleResend = async () => {
    const targetEmail = emailInput.trim().toLowerCase();
    if (!targetEmail) {
      setErrorMessage('Please provide your email address to resend the verification code.');
      return;
    }

    setIsResending(true);
    setResendFeedback(null);
    setErrorMessage(null);
    try {
      await resendVerification(targetEmail);
      setResendFeedback('A new verification code has been sent to your email.');
    } catch (err) {
      setErrorMessage((err as Error).message || 'Failed to resend verification email.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Navigation bar */}
      <View style={styles.navBar}>
        <Pressable
          onPress={() => router.replace('/login' as never)}
          style={styles.backButton}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back to Login">
          <Text style={styles.backArrow}>←</Text>
        </Pressable>
        <Text style={styles.navTitle}>Email Verification</Text>
        <View style={styles.placeholderButton} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">

          <View style={styles.card}>
            {isSuccess ? (
              <View style={styles.successContainer}>
                <View style={styles.successIconCircle}>
                  <Text style={styles.successIconEmoji}>🎉</Text>
                </View>

                <ThemedText type="headlineMedium" style={styles.cardTitle}>
                  Email Verified!
                </ThemedText>
                <Text style={styles.cardSubtitle}>
                  Your email address has been confirmed and your account is active.
                </Text>

                <Pressable
                  style={styles.primaryButton}
                  onPress={() => {
                    if (authStatus === 'authenticated') {
                      router.replace('/');
                    } else {
                      router.replace('/login' as never);
                    }
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Continue to StudyMate AI">
                  <Text style={styles.primaryButtonText}>Continue to StudyMate AI  →</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <View style={styles.iconCircle}>
                  <Text style={styles.iconEmoji}>✉️</Text>
                </View>

                <ThemedText type="headlineMedium" style={styles.cardTitle}>
                  Verify Your Account
                </ThemedText>
                <Text style={styles.cardSubtitle}>
                  Enter the verification code or token sent to your email inbox.
                </Text>

                {errorMessage && (
                  <View style={styles.errorBanner}>
                    <Text style={styles.errorIcon}>⚠️</Text>
                    <Text style={styles.errorBannerText}>{errorMessage}</Text>
                  </View>
                )}

                {resendFeedback && (
                  <View style={styles.successBanner}>
                    <Text style={styles.successIcon}>✓</Text>
                    <Text style={styles.successBannerText}>{resendFeedback}</Text>
                  </View>
                )}

                {/* Verification Token / Code Input */}
                <View style={styles.inputGroup}>
                  <View style={styles.inputFieldContainer}>
                    <Text style={styles.inputPrefixIcon}>🔑</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Paste verification token or code"
                      placeholderTextColor="#64748B"
                      value={tokenInput}
                      onChangeText={(text) => {
                        setTokenInput(text);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!isVerifying}
                      accessibilityLabel="Verification Code input"
                    />
                  </View>
                </View>

                {/* Primary Verify Button */}
                <Pressable
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && styles.primaryButtonPressed,
                    isVerifying && styles.primaryButtonDisabled,
                  ]}
                  onPress={() => handleVerify()}
                  disabled={isVerifying}
                  accessibilityRole="button"
                  accessibilityLabel="Verify Email">
                  {isVerifying ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Verify Email  →</Text>
                  )}
                </Pressable>

                {/* Resend Section */}
                <View style={styles.resendSection}>
                  <Text style={styles.resendTitle}>{"Didn't receive the email?"}</Text>
                  <View style={styles.resendInputContainer}>
                    <TextInput
                      style={styles.resendTextInput}
                      placeholder="your.email@university.edu"
                      placeholderTextColor="#64748B"
                      value={emailInput}
                      onChangeText={setEmailInput}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      editable={!isResending}
                    />
                    <Pressable
                      style={styles.resendButton}
                      onPress={handleResend}
                      disabled={isResending}>
                      {isResending ? (
                        <ActivityIndicator size="small" color="#A855F7" />
                      ) : (
                        <Text style={styles.resendButtonText}>Resend Link</Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#070514',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
    paddingBottom: 40,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    color: '#F8FAFC',
    fontSize: 24,
    fontWeight: 'bold',
  },
  navTitle: {
    color: '#E2E8F0',
    fontSize: 16,
    fontWeight: '600',
  },
  placeholderButton: {
    width: 48,
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
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(124, 58, 237, 0.3)',
    borderWidth: 1,
    borderColor: '#A855F7',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconEmoji: {
    fontSize: 28,
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  successIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    borderWidth: 1.5,
    borderColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successIconEmoji: {
    fontSize: 36,
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
    marginBottom: 22,
    fontSize: 13,
    lineHeight: 18,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(153, 27, 27, 0.35)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.5)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 10,
  },
  errorIcon: {
    fontSize: 16,
  },
  errorBannerText: {
    color: '#FCA5A5',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
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
    gap: 10,
  },
  successIcon: {
    color: '#34D399',
    fontSize: 16,
    fontWeight: 'bold',
  },
  successBannerText: {
    color: '#6EE7B7',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  inputGroup: {
    marginBottom: 18,
  },
  inputFieldContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(13, 10, 30, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    borderRadius: 14,
    height: 52,
    paddingHorizontal: 14,
  },
  inputPrefixIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 14,
    height: '100%',
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
    marginTop: 4,
    width: '100%',
  },
  primaryButtonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  primaryButtonDisabled: {
    opacity: 0.65,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  resendSection: {
    marginTop: 26,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.15)',
  },
  resendTitle: {
    color: '#94A3B8',
    fontSize: 13,
    marginBottom: 10,
    textAlign: 'center',
  },
  resendInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(13, 10, 30, 0.7)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
    paddingLeft: 12,
    paddingRight: 6,
    height: 48,
  },
  resendTextInput: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 13,
  },
  resendButton: {
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 8,
    backgroundColor: 'rgba(124, 58, 237, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resendButtonText: {
    color: '#C084FC',
    fontWeight: '700',
    fontSize: 12,
  },
});
