import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  CardFormModal,
  CardItem,
  DeckCard,
  DeckFormModal,
  FlashcardFlipCard,
} from '@/components/flashcards';
import { ThemedText } from '@/components/themed-text';
import { Badge, Button, EmptyState, Input, ScreenWrapper } from '@/components/ui';
import { BorderRadius, MinTouchTarget, Spacing } from '@/constants/theme';
import { useFlashcards } from '@/hooks/use-flashcards';
import { useSubjects } from '@/hooks/use-subjects';
import { useTheme } from '@/hooks/use-theme';
import {
  CardCreate,
  DeckCreate,
  Flashcard,
  FlashcardDeck,
  FlashcardDeckWithCards,
} from '@/types/flashcard';

export default function FlashcardsScreen() {
  const router = useRouter();
  const theme = useTheme();

  const {
    decks,
    isLoading,
    isRefreshing,
    error,
    fetchDecks,
    fetchDeck,
    createDeck,
    updateDeck,
    deleteDeck,
    createCard,
    updateCard,
    deleteCard,
  } = useFlashcards();

  const { subjects } = useSubjects();

  // Selected Deck State
  const [selectedDeck, setSelectedDeck] = useState<FlashcardDeckWithCards | null>(null);
  const [isLoadingDeck, setIsLoadingDeck] = useState(false);
  const [deckTab, setDeckTab] = useState<'study' | 'cards'>('study');

  // Study Mode State
  const [studyCards, setStudyCards] = useState<Flashcard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isShuffled, setIsShuffled] = useState(false);
  const [masteredCardIds, setMasteredCardIds] = useState<Set<string>>(() => new Set());
  const [reviewCardIds, setReviewCardIds] = useState<Set<string>>(() => new Set());
  const [isSessionCompleted, setIsSessionCompleted] = useState(false);

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<'default' | 'title' | 'cards'>('default');

  // Modals State
  const [isDeckModalOpen, setIsDeckModalOpen] = useState(false);
  const [editingDeck, setEditingDeck] = useState<FlashcardDeck | null>(null);
  const [isSavingDeck, setIsSavingDeck] = useState(false);

  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<Flashcard | null>(null);
  const [isSavingCard, setIsSavingCard] = useState(false);

  // Subject lookup helper
  const subjectMap = useMemo(() => {
    const map = new Map<string, { name: string; color: string }>();
    for (const sub of subjects) {
      map.set(sub.id, { name: sub.name, color: sub.color || '#6366F1' });
    }
    return map;
  }, [subjects]);

  // Total cards across all decks
  const totalCardsCount = useMemo(() => {
    return decks.reduce((acc, d) => acc + (d.card_count || 0), 0);
  }, [decks]);

  // Filtered and sorted decks list
  const filteredDecks = useMemo(() => {
    const list = decks.filter((deck) => {
      const matchesSubject =
        selectedSubjectId === null || deck.subject_id === selectedSubjectId;
      const cleanSearch = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !cleanSearch ||
        deck.title.toLowerCase().includes(cleanSearch) ||
        (deck.description && deck.description.toLowerCase().includes(cleanSearch));
      return matchesSubject && matchesSearch;
    });

    if (sortMode === 'title') {
      return [...list].sort((a, b) => a.title.localeCompare(b.title));
    }
    if (sortMode === 'cards') {
      return [...list].sort((a, b) => (b.card_count || 0) - (a.card_count || 0));
    }
    return list;
  }, [decks, selectedSubjectId, searchQuery, sortMode]);

  // Back navigation handler
  const handleBack = () => {
    if (selectedDeck) {
      setSelectedDeck(null);
      setIsFlipped(false);
      setCurrentCardIndex(0);
      setMasteredCardIds(new Set());
      setReviewCardIds(new Set());
      setIsSessionCompleted(false);
      fetchDecks();
    } else {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/explore' as never);
      }
    }
  };

  // Open a deck for details or study mode
  const handleOpenDeck = useCallback(
    async (deckId: string, initialTab: 'study' | 'cards' = 'study') => {
      setIsLoadingDeck(true);
      try {
        const fullDeck = await fetchDeck(deckId);
        setSelectedDeck(fullDeck);
        setStudyCards(fullDeck.cards);
        setCurrentCardIndex(0);
        setIsFlipped(false);
        setIsShuffled(false);
        setMasteredCardIds(new Set());
        setReviewCardIds(new Set());
        setIsSessionCompleted(false);
        setDeckTab(initialTab);
      } catch {
        // Error handled in hook
      } finally {
        setIsLoadingDeck(false);
      }
    },
    [fetchDeck]
  );

  // Deck CRUD actions
  const handleSaveDeck = async (payload: DeckCreate) => {
    setIsSavingDeck(true);
    try {
      if (editingDeck) {
        await updateDeck(editingDeck.id, payload);
      } else {
        await createDeck(payload);
      }
      setIsDeckModalOpen(false);
      setEditingDeck(null);
    } finally {
      setIsSavingDeck(false);
    }
  };

  const handleDeleteDeck = (deck: FlashcardDeck) => {
    Alert.alert(
      'Delete Deck',
      `Are you sure you want to delete "${deck.title}" and all its flashcards? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDeck(deck.id);
            } catch {
              // Error handled in hook
            }
          },
        },
      ]
    );
  };

  // Card CRUD actions
  const handleSaveCard = async (payload: CardCreate) => {
    if (!selectedDeck) return;
    setIsSavingCard(true);
    try {
      if (editingCard) {
        const updated = await updateCard(selectedDeck.id, editingCard.id, payload);
        const newCards = selectedDeck.cards.map((c) =>
          c.id === editingCard.id ? updated : c
        );
        setSelectedDeck({ ...selectedDeck, cards: newCards });
        setStudyCards(newCards);
      } else {
        const created = await createCard(selectedDeck.id, payload);
        const newCards = [...selectedDeck.cards, created];
        setSelectedDeck({
          ...selectedDeck,
          card_count: selectedDeck.card_count + 1,
          cards: newCards,
        });
        setStudyCards(newCards);
      }
      setIsCardModalOpen(false);
      setEditingCard(null);
    } finally {
      setIsSavingCard(false);
    }
  };

  const handleDeleteCard = (card: Flashcard) => {
    if (!selectedDeck) return;
    Alert.alert(
      'Delete Card',
      'Are you sure you want to delete this flashcard?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCard(selectedDeck.id, card.id);
              const newCards = selectedDeck.cards.filter((c) => c.id !== card.id);
              setSelectedDeck({
                ...selectedDeck,
                card_count: Math.max(0, selectedDeck.card_count - 1),
                cards: newCards,
              });
              setStudyCards(newCards);
              if (currentCardIndex >= newCards.length) {
                setCurrentCardIndex(Math.max(0, newCards.length - 1));
              }
            } catch {
              // Error handled in hook
            }
          },
        },
      ]
    );
  };

  // Study mode navigation
  const handleNextCard = () => {
    if (studyCards.length === 0) return;
    setIsFlipped(false);
    setCurrentCardIndex((prev) => (prev + 1) % studyCards.length);
  };

  const handlePrevCard = () => {
    if (studyCards.length === 0) return;
    setIsFlipped(false);
    setCurrentCardIndex((prev) => (prev - 1 + studyCards.length) % studyCards.length);
  };

  const handleToggleShuffle = () => {
    if (studyCards.length <= 1) return;
    setIsFlipped(false);
    setCurrentCardIndex(0);
    if (!isShuffled) {
      // Shuffle cards
      const shuffled = [...studyCards].sort(() => Math.random() - 0.5);
      setStudyCards(shuffled);
      setIsShuffled(true);
    } else {
      // Restore original order
      if (selectedDeck) {
        setStudyCards(selectedDeck.cards);
      }
      setIsShuffled(false);
    }
  };

  // Self-assessment feedback handler
  const handleRateCard = (cardId: string, rating: 'review' | 'mastered') => {
    if (!cardId) return;
    if (rating === 'mastered') {
      setMasteredCardIds((prev) => {
        const next = new Set(prev);
        next.add(cardId);
        return next;
      });
      setReviewCardIds((prev) => {
        const next = new Set(prev);
        next.delete(cardId);
        return next;
      });
    } else {
      setReviewCardIds((prev) => {
        const next = new Set(prev);
        next.add(cardId);
        return next;
      });
      setMasteredCardIds((prev) => {
        const next = new Set(prev);
        next.delete(cardId);
        return next;
      });
    }

    if (currentCardIndex < studyCards.length - 1) {
      setIsFlipped(false);
      setCurrentCardIndex((prev) => prev + 1);
    } else {
      setIsSessionCompleted(true);
    }
  };

  // Selected deck's subject info
  const selectedDeckSubject = selectedDeck?.subject_id
    ? subjectMap.get(selectedDeck.subject_id)
    : null;

  return (
    <ScreenWrapper
      scrollable={true}
      includeTopInset
      includeBottomInset
      includeTabInset={false}
      refreshing={!selectedDeck && isRefreshing}
      onRefresh={!selectedDeck ? () => fetchDecks(undefined, true) : undefined}
      contentContainerStyle={styles.container}>
      {/* ==================================================================== */}
      {/* Top Bar Header                                                       */}
      {/* ==================================================================== */}
      <View style={styles.topBar}>
        <Pressable
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel={selectedDeck ? 'Back to decks list' : 'Back to Study Hub'}
          style={({ pressed }) => [
            styles.backButton,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.borderSubtle,
              opacity: pressed ? 0.75 : 1,
            },
          ]}>
          <Text style={[styles.backArrow, { color: theme.brandPrimary }]}>←</Text>
        </Pressable>

        <View style={styles.titleContainer}>
          <ThemedText
            type="smallBold"
            style={{ color: theme.brandPrimary, letterSpacing: 0.8 }}>
            ACTIVE RECALL
          </ThemedText>
          <ThemedText
            type="headlineMedium"
            numberOfLines={1}
            style={styles.screenTitle}>
            {selectedDeck ? selectedDeck.title : 'Flashcards'}
          </ThemedText>
        </View>

        {!selectedDeck ? (
          <Button
            title="+ Deck"
            variant="primary"
            size="sm"
            onPress={() => {
              setEditingDeck(null);
              setIsDeckModalOpen(true);
            }}
            accessibilityLabel="Create a new flashcard deck"
          />
        ) : (
          <Button
            title="+ Card"
            variant="primary"
            size="sm"
            onPress={() => {
              setEditingCard(null);
              setIsCardModalOpen(true);
            }}
            accessibilityLabel="Add card to this deck"
          />
        )}
      </View>

      {/* ==================================================================== */}
      {/* View 1: Deck List                                                    */}
      {/* ==================================================================== */}
      {!selectedDeck && (
        <View style={styles.decksView}>
          {/* Active Recall Mastery Pulse Hero Card */}
          <View
            style={[
              styles.heroCard,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.brandPrimary + '35',
              },
            ]}>
            <View style={styles.heroTopRow}>
              <View
                style={[
                  styles.heroBadge,
                  {
                    backgroundColor: theme.brandPrimary + '1A',
                    borderColor: theme.brandPrimary + '38',
                  },
                ]}>
                <Text style={{ fontSize: 13 }}>🧠</Text>
                <ThemedText
                  type="smallBold"
                  style={{
                    color: theme.brandPrimary,
                    fontSize: 11,
                    letterSpacing: 0.6,
                  }}>
                  ACTIVE RECALL ENGINE
                </ThemedText>
              </View>

              <View
                style={[
                  styles.retentionPill,
                  {
                    backgroundColor: theme.statusSuccess + '1A',
                    borderColor: theme.statusSuccess + '35',
                  },
                ]}>
                <View
                  style={[styles.pulseDot, { backgroundColor: theme.statusSuccess }]}
                />
                <ThemedText
                  type="small"
                  style={{
                    color: theme.statusSuccess,
                    fontSize: 11,
                    fontWeight: '700',
                  }}>
                  Spaced Retention
                </ThemedText>
              </View>
            </View>

            <ThemedText type="headlineMedium" style={styles.heroTitle}>
              Accelerate Memory & Long-Term Recall
            </ThemedText>
            <ThemedText
              type="bodySmall"
              style={{ color: theme.textSecondary, lineHeight: 18 }}>
              Flip cards, self-assess understanding, and cement key university concepts before exams.
            </ThemedText>

            {/* Metrics Grid */}
            <View
              style={[
                styles.heroMetricsGrid,
                {
                  backgroundColor: theme.inputBackground,
                  borderColor: theme.borderSubtle,
                },
              ]}>
              <View style={styles.heroMetricItem}>
                <ThemedText
                  type="titleMedium"
                  style={{ color: theme.brandPrimary, fontWeight: '800' }}>
                  {decks.length}
                </ThemedText>
                <ThemedText
                  type="small"
                  style={{ color: theme.textSecondary, fontSize: 11 }}>
                  📚 Decks
                </ThemedText>
              </View>

              <View
                style={[
                  styles.heroMetricDivider,
                  { backgroundColor: theme.borderSubtle },
                ]}
              />

              <View style={styles.heroMetricItem}>
                <ThemedText
                  type="titleMedium"
                  style={{ color: theme.text, fontWeight: '800' }}>
                  {totalCardsCount}
                </ThemedText>
                <ThemedText
                  type="small"
                  style={{ color: theme.textSecondary, fontSize: 11 }}>
                  🎴 Total Cards
                </ThemedText>
              </View>

              <View
                style={[
                  styles.heroMetricDivider,
                  { backgroundColor: theme.borderSubtle },
                ]}
              />

              <View style={styles.heroMetricItem}>
                <ThemedText
                  type="titleMedium"
                  style={{ color: theme.statusSuccess, fontWeight: '800' }}>
                  {decks.filter((d) => (d.card_count || 0) > 0).length}
                </ThemedText>
                <ThemedText
                  type="small"
                  style={{ color: theme.textSecondary, fontSize: 11 }}>
                  ⚡ Ready Decks
                </ThemedText>
              </View>
            </View>
          </View>

          {/* Search Input with Prefix & Clear Button */}
          <Input
            placeholder="Search decks..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            showClearButton={Boolean(searchQuery)}
            onClear={() => setSearchQuery('')}
            leftElement={
              <Text style={{ fontSize: 15, marginRight: 6 }}>🔍</Text>
            }
            containerStyle={styles.searchInput}
          />

          {/* Quick Sort Bar */}
          <View style={styles.sortRow}>
            <ThemedText
              type="small"
              style={{ color: theme.textTertiary, marginRight: 4, fontSize: 11 }}>
              Sort:
            </ThemedText>

            <Pressable
              onPress={() => setSortMode('default')}
              accessibilityRole="button"
              accessibilityLabel="Sort by recent"
              style={[
                styles.sortChip,
                {
                  backgroundColor:
                    sortMode === 'default'
                      ? theme.brandPrimary + '20'
                      : theme.cardBackground,
                  borderColor:
                    sortMode === 'default'
                      ? theme.brandPrimary
                      : theme.borderSubtle,
                },
              ]}>
              <ThemedText
                type="smallBold"
                style={{
                  color:
                    sortMode === 'default'
                      ? theme.brandPrimary
                      : theme.textSecondary,
                  fontSize: 11,
                }}>
                🕒 Recent
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={() => setSortMode('title')}
              accessibilityRole="button"
              accessibilityLabel="Sort by deck title"
              style={[
                styles.sortChip,
                {
                  backgroundColor:
                    sortMode === 'title'
                      ? theme.brandPrimary + '20'
                      : theme.cardBackground,
                  borderColor:
                    sortMode === 'title'
                      ? theme.brandPrimary
                      : theme.borderSubtle,
                },
              ]}>
              <ThemedText
                type="smallBold"
                style={{
                  color:
                    sortMode === 'title'
                      ? theme.brandPrimary
                      : theme.textSecondary,
                  fontSize: 11,
                }}>
                🔤 Title A-Z
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={() => setSortMode('cards')}
              accessibilityRole="button"
              accessibilityLabel="Sort by card count"
              style={[
                styles.sortChip,
                {
                  backgroundColor:
                    sortMode === 'cards'
                      ? theme.brandPrimary + '20'
                      : theme.cardBackground,
                  borderColor:
                    sortMode === 'cards'
                      ? theme.brandPrimary
                      : theme.borderSubtle,
                },
              ]}>
              <ThemedText
                type="smallBold"
                style={{
                  color:
                    sortMode === 'cards'
                      ? theme.brandPrimary
                      : theme.textSecondary,
                  fontSize: 11,
                }}>
                📑 Most Cards
              </ThemedText>
            </Pressable>
          </View>

          {/* Subject Filter Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterChipsRow}>
            <Pressable
              onPress={() => setSelectedSubjectId(null)}
              accessibilityRole="button"
              accessibilityLabel="Show all decks"
              style={[
                styles.filterChip,
                {
                  backgroundColor:
                    selectedSubjectId === null
                      ? theme.brandPrimary
                      : theme.cardBackground,
                  borderColor:
                    selectedSubjectId === null
                      ? theme.brandPrimary
                      : theme.borderSubtle,
                },
              ]}>
              <ThemedText
                type="smallBold"
                style={{
                  color: selectedSubjectId === null ? '#FFFFFF' : theme.textSecondary,
                }}>
                All ({decks.length})
              </ThemedText>
            </Pressable>

            {subjects.map((sub) => {
              const isSelected = selectedSubjectId === sub.id;
              const chipColor = sub.color || theme.brandPrimary;
              return (
                <Pressable
                  key={sub.id}
                  onPress={() => setSelectedSubjectId(sub.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Filter decks by subject ${sub.name}`}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: isSelected ? chipColor : theme.cardBackground,
                      borderColor: isSelected ? chipColor : theme.borderSubtle,
                    },
                  ]}>
                  <ThemedText
                    type="smallBold"
                    style={{
                      color: isSelected ? '#FFFFFF' : theme.textSecondary,
                    }}>
                    {sub.name}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Loading Indicator */}
          {isLoading && !isRefreshing && (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={theme.brandPrimary} />
              <ThemedText type="bodyMedium" style={{ color: theme.textSecondary }}>
                Loading flashcard decks...
              </ThemedText>
            </View>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <EmptyState
              icon="⚠️"
              title="Unable to load decks"
              description={error}
              actionLabel="Retry"
              onAction={() => fetchDecks()}
            />
          )}

          {/* Empty State */}
          {!isLoading && !error && filteredDecks.length === 0 && (
            <EmptyState
              icon="🎴"
              title={searchQuery ? 'No matching decks' : 'No flashcard decks yet'}
              description={
                searchQuery
                  ? 'Try searching with a different keyword or clearing filters.'
                  : 'Organize your study material into flashcard decks to practice active recall.'
              }
              actionLabel="+ Create First Deck"
              onAction={() => {
                setEditingDeck(null);
                setIsDeckModalOpen(true);
              }}
            />
          )}

          {/* Decks List */}
          {!isLoading &&
            !error &&
            filteredDecks.map((deck, idx) => {
              const sub = deck.subject_id ? subjectMap.get(deck.subject_id) : null;
              return (
                <DeckCard
                  key={deck.id}
                  deck={deck}
                  index={idx}
                  subjectName={sub?.name}
                  subjectColor={sub?.color}
                  onPress={() => handleOpenDeck(deck.id, 'study')}
                  onStudyPress={() => handleOpenDeck(deck.id, 'study')}
                  onEditPress={() => {
                    setEditingDeck(deck);
                    setIsDeckModalOpen(true);
                  }}
                  onDeletePress={() => handleDeleteDeck(deck)}
                />
              );
            })}
        </View>
      )}

      {/* ==================================================================== */}
      {/* View 2: Selected Deck Details & Study Mode                           */}
      {/* ==================================================================== */}
      {selectedDeck && (
        <View style={styles.deckDetailView}>
          {/* Deck Metadata Header Box */}
          <View
            style={[
              styles.deckInfoCard,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.borderSubtle,
              },
            ]}>
            <View style={styles.deckInfoTop}>
              <View style={styles.deckBadges}>
                {selectedDeckSubject ? (
                  <View
                    style={[
                      styles.subjectBadge,
                      {
                        backgroundColor: selectedDeckSubject.color + '20',
                        borderColor: selectedDeckSubject.color + '40',
                      },
                    ]}>
                    <View
                      style={[
                        styles.subjectDot,
                        { backgroundColor: selectedDeckSubject.color },
                      ]}
                    />
                    <ThemedText
                      type="smallBold"
                      style={{ color: selectedDeckSubject.color, fontSize: 11 }}>
                      {selectedDeckSubject.name}
                    </ThemedText>
                  </View>
                ) : null}

                <Badge
                  label={`${studyCards.length} ${studyCards.length === 1 ? 'card' : 'cards'}`}
                  variant="brand"
                  size="sm"
                />
              </View>

              {/* Edit deck button */}
              <Pressable
                onPress={() => {
                  setEditingDeck(selectedDeck);
                  setIsDeckModalOpen(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="Edit deck info"
                style={({ pressed }) => [
                  styles.smallIconBtn,
                  { opacity: pressed ? 0.7 : 1 },
                ]}>
                <Text style={{ fontSize: 16 }}>✏️</Text>
              </Pressable>
            </View>

            {selectedDeck.description ? (
              <ThemedText
                type="bodySmall"
                numberOfLines={deckTab === 'study' ? 1 : undefined}
                style={{ color: theme.textSecondary, marginTop: 2 }}>
                {selectedDeck.description}
              </ThemedText>
            ) : null}

            {/* Segmented Mode Selector */}
            <View
              style={[
                styles.modeSelector,
                { backgroundColor: theme.inputBackground },
              ]}>
              <Pressable
                onPress={() => setDeckTab('study')}
                accessibilityRole="button"
                accessibilityLabel="Study mode"
                style={[
                  styles.modeButton,
                  deckTab === 'study' && [
                    styles.modeButtonActive,
                    { backgroundColor: theme.cardBackground },
                  ],
                ]}>
                <ThemedText
                  type="smallBold"
                  style={{
                    color:
                      deckTab === 'study'
                        ? theme.brandPrimary
                        : theme.textSecondary,
                  }}>
                  📖 Study Mode
                </ThemedText>
              </Pressable>

              <Pressable
                onPress={() => setDeckTab('cards')}
                accessibilityRole="button"
                accessibilityLabel="Manage cards list"
                style={[
                  styles.modeButton,
                  deckTab === 'cards' && [
                    styles.modeButtonActive,
                    { backgroundColor: theme.cardBackground },
                  ],
                ]}>
                <ThemedText
                  type="smallBold"
                  style={{
                    color:
                      deckTab === 'cards'
                        ? theme.brandPrimary
                        : theme.textSecondary,
                  }}>
                  📝 Cards ({studyCards.length})
                </ThemedText>
              </Pressable>
            </View>
          </View>

          {/* Loading Single Deck */}
          {isLoadingDeck && (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={theme.brandPrimary} />
            </View>
          )}

          {/* Tab 1: Study Mode */}
          {!isLoadingDeck && deckTab === 'study' && (
            <View style={styles.studyWorkspace}>
              {studyCards.length === 0 ? (
                <EmptyState
                  icon="🃏"
                  title="No cards in this deck"
                  description="Add cards with question and answer prompts to start interactive recall studying."
                  actionLabel="+ Add First Card"
                  onAction={() => {
                    setEditingCard(null);
                    setIsCardModalOpen(true);
                  }}
                />
              ) : isSessionCompleted ? (
                /* Session Completion Celebration Screen */
                <View
                  style={[
                    styles.completionCard,
                    {
                      backgroundColor: theme.cardBackground,
                      borderColor: theme.statusSuccess + '50',
                    },
                  ]}>
                  <Text style={{ fontSize: 44, textAlign: 'center', marginBottom: 6 }}>
                    🎉
                  </Text>
                  <ThemedText
                    type="headlineMedium"
                    style={{ textAlign: 'center', fontWeight: '800' }}>
                    Study Session Complete!
                  </ThemedText>
                  <ThemedText
                    type="bodySmall"
                    style={{
                      color: theme.textSecondary,
                      textAlign: 'center',
                      marginTop: 4,
                      lineHeight: 19,
                    }}>
                    Great job! You reviewed all {studyCards.length} flashcards. Active recall strengthens long-term memory retention.
                  </ThemedText>

                  {/* Results summary stats */}
                  <View
                    style={[
                      styles.sessionStatsBox,
                      {
                        backgroundColor: theme.inputBackground,
                        borderColor: theme.borderSubtle,
                      },
                    ]}>
                    <View style={styles.sessionStatItem}>
                      <ThemedText
                        type="titleMedium"
                        style={{ color: theme.statusSuccess, fontWeight: '800' }}>
                        {masteredCardIds.size}
                      </ThemedText>
                      <ThemedText
                        type="small"
                        style={{ color: theme.textSecondary, fontSize: 11 }}>
                        🟢 Mastered
                      </ThemedText>
                    </View>

                    <View
                      style={[
                        styles.heroMetricDivider,
                        { backgroundColor: theme.borderSubtle },
                      ]}
                    />

                    <View style={styles.sessionStatItem}>
                      <ThemedText
                        type="titleMedium"
                        style={{ color: theme.statusDanger, fontWeight: '800' }}>
                        {reviewCardIds.size}
                      </ThemedText>
                      <ThemedText
                        type="small"
                        style={{ color: theme.textSecondary, fontSize: 11 }}>
                        🔴 Need Review
                      </ThemedText>
                    </View>

                    <View
                      style={[
                        styles.heroMetricDivider,
                        { backgroundColor: theme.borderSubtle },
                      ]}
                    />

                    <View style={styles.sessionStatItem}>
                      <ThemedText
                        type="titleMedium"
                        style={{ color: theme.brandPrimary, fontWeight: '800' }}>
                        {studyCards.length > 0
                          ? Math.round(
                              (masteredCardIds.size / studyCards.length) * 100
                            )
                          : 0}
                        %
                      </ThemedText>
                      <ThemedText
                        type="small"
                        style={{ color: theme.textSecondary, fontSize: 11 }}>
                        🎯 Accuracy
                      </ThemedText>
                    </View>
                  </View>

                  <View style={{ gap: Spacing.sm, marginTop: Spacing.md, width: '100%' }}>
                    <Button
                      title="🔄 Study Again"
                      variant="primary"
                      size="md"
                      onPress={() => {
                        setCurrentCardIndex(0);
                        setIsFlipped(false);
                        setMasteredCardIds(new Set());
                        setReviewCardIds(new Set());
                        setIsSessionCompleted(false);
                      }}
                      accessibilityLabel="Study this deck again"
                    />

                    <Button
                      title="← Back to All Decks"
                      variant="secondary"
                      size="md"
                      onPress={handleBack}
                      accessibilityLabel="Return to flashcard decks list"
                    />
                  </View>
                </View>
              ) : (
                <>
                  {/* Study Toolbar: Position & Shuffle */}
                  <View style={styles.studyToolbar}>
                    <View style={styles.studyCardCounterRow}>
                      <ThemedText
                        type="smallBold"
                        style={{ color: theme.brandPrimary }}>
                        CARD {currentCardIndex + 1} OF {studyCards.length}
                      </ThemedText>
                      <ThemedText
                        type="small"
                        style={{ color: theme.textSecondary, fontSize: 11 }}>
                        ({Math.round(((currentCardIndex + 1) / studyCards.length) * 100)}%)
                      </ThemedText>
                    </View>

                    <View style={styles.studyToolbarRightActions}>
                      <Pressable
                        onPress={handleToggleShuffle}
                        accessibilityRole="button"
                        accessibilityLabel="Shuffle study cards"
                        style={[
                          styles.shuffleBtn,
                          {
                            backgroundColor: isShuffled
                              ? theme.brandPrimary + '20'
                              : theme.inputBackground,
                            borderColor: isShuffled
                              ? theme.brandPrimary
                              : theme.borderSubtle,
                          },
                        ]}>
                        <Text style={{ fontSize: 13 }}>🔀</Text>
                        <ThemedText
                          type="smallBold"
                          style={{
                            color: isShuffled
                              ? theme.brandPrimary
                              : theme.textSecondary,
                            fontSize: 12,
                          }}>
                          {isShuffled ? 'Shuffled' : 'Shuffle'}
                        </ThemedText>
                      </Pressable>

                      <Pressable
                        onPress={() => setIsSessionCompleted(true)}
                        accessibilityRole="button"
                        accessibilityLabel="Finish study session"
                        style={[
                          styles.finishBtn,
                          {
                            backgroundColor: theme.inputBackground,
                            borderColor: theme.borderSubtle,
                          },
                        ]}>
                        <ThemedText
                          type="smallBold"
                          style={{ color: theme.textSecondary, fontSize: 11 }}>
                          Finish 🏁
                        </ThemedText>
                      </Pressable>
                    </View>
                  </View>

                  {/* Progress Indicator Bar */}
                  <View
                    style={[
                      styles.progressBarTrack,
                      { backgroundColor: theme.inputBackground },
                    ]}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          backgroundColor: theme.brandPrimary,
                          width: `${((currentCardIndex + 1) / studyCards.length) * 100}%`,
                        },
                      ]}
                    />
                  </View>

                  {/* 3D Animated Flip Card */}
                  <FlashcardFlipCard
                    card={studyCards[currentCardIndex]}
                    isFlipped={isFlipped}
                    onFlip={() => setIsFlipped((prev) => !prev)}
                    currentIndex={currentCardIndex}
                    totalCards={studyCards.length}
                  />

                  {/* Self-Assessment Active Recall Rating Buttons */}
                  <View style={styles.recallFeedbackContainer}>
                    <ThemedText
                      type="small"
                      style={{
                        color: theme.textTertiary,
                        textAlign: 'center',
                        marginBottom: 6,
                        fontSize: 10,
                        letterSpacing: 0.5,
                      }}>
                      DID YOU RECALL THIS CONCEPT?
                    </ThemedText>

                    {currentCardIndex === studyCards.length - 1 && (
                      <ThemedText
                        type="small"
                        style={{
                          color: theme.brandPrimary,
                          textAlign: 'center',
                          marginBottom: 8,
                          fontSize: 11,
                          fontWeight: '600',
                        }}>
                        💡 Final Card — Rate below or tap Finish 🏁 to view results!
                      </ThemedText>
                    )}

                    <View style={styles.recallButtonsRow}>
                      <Pressable
                        onPress={() =>
                          handleRateCard(
                            studyCards[currentCardIndex]?.id,
                            'review'
                          )
                        }
                        accessibilityRole="button"
                        accessibilityLabel="Mark card as needs review"
                        style={({ pressed }) => [
                          styles.recallScoreBtn,
                          {
                            backgroundColor: reviewCardIds.has(
                              studyCards[currentCardIndex]?.id
                            )
                              ? theme.statusDanger + '26'
                              : theme.inputBackground,
                            borderColor: reviewCardIds.has(
                              studyCards[currentCardIndex]?.id
                            )
                              ? theme.statusDanger
                              : theme.borderSubtle,
                            opacity: pressed ? 0.75 : 1,
                            transform: [{ scale: pressed ? 0.96 : 1 }],
                          },
                        ]}>
                        <Text style={{ fontSize: 13 }}>🔴</Text>
                        <ThemedText
                          type="smallBold"
                          style={{
                            color: reviewCardIds.has(
                              studyCards[currentCardIndex]?.id
                            )
                              ? theme.statusDanger
                              : theme.textSecondary,
                            fontSize: 12,
                          }}>
                          Need Review
                        </ThemedText>
                      </Pressable>

                      <Pressable
                        onPress={() =>
                          handleRateCard(
                            studyCards[currentCardIndex]?.id,
                            'mastered'
                          )
                        }
                        accessibilityRole="button"
                        accessibilityLabel="Mark card as mastered"
                        style={({ pressed }) => [
                          styles.recallScoreBtn,
                          {
                            backgroundColor: masteredCardIds.has(
                              studyCards[currentCardIndex]?.id
                            )
                              ? theme.statusSuccess + '26'
                              : theme.inputBackground,
                            borderColor: masteredCardIds.has(
                              studyCards[currentCardIndex]?.id
                            )
                              ? theme.statusSuccess
                              : theme.borderSubtle,
                            opacity: pressed ? 0.75 : 1,
                            transform: [{ scale: pressed ? 0.96 : 1 }],
                          },
                        ]}>
                        <Text style={{ fontSize: 13 }}>🟢</Text>
                        <ThemedText
                          type="smallBold"
                          style={{
                            color: masteredCardIds.has(
                              studyCards[currentCardIndex]?.id
                            )
                              ? theme.statusSuccess
                              : theme.textSecondary,
                            fontSize: 12,
                          }}>
                          Got It / Mastered
                        </ThemedText>
                      </Pressable>
                    </View>
                  </View>

                  {/* Navigation Controls Row */}
                  <View style={styles.studyControlsRow}>
                    <Button
                      title="← Prev"
                      variant="secondary"
                      size="md"
                      onPress={handlePrevCard}
                      disabled={currentCardIndex === 0}
                      accessibilityLabel="Go to previous card"
                      style={{ flex: 1 }}
                    />

                    <Button
                      title={isFlipped ? 'Show Question' : 'Flip Card 🔄'}
                      variant="primary"
                      size="md"
                      onPress={() => setIsFlipped((prev) => !prev)}
                      accessibilityLabel="Flip between question and answer"
                      style={{ flex: 1.5 }}
                    />

                    <Button
                      title={currentCardIndex === studyCards.length - 1 ? 'Finish 🏁' : 'Next →'}
                      variant={currentCardIndex === studyCards.length - 1 ? 'primary' : 'secondary'}
                      size="md"
                      onPress={() => {
                        if (currentCardIndex === studyCards.length - 1) {
                          setIsSessionCompleted(true);
                        } else {
                          handleNextCard();
                        }
                      }}
                      accessibilityLabel={
                        currentCardIndex === studyCards.length - 1
                          ? 'Finish study session and view summary'
                          : 'Go to next card'
                      }
                      style={{ flex: 1 }}
                    />
                  </View>
                </>
              )}
            </View>
          )}

          {/* Tab 2: Manage Cards List */}
          {!isLoadingDeck && deckTab === 'cards' && (
            <View style={styles.cardsListWorkspace}>
              {studyCards.length === 0 ? (
                <EmptyState
                  icon="📝"
                  title="No cards created yet"
                  description="Tap '+ Add Card' above or below to build this deck."
                  actionLabel="+ Add Card"
                  onAction={() => {
                    setEditingCard(null);
                    setIsCardModalOpen(true);
                  }}
                />
              ) : (
                studyCards.map((card, idx) => (
                  <CardItem
                    key={card.id}
                    card={card}
                    index={idx}
                    onEdit={() => {
                      setEditingCard(card);
                      setIsCardModalOpen(true);
                    }}
                    onDelete={() => handleDeleteCard(card)}
                  />
                ))
              )}
            </View>
          )}
        </View>
      )}

      {/* ==================================================================== */}
      {/* Modals                                                               */}
      {/* ==================================================================== */}
      <DeckFormModal
        visible={isDeckModalOpen}
        deck={editingDeck}
        subjects={subjects}
        isSaving={isSavingDeck}
        onClose={() => {
          setIsDeckModalOpen(false);
          setEditingDeck(null);
        }}
        onSave={handleSaveDeck}
      />

      <CardFormModal
        visible={isCardModalOpen}
        card={editingCard}
        isSaving={isSavingCard}
        onClose={() => {
          setIsCardModalOpen(false);
          setEditingCard(null);
        }}
        onSave={handleSaveCard}
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 72,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  backButton: {
    width: MinTouchTarget,
    height: MinTouchTarget,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  titleContainer: {
    flex: 1,
  },
  screenTitle: {
    marginTop: 2,
  },
  decksView: {
    gap: Spacing.xs,
  },
  searchInput: {
    marginBottom: Spacing.xs,
  },
  filterChipsRow: {
    gap: Spacing.xs,
    paddingVertical: 6,
    marginBottom: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  centerBox: {
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  deckDetailView: {
    gap: Spacing.xs,
  },
  deckInfoCard: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: 4,
  },
  deckInfoTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deckBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  subjectBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  subjectDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  smallIconBtn: {
    width: MinTouchTarget,
    height: MinTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeSelector: {
    flexDirection: 'row',
    borderRadius: BorderRadius.md,
    padding: 3,
    marginTop: 4,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: BorderRadius.sm,
  },
  modeButtonActive: {
    elevation: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  studyWorkspace: {
    paddingTop: 2,
  },
  studyToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    marginTop: 4,
  },
  shuffleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  progressBarTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 2,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  studyControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xl,
  },
  cardsListWorkspace: {
    gap: Spacing.xs,
    paddingTop: Spacing.xs,
  },
  heroCard: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1.2,
    padding: Spacing.md,
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  retentionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  heroTitle: {
    fontWeight: '800',
    fontSize: 18,
    lineHeight: 23,
    marginTop: 2,
  },
  heroMetricsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    marginTop: 6,
  },
  heroMetricItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  heroMetricDivider: {
    width: 1,
    height: 28,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  sortChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  completionCard: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    padding: Spacing.xl,
    alignItems: 'center',
    marginVertical: Spacing.md,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  sessionStatsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingVertical: Spacing.md,
    marginTop: Spacing.md,
    width: '100%',
  },
  sessionStatItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  studyCardCounterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  studyToolbarRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  finishBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  recallFeedbackContainer: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
    alignItems: 'center',
  },
  recallButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    width: '100%',
  },
  recallScoreBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
});
