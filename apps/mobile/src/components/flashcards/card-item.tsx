import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui';
import { BorderRadius, MinTouchTarget, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Flashcard } from '@/types/flashcard';

export interface CardItemProps {
  card: Flashcard;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}

export function CardItem({ card, index, onEdit, onDelete }: CardItemProps) {
  const theme = useTheme();

  return (
    <Card variant="default" style={styles.card}>
      <View style={styles.topRow}>
        <View
          style={[
            styles.indexBadge,
            {
              backgroundColor: theme.brandPrimary + '1A',
              borderColor: theme.brandPrimary + '30',
            },
          ]}>
          <ThemedText
            type="smallBold"
            style={{ color: theme.brandPrimary, fontSize: 11 }}>
            #{index + 1}
          </ThemedText>
        </View>

        <View style={styles.actionButtons}>
          <Pressable
            onPress={onEdit}
            accessibilityRole="button"
            accessibilityLabel={`Edit card number ${index + 1}`}
            style={({ pressed }) => [
              styles.iconBtn,
              { opacity: pressed ? 0.7 : 1 },
            ]}>
            <Text style={[styles.actionIcon, { color: theme.textSecondary }]}>
              ✏️
            </Text>
          </Pressable>

          <Pressable
            onPress={onDelete}
            accessibilityRole="button"
            accessibilityLabel={`Delete card number ${index + 1}`}
            style={({ pressed }) => [
              styles.iconBtn,
              { opacity: pressed ? 0.7 : 1 },
            ]}>
            <Text style={[styles.actionIcon, { color: theme.statusDanger }]}>🗑️</Text>
          </Pressable>
        </View>
      </View>

      {/* Question */}
      <View style={styles.section}>
        <ThemedText
          type="smallBold"
          style={{ color: theme.brandPrimary, letterSpacing: 0.6 }}>
          QUESTION
        </ThemedText>
        <ThemedText type="bodyMedium" numberOfLines={3} style={styles.content}>
          {card.question}
        </ThemedText>
      </View>

      {/* Answer */}
      <View
        style={[
          styles.section,
          styles.answerSection,
          {
            backgroundColor: theme.inputBackground,
            borderColor: theme.borderSubtle,
          },
        ]}>
        <ThemedText
          type="smallBold"
          style={{ color: theme.textSecondary, letterSpacing: 0.6 }}>
          ANSWER
        </ThemedText>
        <ThemedText
          type="bodySmall"
          numberOfLines={4}
          style={[styles.content, { color: theme.textSecondary }]}>
          {card.answer}
        </ThemedText>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  indexBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconBtn: {
    width: MinTouchTarget,
    height: MinTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: {
    fontSize: 15,
  },
  section: {
    gap: 2,
  },
  content: {
    marginTop: 2,
    lineHeight: 20,
  },
  answerSection: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginTop: 4,
  },
});
