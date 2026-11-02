import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
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
import { Button, Card, Input } from '@/components/ui';
import { BorderRadius, MaxContentWidth, MinTouchTarget, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  SUBJECT_COLOR_PRESETS,
  Subject,
  SubjectCreate,
  SubjectUpdate,
  validateSubjectForm,
} from '@/types/subject';

export interface SubjectFormModalProps {
  visible: boolean;
  mode: 'create' | 'edit';
  initialSubject?: Subject | null;
  onClose: () => void;
  onSubmit: (data: SubjectCreate | SubjectUpdate) => Promise<void>;
}

interface SubjectFormContentProps {
  mode: 'create' | 'edit';
  initialSubject?: Subject | null;
  onClose: () => void;
  onSubmit: (data: SubjectCreate | SubjectUpdate) => Promise<void>;
}

function SubjectFormContent({
  mode,
  initialSubject,
  onClose,
  onSubmit,
}: SubjectFormContentProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  const [name, setName] = useState(initialSubject?.name || '');
  const [code, setCode] = useState(initialSubject?.code || '');
  const [description, setDescription] = useState(initialSubject?.description || '');
  const [semester, setSemester] = useState(
    initialSubject?.semester ? String(initialSubject.semester) : ''
  );
  const [color, setColor] = useState(initialSubject?.color || '#4F46E5');

  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    code?: string;
    semester?: string;
    description?: string;
  }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setServerError(null);

    const validation = validateSubjectForm({
      name,
      code,
      semester,
      description,
    });

    if (!validation.isValid) {
      setFieldErrors(validation.errors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const payload: SubjectCreate = {
        name: name.trim(),
        code: code.trim() ? code.trim() : null,
        description: description.trim() ? description.trim() : null,
        semester: semester.trim() ? Number(semester.trim()) : null,
        color,
      };

      await onSubmit(payload);
      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to save subject. Please try again.';
      setServerError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const title = mode === 'create' ? 'Add Subject' : 'Edit Subject';
  const subtitle =
    mode === 'create'
      ? 'Create a new course to organize notes and exams.'
      : 'Update details for this academic subject.';

  return (
    <KeyboardAvoidingView
      style={styles.modalOverlay}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Dismiss subject form"
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
        {/* Color Accent Indicator Strip */}
        <View style={[styles.colorStrip, { backgroundColor: color }]} />

        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.borderSubtle }]}>
          <View style={styles.headerTextGroup}>
            <ThemedText type="headlineMedium" style={styles.headerTitle}>
              {title}
            </ThemedText>
            <ThemedText type="bodySmall" style={{ color: theme.textSecondary }}>
              {subtitle}
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

          {/* Subject Name Input */}
          <Input
            label="Subject Name *"
            placeholder="e.g. Data Structures & Algorithms"
            value={name}
            onChangeText={(text) => {
              setName(text);
              if (fieldErrors.name) {
                setFieldErrors((prev) => ({ ...prev, name: undefined }));
              }
            }}
            error={fieldErrors.name}
            maxLength={150}
            autoFocus={mode === 'create'}
            editable={!isSubmitting}
          />

          {/* Subject Code Input */}
          <Input
            label="Course Code (Optional)"
            placeholder="e.g. CS-301"
            value={code}
            onChangeText={(text) => {
              setCode(text);
              if (fieldErrors.code) {
                setFieldErrors((prev) => ({ ...prev, code: undefined }));
              }
            }}
            error={fieldErrors.code}
            maxLength={50}
            autoCapitalize="characters"
            editable={!isSubmitting}
          />

          {/* Semester Input */}
          <Input
            label="Semester (Optional)"
            placeholder="e.g. 1 to 8"
            value={semester}
            onChangeText={(text) => {
              const clean = text.replace(/[^0-9]/g, '');
              setSemester(clean);
              if (fieldErrors.semester) {
                setFieldErrors((prev) => ({ ...prev, semester: undefined }));
              }
            }}
            error={fieldErrors.semester}
            keyboardType="numeric"
            maxLength={2}
            editable={!isSubmitting}
          />

          {/* Color Swatch Selector */}
          <View style={styles.colorGroup}>
            <ThemedText type="titleMedium" style={styles.colorLabel}>
              Color Theme
            </ThemedText>
            <ThemedText type="bodySmall" style={{ color: theme.textSecondary, marginBottom: Spacing.xs }}>
              Choose a color tag to organize this course and related notes.
            </ThemedText>
            <View style={styles.colorPalette}>
              {SUBJECT_COLOR_PRESETS.map((preset) => {
                const isSelected = color === preset.hex;
                return (
                  <Pressable
                    key={preset.hex}
                    onPress={() => setColor(preset.hex)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel={`${preset.name} color`}
                    accessibilityState={{ selected: isSelected }}
                    style={({ pressed }) => [
                      styles.colorSwatch,
                      {
                        backgroundColor: preset.hex,
                        borderColor: isSelected ? theme.text : 'transparent',
                        opacity: pressed ? 0.8 : 1,
                      },
                      isSelected && styles.colorSwatchSelected,
                    ]}>
                    {isSelected ? <View style={styles.colorCheckmark} /> : null}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Description Input */}
          <Input
            label="Description & Syllabus (Optional)"
            placeholder="Key syllabus topics, textbook references, lecture room..."
            value={description}
            onChangeText={(text) => {
              setDescription(text);
              if (fieldErrors.description) {
                setFieldErrors((prev) => ({ ...prev, description: undefined }));
              }
            }}
            error={fieldErrors.description}
            multiline
            numberOfLines={3}
            maxLength={2000}
            editable={!isSubmitting}
          />

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
              title={mode === 'create' ? 'Create Subject' : 'Save Changes'}
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

export function SubjectFormModal({
  visible,
  mode,
  initialSubject,
  onClose,
  onSubmit,
}: SubjectFormModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}>
      {visible ? (
        <SubjectFormContent
          key={`${mode}-${initialSubject?.id || 'new'}`}
          mode={mode}
          initialSubject={initialSubject}
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
  headerTextGroup: {
    flex: 1,
    gap: 2,
    marginRight: Spacing.sm,
  },
  headerTitle: {
    fontWeight: '700',
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
  colorGroup: {
    gap: 2,
  },
  colorLabel: {
    fontWeight: '600',
  },
  colorPalette: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: 2,
  },
  colorSwatch: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  colorSwatchSelected: {
    borderWidth: 3,
    transform: [{ scale: 1.08 }],
  },
  colorCheckmark: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
  },
});
