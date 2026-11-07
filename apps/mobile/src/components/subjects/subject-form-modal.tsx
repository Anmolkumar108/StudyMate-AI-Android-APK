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
import { MaxContentWidth, Spacing } from '@/constants/theme';
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
  const [color, setColor] = useState(initialSubject?.color || '#8B5CF6');

  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    code?: string;
    semester?: string;
    description?: string;
  }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Compute initials for live preview
  const previewInitials = React.useMemo(() => {
    if (!name.trim()) return 'CS';
    const words = name.trim().split(/\s+/);
    if (words.length >= 2 && words[0] && words[1]) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }, [name]);

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
      ? 'Create a new course to organize notes, syllabus & schedule.'
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
            paddingBottom: Math.max(insets.bottom, Spacing.md),
          },
        ]}>
        {/* Color Accent Indicator Strip */}
        <View style={[styles.colorStrip, { backgroundColor: color, shadowColor: color }]} />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTextGroup}>
            <View style={styles.headerPillRow}>
              <View style={[styles.headerDot, { backgroundColor: color }]} />
              <ThemedText type="smallBold" style={{ color: '#C084FC', letterSpacing: 0.8 }}>
                {mode === 'create' ? 'NEW COURSE' : 'COURSE SETTINGS'}
              </ThemedText>
            </View>
            <ThemedText type="headlineMedium" style={styles.headerTitle}>
              {title}
            </ThemedText>
            <ThemedText type="bodySmall" style={styles.headerSubtitle}>
              {subtitle}
            </ThemedText>
          </View>

          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close form"
            style={({ pressed }) => [
              styles.closeButton,
              pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] },
            ]}>
            <Text style={styles.closeIcon}>✕</Text>
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

          {/* ========================================================================= */}
          {/* LIVE SUBJECT CARD PREVIEW                                                */}
          {/* ========================================================================= */}
          <View style={styles.previewContainer}>
            <View style={styles.previewLabelRow}>
              <Text style={styles.previewSparkle}>✨</Text>
              <Text style={styles.previewLabel}>LIVE CARD PREVIEW</Text>
            </View>
            <View
              style={[
                styles.previewCard,
                {
                  borderColor: `${color}55`,
                  shadowColor: color,
                },
              ]}>
              <View style={[styles.previewBar, { backgroundColor: color }]} />
              <View style={styles.previewInner}>
                <View style={styles.previewTopRow}>
                  <View style={styles.previewAvatarGroup}>
                    <View
                      style={[
                        styles.previewAvatar,
                        { backgroundColor: `${color}25`, borderColor: `${color}60` },
                      ]}>
                      <Text style={[styles.previewAvatarText, { color }]}>
                        {previewInitials}
                      </Text>
                    </View>
                    <View style={styles.previewBadges}>
                      {code.trim() ? (
                        <View style={styles.previewMiniBadge}>
                          <Text style={styles.previewMiniBadgeText}>
                            {code.trim().toUpperCase()}
                          </Text>
                        </View>
                      ) : null}
                      {semester.trim() ? (
                        <View style={styles.previewMiniBadge}>
                          <Text style={styles.previewMiniBadgeText}>
                            Sem {semester.trim()}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  <View style={[styles.previewDot, { backgroundColor: color }]} />
                </View>

                <Text style={styles.previewTitle} numberOfLines={1}>
                  {name.trim() || 'Your Subject Name'}
                </Text>

                <Text style={styles.previewDesc} numberOfLines={1}>
                  {description.trim() || 'Course syllabus, lecture room & notes summary...'}
                </Text>
              </View>
            </View>
          </View>

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
            <View style={styles.colorLabelRow}>
              <ThemedText type="titleMedium" style={styles.colorLabel}>
                Color Theme & Accent
              </ThemedText>
              <View style={[styles.activeColorPill, { backgroundColor: `${color}25`, borderColor: `${color}60` }]}>
                <View style={[styles.activeColorDot, { backgroundColor: color }]} />
                <Text style={[styles.activeColorText, { color }]}>Selected</Text>
              </View>
            </View>
            <ThemedText type="bodySmall" style={styles.colorHelper}>
              Pick an energetic neon hue to highlight this course and related timetable cards.
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
                        shadowColor: preset.hex,
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
  headerTextGroup: {
    flex: 1,
    gap: 3,
    marginRight: Spacing.sm,
  },
  headerPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  headerTitle: {
    fontWeight: '800',
    color: '#FFFFFF',
    fontSize: 20,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
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

  // Live Preview
  previewContainer: {
    gap: 8,
  },
  previewLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  previewSparkle: {
    fontSize: 12,
  },
  previewLabel: {
    color: '#A78BFA',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  previewCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(16, 24, 48, 0.85)',
    borderRadius: 16,
    borderWidth: 1.2,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  previewBar: {
    width: 5,
    alignSelf: 'stretch',
  },
  previewInner: {
    flex: 1,
    padding: 12,
    gap: 4,
  },
  previewTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewAvatarGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewAvatar: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewAvatarText: {
    fontSize: 11,
    fontWeight: '800',
  },
  previewBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  previewMiniBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  previewMiniBadgeText: {
    color: '#E2E8F0',
    fontSize: 10,
    fontWeight: '700',
  },
  previewDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  previewTitle: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  previewDesc: {
    color: '#94A3B8',
    fontSize: 12,
  },

  // Color Swatch
  colorGroup: {
    gap: 4,
  },
  colorLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  colorLabel: {
    fontWeight: '700',
    color: '#F1F5F9',
  },
  activeColorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  activeColorDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  activeColorText: {
    fontSize: 11,
    fontWeight: '700',
  },
  colorHelper: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 4,
  },
  colorPalette: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 4,
  },
  colorSwatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 3,
  },
  colorSwatchSelected: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.12 }],
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 6,
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
