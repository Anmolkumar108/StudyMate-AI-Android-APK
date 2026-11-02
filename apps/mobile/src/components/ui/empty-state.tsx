import React from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Button, ButtonVariant } from './button';

export interface EmptyStateProps {
  /**
   * Primary title describing the empty condition.
   */
  title: string;

  /**
   * Secondary description text providing context or next steps.
   */
  description?: string;

  /**
   * Leading visual element. Can be a string emoji (e.g. '📚', '📝') or a custom ReactNode.
   */
  icon?: React.ReactNode | string;

  /**
   * Primary action button label.
   */
  actionLabel?: string;

  /**
   * Callback invoked when primary action button is pressed.
   */
  onAction?: () => void;

  /**
   * Primary action button visual variant. Defaults to 'primary'.
   */
  actionVariant?: ButtonVariant;

  /**
   * Optional secondary action button label.
   */
  secondaryActionLabel?: string;

  /**
   * Callback invoked when secondary action button is pressed.
   */
  onSecondaryAction?: () => void;

  /**
   * Style override for the empty state container.
   */
  style?: StyleProp<ViewStyle>;

  /**
   * Test identifier.
   */
  testID?: string;
}

/**
 * Reusable, theme-aware EmptyState component adhering to the Hybrid Premium UI.
 * Fully responsive across all Android screen sizes and orientations.
 */
export function EmptyState({
  title,
  description,
  icon,
  actionLabel,
  onAction,
  actionVariant = 'primary',
  secondaryActionLabel,
  onSecondaryAction,
  style,
  testID,
}: EmptyStateProps) {
  const theme = useTheme();

  return (
    <View testID={testID} style={[styles.container, style]}>
      {icon ? (
        <View
          style={[
            styles.iconCircle,
            {
              backgroundColor: theme.badgeBrandBackground,
              borderColor: theme.borderSubtle,
            },
          ]}>
          {typeof icon === 'string' ? (
            <Text style={styles.iconEmoji}>{icon}</Text>
          ) : (
            icon
          )}
        </View>
      ) : null}

      <Text style={[styles.title, { color: theme.text }]}>
        {title}
      </Text>

      {description ? (
        <Text style={[styles.description, { color: theme.textSecondary }]}>
          {description}
        </Text>
      ) : null}

      {actionLabel && onAction ? (
        <View style={styles.actionContainer}>
          <Button
            title={actionLabel}
            onPress={onAction}
            variant={actionVariant}
            size="md"
          />

          {secondaryActionLabel && onSecondaryAction ? (
            <Button
              title={secondaryActionLabel}
              onPress={onSecondaryAction}
              variant="ghost"
              size="md"
              style={styles.secondaryButton}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    width: '100%',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  iconEmoji: {
    fontSize: 32,
    textAlign: 'center',
  },
  title: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    maxWidth: 420,
  },
  actionContainer: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
    gap: Spacing.sm,
  },
  secondaryButton: {
    marginTop: Spacing.xs,
  },
});
