import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Badge, Button, Card } from '@/components/ui';
import { BorderRadius, MaxContentWidth, MinTouchTarget, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Subject } from '@/types/subject';

export interface SubjectDetailModalProps {
  subject: Subject | null;
  visible: boolean;
  onClose: () => void;
  onEdit: (subject: Subject) => void;
  onDelete: (subjectId: string) => Promise<void>;
}

export function SubjectDetailModal({
  subject,
  visible,
  onClose,
  onEdit,
  onDelete,
}: SubjectDetailModalProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  if (!subject) {
    return null;
  }

  const subjectColor = subject.color || theme.brandPrimary;

  const executeDelete = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await onDelete(subject.id);
      setShowConfirmDialog(false);
      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to delete subject.';
      setDeleteError(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeletePress = () => {
    if (Platform.OS === 'web') {
      setShowConfirmDialog(true);
    } else {
      Alert.alert(
        'Delete Subject?',
        `Are you sure you want to delete "${subject.name}"? This action cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: executeDelete,
          },
        ]
      );
    }
  };

  const createdDate = new Date(subject.created_at).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const updatedDate = subject.updated_at
    ? new Date(subject.updated_at).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss modal backdrop"
        />

        <View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: theme.background,
              borderColor: theme.borderSubtle,
              paddingBottom: Math.max(insets.bottom, Spacing.md),
            },
          ]}>
          {/* Top Color Accent Strip */}
          <View style={[styles.colorStrip, { backgroundColor: subjectColor }]} />

          {/* Modal Header */}
          <View style={[styles.header, { borderBottomColor: theme.borderSubtle }]}>
            <View style={styles.headerTitleContainer}>
              <View style={[styles.colorIndicator, { backgroundColor: subjectColor }]} />
              <ThemedText type="smallBold" style={{ color: theme.brandPrimary, letterSpacing: 0.5 }}>
                SUBJECT DETAILS
              </ThemedText>
            </View>

            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close subject details"
              style={({ pressed }) => [
                styles.closeButton,
                {
                  backgroundColor: theme.cardBackground,
                  borderColor: theme.borderSubtle,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}>
              <Text style={[styles.closeIcon, { color: theme.textSecondary }]}>✕</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.contentScroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}>
            {/* Delete Error Banner */}
            {deleteError ? (
              <Card variant="outlined" style={[styles.errorCard, { borderColor: theme.statusDanger }]}>
                <ThemedText type="bodyMedium" style={{ color: theme.statusDanger, fontWeight: '500' }}>
                  {deleteError}
                </ThemedText>
              </Card>
            ) : null}

            {/* Subject Name */}
            <ThemedText type="headlineLarge" style={styles.subjectName}>
              {subject.name}
            </ThemedText>

            {/* Metadata Badges (Code, Semester, Color) */}
            <View style={styles.tagRow}>
              {subject.code ? (
                <Badge label={`Code: ${subject.code}`} variant="brand" size="md" />
              ) : null}

              {subject.semester ? (
                <Badge label={`Semester ${subject.semester}`} variant="neutral" size="md" />
              ) : null}

              <Badge
                label="Color Theme"
                variant="neutral"
                size="md"
                dotColor={subjectColor}
              />
            </View>

            {/* Description & Syllabus Section */}
            <Card variant="default" style={styles.sectionCard}>
              <ThemedText
                type="smallBold"
                style={[styles.sectionTitle, { color: theme.textSecondary }]}>
                DESCRIPTION & SYLLABUS
              </ThemedText>
              <ThemedText
                type="bodyMedium"
                style={[styles.descriptionText, { color: theme.text }]}>
                {subject.description || 'No description provided for this subject.'}
              </ThemedText>
            </Card>

            {/* Academic Timeline Card */}
            <Card variant="default" style={styles.sectionCard}>
              <ThemedText
                type="smallBold"
                style={[styles.sectionTitle, { color: theme.textSecondary }]}>
                ACADEMIC TIMELINE
              </ThemedText>
              <View style={styles.timelineRow}>
                <ThemedText type="bodySmall" style={{ color: theme.textSecondary }}>
                  Enrolled / Created
                </ThemedText>
                <ThemedText type="bodySmall" style={{ color: theme.text, fontWeight: '600' }}>
                  {createdDate}
                </ThemedText>
              </View>
              {updatedDate && updatedDate !== createdDate ? (
                <View style={styles.timelineRow}>
                  <ThemedText type="bodySmall" style={{ color: theme.textSecondary }}>
                    Last Modified
                  </ThemedText>
                  <ThemedText type="bodySmall" style={{ color: theme.text, fontWeight: '600' }}>
                    {updatedDate}
                  </ThemedText>
                </View>
              ) : null}
            </Card>

            {/* Web Inline Confirm Delete Fallback */}
            {showConfirmDialog ? (
              <Card
                variant="outlined"
                style={[
                  styles.confirmBox,
                  {
                    backgroundColor: theme.badgeDangerBackground,
                    borderColor: theme.statusDanger,
                  },
                ]}>
                <ThemedText
                  type="titleMedium"
                  style={{ color: theme.statusDanger, fontWeight: '700' }}>
                  Are you sure you want to delete this subject?
                </ThemedText>
                <ThemedText
                  type="bodySmall"
                  style={{ color: theme.statusDanger, marginTop: 4, marginBottom: 12 }}>
                  This action cannot be undone.
                </ThemedText>
                <View style={styles.confirmButtonRow}>
                  <Button
                    title="Cancel"
                    variant="secondary"
                    size="sm"
                    onPress={() => setShowConfirmDialog(false)}
                    style={{ flex: 1 }}
                  />
                  <Button
                    title="Confirm Delete"
                    variant="danger"
                    size="sm"
                    loading={isDeleting}
                    disabled={isDeleting}
                    onPress={executeDelete}
                    style={{ flex: 1 }}
                  />
                </View>
              </Card>
            ) : null}

            {/* Actions: Edit & Delete */}
            <View style={styles.actionRow}>
              <Button
                title="Edit Subject"
                variant="secondary"
                size="md"
                onPress={() => {
                  onClose();
                  onEdit(subject);
                }}
                style={styles.actionBtn}
              />

              <Button
                title="Delete Subject"
                variant="danger"
                size="md"
                loading={isDeleting}
                disabled={isDeleting}
                onPress={handleDeletePress}
                style={styles.actionBtn}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  sheetContainer: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    borderTopWidth: 1,
    maxHeight: '90%',
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  colorStrip: {
    height: 6,
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.cardPadding,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  colorIndicator: {
    width: 10,
    height: 10,
    borderRadius: BorderRadius.full,
  },
  closeButton: {
    minWidth: MinTouchTarget,
    minHeight: MinTouchTarget,
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIcon: {
    fontSize: 16,
    fontWeight: '700',
  },
  contentScroll: {
    flexGrow: 0,
  },
  content: {
    padding: Spacing.cardPadding,
    gap: Spacing.md,
  },
  errorCard: {
    padding: Spacing.sm,
  },
  subjectName: {
    letterSpacing: -0.3,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  sectionCard: {
    padding: Spacing.cardPadding,
    gap: Spacing.xs,
  },
  sectionTitle: {
    letterSpacing: 0.5,
  },
  descriptionText: {
    lineHeight: 22,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  confirmBox: {
    padding: Spacing.cardPadding,
    gap: Spacing.xs,
  },
  confirmButtonRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  actionBtn: {
    flex: 1,
  },
});
