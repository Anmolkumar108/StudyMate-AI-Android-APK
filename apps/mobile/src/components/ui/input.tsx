import React, { forwardRef, useState } from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';

import { BorderRadius, MinTouchTarget, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface InputProps extends TextInputProps {
  /**
   * Optional field label displayed above the input.
   */
  label?: string;

  /**
   * Inline validation error message displayed below the input.
   */
  error?: string;

  /**
   * Optional helpful hint displayed below the input when there is no error.
   */
  helperText?: string;

  /**
   * Optional element displayed inside the left edge of the input.
   */
  leftElement?: React.ReactNode;

  /**
   * Optional element displayed inside the right edge of the input (e.g. eye toggle).
   */
  rightElement?: React.ReactNode;

  /**
   * Whether to display a clear button when the input has text.
   */
  showClearButton?: boolean;

  /**
   * Callback invoked when the clear button is pressed.
   */
  onClear?: () => void;

  /**
   * Style override for the outer wrapper containing label, input, and helper/error.
   */
  containerStyle?: StyleProp<ViewStyle>;

  /**
   * Style override for the input container box.
   */
  inputBoxStyle?: StyleProp<ViewStyle>;

  /**
   * Style override for the inner TextInput.
   */
  inputStyle?: StyleProp<TextStyle>;
}

/**
 * Reusable, theme-aware Input component adhering to the Hybrid Premium UI.
 * Avoids fixed heights to support Android system font scaling and provides accessible focus states.
 */
export const Input = forwardRef<React.ElementRef<typeof TextInput>, InputProps>(function Input(
  {
    label,
    error,
    helperText,
    leftElement,
    rightElement,
    showClearButton = false,
    onClear,
    containerStyle,
    inputBoxStyle,
    inputStyle,
    value,
    onFocus,
    onBlur,
    editable = true,
    multiline = false,
    numberOfLines,
    ...restProps
  },
  ref
) {
  const theme = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus: TextInputProps['onFocus'] = (e) => {
    setIsFocused(true);
    onFocus?.(e);
  };

  const handleBlur: TextInputProps['onBlur'] = (e) => {
    setIsFocused(false);
    onBlur?.(e);
  };

  const getBorderColor = (): string => {
    if (error) {
      return theme.statusDanger;
    }
    if (isFocused) {
      return theme.borderFocus;
    }
    return theme.borderSubtle;
  };

  const hasValue = Boolean(value && String(value).length > 0);

  return (
    <View style={[styles.outerContainer, containerStyle]}>
      {label ? (
        <Text style={[styles.label, { color: theme.text }]}>
          {label}
        </Text>
      ) : null}

      <View
        style={[
          styles.inputBox,
          multiline ? styles.inputBoxMultiline : styles.inputBoxSingleLine,
          {
            backgroundColor: theme.inputBackground,
            borderColor: getBorderColor(),
          },
          !editable && styles.disabled,
          inputBoxStyle,
        ]}>
        {leftElement ? <View style={styles.leftWrapper}>{leftElement}</View> : null}

        <TextInput
          ref={ref}
          value={value}
          onFocus={handleFocus}
          onBlur={handleBlur}
          editable={editable}
          multiline={multiline}
          numberOfLines={numberOfLines}
          placeholderTextColor={theme.textTertiary}
          style={[
            styles.textInput,
            multiline && styles.textInputMultiline,
            { color: theme.text },
            inputStyle,
          ]}
          {...restProps}
        />

        {showClearButton && hasValue && editable ? (
          <Pressable
            onPress={onClear}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Clear text"
            style={styles.clearButton}>
            <Text style={[styles.clearButtonText, { color: theme.textTertiary }]}>
              ✕
            </Text>
          </Pressable>
        ) : null}

        {rightElement ? <View style={styles.rightWrapper}>{rightElement}</View> : null}
      </View>

      {error ? (
        <Text style={[styles.errorText, { color: theme.statusDanger }]}>
          {error}
        </Text>
      ) : helperText ? (
        <Text style={[styles.helperText, { color: theme.textSecondary }]}>
          {helperText}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  outerContainer: {
    width: '100%',
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
  },
  inputBoxSingleLine: {
    minHeight: MinTouchTarget, // 48dp minimum for Android accessibility
    paddingVertical: 8,
  },
  inputBoxMultiline: {
    minHeight: 90,
    paddingVertical: 12,
    alignItems: 'flex-start',
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    padding: 0,
    margin: 0,
  },
  textInputMultiline: {
    textAlignVertical: 'top',
  },
  leftWrapper: {
    marginRight: Spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightWrapper: {
    marginLeft: Spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearButton: {
    minWidth: 28,
    minHeight: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Spacing.xs,
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  errorText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    marginTop: Spacing.xs,
  },
  helperText: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: Spacing.xs,
  },
  disabled: {
    opacity: 0.6,
  },
});
