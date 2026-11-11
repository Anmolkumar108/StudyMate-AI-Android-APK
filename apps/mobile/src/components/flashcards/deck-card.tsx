import React, { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge, Card } from '@/components/ui';
import { BorderRadius, MinTouchTarget, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { FlashcardDeck } from '@/types/flashcard';

export interface DeckCardProps {
  deck: FlashcardDeck;
  index?: number;
  subjectName?: string | null;
  subjectColor?: string | null;
  onPress: () => void;
  onStudyPress?: () => void;
  onEditPress?: () => void;
  onDeletePress?: () => void;
}

export function DeckCard({
  deck,
  index = 0,
  subjectName,
  subjectColor,
  onPress,
  onStudyPress,
  onEditPress,
  onDeletePress,
}: DeckCardProps) {
  const theme = useTheme();

  const [opacityAnim] = useState(() => new Animated.Value(0));
  const [translateYAnim] = useState(() => new Animated.Value(12));

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (reduced) {
          opacityAnim.setValue(1);
          translateYAnim.setValue(0);
          return;
        }

        const delay = Math.min(index * 40, 220);
        Animated.parallel([
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 240,
            delay,
            useNativeDriver: true,
          }),
          Animated.spring(translateYAnim, {
            toValue: 0,
            friction: 7,
            tension: 50,
            delay,
            useNativeDriver: true,
          }),
        ]).start();
      })
      .catch(() => {
        opacityAnim.setValue(1);
        translateYAnim.setValue(0);
      });
  }, [opacityAnim, translateYAnim, index]);

  const hasCards = deck.card_count > 0;
  const accentColor = subjectColor || theme.brandPrimary;

  return (
    <Animated.View
      style={{
        opacity: opacityAnim,
        transform: [{ translateY: translateYAnim }],
        marginBottom: Spacing.md,
      }}>
      <Card
        variant="default"
        onPress={onPress}
        accessibilityLabel={`Deck: ${deck.title}, ${deck.card_count} cards`}
        accessibilityHint="Opens deck details and card study workspace"
        style={[
          styles.cardContainer,
          {
            borderColor: accentColor + '33',
            shadowColor: accentColor,
          },
        ]}>
        {/* Left Glowing Accent Capsule Indicator */}
        <View style={styles.accentBarWrapper}>
          <View style={[styles.accentBar, { backgroundColor: accentColor }]} />
          <View style={[styles.accentGlowDot, { backgroundColor: accentColor }]} />
        </View>

        <View style={styles.cardContent}>
          {/* Header Row: Badges & Action Menu */}
          <View style={styles.headerRow}>
            <View style={styles.badgeGroup}>
              {subjectName ? (
                <View
                  style={[
                    styles.subjectBadge,
                    {
                      backgroundColor: accentColor + '18',
                      borderColor: accentColor + '44',
                    },
                  ]}>
                  <View
                    style={[
                      styles.subjectDot,
                      { backgroundColor: accentColor },
                    ]}
                  />
                  <ThemedText
                    type="smallBold"
                    style={{
                      color: accentColor,
                      fontSize: 11,
                      letterSpacing: 0.3,
                    }}>
                    {subjectName}
                  </ThemedText>
                </View>
              ) : null}

              <Badge
                label={`🎴 ${deck.card_count} ${deck.card_count === 1 ? 'card' : 'cards'}`}
                variant={hasCards ? 'brand' : 'neutral'}
                size="sm"
              />

              {hasCards ? (
                <View
                  style={[
                    styles.activeRecallChip,
                    {
                      backgroundColor: theme.brandPrimary + '14',
                      borderColor: theme.brandPrimary + '26',
                    },
                  ]}>
                  <Text style={{ fontSize: 9 }}>⚡</Text>
                  <ThemedText
                    type="small"
                    style={{
                      color: theme.brandPrimary,
                      fontSize: 10,
                      fontWeight: '600',
                    }}>
                    Recall Ready
                  </ThemedText>
                </View>
              ) : null}
            </View>

            {/* Quick Action Icons */}
            <View style={styles.actionButtonsRow}>
              {onEditPress ? (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    onEditPress();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Edit deck details"
                  style={({ pressed }) => [
                    styles.iconButton,
                    {
                      backgroundColor: theme.inputBackground,
                      borderColor: theme.borderSubtle,
                      opacity: pressed ? 0.7 : 1,
                      transform: [{ scale: pressed ? 0.92 : 1 }],
                    },
                  ]}>
                  <Text style={[styles.actionIcon, { color: theme.textSecondary }]}>
                    ✏️
                  </Text>
                </Pressable>
              ) : null}

              {onDeletePress ? (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    onDeletePress();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Delete deck"
                  style={({ pressed }) => [
                    styles.iconButton,
                    {
                      backgroundColor: theme.inputBackground,
                      borderColor: theme.statusDanger + '30',
                      opacity: pressed ? 0.7 : 1,
                      transform: [{ scale: pressed ? 0.92 : 1 }],
                    },
                  ]}>
                  <Text style={[styles.actionIcon, { color: theme.statusDanger }]}>
                    🗑️
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          {/* Deck Title */}
          <View style={styles.titleRow}>
            <ThemedText type="headlineMedium" numberOfLines={2} style={styles.title}>
              {deck.title}
            </ThemedText>
          </View>

          {/* Optional Description */}
          {deck.description ? (
            <ThemedText
              type="bodySmall"
              numberOfLines={2}
              style={[styles.description, { color: theme.textSecondary }]}>
              {deck.description}
            </ThemedText>
          ) : null}

          {/* Footer Row: Study Mode CTA */}
          <View
            style={[
              styles.footerRow,
              { borderTopColor: theme.borderSubtle },
            ]}>
            <View style={styles.footerLeft}>
              <Text style={{ fontSize: 13 }}>{hasCards ? '🎯' : '💡'}</Text>
              <ThemedText
                type="small"
                style={{ color: theme.textTertiary, flexShrink: 1 }}>
                {hasCards ? 'Tap to view or study' : 'Add cards to begin studying'}
              </ThemedText>
            </View>

            {hasCards && onStudyPress ? (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  onStudyPress();
                }}
                accessibilityRole="button"
                accessibilityLabel="Start study mode for this deck"
                style={({ pressed }) => [
                  styles.studyPill,
                  {
                    backgroundColor: theme.brandPrimary,
                    opacity: pressed ? 0.85 : 1,
                    transform: [{ scale: pressed ? 0.95 : 1 }],
                  },
                ]}>
                <ThemedText type="smallBold" style={styles.studyPillText}>
                  Study Now →
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    padding: 0,
    overflow: 'hidden',
    flexDirection: 'row',
    borderRadius: BorderRadius.xl,
    borderWidth: 1.2,
    elevation: 3,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  accentBarWrapper: {
    width: 6,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  accentBar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    opacity: 0.85,
  },
  accentGlowDot: {
    width: 6,
    height: 14,
    borderRadius: 3,
  },
  cardContent: {
    flex: 1,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  badgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    flex: 1,
  },
  subjectBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  subjectDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  activeRecallChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconButton: {
    width: MinTouchTarget,
    height: MinTouchTarget,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: {
    fontSize: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  title: {
    fontWeight: '700',
    fontSize: 18,
    lineHeight: 23,
    letterSpacing: -0.2,
  },
  description: {
    lineHeight: 18,
    marginTop: 2,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    gap: Spacing.sm,
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  studyPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
    elevation: 2,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  studyPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
