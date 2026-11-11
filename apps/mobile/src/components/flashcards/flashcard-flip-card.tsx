import React, { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge } from '@/components/ui';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Flashcard } from '@/types/flashcard';

export interface FlashcardFlipCardProps {
  card: Flashcard;
  isFlipped: boolean;
  onFlip: () => void;
  currentIndex: number;
  totalCards: number;
}

export function FlashcardFlipCard({
  card,
  isFlipped,
  onFlip,
  currentIndex,
  totalCards,
}: FlashcardFlipCardProps) {
  const theme = useTheme();
  const [animatedValue] = useState(() => new Animated.Value(isFlipped ? 180 : 0));
  const [isReducedMotion, setIsReducedMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setIsReducedMotion);
  }, []);

  useEffect(() => {
    if (isReducedMotion) {
      animatedValue.setValue(isFlipped ? 180 : 0);
      return;
    }

    Animated.spring(animatedValue, {
      toValue: isFlipped ? 180 : 0,
      friction: 8,
      tension: 10,
      useNativeDriver: true,
    }).start();
  }, [isFlipped, isReducedMotion, animatedValue]);

  // Interpolate rotations
  const frontInterpolate = animatedValue.interpolate({
    inputRange: [0, 180],
    outputRange: ['0deg', '180deg'],
  });

  const backInterpolate = animatedValue.interpolate({
    inputRange: [0, 180],
    outputRange: ['180deg', '360deg'],
  });

  const frontOpacity = animatedValue.interpolate({
    inputRange: [89, 90],
    outputRange: [1, 0],
  });

  const backOpacity = animatedValue.interpolate({
    inputRange: [89, 90],
    outputRange: [0, 1],
  });

  return (
    <Pressable
      onPress={onFlip}
      accessibilityRole="button"
      accessibilityLabel={`Flashcard ${currentIndex + 1} of ${totalCards}. Currently showing ${isFlipped ? 'Answer' : 'Question'}. Tap to flip.`}
      accessibilityHint="Flips between question and answer"
      style={styles.container}>
      {/* Front Face (Question) */}
      <Animated.View
        style={[
          styles.cardFace,
          {
            backgroundColor: theme.cardBackground,
            borderColor: theme.borderSubtle,
            opacity: frontOpacity,
            transform: [{ perspective: 1000 }, { rotateY: frontInterpolate }],
          },
        ]}
        pointerEvents={isFlipped ? 'none' : 'auto'}>
        <View style={styles.cardHeader}>
          <Badge label="QUESTION" variant="brand" size="sm" />
          <ThemedText type="smallBold" style={{ color: theme.textSecondary }}>
            {currentIndex + 1} / {totalCards}
          </ThemedText>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled={true}
          contentContainerStyle={styles.textContainer}>
          <ThemedText type="headlineMedium" style={styles.mainText}>
            {card.question}
          </ThemedText>
        </ScrollView>

        <View
          style={[
            styles.cardFooter,
            { borderTopColor: theme.borderSubtle },
          ]}>
          <ThemedText
            type="small"
            style={{ color: theme.textTertiary, textAlign: 'center' }}>
            👆 Tap to reveal answer
          </ThemedText>
        </View>
      </Animated.View>

      {/* Back Face (Answer) */}
      <Animated.View
        style={[
          styles.cardFace,
          styles.cardBack,
          {
            backgroundColor: theme.inputBackground,
            borderColor: theme.brandPrimary + '40',
            opacity: backOpacity,
            transform: [{ perspective: 1000 }, { rotateY: backInterpolate }],
          },
        ]}
        pointerEvents={isFlipped ? 'auto' : 'none'}>
        <View style={styles.cardHeader}>
          <Badge label="ANSWER" variant="success" size="sm" />
          <ThemedText type="smallBold" style={{ color: theme.textSecondary }}>
            {currentIndex + 1} / {totalCards}
          </ThemedText>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled={true}
          contentContainerStyle={styles.textContainer}>
          <ThemedText
            type="bodyLarge"
            style={[styles.mainText, { color: theme.text }]}>
            {card.answer}
          </ThemedText>
        </ScrollView>

        <View
          style={[
            styles.cardFooter,
            { borderTopColor: theme.borderSubtle },
          ]}>
          <ThemedText
            type="small"
            style={{ color: theme.brandPrimary, textAlign: 'center' }}>
            👆 Tap to return to question
          </ThemedText>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 290,
    marginVertical: Spacing.xs,
    alignSelf: 'center',
    maxWidth: 500,
  },
  cardFace: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    padding: Spacing.md,
    justifyContent: 'space-between',
    backfaceVisibility: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  cardBack: {
    backfaceVisibility: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  textContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  mainText: {
    textAlign: 'center',
    lineHeight: 26,
  },
  cardFooter: {
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    alignItems: 'center',
  },
});
