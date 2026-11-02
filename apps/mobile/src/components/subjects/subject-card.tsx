import React from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge, Card } from '@/components/ui';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Subject } from '@/types/subject';

export interface SubjectCardProps {
  subject: Subject;
  onPress: () => void;
}

/**
 * Premium academic SubjectCard adhering to Hybrid Premium UI.
 * Displays subject title, code, semester badge, description snippet,
 * and colored accent indicator with full theme adaptation.
 */
export function SubjectCard({ subject, onPress }: SubjectCardProps) {
  const theme = useTheme();
  const subjectColor = subject.color || theme.brandPrimary;

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
      style={styles.card}>
      {/* Left Color Accent Bar */}
      <View style={[styles.colorBar, { backgroundColor: subjectColor }]} />

      <View style={styles.cardContent}>
        {/* Top Metadata Row: Code, Semester & Color Dot */}
        <View style={styles.metaRow}>
          <View style={styles.badgeGroup}>
            {subject.code ? (
              <Badge label={subject.code} variant="neutral" size="sm" />
            ) : null}

            {subject.semester ? (
              <Badge label={`Sem ${subject.semester}`} variant="neutral" size="sm" />
            ) : null}
          </View>

          {/* Color Indicator Dot */}
          <View
            style={[
              styles.colorDot,
              { backgroundColor: subjectColor, borderColor: theme.borderSubtle },
            ]}
          />
        </View>

        {/* Subject Name */}
        <ThemedText type="headlineMedium" style={styles.title} numberOfLines={2}>
          {subject.name}
        </ThemedText>

        {/* Description Snippet */}
        {subject.description ? (
          <ThemedText
            type="bodyMedium"
            style={[styles.description, { color: theme.textSecondary }]}
            numberOfLines={2}>
            {subject.description}
          </ThemedText>
        ) : null}

        {/* Footer Meta Row: Date & Action Chevron */}
        <View style={styles.footerRow}>
          {formattedDate ? (
            <ThemedText type="bodySmall" style={{ color: theme.textTertiary }}>
              Added {formattedDate}
            </ThemedText>
          ) : (
            <View />
          )}

          <ThemedText
            type="titleMedium"
            style={[styles.chevron, { color: theme.textTertiary }]}>
            ›
          </ThemedText>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 0,
    marginBottom: Spacing.sm,
    flexDirection: 'row',
    overflow: 'hidden',
    minHeight: 88,
  },
  colorBar: {
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
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
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
    borderWidth: 1,
  },
  title: {
    fontWeight: '700',
    fontSize: 17,
    lineHeight: 22,
  },
  description: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  chevron: {
    fontSize: 18,
    fontWeight: '600',
  },
});
