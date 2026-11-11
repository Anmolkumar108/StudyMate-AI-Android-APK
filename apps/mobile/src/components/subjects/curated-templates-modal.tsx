import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Badge, Button, Card, EmptyState, Input } from '@/components/ui';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  MobileSubjectTemplate,
  subjectTemplateApi,
} from '@/services/api/client';

export interface CuratedTemplatesModalProps {
  visible: boolean;
  onClose: () => void;
  onEnrolled: (subjectName: string) => void;
}

export function CuratedTemplatesModal({
  visible,
  onClose,
  onEnrolled,
}: CuratedTemplatesModalProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<MobileSubjectTemplate[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [enrollingId, setEnrollingId] = useState<string | null>(null);

  // Fetch templates when modal becomes visible
  useEffect(() => {
    if (visible) {
      loadTemplates();
    }
  }, [visible]);

  const loadTemplates = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await subjectTemplateApi.list();
      setTemplates(result.items || []);
      setCategories(result.categories || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load curriculum templates.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredTemplates = useMemo(() => {
    let result = templates;

    if (selectedCategory !== 'all') {
      result = result.filter(
        (t) => t.category.toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          (t.code && t.code.toLowerCase().includes(q)) ||
          (t.description && t.description.toLowerCase().includes(q))
      );
    }

    return result;
  }, [templates, selectedCategory, searchQuery]);

  const handleEnroll = async (template: MobileSubjectTemplate) => {
    setEnrollingId(template.id);
    try {
      const res = await subjectTemplateApi.enroll(template.id);
      Alert.alert(
        'Enrolled Successfully! 🎓',
        `"${res.name}" has been added to your academic course list with standard curriculum units.`,
        [
          {
            text: 'View Courses',
            onPress: () => {
              onEnrolled(res.name);
              onClose();
            },
          },
        ]
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not enroll in this course template.';
      Alert.alert('Enrollment Error', msg);
    } finally {
      setEnrollingId(null);
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
          accessibilityLabel="Dismiss templates backdrop"
        />

        <View
          style={[
            styles.sheetContainer,
            {
              paddingBottom: Math.max(insets.bottom, Spacing.md),
            },
          ]}>
          {/* Header Accent Strip */}
          <View style={styles.colorStrip} />

          {/* Modal Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleContainer}>
              <View style={styles.curatedBadge}>
                <Text style={styles.curatedBadgeIcon}>🎓</Text>
              </View>
              <View style={styles.headerTextGroup}>
                <View style={styles.tagRow}>
                  <ThemedText
                    type="smallBold"
                    style={{ color: '#C084FC', letterSpacing: 0.8 }}>
                    ACADEMIC TEMPLATE LIBRARY
                  </ThemedText>
                  <Badge
                    label={`${templates.length} Curricula`}
                    variant="brand"
                    size="sm"
                  />
                </View>
                <ThemedText type="headlineMedium" style={styles.modalTitle}>
                  Curated Courses
                </ThemedText>
              </View>
            </View>

            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close templates library"
              style={({ pressed }) => [
                styles.closeButton,
                pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] },
              ]}>
              <Text style={styles.closeIcon}>✕</Text>
            </Pressable>
          </View>

          <ThemedText type="bodySmall" style={styles.headerSubtitle}>
            1-Click enroll into standard accredited university curricula with recommended study units.
          </ThemedText>

          {/* Search bar */}
          <Input
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search university curriculum by name or code..."
            showClearButton
            onClear={() => setSearchQuery('')}
            leftElement={<Text style={styles.searchIcon}>🔍</Text>}
            containerStyle={styles.searchContainer}
          />

          {/* Category Filter Pills */}
          {categories.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterPillsRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.filterPill,
                  selectedCategory === 'all' && styles.filterPillActive,
                  pressed && { opacity: 0.8 },
                ]}
                onPress={() => setSelectedCategory('all')}>
                <Text
                  style={[
                    styles.filterPillText,
                    selectedCategory === 'all' && styles.filterPillTextActive,
                  ]}>
                  All ({templates.length})
                </Text>
              </Pressable>

              {categories.map((cat) => {
                const count = templates.filter(
                  (t) => t.category.toLowerCase() === cat.toLowerCase()
                ).length;
                const isActive = selectedCategory.toLowerCase() === cat.toLowerCase();
                return (
                  <Pressable
                    key={`cat-${cat}`}
                    style={({ pressed }) => [
                      styles.filterPill,
                      isActive && styles.filterPillActive,
                      pressed && { opacity: 0.8 },
                    ]}
                    onPress={() => setSelectedCategory(cat)}>
                    <Text
                      style={[
                        styles.filterPillText,
                        isActive && styles.filterPillTextActive,
                      ]}>
                      {cat} ({count})
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          {/* Content Area */}
          {isLoading ? (
            <View style={styles.centerLoading}>
              <ActivityIndicator size="large" color="#8B5CF6" />
              <ThemedText
                type="bodyMedium"
                style={{ color: '#94A3B8', marginTop: Spacing.md }}>
                Loading university curriculum library...
              </ThemedText>
            </View>
          ) : error ? (
            <Card variant="outlined" style={[styles.errorCard, { borderColor: theme.statusDanger }]}>
              <ThemedText
                type="bodyMedium"
                style={{ color: theme.statusDanger, flex: 1 }}>
                {error}
              </ThemedText>
              <Button
                title="Retry"
                size="sm"
                variant="secondary"
                onPress={loadTemplates}
              />
            </Card>
          ) : filteredTemplates.length === 0 ? (
            <EmptyState
              icon="🔍"
              title="No courses found"
              description={`No course curricula match "${searchQuery}". Try selecting another category.`}
              actionLabel="Clear Filters"
              onAction={() => {
                setSearchQuery('');
                setSelectedCategory('all');
              }}
              actionVariant="secondary"
            />
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContainer}>
              {filteredTemplates.map((template) => {
                const isThisEnrolling = enrollingId === template.id;
                const unitCount = template.suggested_units?.length || 0;

                return (
                  <View key={template.id} style={styles.templateCard}>
                    {/* Color Left Border */}
                    <View
                      style={[
                        styles.cardColorStrip,
                        { backgroundColor: template.color || '#8B5CF6' },
                      ]}
                    />

                    <View style={styles.cardMain}>
                      {/* Top Badges Row */}
                      <View style={styles.cardHeaderRow}>
                        <View style={styles.badgesCluster}>
                          {template.code ? (
                            <View style={styles.codeBadge}>
                              <Text style={styles.codeBadgeText}>{template.code}</Text>
                            </View>
                          ) : null}
                          <View style={styles.categoryBadge}>
                            <Text style={styles.categoryBadgeText}>{template.category}</Text>
                          </View>
                          <View style={styles.metaBadge}>
                            <Text style={styles.metaBadgeText}>{template.credits} Credits</Text>
                          </View>
                        </View>

                        <View style={styles.difficultyBadge}>
                          <Text style={styles.difficultyText}>{template.difficulty_level}</Text>
                        </View>
                      </View>

                      {/* Course Title & Description */}
                      <ThemedText type="titleMedium" style={styles.templateTitle}>
                        {template.name}
                      </ThemedText>

                      {template.description ? (
                        <ThemedText
                          type="bodySmall"
                          style={styles.templateDesc}
                          numberOfLines={2}>
                          {template.description}
                        </ThemedText>
                      ) : null}

                      {/* Units count & Enrollment summary */}
                      <View style={styles.unitsSummaryRow}>
                        <View style={styles.unitChip}>
                          <Text style={styles.unitChipIcon}>📖</Text>
                          <Text style={styles.unitChipText}>
                            {unitCount} Standard Units Included
                          </Text>
                        </View>
                        <View style={styles.unitChip}>
                          <Text style={styles.unitChipIcon}>👥</Text>
                          <Text style={styles.unitChipText}>
                            {template.enrolled_count} Enrolled
                          </Text>
                        </View>
                      </View>

                      {/* Units Preview List if present */}
                      {unitCount > 0 ? (
                        <View style={styles.unitsPreviewBox}>
                          <Text style={styles.unitsPreviewTitle}>Core Syllabus Units:</Text>
                          <Text style={styles.unitsPreviewList} numberOfLines={2}>
                            {template.suggested_units.map((u) => u.title).join(' • ')}
                          </Text>
                        </View>
                      ) : null}

                      {/* Enroll CTA */}
                      <View style={styles.cardActionRow}>
                        <Pressable
                          style={({ pressed }) => [
                            styles.enrollBtn,
                            isThisEnrolling && styles.enrollBtnDisabled,
                            pressed && !isThisEnrolling && styles.enrollBtnPressed,
                          ]}
                          disabled={isThisEnrolling}
                          onPress={() => handleEnroll(template)}>
                          {isThisEnrolling ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <>
                              <Text style={styles.enrollBtnIcon}>⚡</Text>
                              <Text style={styles.enrollBtnText}>1-Tap Enroll Course</Text>
                            </>
                          )}
                        </Pressable>
                      </View>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheetContainer: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.sm,
    maxHeight: '90%',
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: 12,
  },
  colorStrip: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#8B5CF6',
    alignSelf: 'center',
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  curatedBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  curatedBadgeIcon: {
    fontSize: 22,
  },
  headerTextGroup: {
    flex: 1,
    gap: 2,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 20,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '700',
  },

  // Search
  searchContainer: {
    marginTop: 2,
  },
  searchIcon: {
    fontSize: 15,
  },

  // Category Filter Pills
  filterPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  filterPillActive: {
    backgroundColor: 'rgba(139, 92, 246, 0.25)',
    borderColor: '#A855F7',
  },
  filterPillText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  filterPillTextActive: {
    color: '#F1F5F9',
    fontWeight: '800',
  },

  centerLoading: {
    paddingVertical: Spacing.xl * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    gap: Spacing.sm,
  },
  listContainer: {
    paddingBottom: Spacing.xl,
    gap: 12,
  },

  // Template Card
  templateCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(16, 24, 48, 0.75)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  cardColorStrip: {
    width: 6,
  },
  cardMain: {
    flex: 1,
    padding: 14,
    gap: 8,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  badgesCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  codeBadge: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.35)',
  },
  codeBadgeText: {
    color: '#C084FC',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  categoryBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  categoryBadgeText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '600',
  },
  metaBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  metaBadgeText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
  },
  difficultyBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  difficultyText: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  templateTitle: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: -0.2,
  },
  templateDesc: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 17,
  },
  unitsSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unitChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  unitChipIcon: {
    fontSize: 11,
  },
  unitChipText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  unitsPreviewBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    gap: 2,
  },
  unitsPreviewTitle: {
    color: '#C084FC',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  unitsPreviewList: {
    color: '#CBD5E1',
    fontSize: 11,
    lineHeight: 15,
  },
  cardActionRow: {
    marginTop: 4,
  },
  enrollBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#7C3AED',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  enrollBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  enrollBtnDisabled: {
    opacity: 0.6,
  },
  enrollBtnIcon: {
    color: '#FDE047',
    fontSize: 13,
  },
  enrollBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
});
