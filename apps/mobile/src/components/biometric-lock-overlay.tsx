import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui';
import { BorderRadius, MinTouchTarget, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { authenticateWithBiometrics } from '@/services/biometrics';

interface BiometricLockOverlayProps {
  visible: boolean;
  onUnlocked: () => void;
  onLogout: () => void;
}

export function BiometricLockOverlay({
  visible,
  onUnlocked,
  onLogout,
}: BiometricLockOverlayProps) {
  const theme = useTheme();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const triggerAuth = useCallback(async () => {
    setIsAuthenticating(true);
    setErrorMessage(null);
    try {
      const res = await authenticateWithBiometrics(
        'Touch sensor to unlock StudyMate AI'
      );
      if (res.success) {
        onUnlocked();
      } else {
        setErrorMessage(
          res.error || 'Biometric authentication was cancelled or failed.'
        );
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Biometric authentication error.');
    } finally {
      setIsAuthenticating(false);
    }
  }, [onUnlocked]);

  useEffect(() => {
    if (visible) {
      // Auto prompt biometrics on lock appearance
      const timer = setTimeout(() => {
        triggerAuth();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [visible, triggerAuth]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        // Prevent closing via back button while locked
      }}>
      <View
        style={[
          styles.container,
          { backgroundColor: theme.background || '#080B16' },
        ]}>
        {/* Subtle decorative glow */}
        <View
          style={[
            styles.glowBackground,
            { backgroundColor: theme.brandPrimary, opacity: 0.12 },
          ]}
        />

        <View style={styles.card}>
          <View
            style={[
              styles.iconWrapper,
              {
                backgroundColor: theme.badgeBrandBackground,
                borderColor: theme.brandPrimary,
              },
            ]}>
            <Text style={styles.fingerprintIcon}>🔒</Text>
          </View>

          <View style={styles.textContainer}>
            <ThemedText type="headlineMedium" style={styles.title}>
              StudyMate AI Locked
            </ThemedText>
            <ThemedText
              type="bodyMedium"
              style={[styles.subtitle, { color: theme.textSecondary }]}>
              Biometric security is active. Touch your device{"'"}s fingerprint sensor
              or use face recognition to access your study hub.
            </ThemedText>
          </View>

          {errorMessage && (
            <View
              style={[
                styles.errorBanner,
                {
                  backgroundColor: theme.badgeDangerBackground,
                  borderColor: theme.statusDanger,
                },
              ]}>
              <Text style={{ fontSize: 16 }}>⚠️</Text>
              <ThemedText
                type="bodySmall"
                style={[styles.errorText, { color: theme.statusDanger }]}>
                {errorMessage}
              </ThemedText>
            </View>
          )}

          <View style={styles.actionsContainer}>
            <Button
              title="Unlock with Fingerprint"
              variant="primary"
              size="lg"
              fullWidth
              loading={isAuthenticating}
              disabled={isAuthenticating}
              onPress={triggerAuth}
            />

            <Pressable
              onPress={onLogout}
              style={({ pressed }) => [
                styles.logoutBtn,
                pressed && { opacity: 0.7 },
              ]}>
              <Text style={[styles.logoutBtnText, { color: theme.textTertiary }]}>
                Switch Account / Sign Out
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.footerNote}>
          <ThemedText
            type="bodySmall"
            style={{ color: theme.textTertiary, textAlign: 'center' }}>
            Protected by Android Hardware Biometrics (Keystore Encrypted)
          </ThemedText>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  glowBackground: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    top: '25%',
  },
  card: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    gap: Spacing.lg,
  },
  iconWrapper: {
    width: 88,
    height: 88,
    borderRadius: BorderRadius.full,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  fingerprintIcon: {
    fontSize: 42,
  },
  textContainer: {
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  title: {
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  subtitle: {
    textAlign: 'center',
    lineHeight: 22,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    width: '100%',
  },
  errorText: {
    flex: 1,
    fontWeight: '500',
  },
  actionsContainer: {
    width: '100%',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  logoutBtn: {
    minHeight: MinTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
  },
  logoutBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  footerNote: {
    position: 'absolute',
    bottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
});
