import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Badge, Button, Card } from '@/components/ui';
import { BorderRadius, MaxContentWidth, MinTouchTarget, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  DEFAULT_POMODORO_SETTINGS,
  POMODORO_LIMITS,
  PomodoroSettings,
  validatePomodoroSettings,
} from '@/types/pomodoro';

export interface PomodoroSettingsModalProps {
  visible: boolean;
  settings: PomodoroSettings;
  onClose: () => void;
  onSave: (settings: PomodoroSettings) => Promise<void>;
}

interface StepperControlProps {
  label: string;
  unit: string;
  min: number;
  max: number;
  value: string;
  onChangeValue: (val: string) => void;
  error?: string;
  accessibilityName: string;
}

function DurationStepper({
  label,
  unit,
  min,
  max,
  value,
  onChangeValue,
  error,
  accessibilityName,
}: StepperControlProps) {
  const theme = useTheme();
  const numericVal = parseInt(value, 10);
  const isValidNum = !Number.isNaN(numericVal);

  const handleDecrement = () => {
    const current = isValidNum ? numericVal : min;
    const next = Math.max(min, current - 1);
    onChangeValue(next.toString());
  };

  const handleIncrement = () => {
    const current = isValidNum ? numericVal : min;
    const next = Math.min(max, current + 1);
    onChangeValue(next.toString());
  };

  return (
    <View style={styles.stepperContainer}>
      <View style={styles.stepperHeader}>
        <ThemedText type="titleMedium" style={styles.stepperLabel}>
          {label}
        </ThemedText>
        <Badge
          label={`${min} - ${max} ${unit}`}
          variant="neutral"
          size="sm"
        />
      </View>

      <View style={styles.stepperRow}>
        {/* Decrement Button */}
        <Pressable
          onPress={handleDecrement}
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${accessibilityName}`}
          accessibilityHint={`Decrements ${accessibilityName} by 1`}
          hitSlop={4}
          style={({ pressed }) => [
            styles.stepperButton,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.borderSubtle,
              opacity: pressed ? 0.75 : 1,
            },
          ]}>
          <Text style={[styles.stepperButtonIcon, { color: theme.brandPrimary }]}>
            −
          </Text>
        </Pressable>

        {/* Numeric Input Display */}
        <View
          style={[
            styles.stepperInputWrapper,
            {
              backgroundColor: theme.inputBackground,
              borderColor: error ? theme.statusDanger : theme.borderSubtle,
            },
          ]}>
          <TextInput
            value={value}
            onChangeText={onChangeValue}
            keyboardType="number-pad"
            maxLength={3}
            accessibilityLabel={`${label} input field`}
            style={[styles.stepperTextInput, { color: theme.text }]}
          />
          <Text style={[styles.stepperUnit, { color: theme.textSecondary }]}>
            {unit}
          </Text>
        </View>

        {/* Increment Button */}
        <Pressable
          onPress={handleIncrement}
          accessibilityRole="button"
          accessibilityLabel={`Increase ${accessibilityName}`}
          accessibilityHint={`Increments ${accessibilityName} by 1`}
          hitSlop={4}
          style={({ pressed }) => [
            styles.stepperButton,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.borderSubtle,
              opacity: pressed ? 0.75 : 1,
            },
          ]}>
          <Text style={[styles.stepperButtonIcon, { color: theme.brandPrimary }]}>
            +
          </Text>
        </Pressable>
      </View>

      {error ? (
        <ThemedText
          type="bodySmall"
          style={[styles.errorText, { color: theme.statusDanger }]}>
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

interface PomodoroSettingsFormContentProps {
  settings: PomodoroSettings;
  onClose: () => void;
  onSave: (settings: PomodoroSettings) => Promise<void>;
}

function PomodoroSettingsFormContent({
  settings,
  onClose,
  onSave,
}: PomodoroSettingsFormContentProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  const [focusMin, setFocusMin] = useState(settings.focusDuration.toString());
  const [shortBreakMin, setShortBreakMin] = useState(
    settings.shortBreakDuration.toString()
  );
  const [longBreakMin, setLongBreakMin] = useState(
    settings.longBreakDuration.toString()
  );
  const [longInterval, setLongInterval] = useState(
    settings.longBreakInterval.toString()
  );
  const [vibrate, setVibrate] = useState(settings.vibrateEnabled);

  const [errors, setErrors] = useState<Partial<Record<keyof PomodoroSettings, string>>>({});
  const [isSaving, setIsSaving] = useState(false);

  const applyPreset = (focus: number, short: number, long: number) => {
    setFocusMin(focus.toString());
    setShortBreakMin(short.toString());
    setLongBreakMin(long.toString());
    setErrors({});
  };

  const handleSave = async () => {
    const focus = parseInt(focusMin.trim(), 10);
    const short = parseInt(shortBreakMin.trim(), 10);
    const long = parseInt(longBreakMin.trim(), 10);
    const interval = parseInt(longInterval.trim(), 10);

    const candidate: PomodoroSettings = {
      ...settings,
      focusDuration: Number.isNaN(focus) ? settings.focusDuration : focus,
      shortBreakDuration: Number.isNaN(short)
        ? settings.shortBreakDuration
        : short,
      longBreakDuration: Number.isNaN(long)
        ? settings.longBreakDuration
        : long,
      longBreakInterval: Number.isNaN(interval)
        ? settings.longBreakInterval
        : interval,
      vibrateEnabled: vibrate,
    };

    const validation = validatePomodoroSettings(candidate);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});
    setIsSaving(true);
    try {
      await onSave(candidate);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View
      style={[
        styles.sheetContainer,
        {
          backgroundColor: theme.background,
          borderColor: theme.borderSubtle,
          paddingBottom: Math.max(insets.bottom, Spacing.md),
        },
      ]}>
          {/* Sheet Handle */}
          <View style={styles.handleContainer}>
            <View
              style={[styles.handleBar, { backgroundColor: theme.borderSubtle }]}
            />
          </View>

          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.borderSubtle }]}>
            <View style={styles.headerTextGroup}>
              <ThemedText type="headlineMedium" style={styles.headerTitle}>
                Timer Preferences
              </ThemedText>
              <ThemedText type="bodySmall" style={{ color: theme.textSecondary }}>
                Customize your academic focus and break intervals.
              </ThemedText>
            </View>

            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close settings"
              style={({ pressed }) => [
                styles.closeButton,
                {
                  backgroundColor: theme.cardBackground,
                  borderColor: theme.borderSubtle,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}>
              <Text style={[styles.closeIcon, { color: theme.textSecondary }]}>✕</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.formScroll}
            contentContainerStyle={styles.formContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {/* Quick Presets Row */}
            <View style={styles.presetSection}>
              <ThemedText type="smallBold" style={{ color: theme.brandPrimary }}>
                POPULAR PRESETS
              </ThemedText>
              <View style={styles.presetRow}>
                <Pressable
                  onPress={() => applyPreset(25, 5, 15)}
                  accessibilityRole="button"
                  accessibilityLabel="Standard 25 minute focus preset"
                  style={({ pressed }) => [
                    styles.presetChip,
                    {
                      backgroundColor: theme.cardBackground,
                      borderColor:
                        focusMin === '25' && shortBreakMin === '5'
                          ? theme.brandPrimary
                          : theme.borderSubtle,
                      opacity: pressed ? 0.75 : 1,
                    },
                  ]}>
                  <ThemedText type="smallBold">Standard</ThemedText>
                  <ThemedText type="bodySmall" style={{ color: theme.textSecondary, fontSize: 11 }}>
                    25m • 5m
                  </ThemedText>
                </Pressable>

                <Pressable
                  onPress={() => applyPreset(50, 10, 20)}
                  accessibilityRole="button"
                  accessibilityLabel="Extended 50 minute focus preset"
                  style={({ pressed }) => [
                    styles.presetChip,
                    {
                      backgroundColor: theme.cardBackground,
                      borderColor:
                        focusMin === '50' && shortBreakMin === '10'
                          ? theme.brandPrimary
                          : theme.borderSubtle,
                      opacity: pressed ? 0.75 : 1,
                    },
                  ]}>
                  <ThemedText type="smallBold">Extended</ThemedText>
                  <ThemedText type="bodySmall" style={{ color: theme.textSecondary, fontSize: 11 }}>
                    50m • 10m
                  </ThemedText>
                </Pressable>

                <Pressable
                  onPress={() => applyPreset(15, 3, 10)}
                  accessibilityRole="button"
                  accessibilityLabel="Quick 15 minute focus preset"
                  style={({ pressed }) => [
                    styles.presetChip,
                    {
                      backgroundColor: theme.cardBackground,
                      borderColor:
                        focusMin === '15' && shortBreakMin === '3'
                          ? theme.brandPrimary
                          : theme.borderSubtle,
                      opacity: pressed ? 0.75 : 1,
                    },
                  ]}>
                  <ThemedText type="smallBold">Quick</ThemedText>
                  <ThemedText type="bodySmall" style={{ color: theme.textSecondary, fontSize: 11 }}>
                    15m • 3m
                  </ThemedText>
                </Pressable>
              </View>
            </View>

            {/* Stepper 1: Focus Duration */}
            <DurationStepper
              label="Focus Duration"
              unit="min"
              min={POMODORO_LIMITS.focus.min}
              max={POMODORO_LIMITS.focus.max}
              value={focusMin}
              onChangeValue={(val) => {
                setFocusMin(val);
                if (errors.focusDuration) setErrors((prev) => ({ ...prev, focusDuration: undefined }));
              }}
              error={errors.focusDuration}
              accessibilityName="focus duration"
            />

            {/* Stepper 2: Short Break Duration */}
            <DurationStepper
              label="Short Break Duration"
              unit="min"
              min={POMODORO_LIMITS.shortBreak.min}
              max={POMODORO_LIMITS.shortBreak.max}
              value={shortBreakMin}
              onChangeValue={(val) => {
                setShortBreakMin(val);
                if (errors.shortBreakDuration) setErrors((prev) => ({ ...prev, shortBreakDuration: undefined }));
              }}
              error={errors.shortBreakDuration}
              accessibilityName="short break duration"
            />

            {/* Stepper 3: Long Break Duration */}
            <DurationStepper
              label="Long Break Duration"
              unit="min"
              min={POMODORO_LIMITS.longBreak.min}
              max={POMODORO_LIMITS.longBreak.max}
              value={longBreakMin}
              onChangeValue={(val) => {
                setLongBreakMin(val);
                if (errors.longBreakDuration) setErrors((prev) => ({ ...prev, longBreakDuration: undefined }));
              }}
              error={errors.longBreakDuration}
              accessibilityName="long break duration"
            />

            {/* Stepper 4: Long Break Interval */}
            <DurationStepper
              label="Long Break Interval"
              unit="sessions"
              min={POMODORO_LIMITS.interval.min}
              max={POMODORO_LIMITS.interval.max}
              value={longInterval}
              onChangeValue={(val) => {
                setLongInterval(val);
                if (errors.longBreakInterval) setErrors((prev) => ({ ...prev, longBreakInterval: undefined }));
              }}
              error={errors.longBreakInterval}
              accessibilityName="long break interval"
            />

            {/* Vibration Toggle */}
            <Card variant="outlined" style={styles.switchCard}>
              <View style={styles.switchTextGroup}>
                <ThemedText type="titleMedium">Vibration Feedback</ThemedText>
                <ThemedText type="bodySmall" style={{ color: theme.textSecondary }}>
                  Vibrate the device when a session finishes.
                </ThemedText>
              </View>
              <Switch
                value={vibrate}
                onValueChange={setVibrate}
                trackColor={{
                  false: theme.borderSubtle,
                  true: theme.brandPrimary,
                }}
                thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
              />
            </Card>

            {/* Actions */}
            <View style={styles.actionRow}>
              <Button
                title="Reset Defaults"
                variant="secondary"
                size="lg"
                onPress={() => {
                  setFocusMin(DEFAULT_POMODORO_SETTINGS.focusDuration.toString());
                  setShortBreakMin(DEFAULT_POMODORO_SETTINGS.shortBreakDuration.toString());
                  setLongBreakMin(DEFAULT_POMODORO_SETTINGS.longBreakDuration.toString());
                  setLongInterval(DEFAULT_POMODORO_SETTINGS.longBreakInterval.toString());
                  setVibrate(DEFAULT_POMODORO_SETTINGS.vibrateEnabled);
                  setErrors({});
                }}
                style={{ flex: 1 }}
              />

              <Button
                title="Save Changes"
                variant="primary"
                size="lg"
                loading={isSaving}
                disabled={isSaving}
                onPress={handleSave}
                style={{ flex: 1.4 }}
              />
            </View>
          </ScrollView>
        </View>
  );
}

export function PomodoroSettingsModal({
  visible,
  settings,
  onClose,
  onSave,
}: PomodoroSettingsModalProps) {
  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss settings backdrop"
        />

        <PomodoroSettingsFormContent
          key={`${settings.focusDuration}-${settings.shortBreakDuration}-${settings.longBreakDuration}-${settings.longBreakInterval}-${settings.vibrateEnabled}`}
          settings={settings}
          onClose={onClose}
          onSave={onSave}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  sheetContainer: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    borderTopWidth: 1,
    maxHeight: '92%',
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  handleBar: {
    width: 38,
    height: 4,
    borderRadius: BorderRadius.full,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.cardPadding,
    paddingVertical: Spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTextGroup: {
    flex: 1,
    gap: 2,
    marginRight: Spacing.sm,
  },
  headerTitle: {
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  closeButton: {
    minWidth: MinTouchTarget,
    minHeight: MinTouchTarget,
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIcon: {
    fontSize: 16,
    fontWeight: '700',
  },
  formScroll: {
    flexGrow: 0,
  },
  formContent: {
    padding: Spacing.cardPadding,
    gap: Spacing.md,
  },
  presetSection: {
    gap: Spacing.xs,
  },
  presetRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  presetChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: 4,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: 2,
    minHeight: MinTouchTarget,
  },
  stepperContainer: {
    gap: 6,
  },
  stepperHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepperLabel: {
    fontWeight: '600',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  stepperButton: {
    minWidth: MinTouchTarget,
    minHeight: MinTouchTarget,
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonIcon: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 24,
  },
  stepperInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    height: 48,
    paddingHorizontal: Spacing.md,
    gap: 6,
  },
  stepperTextInput: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    minWidth: 40,
    fontVariant: ['tabular-nums'],
  },
  stepperUnit: {
    fontSize: 14,
    fontWeight: '500',
  },
  errorText: {
    fontSize: 12,
    marginTop: 2,
  },
  switchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.cardPadding,
  },
  switchTextGroup: {
    flex: 1,
    gap: 2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
  },
});
