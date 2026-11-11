import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
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
import { aiApi } from '@/services/api/client';
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

  // Filter & Sort state
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string | null>(null);
  const [isPinnedOnly, setIsPinnedOnly] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<'recent' | 'title' | 'words'>('recent');

  // Modals state
  const [isFormModalVisible, setIsFormModalVisible] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);

  // AI Smart Note Synthesizer Modal state
  const [isAiModalVisible, setIsAiModalVisible] = useState(false);
  const [aiTitle, setAiTitle] = useState('');
  const [aiSourceText, setAiSourceText] = useState('');
  const [aiFormat, setAiFormat] = useState<'cornell' | 'executive' | 'study_guide'>('cornell');
  const [aiSubjectId, setAiSubjectId] = useState<string | null>(null);
  const [isAiGenerating, setIsAiGenerating] = useState(false);

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

  // Total words across all notes
  const totalWordsCount = useMemo(() => {
    return notes.reduce((sum, n) => {
      if (!n.content) return sum;
      return sum + n.content.trim().split(/\s+/).filter(Boolean).length;
    }, 0);
  }, [notes]);

  const totalReadMinutes = useMemo(() => {
    return Math.max(1, Math.ceil(totalWordsCount / 200));
  }, [totalWordsCount]);

  // Debounce search query input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Filter and sort notes
  const filteredNotes = useMemo(() => {
    return notes
      .filter((note) => {
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
      })
      .sort((a, b) => {
        if (sortBy === 'title') {
          return a.title.localeCompare(b.title);
        }
        if (sortBy === 'words') {
          const wordsA = a.content ? a.content.trim().split(/\s+/).filter(Boolean).length : 0;
          const wordsB = b.content ? b.content.trim().split(/\s+/).filter(Boolean).length : 0;
          return wordsB - wordsA;
        }
        // 'recent': pinned first, then newest updated
        if (a.is_pinned !== b.is_pinned) {
          return a.is_pinned ? -1 : 1;
        }
        const timeA = new Date(a.updated_at || a.created_at).getTime();
        const timeB = new Date(b.updated_at || b.created_at).getTime();
        return timeB - timeA;
      });
  }, [notes, debouncedSearch, selectedSubjectFilter, isPinnedOnly, sortBy]);

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

  // AI Note Generator Handler
  const handleGenerateAiNote = async () => {
    if (!aiSourceText.trim()) {
      Alert.alert('Missing Text', 'Please enter or paste lecture notes, concepts, or syllabus text.');
      return;
    }

    setIsAiGenerating(true);
    try {
      const res = await aiApi.generateAINotes({
        source_text: aiSourceText.trim(),
        title: aiTitle.trim() || undefined,
        format: aiFormat,
        subject_id: aiSubjectId || undefined,
      });

      // Automatically persist the generated note in the database
      await createNote({
        title: res.title || aiTitle.trim() || 'AI Study Note',
        content: res.content,
        subject_id: aiSubjectId,
        is_pinned: false,
      });

      setIsAiModalVisible(false);
      setAiTitle('');
      setAiSourceText('');
      Alert.alert('🎉 Note Created', `"${res.title}" has been successfully synthesized and added to your notes!`);
    } catch (err: any) {
      Alert.alert('AI Error', err?.message || 'Failed to synthesize note. Please check your network connection.');
    } finally {
      setIsAiGenerating(false);
    }
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

  const renderListHeader = () => (
    <View style={styles.listHeaderContainer}>
      {/* SECTION B: Knowledge Hub Sleek Pulse Bar */}
      {notes.length > 0 && (
        <Card
          variant="default"
          style={[
            styles.heroCardCompact,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.borderSubtle,
            },
          ]}>
          <View style={styles.heroHeaderCompact}>
            <View style={styles.heroBadgeGroup}>
              <Badge label="📚 Knowledge Vault" variant="brand" size="sm" />
              <Badge label="✨ Cornell AI Ready" variant="success" size="sm" style={{ marginLeft: 6 }} />
            </View>
            <ThemedText type="bodySmall" style={{ color: theme.textSecondary, fontSize: 11, fontWeight: '600' }}>
              ~{totalReadMinutes}m Read
            </ThemedText>
          </View>

          {/* Sleek Telemetry Stats Strip */}
          <View style={styles.heroStatsRowCompact}>
            <View style={[styles.heroStatItemCompact, { backgroundColor: theme.surfaceSubtle }]}>
              <ThemedText type="titleMedium" style={{ fontWeight: '700', color: theme.brandPrimary, fontSize: 15 }}>
                {notes.length}
              </ThemedText>
              <ThemedText type="bodySmall" style={{ color: theme.textSecondary, fontSize: 10 }}>
                Total Notes
              </ThemedText>
            </View>
            <View style={[styles.heroStatItemCompact, { backgroundColor: theme.surfaceSubtle }]}>
              <ThemedText type="titleMedium" style={{ fontWeight: '700', color: theme.statusWarning, fontSize: 15 }}>
                {pinnedNotesCount}
              </ThemedText>
              <ThemedText type="bodySmall" style={{ color: theme.textSecondary, fontSize: 10 }}>
                Pinned
              </ThemedText>
            </View>
            <View style={[styles.heroStatItemCompact, { backgroundColor: theme.surfaceSubtle }]}>
              <ThemedText type="titleMedium" style={{ fontWeight: '700', color: theme.statusSuccess, fontSize: 15 }}>
                {totalWordsCount > 999 ? `${(totalWordsCount / 1000).toFixed(1)}k` : totalWordsCount}
              </ThemedText>
              <ThemedText type="bodySmall" style={{ color: theme.textSecondary, fontSize: 10 }}>
                Words
              </ThemedText>
            </View>
          </View>
        </Card>
      )}

      {/* Offline Notice or Error Banner */}
      {error && notes.length > 0 ? (
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
            Offline Mode — Viewing saved notes on device (auto-syncs on reconnect)
          </ThemedText>
        </View>
      ) : null}

      {/* SECTION C: Modern Search Bar */}
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

      {/* SECTION D: Filter Chips Bar (Subjects & Pinned) */}
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

      {/* SECTION E: Sorting row */}
      {notes.length > 1 && (
        <View style={styles.sortRow}>
          <ThemedText type="bodySmall" style={{ color: theme.textSecondary, fontSize: 11 }}>
            Sort:
          </ThemedText>
          <TouchableOpacity
            onPress={() => setSortBy('recent')}
            style={[
              styles.sortPill,
              sortBy === 'recent' && { borderBottomColor: theme.brandPrimary, borderBottomWidth: 2 },
            ]}>
            <Text
              style={[
                styles.sortPillText,
                { color: sortBy === 'recent' ? theme.brandPrimary : theme.textSecondary },
              ]}>
              Recent
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSortBy('title')}
            style={[
              styles.sortPill,
              sortBy === 'title' && { borderBottomColor: theme.brandPrimary, borderBottomWidth: 2 },
            ]}>
            <Text
              style={[
                styles.sortPillText,
                { color: sortBy === 'title' ? theme.brandPrimary : theme.textSecondary },
              ]}>
              Title A-Z
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSortBy('words')}
            style={[
              styles.sortPill,
              sortBy === 'words' && { borderBottomColor: theme.brandPrimary, borderBottomWidth: 2 },
            ]}>
            <Text
              style={[
                styles.sortPillText,
                { color: sortBy === 'words' ? theme.brandPrimary : theme.textSecondary },
              ]}>
              Length
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <ScreenWrapper
      scrollable={false}
      includeTopInset
      includeBottomInset={false}
      includeTabInset={false}
      contentContainerStyle={styles.container}>
      {/* SECTION A: Fixed Top Bar */}
      <View style={styles.topHeader}>
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

          <View style={styles.headerActions}>
            <Button
              title="✨ AI Note"
              variant="secondary"
              size="sm"
              onPress={() => setIsAiModalVisible(true)}
              accessibilityLabel="Generate AI Note"
              style={{ marginRight: Spacing.xs }}
            />
            <Button
              title="+ Add Note"
              variant="primary"
              size="sm"
              onPress={handleOpenAddModal}
              accessibilityLabel="Add New Note"
              accessibilityHint="Opens dialog to create a new study note"
              style={styles.addButton}
            />
          </View>
        </View>
      </View>

      {/* SECTION G: Content States with unified scroll */}
      {isLoading && !isRefreshing ? (
        /* Animated Skeleton Loading State */
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.listContent, { paddingBottom: 40 }]}>
          <NoteCardSkeleton count={3} />
        </ScrollView>
      ) : notes.length === 0 ? (
        /* Empty State: No notes created yet */
        <FlatList
          data={[]}
          renderItem={() => null}
          ListHeaderComponent={renderListHeader}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => fetchNotes(undefined, true)}
              tintColor={theme.brandPrimary}
              colors={[theme.brandPrimary]}
            />
          }
          contentContainerStyle={[styles.emptyScrollContent, { paddingBottom: 40 }]}
          ListEmptyComponent={
            error ? (
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
            ) : (
              <EmptyState
                icon="📝"
                title="No notes created yet"
                description="Capture lecture summaries, exam formulas, and revision outlines linked to your courses."
                actionLabel="+ Create First Note"
                onAction={handleOpenAddModal}
                actionVariant="primary"
              />
            )
          }
        />
      ) : filteredNotes.length === 0 ? (
        /* Empty State: No search/filter matches */
        <FlatList
          data={[]}
          renderItem={() => null}
          ListHeaderComponent={renderListHeader}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => fetchNotes(undefined, true)}
              tintColor={theme.brandPrimary}
              colors={[theme.brandPrimary]}
            />
          }
          contentContainerStyle={[styles.emptyScrollContent, { paddingBottom: 40 }]}
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
        /* Notes Cards List with Smooth Full-Screen Scrolling */
        <View style={styles.listWrapper}>
          <FlatList
            data={filteredNotes}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={renderListHeader}
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
            contentContainerStyle={[styles.listContent, { paddingBottom: 40 }]}
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

      {/* Brand New Feature: AI Smart Note Synthesizer Modal */}
      <Modal
        visible={isAiModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsAiModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.aiModalContent, { backgroundColor: theme.cardBackground, borderColor: theme.borderSubtle }]}>
            <View style={styles.modalHandleBar} />

            <View style={styles.aiModalHeader}>
              <View style={{ flex: 1 }}>
                <ThemedText type="titleMedium" style={{ fontSize: 18, fontWeight: '700' }}>
                  ✨ AI Note Synthesizer
                </ThemedText>
                <ThemedText type="bodySmall" style={{ color: theme.textSecondary, fontSize: 12 }}>
                  Transform transcripts or textbook excerpts into Cornell notes
                </ThemedText>
              </View>
              <TouchableOpacity
                onPress={() => setIsAiModalVisible(false)}
                style={styles.modalCloseBtn}>
                <Text style={{ color: theme.textSecondary, fontSize: 18, fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Spacing.xl }}>
              {/* Optional Title */}
              <ThemedText type="bodySmall" style={{ color: theme.text, fontWeight: '600', marginBottom: 4 }}>
                Note Title (Optional)
              </ThemedText>
              <TextInput
                placeholder="e.g. Operating Systems Concurrency"
                placeholderTextColor={theme.textSecondary}
                value={aiTitle}
                onChangeText={setAiTitle}
                style={[
                  styles.aiTextInput,
                  {
                    backgroundColor: theme.inputBackground,
                    borderColor: theme.borderSubtle,
                    color: theme.text,
                    marginBottom: Spacing.sm,
                  },
                ]}
              />

              {/* Source Lecture Text */}
              <ThemedText type="bodySmall" style={{ color: theme.text, fontWeight: '600', marginBottom: 4 }}>
                Source Text, Transcript or Concepts *
              </ThemedText>
              <TextInput
                placeholder="Paste lecture transcript, textbook concepts, or professor slides here..."
                placeholderTextColor={theme.textSecondary}
                value={aiSourceText}
                onChangeText={setAiSourceText}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                style={[
                  styles.aiTextArea,
                  {
                    backgroundColor: theme.inputBackground,
                    borderColor: theme.borderSubtle,
                    color: theme.text,
                    marginBottom: Spacing.sm,
                  },
                ]}
              />

              {/* Synthesis Format Chips */}
              <ThemedText type="bodySmall" style={{ color: theme.text, fontWeight: '600', marginBottom: 6 }}>
                Note Structure Format
              </ThemedText>
              <View style={styles.formatChipRow}>
                {[
                  { key: 'cornell', label: 'Cornell Method 📝' },
                  { key: 'executive', label: 'Executive Summary ⚡' },
                  { key: 'study_guide', label: 'Study Guide 🎯' },
                ].map((fmt) => (
                  <TouchableOpacity
                    key={fmt.key}
                    onPress={() => setAiFormat(fmt.key as any)}
                    style={[
                      styles.formatChip,
                      {
                        backgroundColor: aiFormat === fmt.key ? theme.brandPrimary : theme.surfaceSubtle,
                        borderColor: aiFormat === fmt.key ? theme.brandPrimary : theme.borderSubtle,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.formatChipText,
                        { color: aiFormat === fmt.key ? '#ffffff' : theme.text },
                      ]}>
                      {fmt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Link to Subject */}
              {subjects.length > 0 && (
                <>
                  <ThemedText type="bodySmall" style={{ color: theme.text, fontWeight: '600', marginTop: Spacing.sm, marginBottom: 6 }}>
                    Associate with Course
                  </ThemedText>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: Spacing.md }}>
                    <TouchableOpacity
                      onPress={() => setAiSubjectId(null)}
                      style={[
                        styles.subjectPickChip,
                        {
                          backgroundColor: aiSubjectId === null ? theme.brandPrimary : theme.surfaceSubtle,
                          borderColor: aiSubjectId === null ? theme.brandPrimary : theme.borderSubtle,
                        },
                      ]}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: aiSubjectId === null ? '#ffffff' : theme.text }}>
                        None
                      </Text>
                    </TouchableOpacity>
                    {subjects.map((sub) => (
                      <TouchableOpacity
                        key={sub.id}
                        onPress={() => setAiSubjectId(sub.id)}
                        style={[
                          styles.subjectPickChip,
                          {
                            backgroundColor: aiSubjectId === sub.id ? theme.brandPrimary : theme.surfaceSubtle,
                            borderColor: aiSubjectId === sub.id ? theme.brandPrimary : theme.borderSubtle,
                          },
                        ]}>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: aiSubjectId === sub.id ? '#ffffff' : theme.text }}>
                          {sub.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}

              {/* Generate Action */}
              <Button
                title={isAiGenerating ? 'Synthesizing with AI Tutor...' : '✨ Generate & Save AI Note'}
                variant="primary"
                size="lg"
                loading={isAiGenerating}
                onPress={handleGenerateAiNote}
                style={{ marginTop: Spacing.sm }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.sm,
  },
  topHeader: {
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    paddingBottom: Spacing.xs,
  },
  listHeaderContainer: {
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xs,
    gap: Spacing.xs,
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addButton: {
    alignSelf: 'center',
  },
  heroCardCompact: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginVertical: 2,
  },
  heroHeaderCompact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  heroBadgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroStatsRowCompact: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginTop: 2,
  },
  heroStatItemCompact: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
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
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    marginTop: 2,
  },
  sortPill: {
    paddingVertical: 2,
  },
  sortPillText: {
    fontSize: 12,
    fontWeight: '600',
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
  listWrapper: {
    flex: 1,
    position: 'relative',
  },
  listContent: {
    paddingTop: Spacing.xs,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  aiModalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    borderTopWidth: 1,
    padding: Spacing.md,
    maxHeight: '88%',
  },
  modalHandleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#64748b',
    alignSelf: 'center',
    marginBottom: Spacing.sm,
  },
  aiModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  modalCloseBtn: {
    padding: Spacing.xs,
  },
  aiTextInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm + 2,
    fontSize: 14,
  },
  aiTextArea: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm + 2,
    fontSize: 14,
    minHeight: 120,
  },
  formatChipRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: Spacing.sm,
    flexWrap: 'wrap',
  },
  formatChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  formatChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  subjectPickChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
});
