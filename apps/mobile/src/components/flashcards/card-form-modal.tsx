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
import { CardCreate, Flashcard, validateCardForm } from '@/types/flashcard';

export interface CardFormModalProps {
  visible: boolean;
  card?: Flashcard | null;
  isSaving: boolean;
  onClose: () => void;
  onSave: (payload: CardCreate) => Promise<void>;
}

function CardFormContent({
  card,
  isSaving,
  onClose,
  onSave,
}: CardFormModalProps) {
  const theme = useTheme();

  const [question, setQuestion] = useState(card?.question || '');
  const [answer, setAnswer] = useState(card?.answer || '');
  const [errors, setErrors] = useState<{ question?: string; answer?: string }>({});

  const handleSubmit = async () => {
    const validation = validateCardForm({ question, answer });
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});
    await onSave({
      question: question.trim(),
      answer: answer.trim(),
    });
  };

  const isEditing = Boolean(card);

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
        {/* Header */}
        <View style={styles.dialogHeader}>
          <View>
            <ThemedText
              type="smallBold"
              style={{ color: theme.brandPrimary, letterSpacing: 0.8 }}>
              {isEditing ? 'UPDATE FLASHCARD' : 'NEW FLASHCARD'}
            </ThemedText>
            <ThemedText type="headlineMedium" style={{ marginTop: 2 }}>
              {isEditing ? 'Edit Card' : 'Add Card'}
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
          {/* Question Input */}
          <Input
            label="Question / Front *"
            placeholder="e.g. What is Amdahl's Law?"
            value={question}
            onChangeText={(text) => {
              setQuestion(text);
              if (errors.question)
                setErrors((prev) => ({ ...prev, question: undefined }));
            }}
            error={errors.question}
            multiline
            numberOfLines={3}
            autoFocus
            maxLength={2000}
          />

          {/* Answer Input */}
          <Input
            label="Answer / Back *"
            placeholder="e.g. A formula giving the theoretical speedup in latency of an execution task with fixed workload."
            value={answer}
            onChangeText={(text) => {
              setAnswer(text);
              if (errors.answer)
                setErrors((prev) => ({ ...prev, answer: undefined }));
            }}
            error={errors.answer}
            multiline
            numberOfLines={4}
            maxLength={2000}
          />
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
            title={isSaving ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Card'}
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

export function CardFormModal(props: CardFormModalProps) {
  if (!props.visible) {
    return null;
  }

  return (
    <Modal
      visible={props.visible}
      transparent
      animationType="fade"
      onRequestClose={props.onClose}>
      <CardFormContent key={props.card?.id || 'new'} {...props} />
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
  actionButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
  },
});
