import React from 'react';
import {
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';

import { BorderRadius, Shadows, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type CardVariant = 'default' | 'elevated' | 'outlined';

export interface CardProps {
  /**
   * Card visual variant:
   * - `default`: standard card surface with subtle border and elevation
   * - `elevated`: elevated surface for modals and prominent cards
   * - `outlined`: crisp outline with flat surface
   */
  variant?: CardVariant;

  /**
   * Optional press handler. When provided, renders as an accessible Pressable.
   */
  onPress?: () => void;

  /**
   * Custom style overrides for the outer container.
   */
  style?: StyleProp<ViewStyle>;

  /**
   * Children rendered inside the card.
   */
  children: React.ReactNode;

  /**
   * Accessibility label for screen readers when card is interactive.
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
 * Reusable, theme-aware Card component adhering to the Hybrid Premium UI.
 * Fully responsive across all Android screen sizes and orientations.
 */
export function Card({
  variant = 'default',
  onPress,
  style,
  children,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: CardProps) {
  const theme = useTheme();

  const getVariantStyle = (): ViewStyle => {
    switch (variant) {
      case 'elevated':
        return {
          backgroundColor: theme.cardElevated,
          borderColor: theme.borderCard,
          borderWidth: 1,
          ...Shadows.md,
        };
      case 'outlined':
        return {
          backgroundColor: theme.cardBackground,
          borderColor: theme.borderSubtle,
          borderWidth: 1,
        };
      case 'default':
      default:
        return {
          backgroundColor: theme.cardBackground,
          borderColor: theme.borderSubtle,
          borderWidth: 1,
          ...Shadows.sm,
        };
    }
  };

  const baseCardStyle: ViewStyle = {
    borderRadius: BorderRadius.lg,
    padding: Spacing.cardPadding,
    overflow: Platform.OS === 'android' ? 'hidden' : 'visible',
    ...getVariantStyle(),
  };

  if (onPress) {
    return (
      <Pressable
        testID={testID}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        android_ripple={{
          color: theme.brandPrimary + '15',
          borderless: false,
        }}
        style={({ pressed }) => [
          baseCardStyle,
          styles.interactive,
          pressed && Platform.OS !== 'android' && styles.pressedIos,
          style,
        ]}>
        {children}
      </Pressable>
    );
  }

  return (
    <View testID={testID} style={[baseCardStyle, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  interactive: {
    minHeight: 48,
  },
  pressedIos: {
    opacity: 0.88,
  },
});
