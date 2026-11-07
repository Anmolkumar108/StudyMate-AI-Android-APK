import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge, Card } from '@/components/ui';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Subject } from '@/types/subject';

export interface SubjectCardProps {
  subject: Subject;
  onPress: () => void;
}

function getSubjectInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

/**
 * Ultra-Premium Animated academic SubjectCard.
 * Features glassmorphism, accent glowing strip, squircle avatar badge,
 * semester tags, syllabus summary, and interactive quick action chips.
 */
export function SubjectCard({ subject, onPress }: SubjectCardProps) {
  const router = useRouter();
  const theme = useTheme();
  const subjectColor = subject.color || '#8B5CF6';
  const initials = getSubjectInitials(subject.name);

  const formattedDate = subject.created_at
    ? new Date(subject.created_at).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <Card
      variant="default"
      onPress={onPress}
      accessibilityLabel={`Subject: ${subject.name}${subject.code ? `, code ${subject.code}` : ''}${subject.semester ? `, semester ${subject.semester}` : ''}`}
      accessibilityHint="Tap to view subject details, syllabus, edit, or delete"
      style={[
        styles.card,
        {
          borderColor: subjectColor ? `${subjectColor}40` : 'rgba(139, 92, 246, 0.25)',
        },
      ]}>
      {/* Left Color Accent Bar with subtle glow */}
      <View
        style={[
          styles.colorBar,
          {
            backgroundColor: subjectColor,
            shadowColor: subjectColor,
          },
        ]}
      />

      <View style={styles.cardContent}>
        {/* Top Metadata Row: Initials Avatar, Badges & Color Dot */}
        <View style={styles.topRow}>
          <View style={styles.leftMetaGroup}>
            {/* Subject Initials Squircle Avatar */}
            <View
              style={[
                styles.avatarSquircle,
                {
                  backgroundColor: `${subjectColor}20`,
                  borderColor: `${subjectColor}55`,
                },
              ]}>
              <Text style={[styles.avatarText, { color: subjectColor }]}>
                {initials}
              </Text>
            </View>

            <View style={styles.badgeGroup}>
              {subject.code ? (
                <Badge label={subject.code} variant="neutral" size="sm" />
              ) : null}

              {subject.semester ? (
                <Badge label={`Sem ${subject.semester}`} variant="neutral" size="sm" />
              ) : null}
            </View>
          </View>

          {/* Glowing Color Indicator Dot */}
          <View
            style={[
              styles.colorDot,
              {
                backgroundColor: subjectColor,
                borderColor: `${subjectColor}66`,
                shadowColor: subjectColor,
              },
            ]}
          />
        </View>

        {/* Subject Name */}
        <ThemedText type="headlineMedium" style={styles.title} numberOfLines={2}>
          {subject.name}
        </ThemedText>

        {/* Description / Syllabus Preview */}
        {subject.description ? (
          <ThemedText
            type="bodyMedium"
            style={[styles.description, { color: theme.textSecondary }]}
            numberOfLines={2}>
            {subject.description}
          </ThemedText>
        ) : null}

        {/* Footer Row: Quick Shortcuts & Details Chevron */}
        <View style={styles.footerRow}>
          <View style={styles.quickChipsRow}>
            {/* Timetable Shortcut */}
            <Pressable
              style={({ pressed }) => [
                styles.chipButton,
                pressed && styles.chipButtonPressed,
              ]}
              onPress={(e) => {
                e.stopPropagation?.();
                router.push('/timetable' as never);
              }}
              accessibilityRole="button"
              accessibilityLabel={`View timetable schedule for ${subject.name}`}>
              <Text style={styles.chipIcon}>📅</Text>
              <Text style={styles.chipText}>Schedule</Text>
            </Pressable>

            {/* Notes Shortcut */}
            <Pressable
              style={({ pressed }) => [
                styles.chipButton,
                pressed && styles.chipButtonPressed,
              ]}
              onPress={(e) => {
                e.stopPropagation?.();
                router.push('/notes' as never);
              }}
              accessibilityRole="button"
              accessibilityLabel={`View notes for ${subject.name}`}>
              <Text style={styles.chipIcon}>📝</Text>
              <Text style={styles.chipText}>Notes</Text>
            </Pressable>

            {formattedDate ? (
              <ThemedText type="bodySmall" style={styles.dateText}>
                {formattedDate}
              </ThemedText>
            ) : null}
          </View>

          {/* Action Chevron Circle */}
          <View
            style={[
              styles.chevronCircle,
              { backgroundColor: `${subjectColor}15`, borderColor: `${subjectColor}33` },
            ]}>
            <Text style={[styles.chevronArrow, { color: subjectColor }]}>→</Text>
          </View>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 0,
    marginBottom: Spacing.md,
    flexDirection: 'row',
    overflow: 'hidden',
    minHeight: 110,
    backgroundColor: 'rgba(16, 24, 48, 0.85)',
    borderRadius: 20,
    borderWidth: 1.2,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  colorBar: {
    width: 6,
    alignSelf: 'stretch',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },
  cardContent: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    gap: 6,
    justifyContent: 'center',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  leftMetaGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  avatarSquircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  badgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 4,
    elevation: 2,
  },
  title: {
    fontWeight: '800',
    fontSize: 18,
    lineHeight: 24,
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
    color: '#94A3B8',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  quickChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    flex: 1,
  },
  chipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  chipButtonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    transform: [{ scale: 0.95 }],
  },
  chipIcon: {
    fontSize: 11,
  },
  chipText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '600',
  },
  dateText: {
    color: '#64748B',
    fontSize: 11,
    marginLeft: 2,
  },
  chevronCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevronArrow: {
    fontSize: 14,
    fontWeight: '800',
  },
});
