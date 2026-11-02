import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { SubjectCard } from '@/components/subjects/subject-card';
import { SubjectDetailModal } from '@/components/subjects/subject-detail-modal';
import { SubjectFormModal } from '@/components/subjects/subject-form-modal';
import { ThemedText } from '@/components/themed-text';
import { Badge, Button, Card, EmptyState, Input, ScreenWrapper } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useSubjects } from '@/hooks/use-subjects';
import { useTheme } from '@/hooks/use-theme';
import { Subject, SubjectCreate, SubjectUpdate } from '@/types/subject';

export default function SubjectsScreen() {
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

  // Modals state
  const [isFormModalVisible, setIsFormModalVisible] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);

  // Filtered subjects by name, code, or description
  const filteredSubjects = useMemo(() => {
    if (!searchQuery.trim()) {
      return subjects;
    }
    const query = searchQuery.trim().toLowerCase();
    return subjects.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        (s.code && s.code.toLowerCase().includes(query)) ||
        (s.description && s.description.toLowerCase().includes(query))
    );
  }, [subjects, searchQuery]);

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
      {/* SECTION A: Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View style={styles.titleTextGroup}>
            <View style={styles.tagRow}>
              <ThemedText
                type="smallBold"
                style={{ color: theme.brandPrimary, letterSpacing: 0.8 }}>
                ACADEMIC COURSES
              </ThemedText>
              {!isLoading && subjects.length > 0 ? (
                <Badge label={countLabel} variant="brand" size="sm" />
              ) : null}
            </View>
            <ThemedText type="headlineLarge" style={styles.headerTitle}>
              My Subjects
            </ThemedText>
            <ThemedText type="bodySmall" style={{ color: theme.textSecondary }}>
              Organize your academic journey.
            </ThemedText>
          </View>

          {/* Add Subject Action Button */}
          <Button
            title="+ Add Subject"
            variant="primary"
            size="md"
            onPress={handleOpenAddModal}
            accessibilityLabel="Add New Subject"
            style={styles.addButton}
          />
        </View>

        {/* SECTION B: Modern Search Bar */}
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
      </View>

      {/* SECTION C: Error Banner with Retry */}
      {error ? (
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

      {/* SECTION D: Content States */}
      {isLoading && !isRefreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.brandPrimary} />
          <ThemedText
            type="bodyMedium"
            style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
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
              tintColor={theme.brandPrimary}
              colors={[theme.brandPrimary]}
            />
          }
          contentContainerStyle={styles.emptyScrollContent}
          ListEmptyComponent={
            <EmptyState
              icon="📚"
              title="No subjects added yet"
              description="Organize your study goals, lecture notes, and revision by adding your academic courses."
              actionLabel="+ Add Your First Subject"
              onAction={handleOpenAddModal}
              actionVariant="primary"
            />
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
              tintColor={theme.brandPrimary}
              colors={[theme.brandPrimary]}
            />
          }
          contentContainerStyle={styles.emptyScrollContent}
          ListEmptyComponent={
            <EmptyState
              icon="🔍"
              title="No matching subjects found"
              description={`No courses match "${searchQuery}". Try searching by course title or code.`}
              actionLabel="Clear Search"
              onAction={() => setSearchQuery('')}
              actionVariant="secondary"
            />
          }
        />
      ) : (
        /* Subject Cards List */
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
              tintColor={theme.brandPrimary}
              colors={[theme.brandPrimary]}
            />
          }
        />
      )}

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
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingVertical: Spacing.xs,
    gap: Spacing.sm,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
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
    letterSpacing: -0.3,
  },
  addButton: {
    alignSelf: 'center',
  },
  searchContainer: {
    marginTop: Spacing.xs,
  },
  searchIcon: {
    fontSize: 16,
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
    paddingBottom: Spacing.xl,
  },
  emptyScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: Spacing.xl,
  },
});
