import React, { useEffect, useMemo, useState } from 'react';
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
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Note } from '@/types/note';

export interface NoteCardProps {
  note: Note;
  index?: number;
  subjectName?: string | null;
  subjectColor?: string | null;
  onPress: () => void;
  onTogglePin?: () => void;
}

/**
 * Premium academic NoteCard adhering to Hybrid Premium UI.
 * Features staggered entrance animation, left subject accent bar,
 * animated pin toggle feedback, subject badge, word count indicator,
 * formatted timestamp, and high contrast typography.
 */
export function NoteCard({
  note,
  index = 0,
  subjectName,
  subjectColor,
  onPress,
  onTogglePin,
}: NoteCardProps) {
  const theme = useTheme();

  // Staggered entrance animation
  const [opacityAnim] = useState(() => new Animated.Value(0));
  const [translateYAnim] = useState(() => new Animated.Value(10));

  // Pin toggle bounce animation
  const [pinScaleAnim] = useState(() => new Animated.Value(1));

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (reduced) {
          opacityAnim.setValue(1);
          translateYAnim.setValue(0);
          return;
        }

        const delay = Math.min(index * 35, 210);
        Animated.parallel([
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 240,
            delay,
            useNativeDriver: true,
          }),
          Animated.timing(translateYAnim, {
            toValue: 0,
            duration: 240,
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

  const handleTogglePinWithFeedback = () => {
    Animated.sequence([
      Animated.timing(pinScaleAnim, {
        toValue: 1.28,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.spring(pinScaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start();

    onTogglePin?.();
  };

  const accentColor =
    subjectColor || (note.is_pinned ? theme.statusWarning : theme.brandPrimary);

  // Format creation or update date
  const formattedDate = useMemo(() => {
    const date = new Date(note.updated_at || note.created_at);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }, [note.updated_at, note.created_at]);

  // Student utility: word count calculation
  const wordCount = useMemo(() => {
    if (!note.content) return 0;
    return note.content.trim().split(/\s+/).filter(Boolean).length;
  }, [note.content]);

  return (
    <Animated.View
      style={{
        opacity: opacityAnim,
        transform: [{ translateY: translateYAnim }],
      }}>
      <Card
        variant="default"
        onPress={onPress}
        accessibilityLabel={`Note: ${note.title}${note.is_pinned ? ', pinned to top' : ''}${subjectName ? `, subject ${subjectName}` : ''}, ${wordCount} words`}
        accessibilityHint="Tap to view full note details, edit content, toggle pin, or delete"
        style={styles.card}>
        {/* Left Subject / Pinned Accent Strip */}
        <View style={[styles.accentBar, { backgroundColor: accentColor }]} />

        <View style={styles.cardContent}>
          {/* Top Badges & Meta Row */}
          <View style={styles.badgeRow}>
            <View style={styles.leftBadges}>
              {note.is_pinned ? (
                <Animated.View style={{ transform: [{ scale: pinScaleAnim }] }}>
                  <Pressable
                    onPress={handleTogglePinWithFeedback}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel="Unpin note">
                    <Badge label="📌 Pinned" variant="warning" size="sm" />
                  </Pressable>
                </Animated.View>
              ) : null}

              {subjectName ? (
                <Badge
                  label={subjectName}
                  dotColor={subjectColor || undefined}
                  variant="neutral"
                  size="sm"
                />
              ) : null}
            </View>

            <ThemedText
              type="bodySmall"
              style={[styles.dateText, { color: theme.textTertiary }]}>
              {formattedDate}
            </ThemedText>
          </View>

          {/* Note Title */}
          <ThemedText type="headlineMedium" style={styles.title} numberOfLines={2}>
            {note.title}
          </ThemedText>

          {/* Note Snippet */}
          <ThemedText
            type="bodyMedium"
            style={[styles.snippet, { color: theme.textSecondary }]}
            numberOfLines={2}>
            {note.content.replace(/\n+/g, ' ')}
          </ThemedText>

          {/* Footer Meta Row: Word Count, Pin Action & Chevron */}
          <View style={styles.footerRow}>
            <View style={styles.metaPillGroup}>
              {wordCount > 0 ? (
                <View
                  style={[
                    styles.wordCountPill,
                    {
                      backgroundColor: theme.badgeNeutralBackground,
                      borderColor: theme.borderSubtle,
                    },
                  ]}>
                  <ThemedText
                    type="small"
                    style={{ color: theme.textSecondary, fontSize: 11 }}>
                    {wordCount} {wordCount === 1 ? 'word' : 'words'}
                  </ThemedText>
                </View>
              ) : null}

              {onTogglePin ? (
                <Animated.View style={{ transform: [{ scale: pinScaleAnim }] }}>
                  <Pressable
                    onPress={handleTogglePinWithFeedback}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel={note.is_pinned ? 'Unpin note' : 'Pin note to top'}
                    style={({ pressed }) => [
                      styles.pinButton,
                      {
                        backgroundColor: note.is_pinned
                          ? theme.badgeWarningBackground
                          : theme.badgeNeutralBackground,
                        borderColor: note.is_pinned
                          ? theme.statusWarning + '40'
                          : theme.borderSubtle,
                        opacity: pressed ? 0.75 : 1,
                      },
                    ]}>
                    <Text style={styles.pinIcon}>{note.is_pinned ? '📌' : '📍'}</Text>
                    <ThemedText
                      type="small"
                      style={{
                        color: note.is_pinned ? theme.statusWarning : theme.textSecondary,
                        fontWeight: '600',
                        fontSize: 12,
                      }}>
                      {note.is_pinned ? 'Pinned' : 'Pin'}
                    </ThemedText>
                  </Pressable>
                </Animated.View>
              ) : null}
            </View>

            <ThemedText
              type="titleMedium"
              style={[styles.chevron, { color: theme.textTertiary }]}>
              ›
            </ThemedText>
          </View>
        </View>
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 0,
    marginBottom: Spacing.sm,
    flexDirection: 'row',
    overflow: 'hidden',
    minHeight: 104,
  },
  accentBar: {
    width: 6,
    alignSelf: 'stretch',
  },
  cardContent: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    gap: 4,
    justifyContent: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
    gap: Spacing.xs,
  },
  leftBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flexWrap: 'wrap',
    flex: 1,
  },
  dateText: {
    marginLeft: 'auto',
    fontSize: 12,
  },
  title: {
    fontWeight: '700',
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  snippet: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  metaPillGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  wordCountPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 24,
  },
  pinIcon: {
    fontSize: 11,
  },
  chevron: {
    fontSize: 18,
    fontWeight: '600',
    marginRight: 2,
  },
});
