import { Link, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import {
  validateConfirmPassword,
  validateEmail,
  validateFullName,
  validatePassword,
} from '@/utils/validation';

export default function RegisterScreen() {
  const router = useRouter();
  const { register, isLoading, error: authError, clearError } = useAuth();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

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
  const [isSuccess, setIsSuccess] = useState(false);

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
      await register({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
      });
      setIsSuccess(true);
    } catch (err) {
      setLocalError(
        (err as Error).message || 'Registration failed. Please check your information and try again.'
      );
    }
  };

  const activeError = localError || authError;

  if (isSuccess) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <View style={styles.successContainer}>
          <ThemedView style={styles.successCard}>
            <ThemedText type="headlineMedium" style={[styles.title, { color: colors.statusSuccess }]}>
              Account created!
            </ThemedText>
            <ThemedText type="bodyLarge" style={{ textAlign: 'center', color: colors.textSecondary }}>
              Your student account for <ThemedText type="code">{email}</ThemedText> was successfully registered.
            </ThemedText>
            <ThemedText type="bodyMedium" style={{ textAlign: 'center', color: colors.textSecondary }}>
              Please sign in with your password to begin your academic productivity sessions.
            </ThemedText>
            <Pressable
              style={[styles.primaryButton, { backgroundColor: colors.brandPrimary, width: '100%', marginTop: 16 }]}
              onPress={() => router.replace('/(auth)/login')}
              accessibilityRole="button"
              accessibilityLabel="Proceed to login">
              <ThemedText type="titleMedium" style={styles.primaryButtonText}>
                Go to Sign In
              </ThemedText>
            </Pressable>
          </ThemedView>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          <ThemedView style={styles.header}>
            <ThemedText type="headlineLarge" style={styles.brandTitle}>
              StudyMate AI
            </ThemedText>
            <ThemedText type="headlineMedium" style={styles.title}>
              Create your account
            </ThemedText>
            <ThemedText type="bodyMedium" style={{ color: colors.textSecondary }}>
              Join your personal AI-powered academic learning workspace.
            </ThemedText>
          </ThemedView>

          {activeError && (
            <View
              style={[
                styles.errorBanner,
                { backgroundColor: colorScheme === 'dark' ? '#3B151E' : '#FEE2E2' },
              ]}>
              <ThemedText
                type="bodyMedium"
                style={{ color: colors.statusDanger, fontWeight: '500' }}>
                {activeError}
              </ThemedText>
            </View>
          )}

          <View style={styles.form}>
            {/* Full Name Field */}
            <View style={styles.inputGroup}>
              <ThemedText type="titleMedium" style={styles.label}>
                Full name
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.inputBackground,
                    borderColor: fieldErrors.fullName ? colors.statusDanger : colors.borderSubtle,
                    color: colors.text,
                  },
                ]}
                placeholder="Jane Doe"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="words"
                autoCorrect={false}
                value={fullName}
                onChangeText={(text) => {
                  setFullName(text);
                  if (fieldErrors.fullName) {
                    setFieldErrors((prev) => ({ ...prev, fullName: undefined }));
                  }
                }}
                editable={!isLoading}
                accessible
                accessibilityLabel="Full name input"
              />
              {fieldErrors.fullName && (
                <ThemedText
                  type="small"
                  style={[styles.fieldError, { color: colors.statusDanger }]}>
                  {fieldErrors.fullName}
                </ThemedText>
              )}
            </View>

            {/* Email Field */}
            <View style={styles.inputGroup}>
              <ThemedText type="titleMedium" style={styles.label}>
                Email address
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.inputBackground,
                    borderColor: fieldErrors.email ? colors.statusDanger : colors.borderSubtle,
                    color: colors.text,
                  },
                ]}
                placeholder="student@university.edu"
                placeholderTextColor={colors.textTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (fieldErrors.email) {
                    setFieldErrors((prev) => ({ ...prev, email: undefined }));
                  }
                }}
                editable={!isLoading}
                accessible
                accessibilityLabel="Email input"
              />
              {fieldErrors.email && (
                <ThemedText
                  type="small"
                  style={[styles.fieldError, { color: colors.statusDanger }]}>
                  {fieldErrors.email}
                </ThemedText>
              )}
            </View>

            {/* Password Field */}
            <View style={styles.inputGroup}>
              <ThemedText type="titleMedium" style={styles.label}>
                Password
              </ThemedText>
              <View style={styles.passwordWrapper}>
                <TextInput
                  style={[
                    styles.input,
                    styles.passwordInput,
                    {
                      backgroundColor: colors.inputBackground,
                      borderColor: fieldErrors.password
                        ? colors.statusDanger
                        : colors.borderSubtle,
                      color: colors.text,
                    },
                  ]}
                  placeholder="Minimum 8 characters"
                  placeholderTextColor={colors.textTertiary}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (fieldErrors.password) {
                      setFieldErrors((prev) => ({ ...prev, password: undefined }));
                    }
                  }}
                  editable={!isLoading}
                  accessible
                  accessibilityLabel="Password input"
                />
                <Pressable
                  style={styles.eyeToggle}
                  onPress={() => setShowPassword((prev) => !prev)}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  hitSlop={12}>
                  <ThemedText type="small" style={{ color: colors.brandPrimary, fontWeight: '600' }}>
                    {showPassword ? 'Hide' : 'Show'}
                  </ThemedText>
                </Pressable>
              </View>
              {fieldErrors.password && (
                <ThemedText
                  type="small"
                  style={[styles.fieldError, { color: colors.statusDanger }]}>
                  {fieldErrors.password}
                </ThemedText>
              )}
            </View>

            {/* Confirm Password Field */}
            <View style={styles.inputGroup}>
              <ThemedText type="titleMedium" style={styles.label}>
                Confirm password
              </ThemedText>
              <View style={styles.passwordWrapper}>
                <TextInput
                  style={[
                    styles.input,
                    styles.passwordInput,
                    {
                      backgroundColor: colors.inputBackground,
                      borderColor: fieldErrors.confirmPassword
                        ? colors.statusDanger
                        : colors.borderSubtle,
                      color: colors.text,
                    },
                  ]}
                  placeholder="Re-enter your password"
                  placeholderTextColor={colors.textTertiary}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    if (fieldErrors.confirmPassword) {
                      setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                    }
                  }}
                  editable={!isLoading}
                  accessible
                  accessibilityLabel="Confirm password input"
                />
                <Pressable
                  style={styles.eyeToggle}
                  onPress={() => setShowConfirmPassword((prev) => !prev)}
                  accessibilityRole="button"
                  accessibilityLabel={showConfirmPassword ? 'Hide password' : 'Show password'}
                  hitSlop={12}>
                  <ThemedText type="small" style={{ color: colors.brandPrimary, fontWeight: '600' }}>
                    {showConfirmPassword ? 'Hide' : 'Show'}
                  </ThemedText>
                </Pressable>
              </View>
              {fieldErrors.confirmPassword && (
                <ThemedText
                  type="small"
                  style={[styles.fieldError, { color: colors.statusDanger }]}>
                  {fieldErrors.confirmPassword}
                </ThemedText>
              )}
            </View>

            {/* Submit Button */}
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                {
                  backgroundColor: colors.brandPrimary,
                  opacity: isLoading || pressed ? 0.85 : 1,
                },
              ]}
              onPress={handleRegister}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel="Create account button">
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <ThemedText type="titleMedium" style={styles.primaryButtonText}>
                  Create account
                </ThemedText>
              )}
            </Pressable>

            {/* Login link */}
            <View style={styles.footerLinkRow}>
              <ThemedText type="bodyMedium" style={{ color: colors.textSecondary }}>
                Already have an account?{' '}
              </ThemedText>
              <Link href="/(auth)/login" asChild>
                <Pressable hitSlop={8}>
                  <ThemedText
                    type="bodyMedium"
                    style={{ color: colors.brandPrimary, fontWeight: '600' }}>
                    Sign in
                  </ThemedText>
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
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 24,
    gap: 8,
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
  },
  errorBanner: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  passwordWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  input: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  passwordInput: {
    paddingRight: 64,
  },
  eyeToggle: {
    position: 'absolute',
    right: 16,
    minHeight: 48,
    minWidth: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fieldError: {
    fontSize: 12,
    marginTop: 2,
  },
  primaryButton: {
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    minHeight: 48,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  footerLinkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    minHeight: 48,
  },
  successContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successCard: {
    width: '100%',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    gap: 16,
  },
});
