import React, { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  StyleSheet,
  View,
} from 'react-native';

import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface NoteCardSkeletonProps {
  count?: number;
}

/**
 * Animated skeleton placeholder cards shown while notes are loading.
 * Runs on the native driver for 60fps performance and respects reduced-motion settings.
 */
export function NoteCardSkeleton({ count = 3 }: NoteCardSkeletonProps) {
  const theme = useTheme();
  const [pulseAnim] = useState(() => new Animated.Value(0.35));
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    // Check Android system accessibility reduced-motion preference
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => setReduceMotion(enabled))
      .catch(() => {});

    if (reduceMotion) {
      pulseAnim.setValue(0.5);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.8,
          duration: 850,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.35,
          duration: 850,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => animation.stop();
  }, [pulseAnim, reduceMotion]);

  const items = Array.from({ length: count }, (_, i) => i);

  return (
    <View style={styles.container} accessibilityLabel="Loading study notes">
      {items.map((key) => (
        <View
          key={key}
          style={[
            styles.skeletonCard,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.borderSubtle,
            },
          ]}>
          {/* Left accent bar skeleton */}
          <Animated.View
            style={[
              styles.accentBar,
              {
                backgroundColor: theme.brandMuted,
                opacity: pulseAnim,
              },
            ]}
          />

          <View style={styles.cardContent}>
            {/* Top badges placeholder */}
            <View style={styles.topRow}>
              <View style={styles.badgeGroup}>
                <Animated.View
                  style={[
                    styles.badgePill,
                    {
                      backgroundColor: theme.inputBackground,
                      opacity: pulseAnim,
                    },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.badgePillSmall,
                    {
                      backgroundColor: theme.inputBackground,
                      opacity: pulseAnim,
                    },
                  ]}
                />
              </View>

              <Animated.View
                style={[
                  styles.datePill,
                  {
                    backgroundColor: theme.inputBackground,
                    opacity: pulseAnim,
                  },
                ]}
              />
            </View>

            {/* Title placeholder */}
            <Animated.View
              style={[
                styles.titleBar,
                {
                  backgroundColor: theme.inputBackground,
                  opacity: pulseAnim,
                },
              ]}
            />
            <Animated.View
              style={[
                styles.titleBarShort,
                {
                  backgroundColor: theme.inputBackground,
                  opacity: pulseAnim,
                },
              ]}
            />

            {/* Snippet placeholder */}
            <Animated.View
              style={[
                styles.snippetBar,
                {
                  backgroundColor: theme.inputBackground,
                  opacity: pulseAnim,
                },
              ]}
            />

            {/* Footer placeholder */}
            <View style={styles.footerRow}>
              <Animated.View
                style={[
                  styles.footerButton,
                  {
                    backgroundColor: theme.inputBackground,
                    opacity: pulseAnim,
                  },
                ]}
              />
              <Animated.View
                style={[
                  styles.footerChevron,
                  {
                    backgroundColor: theme.inputBackground,
                    opacity: pulseAnim,
                  },
                ]}
              />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
    paddingTop: Spacing.xs,
  },
  skeletonCard: {
    flexDirection: 'row',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    minHeight: 110,
  },
  accentBar: {
    width: 6,
    alignSelf: 'stretch',
  },
  cardContent: {
    flex: 1,
    padding: Spacing.cardPadding,
    gap: 8,
    justifyContent: 'center',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badgeGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  badgePill: {
    width: 72,
    height: 20,
    borderRadius: BorderRadius.full,
  },
  badgePillSmall: {
    width: 52,
    height: 20,
    borderRadius: BorderRadius.full,
  },
  datePill: {
    width: 48,
    height: 14,
    borderRadius: BorderRadius.sm,
  },
  titleBar: {
    width: '85%',
    height: 16,
    borderRadius: BorderRadius.sm,
    marginTop: 2,
  },
  titleBarShort: {
    width: '60%',
    height: 16,
    borderRadius: BorderRadius.sm,
  },
  snippetBar: {
    width: '95%',
    height: 12,
    borderRadius: BorderRadius.xs,
    marginTop: 2,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  footerButton: {
    width: 64,
    height: 24,
    borderRadius: BorderRadius.sm,
  },
  footerChevron: {
    width: 14,
    height: 14,
    borderRadius: BorderRadius.full,
  },
});
