import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ScreenWrapper } from '@/components/ui';
import { BorderRadius, Spacing } from '@/constants/theme';
import { searchApi } from '@/services/api/client';
import {
  addRecentSearch,
  clearRecentSearches,
  loadRecentSearches,
  removeRecentSearch,
} from '@/services/storage/search-history-storage';
import {
  SearchCategory,
  SearchResultItem,
  SearchResultType,
  UniversalSearchResponse,
} from '@/types/search';

interface CategoryTab {
  id: SearchCategory;
  label: string;
  icon: string;
}

const CATEGORY_TABS: CategoryTab[] = [
  { id: 'all', label: 'All', icon: '🔍' },
  { id: 'notes', label: 'Notes', icon: '📝' },
  { id: 'tasks', label: 'Tasks', icon: '✅' },
  { id: 'documents', label: 'PDFs', icon: '📄' },
  { id: 'flashcards', label: 'Flashcards', icon: '🗂️' },
  { id: 'subjects', label: 'Subjects', icon: '📚' },
  { id: 'exams', label: 'Exams', icon: '🎯' },
];

const QUICK_SUGGESTIONS = [
  'Data Structures',
  'Midterm Exam',
  'Assignment',
  'Algorithms',
  'Database Systems',
  'Python',
  'C++',
];

export default function UniversalSearchScreen() {
  const router = useRouter();
  const inputRef = useRef<any>(null);

  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<SearchCategory>('all');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [searchResponse, setSearchResponse] = useState<UniversalSearchResponse | null>(null);
  const [_hasSearched, setHasSearched] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load recent searches & initial category counts on mount
  useEffect(() => {
    loadRecentSearches().then(setRecentSearches).catch(() => {});

    // Initial count fetch across categories
    searchApi
      .universalSearch({ query: '', category: 'all' })
      .then((res) => {
        if (res.counts_by_type) {
          setCategoryCounts(res.counts_by_type);
        }
      })
      .catch(() => {});
  }, []);

  // Perform search query
  const performSearch = useCallback(
    async (searchTerm: string, category: SearchCategory) => {
      const clean = searchTerm.trim();

      // If in "All" view with empty query, reset to landing view (recent searches & suggestions)
      if (!clean && category === 'all') {
        setSearchResponse(null);
        setHasSearched(false);
        setIsLoading(false);
        setErrorMessage(null);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await searchApi.universalSearch({
          query: clean,
          category,
          limit: 40,
        });
        setSearchResponse(response);
        setHasSearched(true);

        if (response.counts_by_type) {
          setCategoryCounts((prev) => ({
            ...prev,
            ...response.counts_by_type,
          }));
        }

        // Persist non-empty search terms to history
        if (clean.length > 1) {
          addRecentSearch(clean).then(setRecentSearches).catch(() => {});
        }
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : 'Unable to complete search. Please try again.'
        );
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Live debounced search as user types
  useEffect(() => {
    const clean = query.trim();
    if (!clean && activeCategory === 'all') {
      setSearchResponse(null);
      setHasSearched(false);
      return;
    }

    const timer = setTimeout(() => {
      performSearch(query, activeCategory);
    }, 280);

    return () => clearTimeout(timer);
  }, [query, activeCategory, performSearch]);

  const handleSelectCategory = (category: SearchCategory) => {
    setActiveCategory(category);
    performSearch(query, category);
  };

  const handleSelectRecent = (term: string) => {
    setQuery(term);
    performSearch(term, activeCategory);
  };

  const handleRemoveRecent = async (term: string) => {
    const updated = await removeRecentSearch(term);
    setRecentSearches(updated);
  };

  const handleClearAllRecent = async () => {
    await clearRecentSearches();
    setRecentSearches([]);
  };

  const handleClearInput = () => {
    setQuery('');
    setErrorMessage(null);
    if (activeCategory === 'all') {
      setSearchResponse(null);
      setHasSearched(false);
    } else {
      performSearch('', activeCategory);
    }
    inputRef.current?.focus();
  };

  const handleNavigateToResult = (item: SearchResultItem) => {
    Keyboard.dismiss();
    switch (item.type) {
      case 'note':
        router.push('/notes' as never);
        break;
      case 'task':
        router.push('/tasks' as never);
        break;
      case 'document':
        router.push('/documents' as never);
        break;
      case 'flashcard':
        router.push('/flashcards' as never);
        break;
      case 'subject':
        router.push('/subjects' as never);
        break;
      case 'exam':
        router.push('/exams' as never);
        break;
      default:
        router.push(item.target_route as never);
        break;
    }
  };

  const getTypeColor = (type: SearchResultType): string => {
    switch (type) {
      case 'note':
        return '#8B5CF6'; // Purple
      case 'task':
        return '#10B981'; // Emerald Green
      case 'document':
        return '#F59E0B'; // Amber Orange
      case 'flashcard':
        return '#06B6D4'; // Cyan
      case 'subject':
        return '#6366F1'; // Indigo
      case 'exam':
        return '#F43F5E'; // Rose Pink
      default:
        return '#94A3B8';
    }
  };

  const getTypeIcon = (type: SearchResultType): string => {
    switch (type) {
      case 'note':
        return '📝';
      case 'task':
        return '✅';
      case 'document':
        return '📄';
      case 'flashcard':
        return '🗂️';
      case 'subject':
        return '📚';
      case 'exam':
        return '🎯';
      default:
        return '📌';
    }
  };

  const getTypeLabel = (type: SearchResultType): string => {
    switch (type) {
      case 'note':
        return 'Note';
      case 'task':
        return 'Task';
      case 'document':
        return 'PDF';
      case 'flashcard':
        return 'Flashcard';
      case 'subject':
        return 'Subject';
      case 'exam':
        return 'Exam';
      default:
        return type;
    }
  };

  const renderResultItem = ({ item }: { item: SearchResultItem }) => {
    const typeColor = getTypeColor(item.type);
    const typeIcon = getTypeIcon(item.type);
    const typeLabel = getTypeLabel(item.type);

    return (
      <Pressable
        style={styles.resultCard}
        onPress={() => handleNavigateToResult(item)}
        accessibilityRole="button"
        accessibilityLabel={`${typeLabel}: ${item.title}`}
        accessibilityHint="Opens this study asset">
        <View style={styles.resultCardHeader}>
          <View style={styles.resultTypeGroup}>
            <View style={[styles.typeBadge, { backgroundColor: `${typeColor}22`, borderColor: `${typeColor}44` }]}>
              <Text style={styles.typeBadgeIcon}>{typeIcon}</Text>
              <Text style={[styles.typeBadgeText, { color: typeColor }]}>{typeLabel}</Text>
            </View>

            {item.subject_name && (
              <View style={styles.subjectPill}>
                <View
                  style={[
                    styles.subjectDot,
                    { backgroundColor: item.subject_color || '#38BDF8' },
                  ]}
                />
                <Text style={styles.subjectPillText} numberOfLines={1}>
                  {item.subject_name}
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.arrowIcon}>→</Text>
        </View>

        <ThemedText style={styles.resultTitle} numberOfLines={2}>
          {item.title}
        </ThemedText>

        {item.snippet ? (
          <ThemedText style={styles.resultSnippet} numberOfLines={3}>
            {item.snippet}
          </ThemedText>
        ) : null}

        {/* Metadata badges for tasks/exams */}
        {item.metadata && (
          <View style={styles.metadataRow}>
            {item.metadata.status && typeof item.metadata.status === 'string' ? (
              <View style={styles.metaChip}>
                <Text style={styles.metaChipText}>
                  {item.metadata.status === 'completed' ? '✓ Completed' : '○ To-Do'}
                </Text>
              </View>
            ) : null}
            {item.metadata.priority && typeof item.metadata.priority === 'string' ? (
              <View style={styles.metaChip}>
                <Text style={styles.metaChipText}>
                  🔥 {item.metadata.priority.toUpperCase()}
                </Text>
              </View>
            ) : null}
            {item.metadata.target_score !== undefined && (
              <View style={styles.metaChip}>
                <Text style={styles.metaChipText}>
                  🎯 Target: {String(item.metadata.target_score)}%
                </Text>
              </View>
            )}
          </View>
        )}
      </Pressable>
    );
  };

  const isLandingView = activeCategory === 'all' && !query.trim();

  return (
    <ScreenWrapper
      includeTopInset
      includeBottomInset
      style={styles.screenWrapper}>
      {/* Top Search Bar Row */}
      <View style={styles.topBar}>
        <Pressable
          style={styles.backBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back">
          <Text style={styles.backArrow}>←</Text>
        </Pressable>

        <View style={styles.inputContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            ref={inputRef}
            style={styles.textInput}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => performSearch(query, activeCategory)}
            placeholder={
              activeCategory === 'all'
                ? 'Search notes, tasks, PDFs, cards, exams...'
                : `Search in ${CATEGORY_TABS.find((t) => t.id === activeCategory)?.label}...`
            }
            placeholderTextColor="#64748B"
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {isLoading ? (
            <ActivityIndicator size="small" color="#38BDF8" style={styles.loaderIcon} />
          ) : query.length > 0 ? (
            <Pressable
              style={styles.clearBtn}
              onPress={handleClearInput}
              accessibilityRole="button"
              accessibilityLabel="Clear search input">
              <Text style={styles.clearIcon}>✕</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Categories Tab Bar Carousel */}
      <View style={styles.categoryContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}>
          {CATEGORY_TABS.map((tab) => {
            const isActive = activeCategory === tab.id;
            const count =
              tab.id !== 'all'
                ? categoryCounts[tab.id] ?? categoryCounts[tab.id.replace(/s$/, '')] ?? null
                : searchResponse && query.trim()
                ? searchResponse.total_count
                : null;

            return (
              <Pressable
                key={tab.id}
                style={[styles.categoryTab, isActive && styles.categoryTabActive]}
                onPress={() => handleSelectCategory(tab.id)}
                accessibilityRole="button"
                accessibilityLabel={`${tab.label} filter tab`}>
                <Text style={styles.categoryIcon}>{tab.icon}</Text>
                <Text
                  style={[
                    styles.categoryLabel,
                    isActive && styles.categoryLabelActive,
                  ]}>
                  {tab.label}
                </Text>
                {count !== null && count > 0 && (
                  <View style={[styles.countBadge, isActive && styles.countBadgeActive]}>
                    <Text
                      style={[
                        styles.countBadgeText,
                        isActive && styles.countBadgeTextActive,
                      ]}>
                      {count}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Main Content Area */}
      {errorMessage ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
          <Pressable
            style={styles.retryBtn}
            onPress={() => performSearch(query, activeCategory)}>
            <Text style={styles.retryBtnText}>Retry Search</Text>
          </Pressable>
        </View>
      ) : isLandingView ? (
        <ScrollView
          style={styles.initialContent}
          contentContainerStyle={styles.initialContentInner}
          keyboardShouldPersistTaps="handled">
          {/* Recent Searches */}
          {recentSearches.length > 0 && (
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <ThemedText style={styles.sectionTitle}>Recent Searches</ThemedText>
                <Pressable
                  onPress={handleClearAllRecent}
                  accessibilityRole="button"
                  accessibilityLabel="Clear all recent searches">
                  <Text style={styles.clearAllText}>Clear All</Text>
                </Pressable>
              </View>

              <View style={styles.chipWrap}>
                {recentSearches.map((term) => (
                  <View key={term} style={styles.historyChip}>
                    <Pressable
                      style={styles.historyChipPress}
                      onPress={() => handleSelectRecent(term)}>
                      <Text style={styles.historyClockIcon}>🕒</Text>
                      <Text style={styles.historyChipText} numberOfLines={1}>
                        {term}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={styles.historyRemoveBtn}
                      onPress={() => handleRemoveRecent(term)}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${term}`}>
                      <Text style={styles.historyRemoveText}>×</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Quick Suggestions */}
          <View style={styles.sectionBlock}>
            <ThemedText style={styles.sectionTitle}>Popular Topics</ThemedText>
            <View style={styles.chipWrap}>
              {QUICK_SUGGESTIONS.map((topic) => (
                <Pressable
                  key={topic}
                  style={styles.suggestionChip}
                  onPress={() => {
                    setQuery(topic);
                    performSearch(topic, activeCategory);
                  }}>
                  <Text style={styles.suggestionSparkle}>✨</Text>
                  <Text style={styles.suggestionChipText}>{topic}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Feature Showcase Card */}
          <View style={styles.featureInfoCard}>
            <View style={styles.featureInfoIconBox}>
              <Text style={styles.featureInfoIcon}>⚡</Text>
            </View>
            <View style={styles.featureInfoContent}>
              <ThemedText style={styles.featureInfoTitle}>
                Universal Academic Search
              </ThemedText>
              <ThemedText style={styles.featureInfoSub}>
                Instant real-time search across your Cornell notes, homework tasks, uploaded PDF summaries, flashcard question decks, subjects, and upcoming exams.
              </ThemedText>
            </View>
          </View>
        </ScrollView>
      ) : searchResponse && searchResponse.results.length > 0 ? (
        <View style={styles.resultsContainer}>
          <View style={styles.resultsSummaryBar}>
            <Text style={styles.resultsSummaryText}>
              {query.trim()
                ? `Found ${searchResponse.total_count} ${
                    searchResponse.total_count === 1 ? 'match' : 'matches'
                  } for "${query.trim()}"`
                : `Showing all ${searchResponse.total_count} ${
                    CATEGORY_TABS.find((t) => t.id === activeCategory)?.label || 'items'
                  }`}
            </Text>
          </View>

          <FlatList
            data={searchResponse.results}
            keyExtractor={(item) => `${item.type}-${item.id}`}
            renderItem={renderResultItem}
            contentContainerStyle={styles.resultsListContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          />
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateIcon}>🔎</Text>
          <ThemedText style={styles.emptyStateTitle}>No results found</ThemedText>
          <ThemedText style={styles.emptyStateSub}>
            {query.trim()
              ? `We couldn't find any match for "${query}" in ${
                  activeCategory === 'all' ? 'any category' : activeCategory
                }. Try searching for subjects (e.g. Python, C++), topics, or switch categories.`
              : `No ${activeCategory} available yet.`}
          </ThemedText>
        </View>
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
    backgroundColor: '#080B16',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
    gap: Spacing.sm,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: BorderRadius.full,
    backgroundColor: '#131B2E',
    borderWidth: 1,
    borderColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 20,
    color: '#F8FAFC',
    fontWeight: '700',
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131B2E',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: '#2D3A54',
    paddingHorizontal: Spacing.md,
    height: 48,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: Spacing.xs,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: '#F8FAFC',
    paddingVertical: 0,
  },
  clearBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.xs,
  },
  clearIcon: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '700',
  },
  loaderIcon: {
    marginLeft: Spacing.xs,
  },
  categoryContainer: {
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  categoryScroll: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
  },
  categoryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.full,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    gap: 6,
  },
  categoryTabActive: {
    backgroundColor: '#0284C7',
    borderColor: '#38BDF8',
  },
  categoryIcon: {
    fontSize: 13,
  },
  categoryLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
  categoryLabelActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  countBadge: {
    backgroundColor: '#1F2937',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  countBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  countBadgeTextActive: {
    color: '#FFFFFF',
  },
  initialContent: {
    flex: 1,
  },
  initialContentInner: {
    padding: Spacing.md,
    gap: Spacing.lg,
  },
  sectionBlock: {
    gap: Spacing.xs,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xxs,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#CBD5E1',
    letterSpacing: 0.3,
  },
  clearAllText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#38BDF8',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  historyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131B2E',
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: '#1E293B',
    paddingLeft: Spacing.sm,
    paddingRight: Spacing.xxs,
    paddingVertical: 4,
  },
  historyChipPress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 200,
  },
  historyClockIcon: {
    fontSize: 11,
  },
  historyChipText: {
    fontSize: 13,
    color: '#E2E8F0',
  },
  historyRemoveBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  historyRemoveText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '700',
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 6,
  },
  suggestionSparkle: {
    fontSize: 12,
  },
  suggestionChipText: {
    fontSize: 13,
    color: '#93C5FD',
    fontWeight: '500',
  },
  featureInfoCard: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: Spacing.md,
    gap: Spacing.md,
    alignItems: 'flex-start',
    marginTop: Spacing.sm,
  },
  featureInfoIconBox: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureInfoIcon: {
    fontSize: 18,
  },
  featureInfoContent: {
    flex: 1,
    gap: 4,
  },
  featureInfoTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  featureInfoSub: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 18,
  },
  resultsContainer: {
    flex: 1,
  },
  resultsSummaryBar: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
  },
  resultsSummaryText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  resultsListContent: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  resultCard: {
    backgroundColor: '#111827',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  resultCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultTypeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flexWrap: 'wrap',
    flex: 1,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    gap: 4,
  },
  typeBadgeIcon: {
    fontSize: 11,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  subjectPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    gap: 5,
    maxWidth: 160,
  },
  subjectDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  subjectPillText: {
    fontSize: 11,
    color: '#CBD5E1',
    fontWeight: '500',
  },
  arrowIcon: {
    fontSize: 16,
    color: '#64748B',
    fontWeight: '700',
    marginLeft: Spacing.xs,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
    lineHeight: 22,
  },
  resultSnippet: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
  },
  metadataRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xxs,
    marginTop: 2,
  },
  metaChip: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  metaChipText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.xs,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: Spacing.xxs,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  emptyStateSub: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 19,
  },
  errorBox: {
    margin: Spacing.md,
    padding: Spacing.md,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  errorIcon: {
    fontSize: 24,
  },
  errorText: {
    fontSize: 13,
    color: '#FCA5A5',
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: '#EF4444',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
});
