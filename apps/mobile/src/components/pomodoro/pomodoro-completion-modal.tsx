import React, { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui';
import { BorderRadius, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { PomodoroMode } from '@/types/pomodoro';

export interface PomodoroCompletionModalProps {
  visible: boolean;
  completedMode: PomodoroMode | null;
  onDismiss: () => void;
  onStartNext: () => void;
}

export function PomodoroCompletionModal({
  visible,
  completedMode,
  onDismiss,
  onStartNext,
}: PomodoroCompletionModalProps) {
  const theme = useTheme();
  const [scaleAnim] = useState(() => new Animated.Value(0.85));
  const [opacityAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (visible) {
      AccessibilityInfo.isReduceMotionEnabled()
        .then((reduced) => {
          if (reduced) {
            scaleAnim.setValue(1);
            opacityAnim.setValue(1);
            return;
          }
          Animated.parallel([
            Animated.spring(scaleAnim, {
              toValue: 1,
              friction: 6,
              tension: 60,
              useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
              toValue: 1,
              duration: 200,
              useNativeDriver: true,
            }),
          ]).start();
        })
        .catch(() => {
          scaleAnim.setValue(1);
          opacityAnim.setValue(1);
        });
    } else {
      scaleAnim.setValue(0.85);
      opacityAnim.setValue(0);
    }
  }, [visible, scaleAnim, opacityAnim]);

  if (!visible || !completedMode) {
    return null;
  }

  const isFocus = completedMode === 'focus';
  const icon = isFocus ? '🎉' : '⚡';
  const title = isFocus ? 'Focus Session Completed!' : 'Break Finished!';
  const message = isFocus
    ? 'Outstanding concentration. Time to step away, hydrate, and relax your mind.'
    : 'You recharged well. Ready to tackle your next academic block?';
  const nextActionLabel = isFocus ? 'Start Break Now' : 'Begin Focus Session';

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onDismiss}>
      <View style={styles.modalOverlay}>
        <Pressable
          style={styles.backdrop}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss celebration"
        />

        <Animated.View
          style={[
            styles.cardContainer,
            {
              backgroundColor: theme.cardElevated,
              borderColor: theme.borderSubtle,
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}>
          <Text style={styles.celebrationIcon}>{icon}</Text>

          <ThemedText type="headlineMedium" style={styles.title}>
            {title}
          </ThemedText>

          <ThemedText
            type="bodyMedium"
            style={[styles.message, { color: theme.textSecondary }]}>
            {message}
          </ThemedText>

          <View style={styles.buttonRow}>
            <Button
              title="Later"
              variant="secondary"
              size="md"
              onPress={onDismiss}
              style={{ flex: 1 }}
            />
            <Button
              title={nextActionLabel}
              variant="primary"
              size="md"
              onPress={() => {
                onDismiss();
                onStartNext();
              }}
              style={{ flex: 1.6 }}
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  cardContainer: {
    width: '100%',
    maxWidth: MaxContentWidth - 60,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  celebrationIcon: {
    fontSize: 54,
  },
  title: {
    textAlign: 'center',
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  message: {
    textAlign: 'center',
    lineHeight: 22,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    width: '100%',
    marginTop: Spacing.xs,
  },
});
