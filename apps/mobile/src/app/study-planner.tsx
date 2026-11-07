import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ScreenWrapper } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useSubjects } from '@/hooks/use-subjects';
import { studyPlannerApi } from '@/services/api/client';
import { StudyBlock, StudyPaceMode, StudyPlan } from '@/types/planner';

export default function StudyPlannerScreen() {
  const router = useRouter();
  const { subjects, fetchSubjects } = useSubjects();

  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isRebalancing, setIsRebalancing] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Generation Form Customization State
  const [selectedTargetMinutes, setSelectedTargetMinutes] = useState<number>(180);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [selectedPace, setSelectedPace] = useState<StudyPaceMode>('balanced');
  const [selectedStartHour, setSelectedStartHour] = useState<number | null>(null);
  const [includeBreaks, setIncludeBreaks] = useState<boolean>(true);

  // Filter State
  const [filterMode, setFilterMode] = useState<'all' | 'pending' | 'completed'>('all');

  const fetchPlan = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setIsLoading(true);
    try {
      const todayPlan = await studyPlannerApi.getTodayPlan();
      setPlan(todayPlan);
    } catch {
      // Graceful fallback
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPlan();
    fetchSubjects();
  }, [fetchPlan, fetchSubjects]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.allSettled([fetchPlan(true), fetchSubjects(true)]);
  };

  const toggleSubjectSelection = (subjectId: string) => {
    setSelectedSubjectIds((prev) =>
      prev.includes(subjectId) ? prev.filter((id) => id !== subjectId) : [...prev, subjectId]
    );
  };

  const handleToggleAllSubjects = () => {
    if (selectedSubjectIds.length === subjects.length) {
      setSelectedSubjectIds([]);
    } else {
      setSelectedSubjectIds(subjects.map((s) => s.id));
    }
  };

  const handleGeneratePlan = async () => {
    setIsGenerating(true);
    try {
      const newPlan = await studyPlannerApi.generate({
        target_study_minutes: selectedTargetMinutes,
        focus_subject_ids: selectedSubjectIds.length > 0 ? selectedSubjectIds : undefined,
        pace_mode: selectedPace,
        start_hour: selectedStartHour ?? undefined,
        include_breaks: includeBreaks,
      });
      setPlan(newPlan);
      setIsModalOpen(false);
      Alert.alert(
        'Schedule Generated! 🚀',
        `Your personalized ${(selectedTargetMinutes / 60).toFixed(1)}h study agenda has been scheduled with conflict-free timeblocks.`
      );
    } catch (err: any) {
      Alert.alert('Generation Error', err?.message || 'Could not generate study schedule.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleToggleBlock = async (block: StudyBlock) => {
    if (!plan) return;
    const nextCompleted = !block.is_completed;

    // Optimistic UI update
    const previousPlan = { ...plan };
    const updatedBlocks = plan.timeblocks.map((b) =>
      b.id === block.id ? { ...b, is_completed: nextCompleted } : b
    );
    const addedMins = block.block_type !== 'break' ? block.duration_minutes : 0;
    const newCompletedMins = nextCompleted
      ? plan.completed_minutes + addedMins
      : Math.max(0, plan.completed_minutes - addedMins);

    setPlan({
      ...plan,
      timeblocks: updatedBlocks,
      completed_minutes: newCompletedMins,
      completion_percentage:
        plan.planned_minutes > 0 ? (newCompletedMins / plan.planned_minutes) * 100 : 0,
    });

    try {
      const result = await studyPlannerApi.toggleBlock(plan.id, block.id, {
        is_completed: nextCompleted,
      });
      setPlan(result);
    } catch {
      // Revert on error
      setPlan(previousPlan);
      Alert.alert('Sync Error', 'Could not update block status.');
    }
  };

  const handleRebalance = async () => {
    if (!plan) return;
    setIsRebalancing(true);
    try {
      const result = await studyPlannerApi.rebalance(plan.id);
      setPlan(result);
      Alert.alert('Rebalanced! ⚡', 'Remaining unfinished blocks shifted to match your evening hours.');
    } catch (err: any) {
      Alert.alert('Rebalance Error', err?.message || 'Could not rebalance study plan.');
    } finally {
      setIsRebalancing(false);
    }
  };

  const handleStartFocus = (block: StudyBlock) => {
    router.push(
      `/pomodoro?taskTitle=${encodeURIComponent(block.title)}&taskId=${block.task_id || ''}` as never
    );
  };

  const filteredBlocks = (plan?.timeblocks || []).filter((b) => {
    if (filterMode === 'pending') return !b.is_completed;
    if (filterMode === 'completed') return b.is_completed;
    return true;
  });

  const completedCount = (plan?.timeblocks || []).filter(
    (b) => b.is_completed && b.block_type !== 'break'
  ).length;
  const pendingCount = (plan?.timeblocks || []).filter(
    (b) => !b.is_completed && b.block_type !== 'break'
  ).length;

  return (
    <ScreenWrapper
      includeTopInset
      includeBottomInset
      includeTabInset
      scrollable={false}
      contentContainerStyle={{ flex: 1, paddingHorizontal: 0 }}
      style={{ backgroundColor: '#060913' }}>
      {/* 1. Master Header Bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityLabel="Go back"
          style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <View style={styles.headerBadgeRow}>
            <Text style={styles.headerSubBadge}>AI TIMEBOXING</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>
                {new Date().toLocaleDateString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </Text>
            </View>
          </View>
          <Text style={styles.headerTitleText} numberOfLines={1}>
            Smart Study Planner
          </Text>
        </View>

        <View style={styles.headerActions}>
          {plan && pendingCount > 0 ? (
            <TouchableOpacity
              onPress={handleRebalance}
              disabled={isRebalancing}
              accessibilityLabel="Rebalance Schedule"
              style={styles.headerRebalanceBtn}>
              {isRebalancing ? (
                <ActivityIndicator size="small" color="#38BDF8" />
              ) : (
                <>
                  <Text style={styles.headerBtnIcon}>⚡</Text>
                  <Text style={styles.headerRebalanceText}>Shift</Text>
                </>
              )}
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            onPress={() => setIsModalOpen(true)}
            accessibilityLabel="Configure Schedule"
            style={styles.headerGenerateBtn}>
            <Text style={styles.headerGenerateIcon}>✨</Text>
            <Text style={styles.headerGenerateText}>Plan</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#06B6D4"
            colors={['#06B6D4', '#10B981']}
          />
        }>
        {isLoading ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color="#06B6D4" />
            <Text style={styles.loadingText}>Synthesizing conflict-free study schedule...</Text>
          </View>
        ) : !plan ? (
          /* Premium Empty / Unscheduled State Hero */
          <View style={styles.emptyHeroCard}>
            <View style={styles.emptyIconGlowContainer}>
              <View style={styles.emptyIconCircle}>
                <Text style={styles.emptyIconText}>📅</Text>
              </View>
            </View>

            <ThemedText type="headlineMedium" style={styles.emptyTitle}>
              Personalized AI Study Engine
            </ThemedText>
            <Text style={styles.emptySubtitle}>
              StudyMate AI inspects your upcoming exams, pending assignment deadlines, and university
              timetable to curate a conflict-free, optimal daily study agenda.
            </Text>

            {/* Feature Value Props Strip */}
            <View style={styles.featuresStrip}>
              <View style={styles.featureItemPill}>
                <Text style={styles.featurePillIcon}>🛡️</Text>
                <Text style={styles.featurePillText}>No Lecture Collisions</Text>
              </View>
              <View style={styles.featureItemPill}>
                <Text style={styles.featurePillIcon}>🎯</Text>
                <Text style={styles.featurePillText}>Exam Weighted</Text>
              </View>
              <View style={styles.featureItemPill}>
                <Text style={styles.featurePillIcon}>🧠</Text>
                <Text style={styles.featurePillText}>Spaced Recall</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.emptyActionBtn}
              onPress={() => setIsModalOpen(true)}
              accessibilityLabel="Generate Today's AI Schedule">
              <Text style={styles.emptyActionIcon}>✨</Text>
              <Text style={styles.emptyActionText}>Generate Today's AI Schedule</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Active Plan View */
          <>
            {/* Daily Mastery & Goal Card */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryTopRow}>
                <View style={styles.targetProgressPill}>
                  <Text style={styles.targetIcon}>⏱️</Text>
                  <Text style={styles.targetLabel}>
                    {plan.completed_minutes} of {plan.planned_minutes} min completed
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusPill,
                    plan.status === 'completed' && styles.statusPillDone,
                  ]}>
                  <Text
                    style={[
                      styles.statusPillText,
                      plan.status === 'completed' && styles.statusPillTextDone,
                    ]}>
                    {plan.status === 'completed' ? '✓ Complete' : 'Active Plan'}
                  </Text>
                </View>
              </View>

              {/* Progress Bar */}
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(
                        100,
                        plan.planned_minutes > 0
                          ? (plan.completed_minutes / plan.planned_minutes) * 100
                          : 0
                      )}%`,
                    },
                  ]}
                />
              </View>

              {/* Quick Metrics Bar */}
              <View style={styles.quickMetricsRow}>
                <View style={styles.metricCol}>
                  <Text style={styles.metricValDone}>{completedCount}</Text>
                  <Text style={styles.metricSub}>Completed</Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.metricCol}>
                  <Text style={styles.metricValPending}>{pendingCount}</Text>
                  <Text style={styles.metricSub}>Remaining</Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.metricCol}>
                  <Text style={styles.metricValTarget}>
                    {(plan.target_study_minutes / 60).toFixed(1)}h
                  </Text>
                  <Text style={styles.metricSub}>Target Goal</Text>
                </View>
              </View>
            </View>

            {/* AI Strategic Coaching Card */}
            {plan.ai_summary ? (
              <View style={styles.aiInsightCard}>
                <View style={styles.aiInsightHeader}>
                  <Text style={styles.aiSparkleIcon}>💡</Text>
                  <Text style={styles.aiInsightTitle}>AI STRATEGIC ADVISOR</Text>
                </View>
                <Text style={styles.aiInsightBody}>{plan.ai_summary}</Text>
              </View>
            ) : null}

            {/* Filter Tabs */}
            <View style={styles.filterBar}>
              {(
                [
                  { key: 'all', label: `All (${plan.timeblocks.length})` },
                  { key: 'pending', label: `Remaining (${pendingCount})` },
                  { key: 'completed', label: `Done (${completedCount})` },
                ] as const
              ).map((tab) => {
                const isAct = filterMode === tab.key;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    onPress={() => setFilterMode(tab.key)}
                    style={[styles.filterBtn, isAct && styles.filterBtnActive]}>
                    <Text
                      style={[
                        styles.filterBtnText,
                        isAct && styles.filterBtnTextActive,
                      ]}>
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Timeblocks Timeline List */}
            <View style={styles.blocksList}>
              {filteredBlocks.map((block) => {
                const isBreak = block.block_type === 'break';
                return (
                  <View
                    key={block.id}
                    style={[
                      styles.blockCard,
                      block.is_completed && styles.blockCardCompleted,
                      isBreak && styles.blockCardBreak,
                      !isBreak && { borderLeftColor: block.subject_color || '#06B6D4' },
                    ]}>
                    {/* Top Row: Time, Type, Priority */}
                    <View style={styles.blockTopRow}>
                      <View style={styles.timeTag}>
                        <Text style={styles.timeTagText}>
                          ⏰ {block.start_time} - {block.end_time} • {block.duration_minutes}m
                        </Text>
                      </View>

                      {!isBreak ? (
                        <View style={styles.badgeRow}>
                          <View
                            style={[
                              styles.priorityChip,
                              block.priority === 'urgent' && styles.priorityUrgent,
                              block.priority === 'high' && styles.priorityHigh,
                            ]}>
                            <Text style={styles.priorityChipText}>
                              {block.priority === 'urgent' ? '🚨 Urgent' : block.priority}
                            </Text>
                          </View>

                          <View
                            style={[
                              styles.blockTypeChip,
                              block.block_type === 'exam_revision' && styles.typeExam,
                            ]}>
                            <Text style={styles.blockTypeChipText}>
                              {block.block_type === 'exam_revision'
                                ? '📖 Exam Prep'
                                : block.block_type === 'spaced_review'
                                ? '🧠 Spaced Recall'
                                : '📝 Assignment'}
                            </Text>
                          </View>
                        </View>
                      ) : null}
                    </View>

                    {/* Main Row: Checkbox, Title, Subject */}
                    <View style={styles.blockMainRow}>
                      {!isBreak ? (
                        <TouchableOpacity
                          onPress={() => handleToggleBlock(block)}
                          accessibilityLabel="Toggle completion"
                          style={[
                            styles.checkbox,
                            block.is_completed && styles.checkboxDone,
                          ]}>
                          {block.is_completed ? <Text style={styles.checkMark}>✓</Text> : null}
                        </TouchableOpacity>
                      ) : (
                        <Text style={{ fontSize: 20 }}>☕</Text>
                      )}

                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.blockTitle,
                            block.is_completed && styles.blockTitleDone,
                            isBreak && styles.blockTitleBreak,
                          ]}
                          numberOfLines={2}>
                          {block.title}
                        </Text>

                        {!isBreak && block.subject_name ? (
                          <View style={styles.subjectRow}>
                            <View
                              style={[
                                styles.subjectDot,
                                { backgroundColor: block.subject_color || '#38BDF8' },
                              ]}
                            />
                            <Text
                              style={[
                                styles.subjectName,
                                { color: block.subject_color || '#94A3B8' },
                              ]}>
                              {block.subject_name}
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      {/* 1-Tap Pomodoro Focus Launcher */}
                      {!isBreak && !block.is_completed ? (
                        <TouchableOpacity
                          onPress={() => handleStartFocus(block)}
                          style={styles.focusActionBtn}
                          accessibilityLabel="Start Focus Timer">
                          <Text style={styles.focusActionIcon}>⏱️</Text>
                          <Text style={styles.focusActionText}>Focus</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      {/* Advanced AI Schedule Generator Modal with Subject Picker & Customization */}
      <Modal
        visible={isModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderIconBadge}>
                <Text style={{ fontSize: 20 }}>📅</Text>
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText type="headlineMedium" style={styles.modalTitle}>
                  Create AI Study Schedule
                </ThemedText>
                <Text style={styles.modalSubtitle}>
                  Tailor your study session with subject priorities, pace, and timeboxing.
                </Text>
              </View>
            </View>

            <ScrollView
              style={styles.modalScrollBody}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}>
              {/* Section 1: Target Daily Hours */}
              <Text style={styles.modalFieldLabel}>1. DAILY STUDY GOAL</Text>
              <View style={styles.targetGrid}>
                {[
                  { mins: 60, label: '1h', sub: 'Light' },
                  { mins: 120, label: '2h', sub: 'Moderate' },
                  { mins: 180, label: '3h', sub: 'Standard' },
                  { mins: 240, label: '4h', sub: 'Deep Focus' },
                  { mins: 300, label: '5h', sub: 'Intensive' },
                  { mins: 360, label: '6h', sub: 'Full Day' },
                ].map((opt) => {
                  const isSel = selectedTargetMinutes === opt.mins;
                  return (
                    <TouchableOpacity
                      key={opt.mins}
                      onPress={() => setSelectedTargetMinutes(opt.mins)}
                      style={[styles.targetOptionChip, isSel && styles.targetOptionChipSelected]}>
                      <Text
                        style={[
                          styles.targetOptionText,
                          isSel && styles.targetOptionTextSelected,
                        ]}>
                        {opt.label}
                      </Text>
                      <Text
                        style={[
                          styles.targetOptionSub,
                          isSel && styles.targetOptionSubSelected,
                        ]}>
                        {opt.sub}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Section 2: Focus Subjects Selection (User Requested!) */}
              <View style={styles.subjectPickerHeaderRow}>
                <Text style={styles.modalFieldLabel}>2. FOCUS SUBJECTS TODAY</Text>
                {subjects.length > 0 ? (
                  <TouchableOpacity onPress={handleToggleAllSubjects} hitSlop={6}>
                    <Text style={styles.toggleAllText}>
                      {selectedSubjectIds.length === subjects.length ? 'Clear All' : 'Select All'}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {subjects.length === 0 ? (
                <View style={styles.noSubjectsBox}>
                  <Text style={styles.noSubjectsText}>
                    No subjects created yet. AI will generate general deep study timeblocks.
                  </Text>
                </View>
              ) : (
                <View style={styles.subjectChipsWrap}>
                  {subjects.map((sub) => {
                    const isSelected = selectedSubjectIds.includes(sub.id);
                    return (
                      <TouchableOpacity
                        key={sub.id}
                        onPress={() => toggleSubjectSelection(sub.id)}
                        style={[
                          styles.subjectFilterChip,
                          isSelected && styles.subjectFilterChipActive,
                          { borderColor: isSelected ? sub.color || '#06B6D4' : 'rgba(255, 255, 255, 0.1)' },
                        ]}>
                        <View
                          style={[
                            styles.subjectChipDot,
                            { backgroundColor: sub.color || '#38BDF8' },
                          ]}
                        />
                        <Text
                          style={[
                            styles.subjectChipText,
                            isSelected && styles.subjectChipTextActive,
                          ]}
                          numberOfLines={1}>
                          {sub.code ? `${sub.code} • ` : ''}
                          {sub.name}
                        </Text>
                        {isSelected ? <Text style={styles.subjectCheckIcon}>✓</Text> : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Section 3: Study Pace & Style */}
              <Text style={styles.modalFieldLabel}>3. STUDY PACE & STYLE</Text>
              <View style={styles.paceSelectorRow}>
                {(
                  [
                    {
                      id: 'balanced',
                      icon: '⚡',
                      label: 'Balanced',
                      desc: '45m study • 15m rest',
                    },
                    {
                      id: 'intensive',
                      icon: '🎯',
                      label: 'Deep Focus',
                      desc: '60m blocks • 10m rest',
                    },
                    {
                      id: 'pomodoro',
                      icon: '⏱️',
                      label: 'Pomodoro',
                      desc: '25m sprint • 5m rest',
                    },
                  ] as const
                ).map((pace) => {
                  const isSel = selectedPace === pace.id;
                  return (
                    <TouchableOpacity
                      key={pace.id}
                      onPress={() => setSelectedPace(pace.id)}
                      style={[styles.paceCard, isSel && styles.paceCardActive]}>
                      <Text style={styles.paceIcon}>{pace.icon}</Text>
                      <Text style={[styles.paceLabel, isSel && styles.paceLabelActive]}>
                        {pace.label}
                      </Text>
                      <Text style={styles.paceDesc}>{pace.desc}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Section 4: Starting Time Preference */}
              <Text style={styles.modalFieldLabel}>4. STUDY TIME SLOT</Text>
              <View style={styles.slotRow}>
                {[
                  { hour: null, label: 'Auto (After Lectures)' },
                  { hour: 9, label: 'Morning (9 AM)' },
                  { hour: 17, label: 'Evening (5 PM)' },
                  { hour: 20, label: 'Night Owl (8 PM)' },
                ].map((slot, idx) => {
                  const isSel = selectedStartHour === slot.hour;
                  return (
                    <TouchableOpacity
                      key={idx}
                      onPress={() => setSelectedStartHour(slot.hour)}
                      style={[styles.slotChip, isSel && styles.slotChipActive]}>
                      <Text style={[styles.slotChipText, isSel && styles.slotChipTextActive]}>
                        {slot.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Section 5: Rest Breaks Toggle */}
              <View style={styles.breakToggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.breakToggleTitle}>Include Rest Breaks</Text>
                  <Text style={styles.breakToggleSubtitle}>
                    Inserts restorative breaks to mitigate mental fatigue
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setIncludeBreaks((prev) => !prev)}
                  style={[
                    styles.toggleSwitch,
                    includeBreaks && styles.toggleSwitchActive,
                  ]}>
                  <View
                    style={[
                      styles.toggleKnob,
                      includeBreaks && styles.toggleKnobActive,
                    ]}
                  />
                </TouchableOpacity>
              </View>
            </ScrollView>

            {/* Modal Bottom Actions */}
            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                onPress={() => setIsModalOpen(false)}
                style={styles.modalCancelBtn}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleGeneratePlan}
                disabled={isGenerating}
                style={styles.modalConfirmBtn}>
                {isGenerating ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.modalConfirmIcon}>✨</Text>
                    <Text style={styles.modalConfirmText}>Create Schedule</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: 4,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: '#070A14',
    gap: 8,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerTitleWrap: {
    flex: 1,
    gap: 1,
  },
  headerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerSubBadge: {
    color: '#06B6D4',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  countBadge: {
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)',
  },
  countBadgeText: {
    color: '#22D3EE',
    fontSize: 9.5,
    fontWeight: '700',
  },
  headerTitleText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerRebalanceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(56, 189, 248, 0.16)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
  },
  headerBtnIcon: {
    fontSize: 12,
  },
  headerRebalanceText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '800',
  },
  headerGenerateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0891B2',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1.2,
    borderColor: 'rgba(34, 211, 238, 0.4)',
    shadowColor: '#06B6D4',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 3,
  },
  headerGenerateIcon: {
    color: '#FFFFFF',
    fontSize: 13,
  },
  headerGenerateText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: 120,
    gap: 12,
  },
  centerLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 13,
  },
  emptyHeroCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
    backgroundColor: 'rgba(11, 18, 36, 0.95)',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(6, 182, 212, 0.3)',
    marginTop: 16,
    gap: 12,
    shadowColor: '#06B6D4',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 4,
  },
  emptyIconGlowContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(6, 182, 212, 0.4)',
    shadowColor: '#06B6D4',
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#08172E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconText: {
    fontSize: 28,
  },
  emptyTitle: {
    color: '#F8FAFC',
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptySubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  featuresStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginVertical: 4,
  },
  featureItemPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  featurePillIcon: {
    fontSize: 11,
  },
  featurePillText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '700',
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0891B2',
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: 'rgba(34, 211, 238, 0.5)',
    shadowColor: '#06B6D4',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 4,
    marginTop: 6,
  },
  emptyActionIcon: {
    fontSize: 16,
  },
  emptyActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  summaryCard: {
    backgroundColor: 'rgba(10, 18, 34, 0.95)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.2,
    borderColor: 'rgba(6, 182, 212, 0.25)',
    gap: 12,
    shadowColor: '#06B6D4',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  targetProgressPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  targetIcon: {
    fontSize: 14,
  },
  targetLabel: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
  },
  statusPill: {
    backgroundColor: 'rgba(6, 182, 212, 0.16)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)',
  },
  statusPillDone: {
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  statusPillText: {
    color: '#22D3EE',
    fontSize: 11,
    fontWeight: '700',
  },
  statusPillTextDone: {
    color: '#34D399',
  },
  progressTrack: {
    height: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 3.5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#06B6D4',
    borderRadius: 3.5,
  },
  quickMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 4,
  },
  metricCol: {
    alignItems: 'center',
    gap: 2,
  },
  metricValDone: {
    color: '#34D399',
    fontSize: 16,
    fontWeight: '800',
  },
  metricValPending: {
    color: '#38BDF8',
    fontSize: 16,
    fontWeight: '800',
  },
  metricValTarget: {
    color: '#FBBF24',
    fontSize: 16,
    fontWeight: '800',
  },
  metricSub: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  aiInsightCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.25)',
    gap: 6,
  },
  aiInsightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  aiSparkleIcon: {
    fontSize: 14,
  },
  aiInsightTitle: {
    color: '#A5B4FC',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  aiInsightBody: {
    color: '#E2E8F0',
    fontSize: 12.5,
    lineHeight: 18,
  },
  filterBar: {
    flexDirection: 'row',
    gap: 8,
  },
  filterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  filterBtnActive: {
    backgroundColor: 'rgba(6, 182, 212, 0.2)',
    borderColor: '#06B6D4',
  },
  filterBtnText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  filterBtnTextActive: {
    color: '#22D3EE',
    fontWeight: '800',
  },
  blocksList: {
    gap: 10,
  },
  blockCard: {
    backgroundColor: 'rgba(13, 20, 42, 0.92)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderLeftWidth: 4,
    borderLeftColor: '#06B6D4',
    gap: 8,
  },
  blockCardCompleted: {
    opacity: 0.65,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  blockCardBreak: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderStyle: 'dashed',
    borderLeftColor: '#64748B',
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  blockTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  timeTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  timeTagText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  priorityChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  priorityUrgent: {
    backgroundColor: 'rgba(244, 63, 94, 0.18)',
  },
  priorityHigh: {
    backgroundColor: 'rgba(251, 191, 36, 0.18)',
  },
  priorityChipText: {
    color: '#F1F5F9',
    fontSize: 10,
    fontWeight: '700',
  },
  blockTypeChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.14)',
  },
  typeExam: {
    backgroundColor: 'rgba(236, 72, 153, 0.18)',
  },
  blockTypeChipText: {
    color: '#E0F2FE',
    fontSize: 10,
    fontWeight: '700',
  },
  blockMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: 'rgba(6, 182, 212, 0.5)',
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  checkMark: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  blockTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  blockTitleDone: {
    textDecorationLine: 'line-through',
    color: '#64748B',
  },
  blockTitleBreak: {
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  subjectDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  subjectName: {
    fontSize: 11,
    fontWeight: '600',
  },
  focusActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(249, 115, 22, 0.18)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.4)',
  },
  focusActionIcon: {
    fontSize: 12,
  },
  focusActionText: {
    color: '#F97316',
    fontSize: 11,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'center',
    padding: Spacing.md,
  },
  modalCard: {
    backgroundColor: '#09101F',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(6, 182, 212, 0.35)',
    maxHeight: '90%',
    gap: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalHeaderIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(6, 182, 212, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.4)',
  },
  modalTitle: {
    color: '#F8FAFC',
    fontSize: 17,
  },
  modalSubtitle: {
    color: '#94A3B8',
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 2,
  },
  modalScrollBody: {
    maxHeight: 420,
  },
  modalScrollContent: {
    gap: 14,
    paddingBottom: 8,
  },
  modalFieldLabel: {
    color: '#67E8F9',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  targetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  targetOptionChip: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  targetOptionChipSelected: {
    backgroundColor: 'rgba(6, 182, 212, 0.22)',
    borderColor: '#06B6D4',
  },
  targetOptionText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
  },
  targetOptionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  targetOptionSub: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 2,
  },
  targetOptionSubSelected: {
    color: '#22D3EE',
  },
  subjectPickerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleAllText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
  },
  noSubjectsBox: {
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 10,
  },
  noSubjectsText: {
    color: '#94A3B8',
    fontSize: 11.5,
  },
  subjectChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  subjectFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1.2,
  },
  subjectFilterChipActive: {
    backgroundColor: 'rgba(6, 182, 212, 0.18)',
  },
  subjectChipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  subjectChipText: {
    color: '#94A3B8',
    fontSize: 11.5,
    fontWeight: '600',
    maxWidth: 160,
  },
  subjectChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  subjectCheckIcon: {
    color: '#22D3EE',
    fontSize: 11,
    fontWeight: '900',
  },
  paceSelectorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  paceCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    gap: 3,
  },
  paceCardActive: {
    backgroundColor: 'rgba(6, 182, 212, 0.2)',
    borderColor: '#06B6D4',
  },
  paceIcon: {
    fontSize: 16,
  },
  paceLabel: {
    color: '#94A3B8',
    fontSize: 11.5,
    fontWeight: '700',
  },
  paceLabelActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  paceDesc: {
    color: '#64748B',
    fontSize: 9,
    textAlign: 'center',
  },
  slotRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  slotChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  slotChipActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderColor: '#38BDF8',
  },
  slotChipText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  slotChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  breakToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    padding: 12,
    borderRadius: 12,
    marginTop: 2,
  },
  breakToggleTitle: {
    color: '#F1F5F9',
    fontSize: 12.5,
    fontWeight: '700',
  },
  breakToggleSubtitle: {
    color: '#64748B',
    fontSize: 10.5,
    marginTop: 2,
  },
  toggleSwitch: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    padding: 2,
    justifyContent: 'center',
  },
  toggleSwitchActive: {
    backgroundColor: '#06B6D4',
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  toggleKnobActive: {
    alignSelf: 'flex-end',
  },
  modalActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  modalCancelText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
  },
  modalConfirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0891B2',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.4)',
  },
  modalConfirmIcon: {
    color: '#FFFFFF',
    fontSize: 13,
  },
  modalConfirmText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
