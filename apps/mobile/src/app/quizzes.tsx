import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
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

// Quick syllabus topic suggestions for 1-tap generation
const SYLLABUS_SUGGESTIONS = [
  'Data Structures & Algorithms',
  'Operating Systems & Threads',
  'Computer Networks & Protocols',
  'Database Management (DBMS)',
  'Object-Oriented Programming (OOP)',
  'Software Engineering & Agile',
];

interface AnimatedQuizCardProps {
  quiz: Quiz;
  index: number;
  onStart: (quiz: Quiz) => void;
  onDelete: (quizId: string) => void;
}

function AnimatedQuizCard({ quiz, index, onStart, onDelete }: AnimatedQuizCardProps) {
  const theme = useTheme();
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(animValue, {
      toValue: 1,
      delay: Math.min(index * 60, 360),
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, [animValue, index]);

  const difficultyColor =
    quiz.difficulty === 'easy'
      ? theme.statusSuccess
      : quiz.difficulty === 'hard'
      ? theme.statusDanger
      : theme.statusWarning;

  const difficultyVariant =
    quiz.difficulty === 'easy'
      ? 'success'
      : quiz.difficulty === 'hard'
      ? 'danger'
      : 'warning';

  const estMinutes = Math.max(2, Math.round(quiz.question_count * 1.5));

  return (
    <Animated.View
      style={{
        opacity: animValue,
        transform: [
          {
            translateY: animValue.interpolate({
              inputRange: [0, 1],
              outputRange: [18, 0],
            }),
          },
        ],
      }}>
      <Card
        variant="default"
        style={[
          styles.quizCard,
          {
            borderLeftWidth: 4,
            borderLeftColor: difficultyColor,
            backgroundColor: theme.cardBackground,
            borderColor: theme.borderSubtle,
          },
        ]}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardTitleBlock}>
            <View style={styles.quizTitleRow}>
              <Text style={styles.quizLeadIcon}>🎯</Text>
              <ThemedText type="titleMedium" style={styles.quizCardTitle} numberOfLines={2}>
                {quiz.title}
              </ThemedText>
            </View>

            <View style={styles.badgeRow}>
              <Badge
                label={`${quiz.question_count} Questions`}
                variant="neutral"
                size="sm"
              />
              <Badge
                label={quiz.difficulty.toUpperCase()}
                variant={difficultyVariant}
                size="sm"
                style={{ marginLeft: Spacing.xs }}
              />
              <Badge
                label={`~${estMinutes} min`}
                variant="neutral"
                size="sm"
                style={{ marginLeft: Spacing.xs }}
              />
            </View>
          </View>

          <TouchableOpacity
            onPress={() => onDelete(quiz.id)}
            style={[styles.deleteButton, { backgroundColor: theme.surfaceSubtle }]}
            accessibilityLabel="Delete Quiz"
            accessibilityRole="button">
            <Text style={styles.deleteIconText}>🗑</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.quizActionRow}>
          <Button
            title="Start Quiz →"
            variant="primary"
            size="md"
            onPress={() => onStart(quiz)}
            style={{ flex: 1 }}
          />
        </View>
      </Card>
    </Animated.View>
  );
}

export default function QuizzesScreen() {
  const router = useRouter();
  const theme = useTheme();

  // Screen modes: 'list' | 'create' | 'runner' | 'result'
  const [mode, setMode] = useState<'list' | 'create' | 'runner' | 'result'>('list');

  // Quiz list state
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | 'easy' | 'medium' | 'hard'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'title' | 'count'>('recent');

  // Active quiz state for runner & results
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [startTime, setStartTime] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [activeAttempt, setActiveAttempt] = useState<QuizAttempt | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [convertSuccessMsg, setConvertSuccessMsg] = useState<string | null>(null);

  // AI Assistant Instant Check Feature (ON by default)
  const [instantAiFeedback, setInstantAiFeedback] = useState(true);

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

  // Live Timer for Quiz Runner
  useEffect(() => {
    let timer: any = null;
    if (mode === 'runner' && startTime > 0) {
      timer = setInterval(() => {
        setElapsedSeconds(Math.max(1, Math.round((Date.now() - startTime) / 1000)));
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [mode, startTime]);

  const handleBack = () => {
    if (mode === 'runner') {
      Alert.alert(
        'Exit Quiz?',
        'Are you sure you want to exit? Your current in-progress answers will not be submitted.',
        [
          { text: 'Keep Studying', style: 'cancel' },
          {
            text: 'Exit',
            style: 'destructive',
            onPress: () => setMode('list'),
          },
        ]
      );
      return;
    }
    if (mode === 'result' || mode === 'create') {
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
      setElapsedSeconds(0);
      setActiveAttempt(null);
      setConvertSuccessMsg(null);
      setMode('runner');
    } catch {
      Alert.alert('Error', 'Failed to load quiz questions.');
    }
  };

  const handleGenerate = async (customTopic?: string, customCount?: number, customDiff?: 'easy' | 'medium' | 'hard') => {
    const targetTopic = (customTopic ?? topic).trim();
    if (!targetTopic) {
      Alert.alert('Missing Topic', 'Please enter or select a syllabus topic to generate a quiz.');
      return;
    }

    setIsGenerating(true);
    try {
      const newQuiz = await quizApi.generate({
        topic: targetTopic,
        difficulty: customDiff ?? difficulty,
        question_count: customCount ?? questionCount,
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
      setConvertSuccessMsg(`🎉 Success! ${res.cards_created} flashcard(s) synchronized to your Active Recall deck!`);
      Alert.alert(
        'Active Recall Synchronized',
        `${res.cards_created} missed questions have been saved to your Flashcard deck for spaced repetition review!`
      );
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

  // Filtered & Sorted Quizzes
  const filteredQuizzes = useMemo(() => {
    return quizzes
      .filter((q) => {
        const matchesQuery =
          !searchQuery.trim() ||
          q.title.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesDifficulty =
          difficultyFilter === 'all' || q.difficulty === difficultyFilter;
        return matchesQuery && matchesDifficulty;
      })
      .sort((a, b) => {
        if (sortBy === 'title') return a.title.localeCompare(b.title);
        if (sortBy === 'count') return b.question_count - a.question_count;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [quizzes, searchQuery, difficultyFilter, sortBy]);

  const totalQuestionsSum = useMemo(() => {
    return quizzes.reduce((sum, q) => sum + (q.question_count || 0), 0);
  }, [quizzes]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // --- RENDER HELPERS ---

  const renderHeader = (title: string, subtitle?: string, rightElement?: React.ReactNode) => (
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
        {rightElement}
      </View>
    </View>
  );

  // ==========================================
  // 1. RUNNER VIEW (WITH REAL-TIME AI ASSISTANT EVALUATION)
  // ==========================================
  if (mode === 'runner' && activeQuiz && activeQuiz.questions && activeQuiz.questions.length > 0) {
    const questions = activeQuiz.questions;
    const currentQ: QuizQuestion = questions[activeQuestionIndex];
    const totalQ = questions.length;
    const selectedOption = selectedAnswers[currentQ.id];
    const isAnswered = Boolean(selectedOption);
    const isCorrectPick = selectedOption === currentQ.correct_option_key;

    return (
      <ScreenWrapper scrollable includeTopInset includeBottomInset contentContainerStyle={styles.container}>
        {renderHeader(
          activeQuiz.title,
          `Question ${activeQuestionIndex + 1} of ${totalQ}`,
          <View style={styles.timerPill}>
            <Text style={[styles.timerText, { color: theme.brandPrimary }]}>
              ⏱ {formatTimer(elapsedSeconds)}
            </Text>
          </View>
        )}

        {/* AI Assistant Instant Check Mode Toggle */}
        <View style={[styles.aiFeedbackToggleRow, { backgroundColor: theme.surfaceSubtle, borderColor: theme.borderSubtle }]}>
          <View style={styles.aiFeedbackInfoBlock}>
            <ThemedText type="titleMedium" style={{ fontSize: 13, fontWeight: '700' }}>
              🤖 AI Instant Answer Verification
            </ThemedText>
            <ThemedText type="bodySmall" style={{ color: theme.textSecondary, fontSize: 11 }}>
              AI Assistant checks correctness and delivers immediate pedagogical explanations
            </ThemedText>
          </View>
          <TouchableOpacity
            onPress={() => setInstantAiFeedback((prev) => !prev)}
            style={[
              styles.feedbackToggleBtn,
              { backgroundColor: instantAiFeedback ? theme.brandPrimary : theme.borderSubtle },
            ]}>
            <Text style={styles.feedbackToggleBtnText}>
              {instantAiFeedback ? 'ACTIVE ✓' : 'OFF'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Progress indicator */}
        <View style={styles.progressSection}>
          <View style={styles.progressLabelRow}>
            <ThemedText type="bodySmall" style={{ color: theme.textSecondary, fontWeight: '600' }}>
              Progress: {Math.round(((activeQuestionIndex + 1) / totalQ) * 100)}%
            </ThemedText>
            <ThemedText type="bodySmall" style={{ color: theme.textSecondary }}>
              {activeQuestionIndex + 1} / {totalQ}
            </ThemedText>
          </View>
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
        </View>

        {/* Question card */}
        <Card variant="default" style={[styles.card, { borderColor: theme.borderSubtle }]}>
          <View style={styles.questionCardHeader}>
            <Badge
              label={`QUESTION ${activeQuestionIndex + 1}`}
              variant="brand"
              size="sm"
            />
            <Badge
              label={activeQuiz.difficulty.toUpperCase()}
              variant={
                activeQuiz.difficulty === 'easy'
                  ? 'success'
                  : activeQuiz.difficulty === 'hard'
                  ? 'danger'
                  : 'warning'
              }
              size="sm"
            />
          </View>

          <ThemedText type="headlineMedium" style={styles.questionText}>
            {currentQ.question_text}
          </ThemedText>

          {/* Options list with Real-Time AI Assistant Check */}
          <View style={styles.optionsContainer}>
            {currentQ.options.map((opt) => {
              const isSelected = selectedOption === opt.key;
              const isRightAnswer = currentQ.correct_option_key === opt.key;

              // Compute styles based on selection & AI feedback
              let borderColor: string = theme.borderSubtle;
              let backgroundColor: string = theme.surfaceSubtle;
              let badgeBg: string = theme.borderSubtle;
              let badgeTextColor: string = theme.text;
              let statusText: string | null = null;
              let statusColor: string = theme.textSecondary;

              if (instantAiFeedback && isAnswered) {
                if (isSelected && isRightAnswer) {
                  // User chose correctly
                  borderColor = theme.statusSuccess;
                  backgroundColor = theme.badgeSuccessBackground;
                  badgeBg = theme.statusSuccess;
                  badgeTextColor = '#ffffff';
                  statusText = '✓ Correct!';
                  statusColor = theme.statusSuccess;
                } else if (isSelected && !isRightAnswer) {
                  // User chose incorrectly
                  borderColor = theme.statusDanger;
                  backgroundColor = theme.badgeDangerBackground;
                  badgeBg = theme.statusDanger;
                  badgeTextColor = '#ffffff';
                  statusText = '✗ Incorrect';
                  statusColor = theme.statusDanger;
                } else if (!isSelected && isRightAnswer) {
                  // Reveal correct answer
                  borderColor = theme.statusSuccess;
                  backgroundColor = theme.surfaceSubtle;
                  badgeBg = theme.statusSuccess;
                  badgeTextColor = '#ffffff';
                  statusText = '✓ Correct Answer';
                  statusColor = theme.statusSuccess;
                }
              } else if (isSelected) {
                // Regular selection without instant verification
                borderColor = theme.brandPrimary;
                backgroundColor = theme.brandMuted;
                badgeBg = theme.brandPrimary;
                badgeTextColor = '#ffffff';
              }

              return (
                <TouchableOpacity
                  key={opt.key}
                  onPress={() => handleSelectOption(currentQ.id, opt.key)}
                  style={[
                    styles.optionButton,
                    {
                      borderColor,
                      backgroundColor,
                    },
                  ]}
                  activeOpacity={0.7}>
                  <View style={[styles.optionBadge, { backgroundColor: badgeBg }]}>
                    <Text style={[styles.optionKeyText, { color: badgeTextColor }]}>
                      {opt.key}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.optionText,
                      {
                        color: isSelected ? theme.text : theme.text,
                        fontWeight: isSelected ? '600' : '400',
                      },
                    ]}>
                    {opt.text}
                  </Text>
                  {statusText ? (
                    <Text style={[styles.optionStatusText, { color: statusColor }]}>
                      {statusText}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* AI Assistant Explanation Box (Delivered Instantly on Answer) */}
          {instantAiFeedback && isAnswered && currentQ.explanation && (
            <View
              style={[
                styles.aiExplanationCard,
                {
                  backgroundColor: isCorrectPick
                    ? theme.badgeSuccessBackground
                    : theme.surfaceSubtle,
                  borderColor: isCorrectPick ? theme.statusSuccess : theme.borderSubtle,
                },
              ]}>
              <View style={styles.aiExplanationHeader}>
                <Text style={styles.aiAvatarIcon}>🤖</Text>
                <ThemedText
                  type="titleMedium"
                  style={{
                    fontSize: 14,
                    fontWeight: '700',
                    color: isCorrectPick ? theme.badgeSuccessText : theme.brandPrimary,
                  }}>
                  StudyMate AI Assistant Explanation:
                </ThemedText>
              </View>
              <ThemedText
                type="bodySmall"
                style={{
                  color: theme.text,
                  marginTop: 4,
                  lineHeight: 20,
                }}>
                {currentQ.explanation}
              </ThemedText>
              <ThemedText
                type="bodySmall"
                style={{
                  color: theme.textSecondary,
                  fontSize: 11,
                  fontStyle: 'italic',
                  marginTop: 6,
                }}>
                {isCorrectPick
                  ? '🎯 Accurate recall reinforces neural connections for exam day.'
                  : '💡 Review this core concept before proceeding to solidify recall.'}
              </ThemedText>
            </View>
          )}
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
              title={isSubmitting ? 'Submitting...' : 'Finish & Submit ✓'}
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

  // ==========================================
  // 2. RESULTS VIEW
  // ==========================================
  if (mode === 'result' && activeQuiz && activeAttempt) {
    const questions = activeQuiz.questions || [];
    const isPassing = activeAttempt.score_percentage >= 60;
    const isMastery = activeAttempt.score_percentage >= 80;

    return (
      <ScreenWrapper scrollable includeTopInset includeBottomInset contentContainerStyle={styles.container}>
        {renderHeader('Quiz Evaluation', activeQuiz.title)}

        {/* Score summary card */}
        <Card
          variant="default"
          style={[
            styles.card,
            {
              borderLeftWidth: 4,
              borderLeftColor: isMastery
                ? theme.statusSuccess
                : isPassing
                ? theme.statusWarning
                : theme.statusDanger,
            },
          ]}>
          <View style={styles.scoreRow}>
            <View>
              <ThemedText
                type="headlineLarge"
                style={[
                  styles.scoreText,
                  {
                    color: isMastery
                      ? theme.statusSuccess
                      : isPassing
                      ? theme.statusWarning
                      : theme.statusDanger,
                  },
                ]}>
                {Math.round(activeAttempt.score_percentage)}%
              </ThemedText>
              <ThemedText type="bodyMedium" style={{ color: theme.textSecondary, marginTop: 2 }}>
                {activeAttempt.correct_count} of {activeAttempt.correct_count + activeAttempt.incorrect_count} questions correct
              </ThemedText>
            </View>
            <Badge
              label={
                isMastery
                  ? 'MASTERED 🏆'
                  : isPassing
                  ? 'PASSED 👍'
                  : 'NEEDS REVIEW 📖'
              }
              variant={isMastery ? 'success' : isPassing ? 'warning' : 'danger'}
              size="md"
            />
          </View>

          {/* Quick Metrics */}
          <View style={styles.metricsRow}>
            <View style={[styles.metricBox, { backgroundColor: theme.surfaceSubtle }]}>
              <ThemedText type="titleMedium" style={{ fontSize: 13, color: theme.statusSuccess }}>
                ✓ Correct
              </ThemedText>
              <ThemedText type="titleMedium" style={{ fontSize: 16, fontWeight: '700' }}>
                {activeAttempt.correct_count}
              </ThemedText>
            </View>
            <View style={[styles.metricBox, { backgroundColor: theme.surfaceSubtle }]}>
              <ThemedText type="titleMedium" style={{ fontSize: 13, color: theme.statusDanger }}>
                ✗ Missed
              </ThemedText>
              <ThemedText type="titleMedium" style={{ fontSize: 16, fontWeight: '700' }}>
                {activeAttempt.incorrect_count}
              </ThemedText>
            </View>
            <View style={[styles.metricBox, { backgroundColor: theme.surfaceSubtle }]}>
              <ThemedText type="titleMedium" style={{ fontSize: 13, color: theme.brandPrimary }}>
                ⏱ Duration
              </ThemedText>
              <ThemedText type="titleMedium" style={{ fontSize: 16, fontWeight: '700' }}>
                {activeAttempt.time_taken_seconds}s
              </ThemedText>
            </View>
          </View>

          {/* Active Recall SM-2 Spaced Repetition Conversion CTA */}
          {activeAttempt.incorrect_count > 0 && (
            <View style={[styles.recallCallout, { backgroundColor: theme.surfaceSubtle, borderColor: theme.borderSubtle }]}>
              <ThemedText type="titleMedium" style={{ fontSize: 15, marginBottom: 4 }}>
                🧠 Strengthen Weak Knowledge Nodes
              </ThemedText>
              <ThemedText type="bodySmall" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
                You missed {activeAttempt.incorrect_count} question{activeAttempt.incorrect_count > 1 ? 's' : ''}. Convert them directly into Spaced Repetition Flashcards (SM-2) for automated daily revision.
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
          🤖 AI Question Review & Pedagogical Explanations
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
            <Card
              key={q.id}
              variant="default"
              style={[
                styles.card,
                {
                  marginBottom: Spacing.sm,
                  borderLeftWidth: 3,
                  borderLeftColor: isCorrect ? theme.statusSuccess : theme.statusDanger,
                },
              ]}>
              <View style={styles.reviewHeaderRow}>
                <ThemedText type="titleMedium" style={{ fontSize: 15, flex: 1, paddingRight: Spacing.xs }}>
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
                      <Text style={{ fontWeight: '700', marginRight: Spacing.xs, color: theme.text }}>
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
                <View style={[styles.explanationBox, { backgroundColor: theme.surfaceSubtle, borderColor: theme.borderSubtle }]}>
                  <ThemedText type="bodySmall" style={{ color: theme.text, lineHeight: 19 }}>
                    💡 <Text style={{ fontWeight: 'bold' }}>AI Insight: </Text>{q.explanation}
                  </ThemedText>
                </View>
              ) : null}
            </Card>
          );
        })}

        <View style={styles.resultActionsRow}>
          <Button
            title="🔄 Retake Quiz"
            variant="secondary"
            size="md"
            onPress={() => handleStartQuiz(activeQuiz)}
            style={{ flex: 1, marginRight: Spacing.xs }}
          />
          <Button
            title="Back to Quizzes"
            variant="primary"
            size="md"
            onPress={() => setMode('list')}
            style={{ flex: 1, marginLeft: Spacing.xs }}
          />
        </View>
      </ScreenWrapper>
    );
  }

  // ==========================================
  // 3. GENERATOR VIEW
  // ==========================================
  if (mode === 'create') {
    return (
      <ScreenWrapper scrollable includeTopInset includeBottomInset contentContainerStyle={styles.container}>
        {renderHeader('Create AI Quiz', 'StudyMate AI Active Recall Generator')}

        <Card variant="default" style={[styles.card, { borderColor: theme.borderSubtle }]}>
          <ThemedText type="titleMedium" style={{ marginBottom: Spacing.xs }}>
            Syllabus Topic or Concept
          </ThemedText>
          <ThemedText type="bodySmall" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
            Enter any topic, chapter, or exam syllabus concept to generate questions:
          </ThemedText>

          <TextInput
            placeholder="e.g. Operating Systems Deadlocks, TCP vs UDP, B-Trees..."
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

          {/* Quick Syllabus Presets */}
          <ThemedText type="bodySmall" style={{ color: theme.textSecondary, marginTop: Spacing.sm, marginBottom: Spacing.xs }}>
            Or choose a suggested topic:
          </ThemedText>
          <View style={styles.presetChipWrap}>
            {SYLLABUS_SUGGESTIONS.map((preset) => (
              <TouchableOpacity
                key={preset}
                onPress={() => setTopic(preset)}
                style={[
                  styles.presetChip,
                  {
                    backgroundColor: topic === preset ? theme.brandMuted : theme.surfaceSubtle,
                    borderColor: topic === preset ? theme.brandPrimary : theme.borderSubtle,
                  },
                ]}>
                <Text
                  style={[
                    styles.presetChipText,
                    { color: topic === preset ? theme.brandPrimary : theme.text },
                  ]}>
                  {preset}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Difficulty Chips */}
          <ThemedText type="titleMedium" style={{ marginTop: Spacing.md, marginBottom: Spacing.xs }}>
            Cognitive Difficulty Level
          </ThemedText>
          <View style={styles.chipRow}>
            {([
              { key: 'easy', label: '🟢 EASY', sub: 'Definitions' },
              { key: 'medium', label: '🟡 MEDIUM', sub: 'Application' },
              { key: 'hard', label: '🔴 HARD', sub: 'Edge Cases' },
            ] as const).map((d) => (
              <TouchableOpacity
                key={d.key}
                onPress={() => setDifficulty(d.key)}
                style={[
                  styles.difficultyCard,
                  {
                    backgroundColor: difficulty === d.key ? theme.brandMuted : theme.surfaceSubtle,
                    borderColor: difficulty === d.key ? theme.brandPrimary : theme.borderSubtle,
                  },
                ]}>
                <Text
                  style={[
                    styles.difficultyLabel,
                    { color: difficulty === d.key ? theme.brandPrimary : theme.text },
                  ]}>
                  {d.label}
                </Text>
                <Text style={[styles.difficultySub, { color: theme.textSecondary }]}>
                  {d.sub}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Question Count Chips */}
          <ThemedText type="titleMedium" style={{ marginTop: Spacing.md, marginBottom: Spacing.xs }}>
            Question Count
          </ThemedText>
          <View style={styles.chipRow}>
            {[
              { num: 3, label: '3 Quick Check' },
              { num: 5, label: '5 Standard' },
              { num: 10, label: '10 Mock Exam' },
            ].map((item) => (
              <TouchableOpacity
                key={item.num}
                onPress={() => setQuestionCount(item.num)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: questionCount === item.num ? theme.brandPrimary : theme.surfaceSubtle,
                    borderColor: questionCount === item.num ? theme.brandPrimary : theme.borderSubtle,
                    flex: 1,
                    alignItems: 'center',
                  },
                ]}>
                <Text
                  style={[
                    styles.chipText,
                    { color: questionCount === item.num ? '#ffffff' : theme.text },
                  ]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* AI Engine Info */}
          <View style={[styles.aiNoticeBox, { backgroundColor: theme.surfaceSubtle, borderColor: theme.borderSubtle }]}>
            <Text style={styles.aiNoticeIcon}>✨</Text>
            <ThemedText type="bodySmall" style={{ color: theme.textSecondary, flex: 1, fontSize: 12 }}>
              Questions and full pedagogical explanations will be generated by the StudyMate AI Assistant and stored in your database.
            </ThemedText>
          </View>

          <Button
            title={isGenerating ? 'AI Generating Questions...' : '✨ Generate & Launch Quiz'}
            variant="primary"
            size="lg"
            loading={isGenerating}
            onPress={() => handleGenerate()}
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

  // ==========================================
  // 4. DEFAULT LIST VIEW
  // ==========================================
  return (
    <ScreenWrapper scrollable includeTopInset includeBottomInset includeTabInset contentContainerStyle={styles.container}>
      {renderHeader('AI Quiz & Recall', 'Active recall quizzes generated from your syllabus')}

      {/* Hero Pulse Card: AI Quiz Mastery Engine */}
      <Card
        variant="default"
        style={[
          styles.heroCard,
          {
            backgroundColor: theme.cardBackground,
            borderColor: theme.borderSubtle,
          },
        ]}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroTitleBlock}>
            <View style={styles.heroBadgeRow}>
              <Badge label="🤖 AI Examiner Ready" variant="brand" size="sm" />
              <Badge label="SM-2 Active" variant="success" size="sm" style={{ marginLeft: Spacing.xs }} />
            </View>
            <ThemedText type="titleMedium" style={styles.heroTitle}>
              Quiz & Recall Mastery Engine
            </ThemedText>
          </View>
        </View>

        {/* Telemetry Stats Grid */}
        <View style={styles.heroStatsRow}>
          <View style={[styles.heroStatItem, { backgroundColor: theme.surfaceSubtle }]}>
            <ThemedText type="titleMedium" style={{ fontWeight: '700', color: theme.brandPrimary, fontSize: 18 }}>
              {quizzes.length}
            </ThemedText>
            <ThemedText type="bodySmall" style={{ color: theme.textSecondary, fontSize: 11 }}>
              Total Quizzes
            </ThemedText>
          </View>
          <View style={[styles.heroStatItem, { backgroundColor: theme.surfaceSubtle }]}>
            <ThemedText type="titleMedium" style={{ fontWeight: '700', color: theme.statusSuccess, fontSize: 18 }}>
              {totalQuestionsSum}
            </ThemedText>
            <ThemedText type="bodySmall" style={{ color: theme.textSecondary, fontSize: 11 }}>
              Questions
            </ThemedText>
          </View>
          <View style={[styles.heroStatItem, { backgroundColor: theme.surfaceSubtle }]}>
            <ThemedText type="titleMedium" style={{ fontWeight: '700', color: theme.statusWarning, fontSize: 18 }}>
              100%
            </ThemedText>
            <ThemedText type="bodySmall" style={{ color: theme.textSecondary, fontSize: 11 }}>
              AI Verified
            </ThemedText>
          </View>
        </View>

        <ThemedText type="bodySmall" style={[styles.heroTipText, { color: theme.textSecondary }]}>
          💡 Active testing triggers the testing effect, boosting syllabus retention by up to 250% over passive re-reading.
        </ThemedText>
      </Card>

      {/* Action Row & Quick Accelerators */}
      <View style={styles.actionRow}>
        <Button
          title="✨ Create New AI Quiz"
          variant="primary"
          size="md"
          onPress={() => setMode('create')}
          style={{ flex: 1 }}
        />
      </View>

      {/* Quick Quiz Accelerators */}
      <View style={styles.quickAcceleratorsRow}>
        <TouchableOpacity
          onPress={() => {
            setTopic('Data Structures & Algorithms');
            setQuestionCount(3);
            setMode('create');
          }}
          style={[styles.acceleratorPill, { backgroundColor: theme.surfaceSubtle, borderColor: theme.borderSubtle }]}>
          <Text style={styles.acceleratorIcon}>⚡</Text>
          <Text style={[styles.acceleratorText, { color: theme.text }]}>Rapid 3-Q Drill</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            setTopic('Operating Systems');
            setQuestionCount(10);
            setDifficulty('hard');
            setMode('create');
          }}
          style={[styles.acceleratorPill, { backgroundColor: theme.surfaceSubtle, borderColor: theme.borderSubtle }]}>
          <Text style={styles.acceleratorIcon}>🎯</Text>
          <Text style={[styles.acceleratorText, { color: theme.text }]}>Exam Mode (10 Qs)</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={[styles.searchBarContainer, { backgroundColor: theme.inputBackground, borderColor: theme.borderSubtle }]}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          placeholder="Search quizzes by topic, title..."
          placeholderTextColor={theme.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={[styles.searchInput, { color: theme.text }]}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
            <Text style={{ color: theme.textSecondary, fontWeight: 'bold' }}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Difficulty Filter Chips */}
      <View style={styles.filterChipsRow}>
        {(['all', 'easy', 'medium', 'hard'] as const).map((diff) => (
          <TouchableOpacity
            key={diff}
            onPress={() => setDifficultyFilter(diff)}
            style={[
              styles.filterChip,
              {
                backgroundColor: difficultyFilter === diff ? theme.brandPrimary : theme.surfaceSubtle,
                borderColor: difficultyFilter === diff ? theme.brandPrimary : theme.borderSubtle,
              },
            ]}>
            <Text
              style={[
                styles.filterChipText,
                { color: difficultyFilter === diff ? '#ffffff' : theme.text },
              ]}>
              {diff === 'all'
                ? `All (${quizzes.length})`
                : diff === 'easy'
                ? '🟢 Easy'
                : diff === 'medium'
                ? '🟡 Medium'
                : '🔴 Hard'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Sorting bar */}
      <View style={styles.sortBar}>
        <ThemedText type="bodySmall" style={{ color: theme.textSecondary, fontWeight: '600' }}>
          Sort by:
        </ThemedText>
        <TouchableOpacity
          onPress={() => setSortBy('recent')}
          style={[
            styles.sortBtn,
            sortBy === 'recent' && { borderBottomColor: theme.brandPrimary, borderBottomWidth: 2 },
          ]}>
          <Text style={[styles.sortBtnText, { color: sortBy === 'recent' ? theme.brandPrimary : theme.textSecondary }]}>
            Recent
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setSortBy('title')}
          style={[
            styles.sortBtn,
            sortBy === 'title' && { borderBottomColor: theme.brandPrimary, borderBottomWidth: 2 },
          ]}>
          <Text style={[styles.sortBtnText, { color: sortBy === 'title' ? theme.brandPrimary : theme.textSecondary }]}>
            Title A-Z
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setSortBy('count')}
          style={[
            styles.sortBtn,
            sortBy === 'count' && { borderBottomColor: theme.brandPrimary, borderBottomWidth: 2 },
          ]}>
          <Text style={[styles.sortBtnText, { color: sortBy === 'count' ? theme.brandPrimary : theme.textSecondary }]}>
            Most Qs
          </Text>
        </TouchableOpacity>
      </View>

      {/* Quiz List / Empty State */}
      {isLoadingList ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.brandPrimary} />
          <ThemedText type="bodyMedium" style={{ marginTop: Spacing.sm, color: theme.textSecondary }}>
            Loading syllabus quizzes...
          </ThemedText>
        </View>
      ) : filteredQuizzes.length === 0 ? (
        <Card variant="default" style={[styles.emptyCard, { borderColor: theme.borderSubtle }]}>
          <Text style={styles.emptyIcon}>🎯</Text>
          <ThemedText type="headlineMedium" style={styles.emptyTitle}>
            {searchQuery || difficultyFilter !== 'all' ? 'No Matching Quizzes' : 'No Quizzes Yet'}
          </ThemedText>
          <ThemedText type="bodyMedium" style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            {searchQuery || difficultyFilter !== 'all'
              ? 'Try changing your search keywords or clearing difficulty filters.'
              : 'Generate your first interactive AI Quiz from any study topic to test your knowledge and convert missed questions into flashcards!'}
          </ThemedText>
          <Button
            title="✨ Create AI Quiz"
            variant="primary"
            size="md"
            onPress={() => setMode('create')}
            style={{ marginTop: Spacing.md }}
          />
        </Card>
      ) : (
        <View style={styles.quizListContainer}>
          {filteredQuizzes.map((item, index) => (
            <AnimatedQuizCard
              key={item.id}
              quiz={item}
              index={index}
              onStart={handleStartQuiz}
              onDelete={handleDeleteQuiz}
            />
          ))}
        </View>
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.md,
    paddingBottom: 90,
  },
  header: {
    marginBottom: Spacing.md,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  backButtonText: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  headerTitleContainer: {
    flex: 1,
  },
  title: {
    fontWeight: 'bold',
    fontSize: 22,
  },
  timerPill: {
    paddingHorizontal: Spacing.sm + 4,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: '#6366f140',
  },
  timerText: {
    fontWeight: '700',
    fontSize: 14,
  },
  heroCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  heroTitleBlock: {
    flex: 1,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  heroStatsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  heroStatItem: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  heroTipText: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
  },
  quickAcceleratorsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  acceleratorPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  acceleratorIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  acceleratorText: {
    fontSize: 12,
    fontWeight: '600',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm + 4,
    height: 46,
    marginBottom: Spacing.sm,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: Spacing.xs,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    height: '100%',
  },
  clearSearchBtn: {
    padding: Spacing.xs,
  },
  filterChipsRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sortBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  sortBtn: {
    paddingVertical: 4,
  },
  sortBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  quizListContainer: {
    gap: Spacing.sm,
  },
  quizCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  cardTitleBlock: {
    flex: 1,
    paddingRight: Spacing.sm,
  },
  quizTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  quizLeadIcon: {
    fontSize: 18,
    marginRight: 6,
  },
  quizCardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteIconText: {
    fontSize: 16,
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
    borderRadius: BorderRadius.md,
    borderWidth: 1,
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
    fontSize: 14,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: 15,
  },
  presetChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  presetChip: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  chipRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  difficultyCard: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  difficultyLabel: {
    fontWeight: '700',
    fontSize: 12,
    marginBottom: 2,
  },
  difficultySub: {
    fontSize: 10,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  chipText: {
    fontWeight: '600',
    fontSize: 12,
  },
  aiNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: Spacing.md,
  },
  aiNoticeIcon: {
    fontSize: 18,
    marginRight: Spacing.xs,
  },
  aiFeedbackToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  aiFeedbackInfoBlock: {
    flex: 1,
    paddingRight: Spacing.sm,
  },
  feedbackToggleBtn: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  feedbackToggleBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 11,
  },
  progressSection: {
    marginBottom: Spacing.sm,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  progressBarContainer: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  questionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  questionText: {
    fontSize: 17,
    lineHeight: 24,
    marginBottom: Spacing.md,
    fontWeight: '600',
  },
  optionsContainer: {
    gap: Spacing.sm,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm + 4,
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
  optionStatusText: {
    fontWeight: '700',
    fontSize: 12,
    marginLeft: Spacing.xs,
  },
  aiExplanationCard: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  aiExplanationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiAvatarIcon: {
    fontSize: 18,
    marginRight: 6,
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
    fontSize: 38,
    fontWeight: 'bold',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  metricBox: {
    flex: 1,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  recallCallout: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
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
    borderWidth: 1,
  },
  resultActionsRow: {
    flexDirection: 'row',
    marginTop: Spacing.md,
    marginBottom: Spacing.xl,
  },
  card: {
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
});
