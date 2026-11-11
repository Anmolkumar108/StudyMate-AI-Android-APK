import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { CuratedTemplatesModal } from '@/components/subjects/curated-templates-modal';
import { SubjectCard } from '@/components/subjects/subject-card';
import { SubjectDetailModal } from '@/components/subjects/subject-detail-modal';
import { SubjectFormModal } from '@/components/subjects/subject-form-modal';
import { ThemedText } from '@/components/themed-text';
import { Badge, Button, Card, EmptyState, Input, ScreenWrapper } from '@/components/ui';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useSubjects } from '@/hooks/use-subjects';
import { useTheme } from '@/hooks/use-theme';
import { Subject, SubjectCreate, SubjectUpdate } from '@/types/subject';

export default function SubjectsScreen() {
  const router = useRouter();
  const theme = useTheme();

  const {
    subjects,
    isLoading,
    isRefreshing,
    error,
    fetchSubjects,
    createSubject,
    updateSubject,
    deleteSubject,
    clearError,
  } = useSubjects();

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Semester filter state: 'all' or semester number
  const [selectedSemester, setSelectedSemester] = useState<number | 'all'>('all');

  // Modals state
  const [isFormModalVisible, setIsFormModalVisible] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const [isCuratedModalVisible, setIsCuratedModalVisible] = useState(false);

  // Entrance animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(15)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  // Distinct semesters list
  const distinctSemesters = useMemo(() => {
    const sems = new Set<number>();
    subjects.forEach((s) => {
      if (s.semester != null) sems.add(s.semester);
    });
    return Array.from(sems).sort((a, b) => a - b);
  }, [subjects]);

  // Filtered subjects by semester & search query
  const filteredSubjects = useMemo(() => {
    let result = subjects;

    if (selectedSemester !== 'all') {
      result = result.filter((s) => s.semester === selectedSemester);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          (s.code && s.code.toLowerCase().includes(query)) ||
          (s.description && s.description.toLowerCase().includes(query))
      );
    }

    return result;
  }, [subjects, selectedSemester, searchQuery]);

  const handleOpenAddModal = () => {
    setSelectedSubject(null);
    setFormMode('create');
    setIsFormModalVisible(true);
  };

  const handleOpenEditModal = (subject: Subject) => {
    setSelectedSubject(subject);
    setFormMode('edit');
    setIsFormModalVisible(true);
  };

  const handleOpenDetailModal = (subject: Subject) => {
    setSelectedSubject(subject);
    setIsDetailModalVisible(true);
  };

  const handleFormSubmit = async (data: SubjectCreate | SubjectUpdate) => {
    if (formMode === 'create') {
      await createSubject(data as SubjectCreate);
    } else if (selectedSubject) {
      const updated = await updateSubject(selectedSubject.id, data as SubjectUpdate);
      setSelectedSubject(updated);
    }
  };

  const handleDeleteSubject = async (subjectId: string) => {
    await deleteSubject(subjectId);
    setSelectedSubject(null);
  };

  const countLabel = useMemo(() => {
    const total = subjects.length;
    return `${total} ${total === 1 ? 'course' : 'courses'}`;
  }, [subjects.length]);

  return (
    <ScreenWrapper
      scrollable={false}
      includeTopInset
      includeBottomInset
      includeTabInset
      contentContainerStyle={styles.container}>
      <Animated.View
        style={[
          styles.animatedWrapper,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}>
        {/* ========================================================================= */}
        {/* 1. HEADER ROW: Back Button, Brand Pill, Title & + Add Button              */}
        {/* ========================================================================= */}
        <View style={styles.header}>
          <View style={styles.headerTopBar}>
            {/* Back Button */}
            <Pressable
              style={({ pressed }) => [
                styles.backButton,
                pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] },
              ]}
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace('/');
                }
              }}
              accessibilityRole="button"
              accessibilityLabel="Go back">
              <Text style={styles.backArrow}>←</Text>
            </Pressable>

            {/* Title Group */}
            <View style={styles.titleTextGroup}>
              <View style={styles.tagRow}>
                <ThemedText
                  type="smallBold"
                  style={{ color: '#C084FC', letterSpacing: 0.8 }}>
                  ACADEMIC COURSES
                </ThemedText>
                {!isLoading && subjects.length > 0 ? (
                  <Badge label={countLabel} variant="brand" size="sm" />
                ) : null}
              </View>
              <ThemedText type="headlineLarge" style={styles.headerTitle}>
                My Subjects
              </ThemedText>
            </View>

            {/* Action Buttons Group */}
            <View style={styles.headerActionsGroup}>
              {/* Explore Curated Library Button */}
              <Pressable
                style={({ pressed }) => [
                  styles.libraryBtn,
                  pressed && styles.libraryBtnPressed,
                ]}
                onPress={() => setIsCuratedModalVisible(true)}
                accessibilityRole="button"
                accessibilityLabel="Explore Curated University Templates">
                <Text style={styles.libraryBtnIcon}>🎓</Text>
                <Text style={styles.libraryBtnText}>Library</Text>
              </Pressable>

              {/* Add Subject Action Button */}
              <Pressable
                style={({ pressed }) => [
                  styles.gradientAddBtn,
                  pressed && styles.gradientAddBtnPressed,
                ]}
                onPress={handleOpenAddModal}
                accessibilityRole="button"
                accessibilityLabel="Add New Subject">
                <Text style={styles.addBtnIcon}>＋</Text>
                <Text style={styles.addBtnText}>Add</Text>
              </Pressable>
            </View>
          </View>

          <ThemedText type="bodySmall" style={styles.headerSubtitle}>
            Organize your academic journey.
          </ThemedText>

          {/* ========================================================================= */}
          {/* 2. BENTO STATS STRIP: Total Courses, Semesters & Timetable Shortcut      */}
          {/* ========================================================================= */}
          {subjects.length > 0 ? (
            <View style={styles.bentoStrip}>
              {/* Card 1: Total Courses */}
              <View style={styles.bentoCard}>
                <View style={[styles.bentoIconBadge, { backgroundColor: 'rgba(139, 92, 246, 0.2)' }]}>
                  <Text style={styles.bentoIcon}>📚</Text>
                </View>
                <View style={styles.bentoTextGroup}>
                  <Text style={styles.bentoVal}>{subjects.length}</Text>
                  <Text style={styles.bentoLabel}>Total Courses</Text>
                </View>
              </View>

              {/* Card 2: Semesters */}
              <View style={styles.bentoCard}>
                <View style={[styles.bentoIconBadge, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}>
                  <Text style={styles.bentoIcon}>🎓</Text>
                </View>
                <View style={styles.bentoTextGroup}>
                  <Text style={styles.bentoVal}>
                    {distinctSemesters.length || 1}
                  </Text>
                  <Text style={styles.bentoLabel}>Semesters</Text>
                </View>
              </View>

              {/* Card 3: Class Schedule Link */}
              <Pressable
                style={({ pressed }) => [
                  styles.bentoCard,
                  styles.bentoCardAction,
                  pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] },
                ]}
                onPress={() => router.push('/timetable' as never)}>
                <View style={[styles.bentoIconBadge, { backgroundColor: 'rgba(56, 189, 248, 0.2)' }]}>
                  <Text style={styles.bentoIcon}>⏱️</Text>
                </View>
                <View style={styles.bentoTextGroup}>
                  <Text style={[styles.bentoVal, { color: '#38BDF8', fontSize: 13 }]}>
                    Schedule →
                  </Text>
                  <Text style={styles.bentoLabel}>Timetable</Text>
                </View>
              </Pressable>
            </View>
          ) : null}

          {/* ========================================================================= */}
          {/* 3. SEARCH BAR                                                             */}
          {/* ========================================================================= */}
          {subjects.length > 0 || searchQuery ? (
            <Input
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by subject name or code..."
              showClearButton
              onClear={() => setSearchQuery('')}
              leftElement={<Text style={styles.searchIcon}>🔍</Text>}
              containerStyle={styles.searchContainer}
            />
          ) : null}

          {/* ========================================================================= */}
          {/* 4. HORIZONTAL SEMESTER FILTER TABS                                        */}
          {/* ========================================================================= */}
          {distinctSemesters.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterPillsRow}>
              {/* All Tab */}
              <Pressable
                style={({ pressed }) => [
                  styles.filterPill,
                  selectedSemester === 'all' && styles.filterPillActive,
                  pressed && { opacity: 0.8 },
                ]}
                onPress={() => setSelectedSemester('all')}>
                <Text
                  style={[
                    styles.filterPillText,
                    selectedSemester === 'all' && styles.filterPillTextActive,
                  ]}>
                  All ({subjects.length})
                </Text>
              </Pressable>

              {/* Distinct Semester Tabs */}
              {distinctSemesters.map((sem) => {
                const count = subjects.filter((s) => s.semester === sem).length;
                const isActive = selectedSemester === sem;
                return (
                  <Pressable
                    key={`sem-${sem}`}
                    style={({ pressed }) => [
                      styles.filterPill,
                      isActive && styles.filterPillActive,
                      pressed && { opacity: 0.8 },
                    ]}
                    onPress={() => setSelectedSemester(sem)}>
                    <Text
                      style={[
                        styles.filterPillText,
                        isActive && styles.filterPillTextActive,
                      ]}>
                      Sem {sem} ({count})
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}
        </View>

        {/* ========================================================================= */}
        {/* 5. ERROR BANNER OR OFFLINE REASSURANCE                                    */}
        {/* ========================================================================= */}
        {error && subjects.length > 0 ? (
          <View
            style={[
              styles.offlineNotice,
              {
                backgroundColor: theme.badgeNeutralBackground,
                borderColor: theme.borderSubtle,
              },
            ]}>
            <Text style={{ fontSize: 13 }}>⚡</Text>
            <ThemedText
              type="small"
              style={{ color: theme.textSecondary, flex: 1, fontSize: 12 }}>
              Offline Mode — Viewing saved subjects from device storage
            </ThemedText>
          </View>
        ) : error ? (
          <Card variant="outlined" style={[styles.errorCard, { borderColor: theme.statusDanger }]}>
            <ThemedText
              type="bodyMedium"
              style={{ color: theme.statusDanger, fontWeight: '500', flex: 1 }}>
              {error}
            </ThemedText>
            <Button
              title="Retry"
              size="sm"
              variant="secondary"
              onPress={() => {
                clearError();
                fetchSubjects(true);
              }}
            />
          </Card>
        ) : null}

        {/* ========================================================================= */}
        {/* 6. CONTENT STATES (Loading / Empty / Subject Cards List)                  */}
        {/* ========================================================================= */}
        {isLoading && !isRefreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#8B5CF6" />
            <ThemedText
              type="bodyMedium"
              style={{ color: '#94A3B8', marginTop: Spacing.md }}>
              Loading your academic subjects...
            </ThemedText>
          </View>
        ) : subjects.length === 0 ? (
          /* Empty State: No subjects in account */
          <FlatList
            data={[]}
            renderItem={() => null}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={() => fetchSubjects(true)}
                tintColor="#8B5CF6"
                colors={['#8B5CF6']}
              />
            }
            contentContainerStyle={styles.emptyScrollContent}
            ListEmptyComponent={
              <View style={styles.emptyStateWrapper}>
                <EmptyState
                  icon="📚"
                  title="No subjects added yet"
                  description="Organize your study goals, lecture notes, and revision by adding your academic courses."
                  actionLabel="+ Add Custom Subject"
                  onAction={handleOpenAddModal}
                  actionVariant="primary"
                />
                <Pressable
                  style={({ pressed }) => [
                    styles.exploreCuratedEmptyBtn,
                    pressed && styles.exploreCuratedEmptyBtnPressed,
                  ]}
                  onPress={() => setIsCuratedModalVisible(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Explore Curated University Library">
                  <View style={styles.exploreCuratedIconBox}>
                    <Text style={styles.exploreCuratedEmptyIcon}>🎓</Text>
                  </View>
                  <View style={styles.exploreCuratedTextBox}>
                    <Text style={styles.exploreCuratedEmptyTitle}>
                      Explore Curated Library
                    </Text>
                    <Text style={styles.exploreCuratedEmptySub}>
                      1-Tap enroll into Computer Science, AI, Maths & Sciences
                    </Text>
                  </View>
                  <Text style={styles.exploreCuratedEmptyArrow}>→</Text>
                </Pressable>
              </View>
            }
          />
        ) : filteredSubjects.length === 0 ? (
          /* Empty State: No search results matching query */
          <FlatList
            data={[]}
            renderItem={() => null}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={() => fetchSubjects(true)}
                tintColor="#8B5CF6"
                colors={['#8B5CF6']}
              />
            }
            contentContainerStyle={styles.emptyScrollContent}
            ListEmptyComponent={
              <EmptyState
                icon="🔍"
                title="No matching subjects found"
                description={`No courses match "${searchQuery}". Try searching by course title or code.`}
                actionLabel="Clear Search"
                onAction={() => {
                  setSearchQuery('');
                  setSelectedSemester('all');
                }}
                actionVariant="secondary"
              />
            }
          />
        ) : (
          /* Animated Subject Cards List */
          <FlatList
            data={filteredSubjects}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <SubjectCard
                subject={item}
                onPress={() => handleOpenDetailModal(item)}
              />
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={() => fetchSubjects(true)}
                tintColor="#8B5CF6"
                colors={['#8B5CF6']}
              />
            }
          />
        )}
      </Animated.View>

      {/* Add / Edit Form Modal */}
      <SubjectFormModal
        visible={isFormModalVisible}
        mode={formMode}
        initialSubject={selectedSubject}
        onClose={() => {
          setIsFormModalVisible(false);
          setSelectedSubject(null);
        }}
        onSubmit={handleFormSubmit}
      />

      {/* Subject Detail Modal */}
      <SubjectDetailModal
        subject={selectedSubject}
        visible={isDetailModalVisible}
        onClose={() => {
          setIsDetailModalVisible(false);
          setSelectedSubject(null);
        }}
        onEdit={(subject) => {
          setIsDetailModalVisible(false);
          handleOpenEditModal(subject);
        }}
        onDelete={handleDeleteSubject}
      />

      {/* Curated University Templates Library Modal */}
      <CuratedTemplatesModal
        visible={isCuratedModalVisible}
        onClose={() => setIsCuratedModalVisible(false)}
        onEnrolled={async () => {
          await fetchSubjects(true);
        }}
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  animatedWrapper: {
    flex: 1,
  },
  header: {
    paddingVertical: Spacing.xs,
    gap: 10,
  },
  headerTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  titleTextGroup: {
    flex: 1,
    gap: 2,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 24,
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
  },
  headerActionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  libraryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(139, 92, 246, 0.18)',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: 'rgba(168, 85, 247, 0.4)',
  },
  libraryBtnPressed: {
    transform: [{ scale: 0.94 }],
    opacity: 0.85,
  },
  libraryBtnIcon: {
    fontSize: 14,
  },
  libraryBtnText: {
    color: '#E9D5FF',
    fontWeight: '700',
    fontSize: 13,
  },
  gradientAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
  },
  gradientAddBtnPressed: {
    transform: [{ scale: 0.94 }],
    opacity: 0.9,
  },
  addBtnIcon: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  addBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },

  // Bento Stats
  bentoStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  bentoCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(16, 24, 48, 0.75)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  bentoCardAction: {
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  bentoIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bentoIcon: {
    fontSize: 14,
  },
  bentoTextGroup: {
    flex: 1,
    gap: 1,
  },
  bentoVal: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  bentoLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
  },

  // Search
  searchContainer: {
    marginTop: 2,
  },
  searchIcon: {
    fontSize: 15,
  },

  // Semester Filter Pills
  filterPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
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
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 3,
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

  offlineNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginVertical: Spacing.xs,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    gap: Spacing.sm,
    marginVertical: Spacing.xs,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  listContent: {
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl * 2,
  },
  emptyScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: Spacing.xl,
  },
  emptyStateWrapper: {
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: Spacing.md,
  },
  exploreCuratedEmptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(16, 24, 48, 0.85)',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(139, 92, 246, 0.4)',
    padding: 14,
    width: '100%',
    maxWidth: 420,
  },
  exploreCuratedEmptyBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  exploreCuratedIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exploreCuratedEmptyIcon: {
    fontSize: 20,
  },
  exploreCuratedTextBox: {
    flex: 1,
    gap: 2,
  },
  exploreCuratedEmptyTitle: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  exploreCuratedEmptySub: {
    color: '#94A3B8',
    fontSize: 11,
    lineHeight: 15,
  },
  exploreCuratedEmptyArrow: {
    color: '#C084FC',
    fontSize: 16,
    fontWeight: '800',
  },
});
