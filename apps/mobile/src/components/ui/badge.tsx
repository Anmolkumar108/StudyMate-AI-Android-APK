import React from 'react';
import {
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

export type BadgeVariant =
  | 'neutral'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'brand'
  | 'custom';

export type BadgeSize = 'sm' | 'md';

export interface BadgeProps {
  /**
   * The text label displayed in the badge.
   */
  label: string;

  /**
   * Semantic visual style variant.
   */
  variant?: BadgeVariant;

  /**
   * Badge size:
   * - `sm`: compact metadata tag (e.g. course codes, timestamps)
   * - `md`: standard chip (e.g. filter chips, status badges)
   */
  size?: BadgeSize;

  /**
   * Optional leading color dot (useful for subject color tagging).
   */
  dotColor?: string;

  /**
   * Custom background color when variant is 'custom'.
   */
  customBg?: string;

  /**
   * Custom text color when variant is 'custom'.
   */
  customTextColor?: string;

  /**
   * Whether the badge is in an active/selected state (e.g. filter chip active).
   */
  selected?: boolean;

  /**
   * Optional press handler. When provided, the badge becomes an interactive chip.
   */
  onPress?: () => void;

  /**
   * Optional prefix icon or emoji.
   */
  icon?: React.ReactNode;

  /**
   * Optional custom style override for the badge container.
   */
  style?: StyleProp<ViewStyle>;

  /**
   * Optional custom style override for the badge label.
   */
  textStyle?: StyleProp<TextStyle>;

  /**
   * Accessibility label for screen readers.
   */
  accessibilityLabel?: string;

  /**
   * Test identifier.
   */
  testID?: string;
}

/**
 * Reusable, theme-aware Badge and Chip component.
 * Provides accessible touch targets and supports Android font scaling.
 */
export function Badge({
  label,
  variant = 'neutral',
  size = 'md',
  dotColor,
  customBg,
  customTextColor,
  selected = false,
  onPress,
  icon,
  style,
  textStyle,
  accessibilityLabel,
  testID,
}: BadgeProps) {
  const theme = useTheme();

  const getVariantColors = (): { bg: string; text: string; border: string } => {
    if (selected) {
      return {
        bg: theme.brandPrimary,
        text: '#FFFFFF',
        border: theme.brandPrimary,
      };
    }

    switch (variant) {
      case 'success':
        return {
          bg: theme.badgeSuccessBackground,
          text: theme.badgeSuccessText,
          border: 'transparent',
        };
      case 'warning':
        return {
          bg: theme.badgeWarningBackground,
          text: theme.badgeWarningText,
          border: 'transparent',
        };
      case 'danger':
        return {
          bg: theme.badgeDangerBackground,
          text: theme.badgeDangerText,
          border: 'transparent',
        };
      case 'info':
        return {
          bg: theme.badgeInfoBackground,
          text: theme.badgeInfoText,
          border: 'transparent',
        };
      case 'brand':
        return {
          bg: theme.badgeBrandBackground,
          text: theme.badgeBrandText,
          border: theme.brandPrimary + '30',
        };
      case 'custom':
        return {
          bg: customBg || theme.badgeNeutralBackground,
          text: customTextColor || theme.badgeNeutralText,
          border: 'transparent',
        };
      case 'neutral':
      default:
        return {
          bg: theme.badgeNeutralBackground,
          text: theme.badgeNeutralText,
          border: theme.borderSubtle,
        };
    }
  };

  const { bg, text, border } = getVariantColors();

  const isSmall = size === 'sm';

  const badgeContent = (
    <View
      style={[
        styles.container,
        isSmall ? styles.containerSm : styles.containerMd,
        {
          backgroundColor: bg,
          borderColor: border,
        },
        style,
      ]}>
      {icon ? <View style={styles.iconWrapper}>{icon}</View> : null}
      {dotColor ? (
        <View
          style={[
            styles.dot,
            isSmall ? styles.dotSm : styles.dotMd,
            { backgroundColor: dotColor },
          ]}
        />
      ) : null}
      <Text
        style={[
          styles.text,
          isSmall ? styles.textSm : styles.textMd,
          { color: text },
          textStyle,
        ]}
        numberOfLines={1}>
        {label}
      </Text>
    </View>
  );

  if (onPress) {
    // Calculate hitSlop to ensure compliance with Android 48dp minimum touch target
    const verticalSlop = Math.max(0, (MinTouchTarget - (isSmall ? 28 : 36)) / 2);
    const horizontalSlop = Math.max(0, (MinTouchTarget - 48) / 2);

    return (
      <Pressable
        testID={testID}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={accessibilityLabel || label}
        hitSlop={{
          top: verticalSlop,
          bottom: verticalSlop,
          left: horizontalSlop,
          right: horizontalSlop,
        }}
        style={({ pressed }) => [pressed && styles.pressed]}>
        {badgeContent}
      </Pressable>
    );
  }

  return <View testID={testID}>{badgeContent}</View>;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  containerSm: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    minHeight: 24,
    gap: 4,
  },
  containerMd: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    minHeight: 32,
    gap: 6,
  },
  text: {
    fontWeight: '600',
  },
  textSm: {
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.3,
  },
  textMd: {
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.2,
  },
  dot: {
    borderRadius: BorderRadius.full,
  },
  dotSm: {
    width: 6,
    height: 6,
  },
  dotMd: {
    width: 8,
    height: 8,
  },
  iconWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.75,
  },
});
