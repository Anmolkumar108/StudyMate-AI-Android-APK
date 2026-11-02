import React from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';

import { BorderRadius, MinTouchTarget, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  /**
   * Button title text.
   */
  title: string;

  /**
   * Action triggered when button is pressed.
   */
  onPress: () => void | Promise<void>;

  /**
   * Visual style variant:
   * - `primary`: filled brand Indigo background with high contrast white text
   * - `secondary`: outlined surface button with subtle border
   * - `ghost`: transparent background with brand colored text
   * - `danger`: status danger background for destructive actions
   */
  variant?: ButtonVariant;

  /**
   * Button size:
   * - `sm`: compact action (minHeight 40dp with 48dp hitSlop)
   * - `md`: standard touch target (minHeight 48dp)
   * - `lg`: prominent action (minHeight 54dp)
   */
  size?: ButtonSize;

  /**
   * Whether to show a loading indicator.
   */
  loading?: boolean;

  /**
   * Whether the button is disabled.
   */
  disabled?: boolean;

  /**
   * Whether the button should stretch to full container width.
   */
  fullWidth?: boolean;

  /**
   * Optional prefix element or icon.
   */
  leftIcon?: React.ReactNode;

  /**
   * Optional suffix element or icon.
   */
  rightIcon?: React.ReactNode;

  /**
   * Style override for the button container.
   */
  style?: StyleProp<ViewStyle>;

  /**
   * Style override for the button text label.
   */
  textStyle?: StyleProp<TextStyle>;

  /**
   * Accessibility label for screen readers.
   */
  accessibilityLabel?: string;

  /**
   * Accessibility hint for screen readers.
   */
  accessibilityHint?: string;

  /**
   * Test identifier.
   */
  testID?: string;
}

/**
 * Reusable, theme-aware Button component adhering to the Hybrid Premium UI.
 * Guaranteed minimum 48dp touch target and resilient to Android system font scaling.
 */
export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  style,
  textStyle,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const theme = useTheme();

  const isInteractive = !disabled && !loading;

  const getVariantStyles = (): {
    container: ViewStyle;
    text: TextStyle;
    indicatorColor: string;
  } => {
    switch (variant) {
      case 'secondary':
        return {
          container: {
            backgroundColor: theme.cardBackground,
            borderColor: theme.borderSubtle,
            borderWidth: 1,
          },
          text: {
            color: theme.text,
          },
          indicatorColor: theme.text,
        };
      case 'ghost':
        return {
          container: {
            backgroundColor: 'transparent',
            borderColor: 'transparent',
            borderWidth: 0,
          },
          text: {
            color: theme.brandPrimary,
          },
          indicatorColor: theme.brandPrimary,
        };
      case 'danger':
        return {
          container: {
            backgroundColor: theme.statusDanger,
            borderColor: theme.statusDanger,
            borderWidth: 1,
          },
          text: {
            color: '#FFFFFF',
          },
          indicatorColor: '#FFFFFF',
        };
      case 'primary':
      default:
        return {
          container: {
            backgroundColor: theme.brandPrimary,
            borderColor: theme.brandPrimary,
            borderWidth: 1,
          },
          text: {
            color: '#FFFFFF',
          },
          indicatorColor: '#FFFFFF',
        };
    }
  };

  const getSizeStyles = (): {
    container: ViewStyle;
    text: TextStyle;
    hitSlop?: { top: number; bottom: number; left: number; right: number };
  } => {
    switch (size) {
      case 'sm':
        return {
          container: {
            minHeight: 40,
            paddingVertical: 8,
            paddingHorizontal: Spacing.md,
            borderRadius: BorderRadius.md,
          },
          text: {
            fontSize: 13,
            lineHeight: 18,
            fontWeight: '600',
          },
          hitSlop: { top: 4, bottom: 4, left: 4, right: 4 },
        };
      case 'lg':
        return {
          container: {
            minHeight: 54,
            paddingVertical: 14,
            paddingHorizontal: Spacing.lg,
            borderRadius: BorderRadius.md,
          },
          text: {
            fontSize: 16,
            lineHeight: 22,
            fontWeight: '700',
          },
        };
      case 'md':
      default:
        return {
          container: {
            minHeight: MinTouchTarget, // 48dp minimum
            paddingVertical: 12,
            paddingHorizontal: Spacing.lg,
            borderRadius: BorderRadius.md,
          },
          text: {
            fontSize: 15,
            lineHeight: 20,
            fontWeight: '600',
          },
        };
    }
  };

  const variantStyle = getVariantStyles();
  const sizeStyle = getSizeStyles();

  return (
    <Pressable
      testID={testID}
      onPress={isInteractive ? onPress : undefined}
      disabled={!isInteractive}
      accessibilityRole="button"
      accessibilityState={{ disabled: !isInteractive, busy: loading }}
      accessibilityLabel={accessibilityLabel || title}
      accessibilityHint={accessibilityHint}
      hitSlop={sizeStyle.hitSlop}
      android_ripple={
        isInteractive
          ? {
              color:
                variant === 'primary' || variant === 'danger'
                  ? 'rgba(255, 255, 255, 0.2)'
                  : theme.brandPrimary + '20',
              borderless: false,
            }
          : undefined
      }
      style={({ pressed }) => [
        styles.base,
        variantStyle.container,
        sizeStyle.container,
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
        pressed && isInteractive && Platform.OS !== 'android' && styles.pressedIos,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator size="small" color={variantStyle.indicatorColor} />
      ) : (
        <View style={styles.contentRow}>
          {leftIcon ? <View style={styles.iconMargin}>{leftIcon}</View> : null}
          <Text
            style={[
              styles.text,
              variantStyle.text,
              sizeStyle.text,
              textStyle,
            ]}>
            {title}
          </Text>
          {rightIcon ? <View style={styles.rightIconMargin}>{rightIcon}</View> : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    textAlign: 'center',
  },
  iconMargin: {
    marginRight: Spacing.sm,
  },
  rightIconMargin: {
    marginLeft: Spacing.sm,
  },
  disabled: {
    opacity: 0.5,
  },
  pressedIos: {
    opacity: 0.85,
  },
});
