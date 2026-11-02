import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Input } from '@/components/ui';
import { BorderRadius, MinTouchTarget, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { DeckCreate, validateDeckForm } from '@/types/flashcard';
import { Subject } from '@/types/subject';

export interface DeckFormModalProps {
  visible: boolean;
  deck?: {
    id: string;
    title: string;
    description: string | null;
    subject_id: string | null;
  } | null;
  subjects: Subject[];
  isSaving: boolean;
  onClose: () => void;
  onSave: (payload: DeckCreate) => Promise<void>;
}

function DeckFormContent({
  deck,
  subjects,
  isSaving,
  onClose,
  onSave,
}: DeckFormModalProps) {
  const theme = useTheme();

  const [title, setTitle] = useState(deck?.title || '');
  const [description, setDescription] = useState(deck?.description || '');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(
    deck?.subject_id || null
  );
  const [errors, setErrors] = useState<{ title?: string; description?: string }>({});

  const handleSubmit = async () => {
    const validation = validateDeckForm({ title, description });
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});
    await onSave({
      title: title.trim(),
      description: description.trim() ? description.trim() : null,
      subject_id: selectedSubjectId,
    });
  };

  const isEditing = Boolean(deck);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.modalOverlay}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityLabel="Close dialog backdrop"
      />

      <View
        style={[
          styles.dialogContainer,
          {
            backgroundColor: theme.cardBackground,
            borderColor: theme.borderSubtle,
          },
        ]}>
        {/* Modal Header */}
        <View style={styles.dialogHeader}>
          <View>
            <ThemedText
              type="smallBold"
              style={{ color: theme.brandPrimary, letterSpacing: 0.8 }}>
              {isEditing ? 'UPDATE DECK' : 'NEW FLASHCARD DECK'}
            </ThemedText>
            <ThemedText type="headlineMedium" style={{ marginTop: 2 }}>
              {isEditing ? 'Edit Deck' : 'Create Deck'}
            </ThemedText>
          </View>

          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close modal"
            style={({ pressed }) => [
              styles.closeButton,
              { opacity: pressed ? 0.7 : 1 },
            ]}>
            <ThemedText type="bodyLarge" style={{ color: theme.textSecondary }}>
              ✕
            </ThemedText>
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.formScroll}>
          {/* Deck Title Input */}
          <Input
            label="Deck Title *"
            placeholder="e.g. Neuroscience Terminology"
            value={title}
            onChangeText={(text) => {
              setTitle(text);
              if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
            }}
            error={errors.title}
            autoFocus
            maxLength={200}
          />

          {/* Deck Description Input */}
          <Input
            label="Description (Optional)"
            placeholder="What topics or exam chapters does this deck cover?"
            value={description}
            onChangeText={(text) => {
              setDescription(text);
              if (errors.description)
                setErrors((prev) => ({ ...prev, description: undefined }));
            }}
            error={errors.description}
            multiline
            numberOfLines={3}
            maxLength={2000}
          />

          {/* Subject Selector */}
          <View style={styles.subjectSection}>
            <ThemedText type="smallBold" style={{ color: theme.textSecondary }}>
              LINK TO SUBJECT (OPTIONAL)
            </ThemedText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.subjectChipsRow}>
              {/* No Subject Option */}
              <Pressable
                onPress={() => setSelectedSubjectId(null)}
                accessibilityRole="button"
                accessibilityLabel="No subject"
                style={[
                  styles.subjectChip,
                  {
                    borderColor:
                      selectedSubjectId === null
                        ? theme.brandPrimary
                        : theme.borderSubtle,
                    backgroundColor:
                      selectedSubjectId === null
                        ? theme.brandPrimary + '1A'
                        : theme.inputBackground,
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
                  General / None
                </ThemedText>
              </Pressable>

              {/* User Subject Chips */}
              {subjects.map((sub) => {
                const isSelected = selectedSubjectId === sub.id;
                const chipColor = sub.color || theme.brandPrimary;
                return (
                  <Pressable
                    key={sub.id}
                    onPress={() => setSelectedSubjectId(sub.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Select subject ${sub.name}`}
                    style={[
                      styles.subjectChip,
                      {
                        borderColor: isSelected ? chipColor : theme.borderSubtle,
                        backgroundColor: isSelected
                          ? chipColor + '20'
                          : theme.inputBackground,
                      },
                    ]}>
                    <View
                      style={[
                        styles.subjectDot,
                        { backgroundColor: chipColor },
                      ]}
                    />
                    <ThemedText
                      type="small"
                      style={{
                        color: isSelected ? chipColor : theme.text,
                        fontWeight: isSelected ? '700' : '500',
                      }}>
                      {sub.name}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <Button
            title="Cancel"
            variant="secondary"
            size="md"
            onPress={onClose}
            disabled={isSaving}
            style={{ flex: 1 }}
          />
          <Button
            title={isSaving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Deck'}
            variant="primary"
            size="md"
            onPress={handleSubmit}
            loading={isSaving}
            style={{ flex: 1.5 }}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

export function DeckFormModal(props: DeckFormModalProps) {
  if (!props.visible) {
    return null;
  }

  return (
    <Modal
      visible={props.visible}
      transparent
      animationType="fade"
      onRequestClose={props.onClose}>
      <DeckFormContent key={props.deck?.id || 'new'} {...props} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.screenPadding,
  },
  dialogContainer: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '85%',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
  },
  dialogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  closeButton: {
    width: MinTouchTarget,
    height: MinTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formScroll: {
    gap: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  subjectSection: {
    gap: Spacing.xs,
  },
  subjectChipsRow: {
    gap: Spacing.xs,
    paddingVertical: 4,
  },
  subjectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  subjectDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
  },
});
