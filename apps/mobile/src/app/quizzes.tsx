import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge, Button, Card, ScreenWrapper } from '@/components/ui';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { quizApi } from '@/services/api/client';
import {
  Quiz,
  QuizAttempt,
  QuizQuestion,
} from '@/types/quiz';

export default function QuizzesScreen() {
  const router = useRouter();
  const theme = useTheme();

  // Screen modes: 'list' | 'create' | 'runner' | 'result'
  const [mode, setMode] = useState<'list' | 'create' | 'runner' | 'result'>('list');

  // Quiz list state
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);

  // Active quiz state for runner & results
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [startTime, setStartTime] = useState<number>(0);
  const [activeAttempt, setActiveAttempt] = useState<QuizAttempt | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [convertSuccessMsg, setConvertSuccessMsg] = useState<string | null>(null);

  const params = useLocalSearchParams<{ docTitle?: string; docId?: string }>();

  // Generator form state
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (params.docTitle) {
      const timer = setTimeout(() => {
        setTopic(params.docTitle as string);
        setMode('create');
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [params.docTitle]);

  const handleBack = () => {
    if (mode === 'runner' || mode === 'result' || mode === 'create') {
      setMode('list');
      return;
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/explore' as never);
    }
  };

  const loadQuizzes = async () => {
    setIsLoadingList(true);
    try {
      const res = await quizApi.list();
      setQuizzes(res.items);
    } catch {
      setQuizzes([]);
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadQuizzes();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleStartQuiz = async (quiz: Quiz) => {
    try {
      const fullQuiz = await quizApi.getById(quiz.id);
      setActiveQuiz(fullQuiz);
      setActiveQuestionIndex(0);
      setSelectedAnswers({});
      setStartTime(Date.now());
      setActiveAttempt(null);
      setConvertSuccessMsg(null);
      setMode('runner');
    } catch {
      Alert.alert('Error', 'Failed to load quiz questions.');
    }
  };

  const handleGenerate = async () => {
    if (!topic.trim()) {
      Alert.alert('Missing Topic', 'Please enter a topic or concept to generate a quiz.');
      return;
    }

    setIsGenerating(true);
    try {
      const newQuiz = await quizApi.generate({
        topic: topic.trim(),
        difficulty,
        question_count: questionCount,
      });

      setQuizzes((prev) => [newQuiz, ...prev]);
      setTopic('');
      await handleStartQuiz(newQuiz);
    } catch (err: any) {
      Alert.alert(
        'Generation Error',
        err?.message || 'Could not generate quiz. Please check your connection.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelectOption = (questionId: string, optionKey: string) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: optionKey,
    }));
  };

  const handleSubmitQuiz = async () => {
    if (!activeQuiz) return;

    const timeTaken = Math.max(1, Math.round((Date.now() - startTime) / 1000));
    setIsSubmitting(true);
    try {
      const attempt = await quizApi.submit(activeQuiz.id, {
        answers: selectedAnswers,
        time_taken_seconds: timeTaken,
      });

      setActiveAttempt(attempt);
      setMode('result');
      loadQuizzes();
    } catch {
      Alert.alert('Submit Error', 'Failed to submit quiz attempt.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConvertMissed = async () => {
    if (!activeQuiz || !activeAttempt) return;

    setIsConverting(true);
    try {
      const res = await quizApi.convertMissedToFlashcards(activeQuiz.id, activeAttempt.id);
      setConvertSuccessMsg(`🎉 Success! ${res.cards_created} flashcard(s) created in your Active Recall deck!`);
      Alert.alert('Active Recall Synchronized', `${res.cards_created} missed questions have been saved to your Flashcard deck for spaced repetition review!`);
    } catch {
      Alert.alert('Error', 'Failed to convert missed questions to flashcards.');
    } finally {
      setIsConverting(false);
    }
  };

  const handleDeleteQuiz = (quizId: string) => {
    Alert.alert('Delete Quiz', 'Are you sure you want to delete this quiz?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await quizApi.delete(quizId);
            setQuizzes((prev) => prev.filter((q) => q.id !== quizId));
          } catch {
            Alert.alert('Error', 'Failed to delete quiz.');
          }
        },
      },
    ]);
  };

  // --- RENDER HELPERS ---

  const renderHeader = (title: string, subtitle?: string) => (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <TouchableOpacity
          onPress={handleBack}
          style={[styles.backButton, { backgroundColor: theme.surfaceSubtle }]}
          accessibilityLabel="Go Back"
          accessibilityRole="button">
          <ThemedText style={styles.backButtonText}>←</ThemedText>
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <ThemedText type="headlineMedium" style={styles.title}>
            {title}
          </ThemedText>
          {subtitle ? (
            <ThemedText type="bodySmall" style={{ color: theme.textSecondary }}>
              {subtitle}
            </ThemedText>
          ) : null}
        </View>
      </View>
    </View>
  );

  // 1. RUNNER VIEW
  if (mode === 'runner' && activeQuiz && activeQuiz.questions && activeQuiz.questions.length > 0) {
    const questions = activeQuiz.questions;
    const currentQ: QuizQuestion = questions[activeQuestionIndex];
    const totalQ = questions.length;
    const selectedOption = selectedAnswers[currentQ.id];

    return (
      <ScreenWrapper scrollable includeTopInset includeBottomInset contentContainerStyle={styles.container}>
        {renderHeader(activeQuiz.title, `Question ${activeQuestionIndex + 1} of ${totalQ}`)}

        {/* Progress indicator */}
        <View style={[styles.progressBarContainer, { backgroundColor: theme.surfaceSubtle }]}>
          <View
            style={[
              styles.progressBarFill,
              {
                backgroundColor: theme.brandPrimary,
                width: `${((activeQuestionIndex + 1) / totalQ) * 100}%`,
              },
            ]}
          />
        </View>

        {/* Question card */}
        <Card variant="default" style={styles.card}>
          <Badge
            label={`Difficulty: ${activeQuiz.difficulty.toUpperCase()}`}
            variant="brand"
            size="sm"
            style={{ marginBottom: Spacing.sm, alignSelf: 'flex-start' }}
          />

          <ThemedText type="headlineMedium" style={styles.questionText}>
            {currentQ.question_text}
          </ThemedText>

          {/* Options list */}
          <View style={styles.optionsContainer}>
            {currentQ.options.map((opt) => {
              const isSelected = selectedOption === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  onPress={() => handleSelectOption(currentQ.id, opt.key)}
                  style={[
                    styles.optionButton,
                    {
                      borderColor: isSelected ? theme.brandPrimary : theme.borderSubtle,
                      backgroundColor: isSelected
                        ? theme.brandMuted
                        : theme.surfaceSubtle,
                    },
                  ]}
                  activeOpacity={0.7}>
                  <View
                    style={[
                      styles.optionBadge,
                      {
                        backgroundColor: isSelected ? theme.brandPrimary : theme.borderSubtle,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.optionKeyText,
                        { color: isSelected ? '#ffffff' : theme.text },
                      ]}>
                      {opt.key}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.optionText,
                      {
                        color: isSelected ? theme.brandPrimary : theme.text,
                        fontWeight: isSelected ? '600' : '400',
                      },
                    ]}>
                    {opt.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        {/* Navigation buttons */}
        <View style={styles.navButtonRow}>
          <Button
            title="← Previous"
            variant="secondary"
            size="md"
            disabled={activeQuestionIndex === 0}
            onPress={() => setActiveQuestionIndex((prev) => Math.max(0, prev - 1))}
            style={{ flex: 1, marginRight: Spacing.sm }}
          />

          {activeQuestionIndex < totalQ - 1 ? (
            <Button
              title="Next →"
              variant="primary"
              size="md"
              onPress={() => setActiveQuestionIndex((prev) => Math.min(totalQ - 1, prev + 1))}
              style={{ flex: 1, marginLeft: Spacing.sm }}
            />
          ) : (
            <Button
              title={isSubmitting ? 'Scoring...' : 'Finish & Submit ✓'}
              variant="primary"
              size="md"
              loading={isSubmitting}
              onPress={handleSubmitQuiz}
              style={{ flex: 1, marginLeft: Spacing.sm }}
            />
          )}
        </View>
      </ScreenWrapper>
    );
  }

  // 2. RESULTS VIEW
  if (mode === 'result' && activeQuiz && activeAttempt) {
    const questions = activeQuiz.questions || [];
    const isPassing = activeAttempt.score_percentage >= 60;

    return (
      <ScreenWrapper scrollable includeTopInset includeBottomInset contentContainerStyle={styles.container}>
        {renderHeader('Quiz Results', activeQuiz.title)}

        {/* Score summary card */}
        <Card
          variant="default"
          style={[
            styles.card,
            {
              borderLeftWidth: 4,
              borderLeftColor: isPassing ? theme.statusSuccess : theme.statusDanger,
            },
          ]}>
          <View style={styles.scoreRow}>
            <View>
              <ThemedText type="headlineLarge" style={styles.scoreText}>
                {Math.round(activeAttempt.score_percentage)}%
              </ThemedText>
              <ThemedText type="bodyMedium" style={{ color: theme.textSecondary }}>
                {activeAttempt.correct_count} of {activeAttempt.correct_count + activeAttempt.incorrect_count} questions correct
              </ThemedText>
            </View>
            <Badge
              label={isPassing ? 'PASSED 🏆' : 'NEEDS REVIEW 📖'}
              variant={isPassing ? 'success' : 'danger'}
              size="md"
            />
          </View>

          <ThemedText type="bodySmall" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
            ⏱ Time taken: {activeAttempt.time_taken_seconds} seconds
          </ThemedText>

          {/* Active Recall Conversion CTA */}
          {activeAttempt.incorrect_count > 0 && (
            <View style={[styles.recallCallout, { backgroundColor: theme.surfaceSubtle }]}>
              <ThemedText type="titleMedium" style={{ fontSize: 16, marginBottom: 4 }}>
                💡 Strengthen Weak Concepts
              </ThemedText>
              <ThemedText type="bodySmall" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
                You missed {activeAttempt.incorrect_count} question{activeAttempt.incorrect_count > 1 ? 's' : ''}. Convert them to Spaced Repetition flashcards with 1 tap.
              </ThemedText>

              {convertSuccessMsg ? (
                <ThemedText type="bodyMedium" style={{ color: theme.statusSuccess, fontWeight: 'bold' }}>
                  {convertSuccessMsg}
                </ThemedText>
              ) : (
                <Button
                  title={isConverting ? 'Creating Flashcards...' : '🎴 Convert Missed to Flashcards (SM-2)'}
                  variant="primary"
                  size="sm"
                  loading={isConverting}
                  onPress={handleConvertMissed}
                />
              )}
            </View>
          )}
        </Card>

        {/* Detailed Question Review */}
        <ThemedText type="titleMedium" style={{ marginTop: Spacing.md, marginBottom: Spacing.sm }}>
          Question Review & Explanations
        </ThemedText>

        {questions.map((q, idx) => {
          const userAnswer =
            activeAttempt?.answers_submitted?.[q.id] ??
            activeAttempt?.answers_submitted?.[String(q.id)] ??
            selectedAnswers[q.id] ??
            activeAttempt?.review?.find((r) => String(r.question_id) === String(q.id))?.user_answer ??
            '';
          const isCorrect = userAnswer === q.correct_option_key;

          return (
            <Card key={q.id} variant="default" style={[styles.card, { marginBottom: Spacing.sm }]}>
              <View style={styles.reviewHeaderRow}>
                <ThemedText type="titleMedium" style={{ fontSize: 15, flex: 1 }}>
                  {idx + 1}. {q.question_text}
                </ThemedText>
                <Badge
                  label={isCorrect ? 'Correct ✓' : 'Missed ✗'}
                  variant={isCorrect ? 'success' : 'danger'}
                  size="sm"
                />
              </View>

              <View style={{ marginTop: Spacing.xs }}>
                {q.options.map((opt) => {
                  const isUserPick = userAnswer === opt.key;
                  const isRightAnswer = q.correct_option_key === opt.key;
                  let bgCol: string = theme.surfaceSubtle;
                  let borderCol: string = 'transparent';

                  if (isRightAnswer) {
                    bgCol = theme.badgeSuccessBackground;
                    borderCol = theme.statusSuccess;
                  } else if (isUserPick && !isCorrect) {
                    bgCol = theme.badgeDangerBackground;
                    borderCol = theme.statusDanger;
                  }

                  return (
                    <View
                      key={opt.key}
                      style={[
                        styles.reviewOptionRow,
                        { backgroundColor: bgCol, borderColor: borderCol, borderWidth: 1 },
                      ]}>
                      <Text style={{ fontWeight: '600', marginRight: Spacing.xs, color: theme.text }}>
                        {opt.key}:
                      </Text>
                      <Text style={{ flex: 1, color: theme.text }}>{opt.text}</Text>
                      {isRightAnswer && <Text style={{ color: theme.badgeSuccessText, fontWeight: 'bold' }}> (Correct)</Text>}
                      {isUserPick && !isRightAnswer && <Text style={{ color: theme.badgeDangerText, fontWeight: 'bold' }}> (Your answer)</Text>}
                    </View>
                  );
                })}
              </View>

              {q.explanation ? (
                <View style={[styles.explanationBox, { backgroundColor: theme.surfaceSubtle }]}>
                  <ThemedText type="bodySmall" style={{ fontStyle: 'italic', color: theme.textSecondary }}>
                    💡 {q.explanation}
                  </ThemedText>
                </View>
              ) : null}
            </Card>
          );
        })}

        <Button
          title="Back to Quizzes"
          variant="secondary"
          size="md"
          onPress={() => setMode('list')}
          style={{ marginTop: Spacing.md, marginBottom: Spacing.xl }}
        />
      </ScreenWrapper>
    );
  }

  // 3. GENERATOR VIEW
  if (mode === 'create') {
    return (
      <ScreenWrapper scrollable includeTopInset includeBottomInset contentContainerStyle={styles.container}>
        {renderHeader('Create AI Quiz', 'Active Recall practice generator')}

        <Card variant="default" style={styles.card}>
          <ThemedText type="titleMedium" style={{ marginBottom: Spacing.xs }}>
            Topic or Concept
          </ThemedText>
          <ThemedText type="bodySmall" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
            Enter any syllabus topic, exam unit, or concept:
          </ThemedText>

          <TextInput
            placeholder="e.g. Operating Systems Scheduling, OSI Model, Photosynthesis..."
            placeholderTextColor={theme.textSecondary}
            value={topic}
            onChangeText={setTopic}
            style={[
              styles.textInput,
              {
                borderColor: theme.borderSubtle,
                color: theme.text,
                backgroundColor: theme.inputBackground,
              },
            ]}
          />

          {/* Difficulty Chips */}
          <ThemedText type="titleMedium" style={{ marginTop: Spacing.md, marginBottom: Spacing.xs }}>
            Difficulty Level
          </ThemedText>
          <View style={styles.chipRow}>
            {(['easy', 'medium', 'hard'] as const).map((d) => (
              <TouchableOpacity
                key={d}
                onPress={() => setDifficulty(d)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: difficulty === d ? theme.brandPrimary : theme.surfaceSubtle,
                    borderColor: difficulty === d ? theme.brandPrimary : theme.borderSubtle,
                  },
                ]}>
                <Text
                  style={[
                    styles.chipText,
                    { color: difficulty === d ? '#ffffff' : theme.text },
                  ]}>
                  {d.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Question Count Chips */}
          <ThemedText type="titleMedium" style={{ marginTop: Spacing.md, marginBottom: Spacing.xs }}>
            Number of Questions
          </ThemedText>
          <View style={styles.chipRow}>
            {[3, 5, 10].map((num) => (
              <TouchableOpacity
                key={num}
                onPress={() => setQuestionCount(num)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: questionCount === num ? theme.brandPrimary : theme.surfaceSubtle,
                    borderColor: questionCount === num ? theme.brandPrimary : theme.borderSubtle,
                  },
                ]}>
                <Text
                  style={[
                    styles.chipText,
                    { color: questionCount === num ? '#ffffff' : theme.text },
                  ]}>
                  {num} Questions
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Button
            title={isGenerating ? 'Generating with AI...' : '✨ Generate & Launch Quiz'}
            variant="primary"
            size="lg"
            loading={isGenerating}
            onPress={handleGenerate}
            style={{ marginTop: Spacing.lg }}
          />

          <Button
            title="Cancel"
            variant="secondary"
            size="md"
            onPress={() => setMode('list')}
            style={{ marginTop: Spacing.sm }}
          />
        </Card>
      </ScreenWrapper>
    );
  }

  // 4. DEFAULT LIST VIEW
  return (
    <ScreenWrapper scrollable includeTopInset includeBottomInset includeTabInset contentContainerStyle={styles.container}>
      {renderHeader('AI Quiz & Recall', 'Active recall quizzes generated from your syllabus')}

      <View style={styles.actionRow}>
        <Button
          title="+ Create New Quiz"
          variant="primary"
          size="md"
          onPress={() => setMode('create')}
          style={{ flex: 1 }}
        />
      </View>

      {isLoadingList ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.brandPrimary} />
          <ThemedText type="bodyMedium" style={{ marginTop: Spacing.sm, color: theme.textSecondary }}>
            Loading quizzes...
          </ThemedText>
        </View>
      ) : quizzes.length === 0 ? (
        <Card variant="default" style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>🎯</Text>
          <ThemedText type="headlineMedium" style={styles.emptyTitle}>
            No Quizzes Yet
          </ThemedText>
          <ThemedText type="bodyMedium" style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            Generate your first interactive AI Quiz from any study topic to test your knowledge and convert missed questions into flashcards!
          </ThemedText>
          <Button
            title="✨ Create First Quiz"
            variant="primary"
            size="md"
            onPress={() => setMode('create')}
            style={{ marginTop: Spacing.md }}
          />
        </Card>
      ) : (
        <FlatList
          data={quizzes}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <Card variant="default" style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View style={{ flex: 1 }}>
                  <ThemedText type="titleMedium" style={styles.quizCardTitle}>
                    {item.title}
                  </ThemedText>
                  <View style={styles.badgeRow}>
                    <Badge
                      label={`${item.question_count} Qs`}
                      variant="neutral"
                      size="sm"
                    />
                    <Badge
                      label={item.difficulty.toUpperCase()}
                      variant={
                        item.difficulty === 'easy'
                          ? 'success'
                          : item.difficulty === 'hard'
                          ? 'danger'
                          : 'brand'
                      }
                      size="sm"
                      style={{ marginLeft: Spacing.xs }}
                    />
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => handleDeleteQuiz(item.id)}
                  style={styles.deleteButton}
                  accessibilityLabel="Delete Quiz">
                  <Text style={styles.deleteIconText}>🗑</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.quizActionRow}>
                <Button
                  title="Start Quiz →"
                  variant="primary"
                  size="sm"
                  onPress={() => handleStartQuiz(item)}
                  style={{ flex: 1 }}
                />
              </View>
            </Card>
          )}
        />
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.md,
    paddingBottom: Spacing.xl * 2,
  },
  header: {
    marginBottom: Spacing.md,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  backButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerTitleContainer: {
    flex: 1,
  },
  title: {
    fontWeight: 'bold',
  },
  actionRow: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
  },
  card: {
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  quizCardTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    marginBottom: Spacing.xs,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  deleteButton: {
    padding: Spacing.xs,
  },
  deleteIconText: {
    fontSize: 18,
  },
  quizActionRow: {
    marginTop: Spacing.md,
    flexDirection: 'row',
  },
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
  },
  emptyCard: {
    alignItems: 'center',
    padding: Spacing.xl,
    textAlign: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    fontWeight: 'bold',
    marginBottom: Spacing.xs,
  },
  emptySubtitle: {
    textAlign: 'center',
    lineHeight: 20,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: 15,
  },
  chipRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  chipText: {
    fontWeight: '600',
    fontSize: 13,
  },
  progressBarContainer: {
    height: 6,
    borderRadius: 3,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  questionText: {
    fontSize: 18,
    lineHeight: 24,
    marginBottom: Spacing.md,
  },
  optionsContainer: {
    gap: Spacing.sm,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
  },
  optionBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  optionKeyText: {
    fontWeight: 'bold',
    fontSize: 13,
  },
  optionText: {
    fontSize: 15,
    flex: 1,
  },
  navButtonRow: {
    flexDirection: 'row',
    marginTop: Spacing.md,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#22c55e',
  },
  recallCallout: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  reviewHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
  },
  reviewOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.xs + 2,
    borderRadius: BorderRadius.sm,
    marginBottom: 4,
  },
  explanationBox: {
    marginTop: Spacing.xs,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
});
