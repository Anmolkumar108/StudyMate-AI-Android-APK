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

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);

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

  // Filtered decks list
  const filteredDecks = useMemo(() => {
    return decks.filter((deck) => {
      const matchesSubject =
        selectedSubjectId === null || deck.subject_id === selectedSubjectId;
      const cleanSearch = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !cleanSearch ||
        deck.title.toLowerCase().includes(cleanSearch) ||
        (deck.description && deck.description.toLowerCase().includes(cleanSearch));
      return matchesSubject && matchesSearch;
    });
  }, [decks, selectedSubjectId, searchQuery]);

  // Back navigation handler
  const handleBack = () => {
    if (selectedDeck) {
      setSelectedDeck(null);
      setIsFlipped(false);
      setCurrentCardIndex(0);
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

  // Selected deck's subject info
  const selectedDeckSubject = selectedDeck?.subject_id
    ? subjectMap.get(selectedDeck.subject_id)
    : null;

  return (
    <ScreenWrapper
      scrollable={!selectedDeck || deckTab === 'cards'}
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
          {/* Search Input */}
          <Input
            placeholder="Search decks..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            containerStyle={styles.searchInput}
          />

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
                style={{ color: theme.textSecondary, marginTop: 4 }}>
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
              ) : (
                <>
                  {/* Study Toolbar: Position & Shuffle */}
                  <View style={styles.studyToolbar}>
                    <ThemedText type="smallBold" style={{ color: theme.textSecondary }}>
                      CARD {currentCardIndex + 1} OF {studyCards.length}
                    </ThemedText>

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

                  {/* Navigation Controls Row */}
                  <View style={styles.studyControlsRow}>
                    <Button
                      title="← Prev"
                      variant="secondary"
                      size="md"
                      onPress={handlePrevCard}
                      disabled={studyCards.length <= 1}
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
                      title="Next →"
                      variant="secondary"
                      size="md"
                      onPress={handleNextCard}
                      disabled={studyCards.length <= 1}
                      accessibilityLabel="Go to next card"
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
    paddingBottom: Spacing.xl,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
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
    gap: Spacing.md,
  },
  deckInfoCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.sm,
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
    paddingVertical: 8,
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
    paddingTop: Spacing.xs,
  },
  studyToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
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
    marginBottom: Spacing.xs,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  studyControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  cardsListWorkspace: {
    gap: Spacing.xs,
    paddingTop: Spacing.xs,
  },
});
