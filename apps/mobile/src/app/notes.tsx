import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { NoteCard } from '@/components/notes/note-card';
import { NoteCardSkeleton } from '@/components/notes/note-card-skeleton';
import { NoteDetailModal } from '@/components/notes/note-detail-modal';
import { NoteFormModal } from '@/components/notes/note-form-modal';
import { ThemedText } from '@/components/themed-text';
import { Badge, Button, Card, EmptyState, Input, ScreenWrapper } from '@/components/ui';
import { BorderRadius, MinTouchTarget, Shadows, Spacing } from '@/constants/theme';
import { useNotes } from '@/hooks/use-notes';
import { useSubjects } from '@/hooks/use-subjects';
import { useTheme } from '@/hooks/use-theme';
import { Note, NoteCreate, NoteUpdate } from '@/types/note';

export default function NotesScreen() {
  const theme = useTheme();

  const {
    notes,
    isLoading,
    isRefreshing,
    error,
    fetchNotes,
    createNote,
    updateNote,
    togglePin,
    deleteNote,
    clearError,
  } = useNotes();

  const { subjects } = useSubjects();

  // Search state with debounce
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Filter state
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string | null>(null);
  const [isPinnedOnly, setIsPinnedOnly] = useState<boolean>(false);

  // Modals state
  const [isFormModalVisible, setIsFormModalVisible] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);

  // Subject lookup map
  const subjectsMap = useMemo(() => {
    const map = new Map<string, { name: string; color: string | null }>();
    subjects.forEach((s) => {
      map.set(s.id, { name: s.name, color: s.color });
    });
    return map;
  }, [subjects]);

  // Per-subject note count map for filter chips
  const notesCountBySubject = useMemo(() => {
    const map = new Map<string, number>();
    notes.forEach((n) => {
      if (n.subject_id) {
        map.set(n.subject_id, (map.get(n.subject_id) || 0) + 1);
      }
    });
    return map;
  }, [notes]);

  const pinnedNotesCount = useMemo(() => {
    return notes.filter((n) => n.is_pinned).length;
  }, [notes]);

  // Debounce search query input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Filter notes client-side & server-side
  const filteredNotes = useMemo(() => {
    return notes.filter((note) => {
      // Search filter
      if (debouncedSearch) {
        const query = debouncedSearch.toLowerCase();
        const matchesTitle = note.title.toLowerCase().includes(query);
        const matchesContent = note.content.toLowerCase().includes(query);
        if (!matchesTitle && !matchesContent) {
          return false;
        }
      }

      // Subject filter
      if (selectedSubjectFilter !== null) {
        if (note.subject_id !== selectedSubjectFilter) {
          return false;
        }
      }

      // Pinned only filter
      if (isPinnedOnly && !note.is_pinned) {
        return false;
      }

      return true;
    });
  }, [notes, debouncedSearch, selectedSubjectFilter, isPinnedOnly]);

  const handleOpenAddModal = () => {
    setSelectedNote(null);
    setFormMode('create');
    setIsFormModalVisible(true);
  };

  const handleOpenEditModal = (note: Note) => {
    setSelectedNote(note);
    setFormMode('edit');
    setIsFormModalVisible(true);
  };

  const handleOpenDetailModal = (note: Note) => {
    setSelectedNote(note);
    setIsDetailModalVisible(true);
  };

  const handleFormSubmit = async (data: NoteCreate | NoteUpdate) => {
    if (formMode === 'create') {
      await createNote(data as NoteCreate);
    } else if (selectedNote) {
      const updated = await updateNote(selectedNote.id, data as NoteUpdate);
      setSelectedNote(updated);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    await deleteNote(noteId);
    setSelectedNote(null);
  };

  const handleTogglePin = async (noteId: string) => {
    const updated = await togglePin(noteId);
    if (selectedNote && selectedNote.id === noteId) {
      setSelectedNote(updated);
    }
  };

  const clearAllFilters = () => {
    setSearchInput('');
    setDebouncedSearch('');
    setSelectedSubjectFilter(null);
    setIsPinnedOnly(false);
  };

  // Selected note's subject for detail modal
  const selectedNoteSubject = useMemo(() => {
    if (!selectedNote || !selectedNote.subject_id) return null;
    return subjects.find((s) => s.id === selectedNote.subject_id) || null;
  }, [selectedNote, subjects]);

  const countLabel = useMemo(() => {
    const total = notes.length;
    return `${total} ${total === 1 ? 'note' : 'notes'}`;
  }, [notes.length]);

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
                STUDY WORKSPACE
              </ThemedText>
              {!isLoading && notes.length > 0 ? (
                <Badge label={countLabel} variant="brand" size="sm" />
              ) : null}
            </View>
            <ThemedText type="headlineLarge" style={styles.headerTitle}>
              Study Notes
            </ThemedText>
            <ThemedText type="bodySmall" style={{ color: theme.textSecondary }}>
              Capture ideas, lecture summaries, and formulas.
            </ThemedText>
          </View>

          <Button
            title="+ Add Note"
            variant="primary"
            size="md"
            onPress={handleOpenAddModal}
            accessibilityLabel="Add New Note"
            accessibilityHint="Opens dialog to create a new study note"
            style={styles.addButton}
          />
        </View>

        {/* SECTION B: Modern Search Bar */}
        {notes.length > 0 || searchInput ? (
          <Input
            value={searchInput}
            onChangeText={setSearchInput}
            placeholder="Search notes by title or content..."
            showClearButton
            onClear={() => setSearchInput('')}
            leftElement={<Text style={styles.searchIcon}>🔍</Text>}
            containerStyle={styles.searchContainer}
          />
        ) : null}

        {/* SECTION C: Filter Chips Bar (Subjects & Pinned) */}
        {notes.length > 0 || selectedSubjectFilter !== null || isPinnedOnly ? (
          <View style={styles.filtersWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterScrollContent}>
              {/* Pinned filter chip */}
              <Pressable
                onPress={() => setIsPinnedOnly((prev) => !prev)}
                accessibilityRole="button"
                accessibilityLabel="Filter pinned notes only"
                hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                style={({ pressed }) => [
                  styles.filterChip,
                  {
                    backgroundColor: isPinnedOnly
                      ? theme.badgeWarningBackground
                      : theme.cardBackground,
                    borderColor: isPinnedOnly
                      ? theme.statusWarning
                      : theme.borderSubtle,
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}>
                <Text style={{ fontSize: 13 }}>📌</Text>
                <ThemedText
                  type="small"
                  style={{
                    color: isPinnedOnly ? theme.statusWarning : theme.textSecondary,
                    fontWeight: isPinnedOnly ? '700' : '500',
                  }}>
                  Pinned{pinnedNotesCount > 0 ? ` (${pinnedNotesCount})` : ''}
                </ThemedText>
              </Pressable>

              {/* All Courses chip */}
              <Pressable
                onPress={() => setSelectedSubjectFilter(null)}
                accessibilityRole="button"
                accessibilityLabel="All Courses"
                hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                style={({ pressed }) => [
                  styles.filterChip,
                  {
                    backgroundColor:
                      selectedSubjectFilter === null
                        ? theme.badgeBrandBackground
                        : theme.cardBackground,
                    borderColor:
                      selectedSubjectFilter === null
                        ? theme.brandPrimary
                        : theme.borderSubtle,
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}>
                <ThemedText
                  type="small"
                  style={{
                    color:
                      selectedSubjectFilter === null
                        ? theme.brandPrimary
                        : theme.textSecondary,
                    fontWeight: selectedSubjectFilter === null ? '700' : '500',
                  }}>
                  All Courses ({notes.length})
                </ThemedText>
              </Pressable>

              {/* Enrolled subjects chips */}
              {subjects.map((sub) => {
                const isSelected = selectedSubjectFilter === sub.id;
                const dotColor = sub.color || theme.brandPrimary;
                const count = notesCountBySubject.get(sub.id) || 0;
                return (
                  <Pressable
                    key={sub.id}
                    onPress={() =>
                      setSelectedSubjectFilter(isSelected ? null : sub.id)
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`Filter by subject ${sub.name}, ${count} notes`}
                    hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                    style={({ pressed }) => [
                      styles.filterChip,
                      {
                        backgroundColor: isSelected
                          ? theme.badgeBrandBackground
                          : theme.cardBackground,
                        borderColor: isSelected
                          ? theme.brandPrimary
                          : theme.borderSubtle,
                        opacity: pressed ? 0.75 : 1,
                      },
                    ]}>
                    <View
                      style={[styles.chipDot, { backgroundColor: dotColor }]}
                    />
                    <ThemedText
                      type="small"
                      style={{
                        color: isSelected
                          ? theme.brandPrimary
                          : theme.textSecondary,
                        fontWeight: isSelected ? '700' : '500',
                      }}>
                      {sub.name}{count > 0 ? ` (${count})` : ''}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}
      </View>

      {/* SECTION D: Error Banner with Retry */}
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
              fetchNotes(undefined, true);
            }}
          />
        </Card>
      ) : null}

      {/* SECTION E: Content States */}
      {isLoading && !isRefreshing ? (
        /* Animated Skeleton Loading State */
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}>
          <NoteCardSkeleton count={3} />
        </ScrollView>
      ) : notes.length === 0 ? (
        /* Empty State: No notes created yet */
        <FlatList
          data={[]}
          renderItem={() => null}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => fetchNotes(undefined, true)}
              tintColor={theme.brandPrimary}
              colors={[theme.brandPrimary]}
            />
          }
          contentContainerStyle={styles.emptyScrollContent}
          ListEmptyComponent={
            <EmptyState
              icon="📝"
              title="No notes created yet"
              description="Capture lecture summaries, exam formulas, and revision outlines linked to your courses."
              actionLabel="+ Create First Note"
              onAction={handleOpenAddModal}
              actionVariant="primary"
            />
          }
        />
      ) : filteredNotes.length === 0 ? (
        /* Empty State: No search/filter matches */
        <FlatList
          data={[]}
          renderItem={() => null}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => fetchNotes(undefined, true)}
              tintColor={theme.brandPrimary}
              colors={[theme.brandPrimary]}
            />
          }
          contentContainerStyle={styles.emptyScrollContent}
          ListEmptyComponent={
            <EmptyState
              icon="🔍"
              title="No matching notes found"
              description={
                debouncedSearch
                  ? `No notes matched "${debouncedSearch}". Try a different keyword or reset filters.`
                  : 'No notes match the active filter criteria.'
              }
              actionLabel="Clear Filters"
              onAction={clearAllFilters}
              actionVariant="secondary"
            />
          }
        />
      ) : (
        /* Notes Cards List with Staggered Entrance */
        <View style={styles.listWrapper}>
          <FlatList
            data={filteredNotes}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => {
              const linkedSubject = item.subject_id
                ? subjectsMap.get(item.subject_id)
                : null;
              return (
                <NoteCard
                  note={item}
                  index={index}
                  subjectName={linkedSubject?.name}
                  subjectColor={linkedSubject?.color}
                  onPress={() => handleOpenDetailModal(item)}
                  onTogglePin={() => handleTogglePin(item.id)}
                />
              );
            }}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={() => fetchNotes(undefined, true)}
                tintColor={theme.brandPrimary}
                colors={[theme.brandPrimary]}
              />
            }
          />

          {/* Prominent Floating Add Note Action Button (FAB) */}
          <Pressable
            onPress={handleOpenAddModal}
            accessibilityRole="button"
            accessibilityLabel="Create New Note"
            accessibilityHint="Opens dialog to create a new study note"
            android_ripple={{ color: 'rgba(255, 255, 255, 0.25)', borderless: true }}
            style={({ pressed }) => [
              styles.floatingAddButton,
              {
                backgroundColor: theme.brandPrimary,
                opacity: pressed && Platform.OS !== 'android' ? 0.88 : 1,
              },
            ]}>
            <Text style={styles.fabPlus}>+</Text>
            <ThemedText type="smallBold" style={styles.fabText}>
              New Note
            </ThemedText>
          </Pressable>
        </View>
      )}

      {/* Add / Edit Form Modal */}
      <NoteFormModal
        visible={isFormModalVisible}
        mode={formMode}
        initialNote={selectedNote}
        subjects={subjects}
        onClose={() => {
          setIsFormModalVisible(false);
          setSelectedNote(null);
        }}
        onSubmit={handleFormSubmit}
      />

      {/* Note Detail Modal */}
      <NoteDetailModal
        note={selectedNote}
        subject={selectedNoteSubject}
        visible={isDetailModalVisible}
        onClose={() => {
          setIsDetailModalVisible(false);
          setSelectedNote(null);
        }}
        onEdit={(note) => {
          setIsDetailModalVisible(false);
          handleOpenEditModal(note);
        }}
        onTogglePin={handleTogglePin}
        onDelete={handleDeleteNote}
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
    marginTop: 2,
  },
  searchIcon: {
    fontSize: 16,
  },
  filtersWrapper: {
    marginTop: 2,
  },
  filterScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: 2,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    minHeight: 36,
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: BorderRadius.full,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    gap: Spacing.sm,
    marginVertical: Spacing.xs,
  },
  listWrapper: {
    flex: 1,
    position: 'relative',
  },
  listContent: {
    paddingTop: Spacing.sm,
    paddingBottom: 88, // Clear floating action button
  },
  emptyScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: Spacing.xl,
  },
  floatingAddButton: {
    position: 'absolute',
    bottom: Spacing.md,
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 12,
    minHeight: MinTouchTarget,
    borderRadius: BorderRadius.full,
    ...Shadows.md,
    zIndex: 10,
  },
  fabPlus: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 22,
  },
  fabText: {
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
