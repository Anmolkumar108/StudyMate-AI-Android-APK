import { Link } from 'expo-router';
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
import { validateEmail, validatePassword } from '@/utils/validation';

export default function LoginScreen() {
  const { login, isLoading, error: authError, clearError } = useAuth();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [localError, setLocalError] = useState<string | null>(null);

  const handleLogin = async () => {
    clearError();
    setLocalError(null);

    // Validate fields
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
      await login({
        email: email.trim().toLowerCase(),
        password,
        device_name: Platform.OS === 'android' ? 'Android Device' : 'Mobile Client',
        device_os: Platform.OS,
      });
      // Navigation is automatically handled by the root layout auth listener
    } catch (err) {
      setLocalError((err as Error).message || 'Unable to log in. Please check your credentials.');
    }
  };

  const activeError = localError || authError;

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
              Welcome back
            </ThemedText>
            <ThemedText type="bodyMedium" style={{ color: colors.textSecondary }}>
              Sign in to resume your focused academic studies.
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
                  placeholder="Enter your password"
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

            {/* Submit Button */}
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                {
                  backgroundColor: colors.brandPrimary,
                  opacity: isLoading || pressed ? 0.85 : 1,
                },
              ]}
              onPress={handleLogin}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel="Sign in button">
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <ThemedText type="titleMedium" style={styles.primaryButtonText}>
                  Sign in
                </ThemedText>
              )}
            </Pressable>

            {/* Registration link */}
            <View style={styles.footerLinkRow}>
              <ThemedText type="bodyMedium" style={{ color: colors.textSecondary }}>
                Don&apos;t have an account?{' '}
              </ThemedText>
              <Link href="/(auth)/register" asChild>
                <Pressable hitSlop={8}>
                  <ThemedText
                    type="bodyMedium"
                    style={{ color: colors.brandPrimary, fontWeight: '600' }}>
                    Create account
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
    paddingTop: 40,
    paddingBottom: 24,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 32,
    gap: 8,
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  errorBanner: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  form: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
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
});
