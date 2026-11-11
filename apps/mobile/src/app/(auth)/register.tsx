import { Link, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { getDeviceDetails } from '@/services/device-info';
import { isGoogleOAuthConfigured } from '@/services/google-auth';
import {
  validateConfirmPassword,
  validateEmail,
  validateFullName,
  validatePassword,
} from '@/utils/validation';

export default function RegisterScreen() {
  const router = useRouter();
  const {
    register,
    loginWithGoogle,
    isLoading,
    error: authError,
    clearError,
  } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<{
    fullName?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});
  const [localError, setLocalError] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Dynamic Password Strength Evaluation
  const passwordStrength = useMemo(() => {
    if (!password) return { score: 0, label: '', color: '#64748B' };

    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

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
  }, [password]);

  const handleRegister = async () => {
    clearError();
    setLocalError(null);

    const nameResult = validateFullName(fullName);
    const emailResult = validateEmail(email);
    const passwordResult = validatePassword(password);
    const confirmResult = validateConfirmPassword(password, confirmPassword);

    if (
      !nameResult.isValid ||
      !emailResult.isValid ||
      !passwordResult.isValid ||
      !confirmResult.isValid
    ) {
      setFieldErrors({
        fullName: nameResult.error,
        email: emailResult.error,
        password: passwordResult.error,
        confirmPassword: confirmResult.error,
      });
      return;
    }

    setFieldErrors({});

    try {
      const dev = getDeviceDetails();
      await register({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        device_name: dev.deviceName,
        device_os: dev.deviceOs,
      });
      // Directly enter app on successful registration
      router.replace('/');
    } catch (err) {
      setLocalError(
        (err as Error).message || 'Registration failed. Please check your information and try again.'
      );
    }
  };

  const handleGoogleSignIn = async () => {
    clearError();
    setLocalError(null);

    if (isGoogleOAuthConfigured()) {
      setIsGoogleLoading(true);
      try {
        const success = await loginWithGoogle();
        if (success) {
          router.replace('/');
        }
      } catch (err) {
        setLocalError((err as Error).message || 'Google Sign-In failed. Please try again.');
      } finally {
        setIsGoogleLoading(false);
      }
    } else {
      Alert.alert(
        'Google Sign-In Configuration',
        'Real Google authentication on Android requires a Google Cloud Client ID.\n\nPlease set EXPO_PUBLIC_GOOGLE_CLIENT_ID in apps/mobile/.env to connect Google accounts on this phone.\n\nIn the meantime, you can create your account directly using the form below.',
        [{ text: 'Got It' }]
      );
    }
  };

  const activeError = localError || authError;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">

          {/* Top Mascot Hero Illustration */}
          <View style={styles.mascotWrapper}>
            <Image
              source={require('../../../assets/images/auth-robot-signup.jpg')}
              style={styles.mascotImage}
              resizeMode="cover"
            />
          </View>

          {/* App Brand Header */}
          <View style={styles.brandRow}>
            <View style={styles.brandIconBox}>
              <Text style={styles.brandEmoji}>📖</Text>
            </View>
            <View>
              <View style={styles.brandTitleRow}>
                <Text style={styles.brandTitleWhite}>StudyMate </Text>
                <Text style={styles.brandTitlePurple}>AI</Text>
              </View>
              <Text style={styles.brandSubtitle}>Learn • Plan • Achieve</Text>
            </View>
          </View>

          {/* Card Form */}
          <View style={styles.card}>
            <ThemedText type="headlineMedium" style={styles.cardTitle}>
              Create Your Account
            </ThemedText>
            <ThemedText type="bodySmall" style={styles.cardSubtitle}>
              Join us and start your smart learning journey!
            </ThemedText>

            {/* Error Banner */}
            {activeError && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorIcon}>⚠️</Text>
                <Text style={styles.errorBannerText}>{activeError}</Text>
              </View>
            )}

            {/* Input: Full Name */}
            <View style={styles.inputGroup}>
              <View
                style={[
                  styles.inputFieldContainer,
                  Boolean(fieldErrors.fullName) && styles.inputFieldError,
                ]}>
                <Text style={styles.inputPrefixIcon}>👤</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Full Name"
                  placeholderTextColor="#64748B"
                  value={fullName}
                  onChangeText={(text) => {
                    setFullName(text);
                    if (fieldErrors.fullName) {
                      setFieldErrors((prev) => ({ ...prev, fullName: undefined }));
                    }
                  }}
                  autoCapitalize="words"
                  editable={!isLoading && !isGoogleLoading}
                  accessibilityLabel="Full Name input"
                />
              </View>
              {fieldErrors.fullName && (
                <Text style={styles.fieldErrorText}>{fieldErrors.fullName}</Text>
              )}
            </View>

            {/* Input: Email Address */}
            <View style={styles.inputGroup}>
              <View
                style={[
                  styles.inputFieldContainer,
                  Boolean(fieldErrors.email) && styles.inputFieldError,
                ]}>
                <Text style={styles.inputPrefixIcon}>✉️</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Email Address"
                  placeholderTextColor="#64748B"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (fieldErrors.email) {
                      setFieldErrors((prev) => ({ ...prev, email: undefined }));
                    }
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading && !isGoogleLoading}
                  accessibilityLabel="Email Address input"
                />
              </View>
              {fieldErrors.email && (
                <Text style={styles.fieldErrorText}>{fieldErrors.email}</Text>
              )}
            </View>

            {/* Input: Create Password */}
            <View style={styles.inputGroup}>
              <View
                style={[
                  styles.inputFieldContainer,
                  Boolean(fieldErrors.password) && styles.inputFieldError,
                ]}>
                <Text style={styles.inputPrefixIcon}>🔒</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Create Password"
                  placeholderTextColor="#64748B"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (fieldErrors.password) {
                      setFieldErrors((prev) => ({ ...prev, password: undefined }));
                    }
                  }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  editable={!isLoading && !isGoogleLoading}
                  accessibilityLabel="Create Password input"
                />
                <Pressable
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeToggle}
                  hitSlop={12}
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  accessibilityRole="button">
                  <Text style={styles.eyeIconText}>{showPassword ? '👁️' : '🙈'}</Text>
                </Pressable>
              </View>
              {fieldErrors.password && (
                <Text style={styles.fieldErrorText}>{fieldErrors.password}</Text>
              )}
            </View>

            {/* Input: Confirm Password */}
            <View style={styles.inputGroup}>
              <View
                style={[
                  styles.inputFieldContainer,
                  Boolean(fieldErrors.confirmPassword) && styles.inputFieldError,
                ]}>
                <Text style={styles.inputPrefixIcon}>🔒</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Confirm Password"
                  placeholderTextColor="#64748B"
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    if (fieldErrors.confirmPassword) {
                      setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                    }
                  }}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  editable={!isLoading && !isGoogleLoading}
                  accessibilityLabel="Confirm Password input"
                />
                <Pressable
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={styles.eyeToggle}
                  hitSlop={12}
                  accessibilityLabel={showConfirmPassword ? 'Hide password' : 'Show password'}
                  accessibilityRole="button">
                  <Text style={styles.eyeIconText}>{showConfirmPassword ? '👁️' : '🙈'}</Text>
                </Pressable>
              </View>
              {fieldErrors.confirmPassword && (
                <Text style={styles.fieldErrorText}>{fieldErrors.confirmPassword}</Text>
              )}
            </View>

            {/* Dynamic Password Strength Indicator */}
            {password.length > 0 && (
              <View style={styles.strengthContainer}>
                <View style={styles.strengthHeaderRow}>
                  {passwordStrength.score >= 4 && (
                    <Text style={styles.strengthCheckmark}>✓ </Text>
                  )}
                  <Text style={[styles.strengthLabel, { color: passwordStrength.color }]}>
                    {passwordStrength.label}
                  </Text>
                </View>
                <View style={styles.strengthPillsRow}>
                  {[1, 2, 3, 4].map((step) => (
                    <View
                      key={step}
                      style={[
                        styles.strengthPill,
                        {
                          backgroundColor:
                            step <= passwordStrength.score
                              ? passwordStrength.color
                              : 'rgba(100, 116, 139, 0.3)',
                        },
                      ]}
                    />
                  ))}
                </View>
              </View>
            )}

            {/* Primary Action: Create Account Button */}
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.primaryButtonPressed,
                (isLoading || isGoogleLoading) && styles.primaryButtonDisabled,
              ]}
              onPress={handleRegister}
              disabled={isLoading || isGoogleLoading}
              accessibilityRole="button"
              accessibilityLabel="Create Account">
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Create Account  →</Text>
              )}
            </Pressable>

            {/* Divider "or" */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Real Google OAuth Sign-In */}
            <Pressable
              style={({ pressed }) => [
                styles.googleButton,
                pressed && styles.googleButtonPressed,
                (isLoading || isGoogleLoading) && styles.googleButtonDisabled,
              ]}
              onPress={handleGoogleSignIn}
              disabled={isLoading || isGoogleLoading}
              accessibilityRole="button"
              accessibilityLabel="Continue with Google">
              {isGoogleLoading ? (
                <ActivityIndicator color="#A855F7" size="small" />
              ) : (
                <View style={styles.googleContentRow}>
                  <View style={styles.googleBadge}>
                    <Text style={styles.googleLetterG}>G</Text>
                  </View>
                  <Text style={styles.googleButtonText}>Continue with Google</Text>
                </View>
              )}
            </Pressable>

            {/* Switch to Login */}
            <View style={styles.switchAuthRow}>
              <Text style={styles.switchAuthPrompt}>Already have an account? </Text>
              <Link href={"/login" as never} asChild>
                <Pressable
                  hitSlop={8}
                  accessibilityRole="link"
                  accessibilityLabel="Login link">
                  <Text style={styles.switchAuthLink}>Login  ›</Text>
                </Pressable>
              </Link>
            </View>
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
    paddingBottom: 36,
  },
  mascotWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  mascotImage: {
    width: 170,
    height: 170,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: 'rgba(168, 85, 247, 0.45)',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 12,
  },
  brandIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(46, 26, 86, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandEmoji: {
    fontSize: 22,
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandTitleWhite: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  brandTitlePurple: {
    fontSize: 22,
    fontWeight: '800',
    color: '#A855F7',
    letterSpacing: 0.3,
  },
  brandSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  card: {
    backgroundColor: 'rgba(20, 15, 45, 0.85)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    padding: 22,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 8,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 4,
  },
  cardSubtitle: {
    textAlign: 'center',
    color: '#94A3B8',
    marginBottom: 20,
    fontSize: 13,
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
    marginBottom: 14,
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
    fontSize: 15,
    height: '100%',
  },
  eyeToggle: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeIconText: {
    fontSize: 16,
  },
  fieldErrorText: {
    color: '#F87171',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 6,
  },
  strengthContainer: {
    marginBottom: 18,
    marginTop: 4,
  },
  strengthHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  strengthCheckmark: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: 'bold',
  },
  strengthLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  strengthPillsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  strengthPill: {
    flex: 1,
    height: 4,
    borderRadius: 2,
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
    marginTop: 6,
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
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
  },
  dividerText: {
    color: '#94A3B8',
    paddingHorizontal: 12,
    fontSize: 13,
  },
  googleButton: {
    height: 50,
    borderRadius: 14,
    backgroundColor: 'rgba(13, 10, 30, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleButtonPressed: {
    backgroundColor: 'rgba(30, 20, 65, 0.9)',
  },
  googleButtonDisabled: {
    opacity: 0.6,
  },
  googleContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  googleBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleLetterG: {
    color: '#4285F4',
    fontSize: 15,
    fontWeight: '900',
  },
  googleButtonText: {
    color: '#F1F5F9',
    fontSize: 15,
    fontWeight: '600',
  },
  switchAuthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  switchAuthPrompt: {
    color: '#94A3B8',
    fontSize: 13,
  },
  switchAuthLink: {
    color: '#C084FC',
    fontSize: 13,
    fontWeight: '700',
  },
  successWrapper: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  successIconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(124, 58, 237, 0.3)',
    borderWidth: 1,
    borderColor: '#A855F7',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successIconEmoji: {
    fontSize: 32,
  },
  successTitle: {
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  successSubtitle: {
    color: '#94A3B8',
    textAlign: 'center',
    fontSize: 14,
  },
  emailPill: {
    backgroundColor: 'rgba(13, 10, 30, 0.8)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.4)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignSelf: 'center',
    marginVertical: 12,
  },
  emailPillText: {
    color: '#C084FC',
    fontWeight: '600',
    fontSize: 14,
  },
  successInstructions: {
    color: '#94A3B8',
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 24,
  },
  secondaryButton: {
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  secondaryButtonText: {
    color: '#CBD5E1',
    fontSize: 15,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: '#120B28',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#7C3AED',
    padding: 24,
    gap: 14,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  modalSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
  },
  cancelModalBtn: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelModalText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },
});
