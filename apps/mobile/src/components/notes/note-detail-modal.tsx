import React, { useMemo, useState } from 'react';
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
import { Note } from '@/types/note';
import { Subject } from '@/types/subject';

export interface NoteDetailModalProps {
  visible: boolean;
  note: Note | null;
  subject?: Subject | null;
  onClose: () => void;
  onEdit: (note: Note) => void;
  onTogglePin: (noteId: string) => Promise<void>;
  onDelete: (noteId: string) => Promise<void>;
}

export function NoteDetailModal({
  visible,
  note,
  subject,
  onClose,
  onEdit,
  onTogglePin,
  onDelete,
}: NoteDetailModalProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  const [isDeleting, setIsDeleting] = useState(false);
  const [isTogglingPin, setIsTogglingPin] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Note metrics for student reading
  const noteContent = note?.content;
  const metrics = useMemo(() => {
    if (!noteContent) return { words: 0, characters: 0, readMinutes: 1 };
    const text = noteContent.trim();
    const words = text.split(/\s+/).filter(Boolean).length;
    const characters = text.length;
    const readMinutes = Math.max(1, Math.ceil(words / 200));
    return { words, characters, readMinutes };
  }, [noteContent]);

  if (!note) {
    return null;
  }

  const subjectColor = subject?.color || theme.brandPrimary;
  const createdDate = new Date(note.created_at).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const updatedDate = new Date(note.updated_at).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const handleTogglePin = async () => {
    setIsTogglingPin(true);
    try {
      await onTogglePin(note.id);
    } catch {
      Alert.alert('Error', 'Failed to update pin status. Please try again.');
    } finally {
      setIsTogglingPin(false);
    }
  };

  const executeDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(note.id);
      setShowConfirmDialog(false);
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to delete note. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDelete = () => {
    if (Platform.OS === 'web') {
      setShowConfirmDialog(true);
    } else {
      Alert.alert(
        'Delete Note?',
        `Are you sure you want to delete "${note.title}"? This action cannot be undone.`,
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
          {/* Top Sheet Handle */}
          <View style={styles.handleContainer}>
            <View
              style={[
                styles.handleBar,
                { backgroundColor: theme.borderSubtle },
              ]}
            />
          </View>

          {/* Top Subject / Pin Color Strip */}
          <View
            style={[
              styles.colorStrip,
              {
                backgroundColor: note.is_pinned
                  ? theme.statusWarning
                  : subjectColor,
              },
            ]}
          />

          {/* Modal Header */}
          <View style={[styles.header, { borderBottomColor: theme.borderSubtle }]}>
            <View style={styles.headerTitleContainer}>
              <View
                style={[
                  styles.colorIndicator,
                  {
                    backgroundColor: note.is_pinned
                      ? theme.statusWarning
                      : subjectColor,
                  },
                ]}
              />
              <ThemedText
                type="smallBold"
                style={{ color: theme.brandPrimary, letterSpacing: 0.6 }}>
                NOTE DETAILS
              </ThemedText>
            </View>

            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close note details"
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
            {/* Note Title */}
            <ThemedText type="headlineLarge" style={styles.noteTitle}>
              {note.title}
            </ThemedText>

            {/* Badges & Reading Metrics Row */}
            <View style={styles.tagRow}>
              {note.is_pinned ? (
                <Badge label="📌 Pinned to Top" variant="warning" size="md" />
              ) : null}

              {subject ? (
                <Badge
                  label={subject.name}
                  dotColor={subjectColor}
                  variant="brand"
                  size="md"
                />
              ) : (
                <Badge label="General Note" variant="neutral" size="md" />
              )}

              <View
                style={[
                  styles.readingTimePill,
                  {
                    backgroundColor: theme.badgeNeutralBackground,
                    borderColor: theme.borderSubtle,
                  },
                ]}>
                <ThemedText
                  type="small"
                  style={{ color: theme.textSecondary, fontSize: 11 }}>
                  📖 ~{metrics.readMinutes} min read
                </ThemedText>
              </View>
            </View>

            {/* Content Card */}
            <Card variant="default" style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <ThemedText
                  type="smallBold"
                  style={[styles.sectionTitle, { color: theme.textSecondary }]}>
                  NOTE CONTENT
                </ThemedText>
                <ThemedText
                  type="bodySmall"
                  style={{ color: theme.textTertiary, fontSize: 11 }}>
                  {metrics.words} words • {metrics.characters} chars
                </ThemedText>
              </View>

              <ThemedText
                type="bodyMedium"
                selectable
                style={[styles.bodyText, { color: theme.text }]}>
                {note.content}
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
                  Created
                </ThemedText>
                <ThemedText type="bodySmall" style={{ color: theme.text, fontWeight: '600' }}>
                  {createdDate}
                </ThemedText>
              </View>
              {updatedDate !== createdDate ? (
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
                  Are you sure you want to delete this note?
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

            {/* Actions: Pin, Edit, Delete */}
            <View style={styles.actionRow}>
              <Button
                title={note.is_pinned ? 'Unpin' : 'Pin to Top'}
                variant="secondary"
                size="md"
                loading={isTogglingPin}
                disabled={isTogglingPin}
                onPress={handleTogglePin}
                style={{ flex: 1 }}
              />

              <Button
                title="Edit Note"
                variant="secondary"
                size="md"
                onPress={() => {
                  onClose();
                  onEdit(note);
                }}
                style={{ flex: 1 }}
              />

              <Button
                title="Delete Note"
                variant="danger"
                size="md"
                loading={isDeleting}
                disabled={isDeleting}
                onPress={handleDelete}
                style={{ flex: 1 }}
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
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  handleBar: {
    width: 38,
    height: 4,
    borderRadius: BorderRadius.full,
  },
  colorStrip: {
    height: 5,
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.cardPadding,
    paddingVertical: Spacing.xs,
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
  noteTitle: {
    letterSpacing: -0.3,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  readingTimePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sectionCard: {
    padding: Spacing.cardPadding,
    gap: Spacing.xs,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionTitle: {
    letterSpacing: 0.5,
  },
  bodyText: {
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
});
