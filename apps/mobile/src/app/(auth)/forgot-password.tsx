import { Link, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
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
import { validateConfirmPassword, validateEmail, validatePassword } from '@/utils/validation';

type ResetStep = 'request_otp' | 'verify_otp' | 'success';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { requestPasswordResetOtp, resetPasswordWithOtp, clearError } = useAuth();

  const [step, setStep] = useState<ResetStep>('request_otp');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    otp?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dynamic Password Strength Evaluation
  const passwordStrength = useMemo(() => {
    if (!newPassword) return { score: 0, label: '', color: '#64748B' };

    let score = 0;
    if (newPassword.length >= 8) score += 1;
    if (/[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword)) score += 1;
    if (/[0-9]/.test(newPassword)) score += 1;
    if (/[^A-Za-z0-9]/.test(newPassword)) score += 1;

    switch (score) {
      case 1:
        return { score: 1, label: 'Weak', color: '#EF4444' };
      case 2:
        return { score: 2, label: 'Fair', color: '#F59E0B' };
      case 3:
        return { score: 3, label: 'Good', color: '#38BDF8' };
      case 4:
        return { score: 4, label: 'Strong Password', color: '#10B981' };
      default:
        return { score: 0, label: '', color: '#64748B' };
    }
  }, [newPassword]);

  // Step 1: Send 6-digit OTP
  const handleRequestOtp = async () => {
    clearError();
    setLocalError(null);
    setFieldErrors({});

    const emailResult = validateEmail(email);
    if (!emailResult.isValid) {
      setFieldErrors({ email: emailResult.error || 'Please enter a valid student email address.' });
      return;
    }

    setIsSubmitting(true);
    try {
      await requestPasswordResetOtp(email.trim().toLowerCase());
      setOtp('');
      setStep('verify_otp');
    } catch (err) {
      setLocalError((err as Error).message || 'Unable to send password reset code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 2: Verify OTP & Update Password
  const handleResetPassword = async () => {
    clearError();
    setLocalError(null);

    const cleanOtp = otp.trim();
    if (!cleanOtp || cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
      setFieldErrors((prev) => ({ ...prev, otp: 'Please enter the 6-digit verification code.' }));
      return;
    }

    const passResult = validatePassword(newPassword);
    const confirmResult = validateConfirmPassword(newPassword, confirmPassword);

    if (!passResult.isValid || !confirmResult.isValid) {
      setFieldErrors({
        otp: undefined,
        newPassword: passResult.error,
        confirmPassword: confirmResult.error,
      });
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);
    try {
      await resetPasswordWithOtp({
        email: email.trim().toLowerCase(),
        otp: cleanOtp,
        new_password: newPassword,
      });
      setStep('success');
    } catch (err) {
      setLocalError((err as Error).message || 'Invalid or expired verification code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Navigation Bar */}
      <View style={styles.navBar}>
        <Pressable
          onPress={() => {
            if (step === 'verify_otp') {
              setStep('request_otp');
            } else {
              router.back();
            }
          }}
          style={styles.backButton}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back">
          <Text style={styles.backArrow}>←</Text>
        </Pressable>
        <Text style={styles.navTitle}>Password Recovery</Text>
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
            {step === 'request_otp' && (
              <>
                <View style={styles.iconCircle}>
                  <Text style={styles.iconEmoji}>🔑</Text>
                </View>

                <ThemedText type="headlineMedium" style={styles.cardTitle}>
                  Forgot Password?
                </ThemedText>
                <Text style={styles.cardSubtitle}>
                  Enter your registered student email address. We will send a secure 6-digit verification code to reset your password.
                </Text>

                {localError && (
                  <View style={styles.errorBanner}>
                    <Text style={styles.errorIcon}>⚠️</Text>
                    <Text style={styles.errorBannerText}>{localError}</Text>
                  </View>
                )}

                <View style={styles.inputGroup}>
                  <View
                    style={[
                      styles.inputFieldContainer,
                      Boolean(fieldErrors.email) && styles.inputFieldError,
                    ]}>
                    <Text style={styles.inputPrefixIcon}>✉️</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="student@university.edu"
                      placeholderTextColor="#64748B"
                      value={email}
                      onChangeText={(text) => {
                        setEmail(text);
                        if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
                      }}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!isSubmitting}
                      accessibilityLabel="Email Address input"
                    />
                  </View>
                  {fieldErrors.email && (
                    <Text style={styles.fieldErrorText}>{fieldErrors.email}</Text>
                  )}
                </View>

                <Pressable
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && styles.primaryButtonPressed,
                    isSubmitting && styles.primaryButtonDisabled,
                  ]}
                  onPress={handleRequestOtp}
                  disabled={isSubmitting}
                  accessibilityRole="button"
                  accessibilityLabel="Send 6-digit verification code">
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Send 6-Digit Code  →</Text>
                  )}
                </Pressable>

                <View style={styles.switchAuthRow}>
                  <Link href={"/login" as never} asChild>
                    <Pressable
                      hitSlop={8}
                      accessibilityRole="link"
                      accessibilityLabel="Back to Login">
                      <Text style={styles.switchAuthLink}>Remember your password? Log In</Text>
                    </Pressable>
                  </Link>
                </View>
              </>
            )}

            {step === 'verify_otp' && (
              <>
                <View style={styles.iconCircle}>
                  <Text style={styles.iconEmoji}>🛡️</Text>
                </View>

                <ThemedText type="headlineMedium" style={styles.cardTitle}>
                  Enter 6-Digit Code
                </ThemedText>
                <Text style={styles.cardSubtitle}>
                  We sent a 6-digit verification code to:
                </Text>
                <View style={styles.emailPill}>
                  <Text style={styles.emailPillText}>{email.trim().toLowerCase()}</Text>
                </View>

                {localError && (
                  <View style={styles.errorBanner}>
                    <Text style={styles.errorIcon}>⚠️</Text>
                    <Text style={styles.errorBannerText}>{localError}</Text>
                  </View>
                )}

                {/* 6-Digit OTP Code Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Verification Code (6 Digits)</Text>
                  <View
                    style={[
                      styles.inputFieldContainer,
                      Boolean(fieldErrors.otp) && styles.inputFieldError,
                    ]}>
                    <Text style={styles.inputPrefixIcon}>🔢</Text>
                    <TextInput
                      style={[styles.textInput, styles.otpTextInput]}
                      placeholder="123456"
                      placeholderTextColor="#64748B"
                      value={otp}
                      onChangeText={(text) => {
                        const cleaned = text.replace(/[^0-9]/g, '').slice(0, 6);
                        setOtp(cleaned);
                        if (fieldErrors.otp) setFieldErrors((prev) => ({ ...prev, otp: undefined }));
                      }}
                      keyboardType="number-pad"
                      maxLength={6}
                      editable={!isSubmitting}
                      accessibilityLabel="6-digit verification code"
                    />
                  </View>
                  {fieldErrors.otp && (
                    <Text style={styles.fieldErrorText}>{fieldErrors.otp}</Text>
                  )}
                </View>

                {/* New Password Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>New Password</Text>
                  <View
                    style={[
                      styles.inputFieldContainer,
                      Boolean(fieldErrors.newPassword) && styles.inputFieldError,
                    ]}>
                    <Text style={styles.inputPrefixIcon}>🔒</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Minimum 8 characters"
                      placeholderTextColor="#64748B"
                      value={newPassword}
                      onChangeText={(text) => {
                        setNewPassword(text);
                        if (fieldErrors.newPassword) setFieldErrors((prev) => ({ ...prev, newPassword: undefined }));
                      }}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      editable={!isSubmitting}
                      accessibilityLabel="New Password input"
                    />
                    <Pressable
                      onPress={() => setShowPassword((prev) => !prev)}
                      style={styles.eyeButton}
                      hitSlop={8}>
                      <Text style={styles.eyeIcon}>{showPassword ? '👁️' : '🔒'}</Text>
                    </Pressable>
                  </View>
                  {fieldErrors.newPassword && (
                    <Text style={styles.fieldErrorText}>{fieldErrors.newPassword}</Text>
                  )}
                  {Boolean(newPassword) && (
                    <View style={styles.passwordStrengthRow}>
                      <View style={styles.strengthBarsContainer}>
                        {[1, 2, 3, 4].map((barIndex) => (
                          <View
                            key={barIndex}
                            style={[
                              styles.strengthBar,
                              {
                                backgroundColor:
                                  passwordStrength.score >= barIndex
                                    ? passwordStrength.color
                                    : 'rgba(255, 255, 255, 0.1)',
                              },
                            ]}
                          />
                        ))}
                      </View>
                      <Text style={[styles.strengthLabel, { color: passwordStrength.color }]}>
                        {passwordStrength.label}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Confirm New Password Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Confirm New Password</Text>
                  <View
                    style={[
                      styles.inputFieldContainer,
                      Boolean(fieldErrors.confirmPassword) && styles.inputFieldError,
                    ]}>
                    <Text style={styles.inputPrefixIcon}>🔒</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Re-enter new password"
                      placeholderTextColor="#64748B"
                      value={confirmPassword}
                      onChangeText={(text) => {
                        setConfirmPassword(text);
                        if (fieldErrors.confirmPassword) setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                      }}
                      secureTextEntry={!showConfirmPassword}
                      autoCapitalize="none"
                      editable={!isSubmitting}
                      accessibilityLabel="Confirm Password input"
                    />
                    <Pressable
                      onPress={() => setShowConfirmPassword((prev) => !prev)}
                      style={styles.eyeButton}
                      hitSlop={8}>
                      <Text style={styles.eyeIcon}>{showConfirmPassword ? '👁️' : '🔒'}</Text>
                    </Pressable>
                  </View>
                  {fieldErrors.confirmPassword && (
                    <Text style={styles.fieldErrorText}>{fieldErrors.confirmPassword}</Text>
                  )}
                </View>

                <Pressable
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && styles.primaryButtonPressed,
                    isSubmitting && styles.primaryButtonDisabled,
                  ]}
                  onPress={handleResetPassword}
                  disabled={isSubmitting}
                  accessibilityRole="button"
                  accessibilityLabel="Update Password">
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Update Password  →</Text>
                  )}
                </Pressable>

                <View style={styles.resendRow}>
                  <Pressable
                    onPress={handleRequestOtp}
                    disabled={isSubmitting}
                    hitSlop={8}>
                    <Text style={styles.resendLink}>{"Didn't receive code? Resend"}</Text>
                  </Pressable>
                </View>
              </>
            )}

            {step === 'success' && (
              <View style={styles.successBox}>
                <View style={styles.successIconCircle}>
                  <Text style={styles.successCheckIcon}>✓</Text>
                </View>
                <ThemedText type="headlineMedium" style={styles.successTitle}>
                  Password Reset! 🎉
                </ThemedText>
                <Text style={styles.successText}>
                  Your password has been successfully updated in your student account. You can now log in securely with your new password.
                </Text>
                <Pressable
                  style={styles.primaryButton}
                  onPress={() => router.replace('/login' as never)}
                  accessibilityRole="button"
                  accessibilityLabel="Return to login">
                  <Text style={styles.primaryButtonText}>Log In with New Password  →</Text>
                </Pressable>
              </View>
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
    marginBottom: 20,
    fontSize: 13,
    lineHeight: 18,
  },
  emailPill: {
    backgroundColor: 'rgba(124, 58, 237, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.4)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignSelf: 'center',
    marginBottom: 18,
  },
  emailPillText: {
    color: '#E9D5FF',
    fontSize: 13,
    fontWeight: '700',
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
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
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
  inputFieldError: {
    borderColor: '#EF4444',
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
  otpTextInput: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 6,
  },
  eyeButton: {
    padding: 4,
  },
  eyeIcon: {
    fontSize: 16,
  },
  fieldErrorText: {
    color: '#F87171',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  passwordStrengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 10,
  },
  strengthBarsContainer: {
    flexDirection: 'row',
    flex: 1,
    height: 4,
    gap: 4,
  },
  strengthBar: {
    flex: 1,
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 12,
    fontWeight: '600',
    minWidth: 80,
    textAlign: 'right',
  },
  primaryButton: {
    height: 52,
    backgroundColor: '#7C3AED',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  primaryButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  switchAuthRow: {
    marginTop: 20,
    alignItems: 'center',
  },
  switchAuthLink: {
    color: '#C084FC',
    fontSize: 13,
    fontWeight: '600',
  },
  resendRow: {
    marginTop: 16,
    alignItems: 'center',
  },
  resendLink: {
    color: '#A855F7',
    fontSize: 13,
    fontWeight: '600',
  },
  successBox: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  successIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 2,
    borderColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successCheckIcon: {
    color: '#10B981',
    fontSize: 32,
    fontWeight: 'bold',
  },
  successTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  successText: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
});
