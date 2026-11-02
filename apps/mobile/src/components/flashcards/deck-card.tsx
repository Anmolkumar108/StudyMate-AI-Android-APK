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
  const [translateYAnim] = useState(() => new Animated.Value(8));

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (reduced) {
          opacityAnim.setValue(1);
          translateYAnim.setValue(0);
          return;
        }

        const delay = Math.min(index * 35, 200);
        Animated.parallel([
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 220,
            delay,
            useNativeDriver: true,
          }),
          Animated.timing(translateYAnim, {
            toValue: 0,
            duration: 220,
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
        style={styles.cardContainer}>
        {/* Left Color Accent Bar */}
        <View style={[styles.accentBar, { backgroundColor: accentColor }]} />

        <View style={styles.cardContent}>
          {/* Header Row: Badges & Action Menu */}
          <View style={styles.headerRow}>
            <View style={styles.badgeGroup}>
              {subjectName ? (
                <View
                  style={[
                    styles.subjectBadge,
                    {
                      backgroundColor: (subjectColor || theme.brandPrimary) + '1F',
                      borderColor: (subjectColor || theme.brandPrimary) + '40',
                    },
                  ]}>
                  <View
                    style={[
                      styles.subjectDot,
                      { backgroundColor: subjectColor || theme.brandPrimary },
                    ]}
                  />
                  <ThemedText
                    type="smallBold"
                    style={{
                      color: subjectColor || theme.brandPrimary,
                      fontSize: 11,
                    }}>
                    {subjectName}
                  </ThemedText>
                </View>
              ) : null}

              <Badge
                label={`${deck.card_count} ${deck.card_count === 1 ? 'card' : 'cards'}`}
                variant={hasCards ? 'brand' : 'neutral'}
                size="sm"
              />
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
                    { opacity: pressed ? 0.7 : 1 },
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
                    { opacity: pressed ? 0.7 : 1 },
                  ]}>
                  <Text style={[styles.actionIcon, { color: theme.statusDanger }]}>
                    🗑️
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          {/* Deck Title */}
          <ThemedText type="headlineMedium" numberOfLines={2} style={styles.title}>
            {deck.title}
          </ThemedText>

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
            <ThemedText
              type="small"
              style={{ color: theme.textTertiary }}>
              {hasCards ? 'Tap to view or study' : 'Add cards to begin studying'}
            </ThemedText>

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
  },
  accentBar: {
    width: 5,
    alignSelf: 'stretch',
  },
  cardContent: {
    flex: 1,
    padding: Spacing.cardPadding,
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
    gap: Spacing.xs,
    flexWrap: 'wrap',
    flex: 1,
  },
  subjectBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  subjectDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  iconButton: {
    width: MinTouchTarget,
    height: MinTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: {
    fontSize: 16,
  },
  title: {
    marginTop: 2,
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
  },
  studyPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
  },
  studyPillText: {
    color: '#FFFFFF',
    fontSize: 12,
  },
});
