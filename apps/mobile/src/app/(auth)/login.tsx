import { Link, useRouter } from 'expo-router';
import React, { useState } from 'react';
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
import { isGoogleOAuthConfigured, openGoogleAccountPage } from '@/services/google-auth';
import { validateEmail, validatePassword } from '@/utils/validation';

export default function LoginScreen() {
  const router = useRouter();
  const {
    login,
    loginWithGoogle,
    resendVerification,
    isLoading,
    error: authError,
    clearError,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [localError, setLocalError] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  const isPendingVerification = (localError || authError || '').toLowerCase().includes('verification');

  const handleLogin = async () => {
    clearError();
    setLocalError(null);
    setResendMessage(null);

    const emailResult = validateEmail(email);
    const passwordResult = validatePassword(password);

    if (!emailResult.isValid || !passwordResult.isValid) {
      setFieldErrors({
        email: emailResult.error,
        password: passwordResult.error,
      });
      return;
    }

    setFieldErrors({});

    try {
      const dev = getDeviceDetails();
      await login({
        email: email.trim().toLowerCase(),
        password,
        device_name: dev.deviceName,
        device_os: dev.deviceOs,
      });
    } catch (err) {
      setLocalError((err as Error).message || 'Unable to log in. Please check your credentials.');
    }
  };

  const handleGoogleSignIn = async () => {
    clearError();
    setLocalError(null);
    setResendMessage(null);

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
        'Real Google authentication requires a Google Cloud Client ID.\n\nPlease set EXPO_PUBLIC_GOOGLE_CLIENT_ID in apps/mobile/.env to connect with Google on this device.\n\nIn the meantime, please log in using your student email and password above.',
        [{ text: 'Got It' }]
      );
    }
  };

  const handleResendVerification = async () => {
    const targetEmail = email.trim().toLowerCase();
    if (!targetEmail) {
      setLocalError('Please enter your email address to resend verification.');
      return;
    }

    setIsResending(true);
    setResendMessage(null);
    try {
      await resendVerification(targetEmail);
      setResendMessage('Verification email sent! Please check your inbox or spam folder.');
    } catch (err) {
      setLocalError((err as Error).message || 'Failed to resend verification email.');
    } finally {
      setIsResending(false);
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
              source={require('../../../assets/images/auth-robot-login.jpg')}
              style={styles.mascotImage}
              resizeMode="cover"
            />
            {/* Playful Floating Speech Bubble */}
            <View style={styles.speechBubble}>
              <Text style={styles.speechBubbleText}>Welcome Back! 💖</Text>
            </View>
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
              <Text style={styles.brandSubtitle}>Your Personal Study Companion</Text>
            </View>
          </View>

          {/* Form Card Container */}
          <View style={styles.card}>
            <ThemedText type="headlineMedium" style={styles.cardTitle}>
              Welcome Back! 👋
            </ThemedText>
            <ThemedText type="bodySmall" style={styles.cardSubtitle}>
              Login to continue your learning journey
            </ThemedText>

            {/* Error or Notice Banners */}
            {activeError && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorIcon}>⚠️</Text>
                <Text style={styles.errorBannerText}>{activeError}</Text>
              </View>
            )}

            {/* Resend Verification Notice */}
            {isPendingVerification && (
              <View style={styles.resendCard}>
                <Text style={styles.resendCardText}>
                  Need a new verification link?
                </Text>
                <Pressable
                  onPress={handleResendVerification}
                  disabled={isResending}
                  style={styles.resendActionBtn}>
                  {isResending ? (
                    <ActivityIndicator size="small" color="#A855F7" />
                  ) : (
                    <Text style={styles.resendActionText}>Resend Verification Email</Text>
                  )}
                </Pressable>
              </View>
            )}

            {resendMessage && (
              <View style={styles.successBanner}>
                <Text style={styles.successIcon}>✓</Text>
                <Text style={styles.successBannerText}>{resendMessage}</Text>
              </View>
            )}

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

            {/* Input: Password */}
            <View style={styles.inputGroup}>
              <View
                style={[
                  styles.inputFieldContainer,
                  Boolean(fieldErrors.password) && styles.inputFieldError,
                ]}>
                <Text style={styles.inputPrefixIcon}>🔒</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Password"
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
                  accessibilityLabel="Password input"
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

            {/* Forgot Password Link */}
            <View style={styles.forgotPasswordRow}>
              <Link href={"/forgot-password" as never} asChild>
                <Pressable
                  hitSlop={8}
                  style={styles.forgotPasswordButton}
                  accessibilityRole="link"
                  accessibilityLabel="Forgot Password link">
                  <Text style={styles.forgotPasswordText}>🔒 Forgot Password?</Text>
                </Pressable>
              </Link>
            </View>

            {/* Primary Action: Log In Button */}
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.primaryButtonPressed,
                (isLoading || isGoogleLoading) && styles.primaryButtonDisabled,
              ]}
              onPress={handleLogin}
              disabled={isLoading || isGoogleLoading}
              accessibilityRole="button"
              accessibilityLabel="Log In">
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Log In  →</Text>
              )}
            </Pressable>

            {/* Divider "or" */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Real Google OAuth Button */}
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

            {/* Go to Google Account Option */}
            <Pressable
              onPress={openGoogleAccountPage}
              style={styles.goToGoogleLink}
              hitSlop={8}
              accessibilityRole="link"
              accessibilityLabel="Go to Google account portal">
              <Text style={styles.goToGoogleText}>Go to Google account portal ↗</Text>
            </Pressable>

            {/* Link to Signup */}
            <View style={styles.switchAuthRow}>
              <Text style={styles.switchAuthPrompt}>{"Don't have an account? "}</Text>
              <Link href={"/register" as never} asChild>
                <Pressable
                  hitSlop={8}
                  accessibilityRole="link"
                  accessibilityLabel="Create Account link">
                  <Text style={styles.switchAuthLink}>Create Account  →</Text>
                </Pressable>
              </Link>
            </View>

            {/* Decorative Quote */}
            <View style={styles.quoteBox}>
              <Text style={styles.quoteText}>Study Smart... Grow Smart...</Text>
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
  speechBubble: {
    position: 'absolute',
    right: 18,
    top: 8,
    backgroundColor: 'rgba(124, 58, 237, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(216, 180, 254, 0.6)',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
  speechBubbleText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
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
  resendCard: {
    backgroundColor: 'rgba(59, 30, 94, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.4)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    alignItems: 'center',
    gap: 6,
  },
  resendCardText: {
    color: '#E2E8F0',
    fontSize: 13,
  },
  resendActionBtn: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  resendActionText: {
    color: '#C084FC',
    fontWeight: '700',
    fontSize: 13,
    textDecorationLine: 'underline',
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
    marginBottom: 16,
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
  forgotPasswordRow: {
    alignItems: 'flex-end',
    marginBottom: 20,
  },
  forgotPasswordButton: {
    minHeight: 48,
    justifyContent: 'center',
    paddingVertical: 4,
  },
  forgotPasswordText: {
    color: '#C084FC',
    fontSize: 13,
    fontWeight: '600',
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
  goToGoogleLink: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 4,
  },
  goToGoogleText: {
    color: '#818CF8',
    fontSize: 12,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  switchAuthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
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
  quoteBox: {
    marginTop: 22,
    alignItems: 'center',
  },
  quoteText: {
    color: '#A78BFA',
    fontSize: 13,
    fontStyle: 'italic',
    letterSpacing: 0.5,
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
