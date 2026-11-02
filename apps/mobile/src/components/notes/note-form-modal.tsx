import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Input } from '@/components/ui';
import { BorderRadius, MaxContentWidth, MinTouchTarget, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Note, NoteCreate, NoteUpdate, validateNoteForm } from '@/types/note';
import { Subject } from '@/types/subject';

export interface NoteFormModalProps {
  visible: boolean;
  mode: 'create' | 'edit';
  initialNote?: Note | null;
  subjects: Subject[];
  onClose: () => void;
  onSubmit: (data: NoteCreate | NoteUpdate) => Promise<void>;
}

interface NoteFormContentProps {
  mode: 'create' | 'edit';
  initialNote?: Note | null;
  subjects: Subject[];
  onClose: () => void;
  onSubmit: (data: NoteCreate | NoteUpdate) => Promise<void>;
}

function NoteFormContent({
  mode,
  initialNote,
  subjects,
  onClose,
  onSubmit,
}: NoteFormContentProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  const [title, setTitle] = useState(initialNote?.title || '');
  const [content, setContent] = useState(initialNote?.content || '');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(
    initialNote?.subject_id || null
  );
  const [isPinned, setIsPinned] = useState<boolean>(initialNote?.is_pinned || false);

  const [fieldErrors, setFieldErrors] = useState<{
    title?: string;
    content?: string;
  }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Content metrics
  const contentWordCount = useMemo(() => {
    if (!content) return 0;
    return content.trim().split(/\s+/).filter(Boolean).length;
  }, [content]);

  const handleSubmit = async () => {
    setServerError(null);

    const validation = validateNoteForm({
      title,
      content,
    });

    if (!validation.isValid) {
      setFieldErrors(validation.errors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const payload: NoteCreate | NoteUpdate = {
        title: title.trim(),
        content: content.trim(),
        subject_id: selectedSubjectId,
        is_pinned: isPinned,
      };

      await onSubmit(payload);
      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to save note. Please try again.';
      setServerError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalTitle = mode === 'create' ? 'Create Note' : 'Edit Note';
  const modalSubtitle =
    mode === 'create'
      ? 'Record lecture summaries, exam formulas, or key concepts.'
      : 'Update your study notes and references.';

  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId);
  const accentColor =
    selectedSubject?.color || (isPinned ? theme.statusWarning : theme.brandPrimary);

  return (
    <KeyboardAvoidingView
      style={styles.modalOverlay}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Dismiss note form"
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

        {/* Accent Strip */}
        <View style={[styles.colorStrip, { backgroundColor: accentColor }]} />

        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.borderSubtle }]}>
          <View style={styles.headerTextGroup}>
            <ThemedText type="headlineMedium" style={styles.headerTitle}>
              {modalTitle}
            </ThemedText>
            <ThemedText type="bodySmall" style={{ color: theme.textSecondary }}>
              {modalSubtitle}
            </ThemedText>
          </View>

          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close form"
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
          style={styles.formScroll}
          contentContainerStyle={styles.formContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {/* Server Error Banner */}
          {serverError ? (
            <Card variant="outlined" style={[styles.errorCard, { borderColor: theme.statusDanger }]}>
              <ThemedText
                type="bodyMedium"
                style={{ color: theme.statusDanger, fontWeight: '500' }}>
                {serverError}
              </ThemedText>
            </Card>
          ) : null}

          {/* Note Title Input with Counter */}
          <View style={styles.inputWrapper}>
            <Input
              label="Note Title *"
              placeholder="e.g. Binary Search Trees & AVL Rotations"
              value={title}
              onChangeText={(text) => {
                setTitle(text);
                if (fieldErrors.title) {
                  setFieldErrors((prev) => ({ ...prev, title: undefined }));
                }
              }}
              error={fieldErrors.title}
              maxLength={255}
              autoFocus={mode === 'create'}
              editable={!isSubmitting}
            />
            <ThemedText
              type="bodySmall"
              style={[
                styles.charCounter,
                {
                  color:
                    title.length >= 240
                      ? theme.statusWarning
                      : theme.textTertiary,
                },
              ]}>
              {title.length}/255
            </ThemedText>
          </View>

          {/* Subject Linker Selector */}
          <View style={styles.subjectSelectorGroup}>
            <ThemedText type="titleMedium" style={styles.groupLabel}>
              Linked Academic Subject
            </ThemedText>
            <ThemedText type="bodySmall" style={{ color: theme.textSecondary, marginBottom: Spacing.xs }}>
              Assigning a course organizes notes and powers contextual AI synthesis.
            </ThemedText>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.subjectChipsRow}>
              {/* No Subject option */}
              <Pressable
                onPress={() => setSelectedSubjectId(null)}
                accessibilityRole="button"
                accessibilityLabel="General, no subject assigned"
                style={({ pressed }) => [
                  styles.subjectChip,
                  {
                    backgroundColor:
                      selectedSubjectId === null
                        ? theme.badgeBrandBackground
                        : theme.cardBackground,
                    borderColor:
                      selectedSubjectId === null
                        ? theme.brandPrimary
                        : theme.borderSubtle,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}>
                <ThemedText
                  type="small"
                  style={{
                    color:
                      selectedSubjectId === null
                        ? theme.brandPrimary
                        : theme.textSecondary,
                    fontWeight: selectedSubjectId === null ? '700' : '500',
                  }}>
                  General (No Subject)
                </ThemedText>
              </Pressable>

              {/* Enrolled Subject items */}
              {subjects.map((sub) => {
                const isSelected = selectedSubjectId === sub.id;
                const dotColor = sub.color || theme.brandPrimary;
                return (
                  <Pressable
                    key={sub.id}
                    onPress={() => setSelectedSubjectId(sub.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Select subject ${sub.name}`}
                    style={({ pressed }) => [
                      styles.subjectChip,
                      {
                        backgroundColor: isSelected
                          ? theme.badgeBrandBackground
                          : theme.cardBackground,
                        borderColor: isSelected
                          ? theme.brandPrimary
                          : theme.borderSubtle,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}>
                    <View
                      style={[
                        styles.chipDot,
                        { backgroundColor: dotColor },
                      ]}
                    />
                    <ThemedText
                      type="small"
                      style={{
                        color: isSelected
                          ? theme.brandPrimary
                          : theme.textSecondary,
                        fontWeight: isSelected ? '700' : '500',
                      }}>
                      {sub.name}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Pinned to Top Switch Card */}
          <Card variant="outlined" style={styles.pinToggleCard}>
            <View style={styles.pinTextGroup}>
              <View style={styles.pinTitleRow}>
                <Text style={{ fontSize: 16 }}>📌</Text>
                <ThemedText type="titleMedium">Pin to Top</ThemedText>
              </View>
              <ThemedText type="bodySmall" style={{ color: theme.textSecondary }}>
                Keep this note at the top of your workspace for priority revision.
              </ThemedText>
            </View>
            <Switch
              value={isPinned}
              onValueChange={setIsPinned}
              trackColor={{
                false: theme.borderSubtle,
                true: theme.statusWarning,
              }}
              thumbColor={Platform.OS === 'android' ? (isPinned ? '#FFFFFF' : '#F4F3F4') : undefined}
            />
          </Card>

          {/* Note Content Input with Word Counter */}
          <View style={styles.inputWrapper}>
            <Input
              label="Note Content *"
              placeholder="Type your lecture notes, equations, summaries, or questions..."
              value={content}
              onChangeText={(text) => {
                setContent(text);
                if (fieldErrors.content) {
                  setFieldErrors((prev) => ({ ...prev, content: undefined }));
                }
              }}
              error={fieldErrors.content}
              multiline
              numberOfLines={8}
              inputBoxStyle={{ minHeight: 140 }}
              editable={!isSubmitting}
            />
            {contentWordCount > 0 ? (
              <ThemedText
                type="bodySmall"
                style={[styles.charCounter, { color: theme.textTertiary }]}>
                {contentWordCount} {contentWordCount === 1 ? 'word' : 'words'}
              </ThemedText>
            ) : null}
          </View>

          {/* Form Actions */}
          <View style={styles.buttonRow}>
            <Button
              title="Cancel"
              variant="secondary"
              size="lg"
              disabled={isSubmitting}
              onPress={onClose}
              style={{ flex: 1 }}
            />

            <Button
              title={mode === 'create' ? 'Create Note' : 'Save Changes'}
              variant="primary"
              size="lg"
              loading={isSubmitting}
              disabled={isSubmitting}
              onPress={handleSubmit}
              style={{ flex: 1.5 }}
            />
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

export function NoteFormModal({
  visible,
  mode,
  initialNote,
  subjects,
  onClose,
  onSubmit,
}: NoteFormModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}>
      {visible ? (
        <NoteFormContent
          key={`${mode}-${initialNote?.id || 'new'}`}
          mode={mode}
          initialNote={initialNote}
          subjects={subjects}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      ) : null}
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
    maxHeight: '92%',
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
  headerTextGroup: {
    flex: 1,
    gap: 2,
    marginRight: Spacing.sm,
  },
  headerTitle: {
    fontWeight: '700',
    letterSpacing: -0.2,
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
  formScroll: {
    flexGrow: 0,
  },
  formContent: {
    padding: Spacing.cardPadding,
    gap: Spacing.md,
  },
  errorCard: {
    padding: Spacing.sm,
  },
  inputWrapper: {
    position: 'relative',
  },
  charCounter: {
    fontSize: 11,
    textAlign: 'right',
    marginTop: 4,
    marginRight: 4,
  },
  subjectSelectorGroup: {
    gap: 2,
  },
  groupLabel: {
    fontWeight: '600',
  },
  subjectChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: 4,
  },
  subjectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    minHeight: 40,
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: BorderRadius.full,
  },
  pinToggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.cardPadding,
    gap: Spacing.sm,
  },
  pinTextGroup: {
    flex: 1,
    gap: 2,
  },
  pinTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
  },
});
