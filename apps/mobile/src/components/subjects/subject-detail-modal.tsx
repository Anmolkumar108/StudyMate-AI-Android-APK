import { useRouter } from 'expo-router';
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
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Subject } from '@/types/subject';

export interface SubjectDetailModalProps {
  subject: Subject | null;
  visible: boolean;
  onClose: () => void;
  onEdit: (subject: Subject) => void;
  onDelete: (subjectId: string) => Promise<void>;
}

function getSubjectInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function SubjectDetailModal({
  subject,
  visible,
  onClose,
  onEdit,
  onDelete,
}: SubjectDetailModalProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  if (!subject) {
    return null;
  }

  const subjectColor = subject.color || '#8B5CF6';
  const initials = getSubjectInitials(subject.name);

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
              paddingBottom: Math.max(insets.bottom, Spacing.md),
            },
          ]}>
          {/* Top Color Accent Strip */}
          <View
            style={[
              styles.colorStrip,
              { backgroundColor: subjectColor, shadowColor: subjectColor },
            ]}
          />

          {/* Modal Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleContainer}>
              <View style={[styles.colorIndicator, { backgroundColor: subjectColor }]} />
              <ThemedText
                type="smallBold"
                style={{ color: '#C084FC', letterSpacing: 0.8 }}>
                SUBJECT DETAILS
              </ThemedText>
            </View>

            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close subject details"
              style={({ pressed }) => [
                styles.closeButton,
                pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] },
              ]}>
              <Text style={styles.closeIcon}>✕</Text>
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

            {/* Hero Card Banner */}
            <View
              style={[
                styles.heroBanner,
                {
                  borderColor: `${subjectColor}44`,
                  shadowColor: subjectColor,
                },
              ]}>
              <View
                style={[
                  styles.heroAvatar,
                  { backgroundColor: `${subjectColor}25`, borderColor: `${subjectColor}66` },
                ]}>
                <Text style={[styles.heroAvatarText, { color: subjectColor }]}>
                  {initials}
                </Text>
              </View>

              <View style={styles.heroTextGroup}>
                <ThemedText type="headlineLarge" style={styles.subjectName}>
                  {subject.name}
                </ThemedText>
                {subject.code ? (
                  <Text style={[styles.heroCode, { color: subjectColor }]}>
                    {subject.code}
                  </Text>
                ) : null}
              </View>
            </View>

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

            {/* Quick Action Navigation Chips */}
            <View style={styles.shortcutRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.shortcutCard,
                  pressed && styles.shortcutCardPressed,
                ]}
                onPress={() => {
                  onClose();
                  router.push('/timetable' as never);
                }}>
                <Text style={styles.shortcutIcon}>📅</Text>
                <View style={styles.shortcutTextGroup}>
                  <Text style={styles.shortcutTitle}>Class Schedule</Text>
                  <Text style={styles.shortcutSubtitle}>Check lectures & room</Text>
                </View>
                <Text style={styles.shortcutArrow}>→</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.shortcutCard,
                  pressed && styles.shortcutCardPressed,
                ]}
                onPress={() => {
                  onClose();
                  router.push('/notes' as never);
                }}>
                <Text style={styles.shortcutIcon}>📝</Text>
                <View style={styles.shortcutTextGroup}>
                  <Text style={styles.shortcutTitle}>Course Notes</Text>
                  <Text style={styles.shortcutSubtitle}>View & revise Cornell notes</Text>
                </View>
                <Text style={styles.shortcutArrow}>→</Text>
              </Pressable>
            </View>

            {/* Description & Syllabus Section */}
            <Card variant="default" style={styles.sectionCard}>
              <ThemedText
                type="smallBold"
                style={[styles.sectionTitle, { color: '#C084FC' }]}>
                DESCRIPTION & SYLLABUS
              </ThemedText>
              <ThemedText
                type="bodyMedium"
                style={[styles.descriptionText, { color: '#E2E8F0' }]}>
                {subject.description || 'No description provided for this subject.'}
              </ThemedText>
            </Card>

            {/* Academic Timeline Card */}
            <Card variant="default" style={styles.sectionCard}>
              <ThemedText
                type="smallBold"
                style={[styles.sectionTitle, { color: '#C084FC' }]}>
                ACADEMIC TIMELINE
              </ThemedText>
              <View style={styles.timelineRow}>
                <ThemedText type="bodySmall" style={{ color: '#94A3B8' }}>
                  Enrolled / Created
                </ThemedText>
                <ThemedText type="bodySmall" style={{ color: '#FFFFFF', fontWeight: '700' }}>
                  {createdDate}
                </ThemedText>
              </View>
              {updatedDate && updatedDate !== createdDate ? (
                <View style={styles.timelineRow}>
                  <ThemedText type="bodySmall" style={{ color: '#94A3B8' }}>
                    Last Modified
                  </ThemedText>
                  <ThemedText type="bodySmall" style={{ color: '#FFFFFF', fontWeight: '700' }}>
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
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  sheetContainer: {
    backgroundColor: '#0F1528',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1.5,
    borderColor: 'rgba(139, 92, 246, 0.35)',
    maxHeight: '92%',
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    overflow: 'hidden',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 18,
    elevation: 12,
  },
  colorStrip: {
    height: 5,
    width: '100%',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.cardPadding,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  colorIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIcon: {
    fontSize: 14,
    fontWeight: '700',
    color: '#E2E8F0',
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

  // Hero Card
  heroBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(16, 24, 48, 0.85)',
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  heroAvatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroAvatarText: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  heroTextGroup: {
    flex: 1,
    gap: 2,
  },
  subjectName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  heroCode: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },

  // Shortcuts
  shortcutRow: {
    gap: 10,
  },
  shortcutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 12,
    gap: 12,
  },
  shortcutCardPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    transform: [{ scale: 0.98 }],
  },
  shortcutIcon: {
    fontSize: 20,
  },
  shortcutTextGroup: {
    flex: 1,
    gap: 1,
  },
  shortcutTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  shortcutSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
  },
  shortcutArrow: {
    color: '#C084FC',
    fontSize: 16,
    fontWeight: '800',
  },

  sectionCard: {
    padding: Spacing.cardPadding,
    gap: Spacing.xs,
    backgroundColor: 'rgba(16, 24, 48, 0.75)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  sectionTitle: {
    letterSpacing: 0.8,
  },
  descriptionText: {
    lineHeight: 22,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  confirmBox: {
    padding: Spacing.cardPadding,
    gap: Spacing.xs,
    borderRadius: 16,
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
