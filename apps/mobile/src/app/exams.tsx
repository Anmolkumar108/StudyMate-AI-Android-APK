import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, ScreenWrapper } from '@/components/ui';
import { BorderRadius, Spacing } from '@/constants/theme';
import { examApi, subjectApi } from '@/services/api/client';
import { loadCachedExams, saveCachedExams } from '@/services/storage/exams-cache';
import { Exam } from '@/types/exam';
import { Subject } from '@/types/subject';

type FilterTab = 'upcoming' | 'all' | 'past';

export default function ExamsScreen() {
  const router = useRouter();

  const [exams, setExams] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<FilterTab>('upcoming');
  const [searchQuery, setSearchQuery] = useState('');

  // Create / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [targetScore, setTargetScore] = useState('90');
  const [dueDaysOffset, setDueDaysOffset] = useState<number>(7); // Default 1 week ahead
  const [dueHour, setDueHour] = useState<number>(10);
  const [dueMinute, setDueMinute] = useState<number>(0);
  const [duePeriod, setDuePeriod] = useState<'AM' | 'PM'>('AM');
  const [topicInputs, setTopicInputs] = useState<string[]>(['']);
  const [isSaving, setIsSaving] = useState(false);
  const [generatingPlanExamId, setGeneratingPlanExamId] = useState<string | null>(null);

  // Fetch data with offline instant hydration
  const fetchData = async () => {
    setIsLoading(true);
    // Instant hydration from local cache
    try {
      const cached = await loadCachedExams();
      if (cached && cached.length > 0) {
        setExams(cached);
        setIsLoading(false);
      }
    } catch {
      // Ignore
    }

    try {
      const [examRes, subList] = await Promise.all([
        examApi.list(),
        subjectApi.list().catch(() => []),
      ]);
      setExams(examRes.items);
      saveCachedExams(examRes.items);
      setSubjects(subList);
    } catch {
      // Graceful offline fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/explore' as never);
    }
  };

  // Form Handlers
  const openCreateModal = () => {
    setEditingExam(null);
    setSubjectId(subjects.length > 0 ? subjects[0].id : null);
    setTitle('');
    setLocation('');
    setTargetScore('90');
    setDueDaysOffset(7);
    setDueHour(10);
    setDueMinute(0);
    setDuePeriod('AM');
    setTopicInputs(['']);
    setIsModalOpen(true);
  };

  const openEditModal = (exam: Exam) => {
    setEditingExam(exam);
    setSubjectId(exam.subject_id);
    setTitle(exam.title);
    setLocation(exam.location || '');
    setTargetScore(exam.target_score ? String(exam.target_score) : '90');

    const dt = new Date(exam.exam_date);
    const now = new Date();
    const diffDays = Math.max(1, Math.round((dt.getTime() - now.getTime()) / (1000 * 3600 * 24)));
    setDueDaysOffset(diffDays);

    let h = dt.getHours();
    const isPm = h >= 12;
    if (h > 12) h -= 12;
    if (h === 0) h = 12;
    setDueHour(h);
    setDueMinute(dt.getMinutes() >= 30 ? 30 : 0);
    setDuePeriod(isPm ? 'PM' : 'AM');

    if (exam.syllabus_topics && exam.syllabus_topics.length > 0) {
      setTopicInputs(exam.syllabus_topics.map((t) => t.name));
    } else {
      setTopicInputs(['']);
    }
    setIsModalOpen(true);
  };

  const handleSaveExam = async () => {
    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please enter an exam title (e.g. Operating Systems Final).');
      return;
    }
    if (!subjectId) {
      Alert.alert('Missing Subject', 'Please select a subject for this exam.');
      return;
    }

    const d = new Date();
    d.setDate(d.getDate() + dueDaysOffset);
    let h24 = dueHour % 12;
    if (duePeriod === 'PM') h24 += 12;
    d.setHours(h24, dueMinute, 0, 0);

    const validTopics = topicInputs.map((t) => t.trim()).filter(Boolean);
    const scoreVal = parseFloat(targetScore);

    setIsSaving(true);
    try {
      if (editingExam) {
        const updated = await examApi.update(editingExam.id, {
          subject_id: subjectId,
          title: title.trim(),
          exam_date: d.toISOString(),
          location: location.trim() || undefined,
          target_score: isNaN(scoreVal) ? undefined : scoreVal,
          syllabus_topics: validTopics,
        });
        setExams((prev) => {
          const next = prev.map((e) => (e.id === updated.id ? updated : e));
          saveCachedExams(next);
          return next;
        });
        Alert.alert('Updated', 'Exam details and syllabus topics saved successfully.');
      } else {
        const created = await examApi.create({
          subject_id: subjectId,
          title: title.trim(),
          exam_date: d.toISOString(),
          location: location.trim() || undefined,
          target_score: isNaN(scoreVal) ? undefined : scoreVal,
          syllabus_topics: validTopics,
        });
        setExams((prev) => {
          const next = [created, ...prev];
          saveCachedExams(next);
          return next;
        });
        Alert.alert('Exam Registered 🎯', 'Upcoming exam added with syllabus topics!');
      }
      setIsModalOpen(false);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not save exam.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteExam = (exam: Exam) => {
    Alert.alert('Delete Exam', `Are you sure you want to remove "${exam.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await examApi.delete(exam.id);
            setExams((prev) => prev.filter((e) => e.id !== exam.id));
          } catch (err: any) {
            Alert.alert('Error', err?.message || 'Could not delete exam.');
          }
        },
      },
    ]);
  };

  const handleToggleTopic = async (exam: Exam, topicId: string) => {
    try {
      const updated = await examApi.toggleTopic(exam.id, topicId);
      setExams((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not update topic status.');
    }
  };

  const handleGenerateRevisionPlan = async (exam: Exam) => {
    setGeneratingPlanExamId(exam.id);
    try {
      const updated = await examApi.generateRevisionPlan(exam.id);
      setExams((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      Alert.alert('AI Plan Ready! ✨', `Generated a 3-phase revision plan for "${exam.title}".`);
    } catch (err: any) {
      Alert.alert('AI Plan Error', err?.message || 'Could not generate revision plan.');
    } finally {
      setGeneratingPlanExamId(null);
    }
  };

  // Filtered exams
  const filteredExams = useMemo(() => {
    return exams.filter((e) => {
      if (filterTab === 'upcoming' && e.is_past) return false;
      if (filterTab === 'past' && !e.is_past) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = e.title.toLowerCase().includes(q);
        const matchSub = (e.subject_name || '').toLowerCase().includes(q);
        if (!matchTitle && !matchSub) return false;
      }
      return true;
    });
  }, [exams, filterTab, searchQuery]);

  // Overall metrics
  const upcomingCount = useMemo(() => exams.filter((e) => !e.is_past).length, [exams]);
  const avgReadiness = useMemo(() => {
    if (exams.length === 0) return 0;
    return Math.round(exams.reduce((sum, e) => sum + e.readiness_percentage, 0) / exams.length);
  }, [exams]);
  const nearestExam = useMemo(() => {
    const upcoming = exams.filter((e) => !e.is_past);
    return upcoming.length > 0 ? upcoming[0] : null;
  }, [exams]);

  const formatExamDate = (isoStr: string) => {
    const d = new Date(isoStr);
    return d.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <ScreenWrapper
      includeTopInset
      includeBottomInset
      includeTabInset
      scrollable={false}
      contentContainerStyle={{ flex: 1, paddingHorizontal: 0 }}
      style={{ backgroundColor: '#060913' }}>
      
      {/* 1. Master Header (Height: 46dp) */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          onPress={handleBack}
          accessibilityLabel="Go back"
          style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <View style={styles.headerBadgeRow}>
            <Text style={styles.headerSubBadge}>EXAM PREPARATION</Text>
            {upcomingCount > 0 ? (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{upcomingCount} upcoming</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.headerTitleText} numberOfLines={1}>
            Exams & Revision
          </Text>
        </View>

        <TouchableOpacity
          onPress={openCreateModal}
          accessibilityLabel="Register Exam"
          style={styles.headerAddBtn}>
          <Text style={styles.headerAddBtnIcon}>＋</Text>
          <Text style={styles.headerAddBtnText}>Exam</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.listRootContainer}>
        {/* 2. Top Summary Metrics Strip */}
        <View style={styles.metricsBar}>
          <View style={styles.metricItem}>
            <Text style={styles.metricValUpcoming} numberOfLines={1}>
              {upcomingCount}
            </Text>
            <Text style={styles.metricLabel} numberOfLines={1}>
              Upcoming
            </Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={styles.metricValReadiness} numberOfLines={1}>
              {avgReadiness}%
            </Text>
            <Text style={styles.metricLabel} numberOfLines={1}>
              Readiness
            </Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={styles.metricValCountdown} numberOfLines={1}>
              {nearestExam ? `${nearestExam.days_remaining}d` : 'None'}
            </Text>
            <Text style={styles.metricLabel} numberOfLines={1}>
              Next Exam
            </Text>
          </View>
        </View>

        {/* 3. Search Bar */}
        <View style={styles.searchRow}>
          <View style={styles.searchContainer}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search exams, subjects..."
              placeholderTextColor="#64748B"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
                <Text style={styles.clearSearchIcon}>✕</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* 4. Filter Tabs Row */}
        <View style={styles.filterRowContainer}>
          {(
            [
              { key: 'upcoming', label: 'Upcoming', count: upcomingCount },
              { key: 'all', label: 'All Exams', count: exams.length },
              { key: 'past', label: 'Past', count: exams.filter((e) => e.is_past).length },
            ] as const
          ).map((tab) => {
            const isAct = filterTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setFilterTab(tab.key)}
                style={[styles.filterPill, isAct && styles.filterPillActive]}>
                <Text style={[styles.filterPillText, isAct && styles.filterPillTextActive]}>
                  {tab.label} ({tab.count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 5. Exam Cards List */}
        <FlatList
          data={filteredExams}
          keyExtractor={(item) => item.id}
          style={styles.examList}
          contentContainerStyle={styles.listContent}
          refreshing={isLoading}
          onRefresh={fetchData}
          ListEmptyComponent={
            !isLoading ? (
              <View style={styles.emptyContainer}>
                <Text style={{ fontSize: 44, marginBottom: Spacing.sm }}>🎓</Text>
                <ThemedText type="titleMedium" style={{ textAlign: 'center', color: '#F1F5F9' }}>
                  No Exams Found
                </ThemedText>
                <ThemedText
                  type="bodyMedium"
                  style={{ color: '#94A3B8', textAlign: 'center', marginTop: Spacing.xs }}>
                  {filterTab === 'upcoming'
                    ? 'No upcoming exams scheduled. Register your midterm or final exam to start tracking!'
                    : 'No exams found.'}
                </ThemedText>
                <Button
                  title="+ Register First Exam"
                  variant="primary"
                  size="md"
                  onPress={openCreateModal}
                  style={{ marginTop: Spacing.md }}
                />
              </View>
            ) : undefined
          }
          renderItem={({ item }) => {
            const isGeneratingThis = generatingPlanExamId === item.id;
            const hasPlan = item.revision_plan && item.revision_plan.phases?.length > 0;

            return (
              <Card variant="default" style={styles.examCard}>
                {/* Header: Subject + Countdown Badge */}
                <View style={styles.cardHeaderRow}>
                  {item.subject_name ? (
                    <View
                      style={[
                        styles.subjectBadge,
                        { backgroundColor: (item.subject_color || '#6366F1') + '22' },
                      ]}>
                      <View
                        style={[
                          styles.subjectDot,
                          { backgroundColor: item.subject_color || '#6366F1' },
                        ]}
                      />
                      <Text
                        style={[
                          styles.subjectNameText,
                          { color: item.subject_color || '#818CF8' },
                        ]}>
                        {item.subject_name}
                      </Text>
                    </View>
                  ) : null}

                  {/* Countdown Badge */}
                  {!item.is_past ? (
                    <View
                      style={[
                        styles.countdownBadge,
                        item.days_remaining <= 2 && styles.countdownBadgeUrgent,
                      ]}>
                      <Text
                        style={[
                          styles.countdownText,
                          item.days_remaining <= 2 && styles.countdownTextUrgent,
                        ]}>
                        ⏰ {item.days_remaining > 0 ? `${item.days_remaining}d left` : `${item.hours_remaining}h left!`}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.countdownBadgePast}>
                      <Text style={styles.countdownTextPast}>Finished</Text>
                    </View>
                  )}
                </View>

                {/* Exam Title */}
                <Text style={styles.examTitleText}>{item.title}</Text>

                {/* Date, Time & Location Meta */}
                <View style={styles.metaRow}>
                  <Text style={styles.metaText}>📅 {formatExamDate(item.exam_date)}</Text>
                  {item.location ? <Text style={styles.metaText}>📍 {item.location}</Text> : null}
                  {item.target_score ? (
                    <Text style={styles.targetScoreText}>🎯 Target: {item.target_score}%</Text>
                  ) : null}
                </View>

                {/* Readiness & Progress Bar */}
                <View style={styles.readinessContainer}>
                  <View style={styles.readinessHeader}>
                    <Text style={styles.readinessLabel}>
                      Syllabus Mastery ({item.completed_topics}/{item.total_topics} topics)
                    </Text>
                    <Text style={styles.readinessPctText}>{item.readiness_percentage}%</Text>
                  </View>
                  <View style={styles.progressBarTrack}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${item.readiness_percentage}%`,
                          backgroundColor:
                            item.readiness_percentage === 100
                              ? '#10B981'
                              : item.readiness_percentage >= 50
                              ? '#38BDF8'
                              : '#F59E0B',
                        },
                      ]}
                    />
                  </View>
                </View>

                {/* Syllabus Topics Checklist */}
                {item.syllabus_topics && item.syllabus_topics.length > 0 ? (
                  <View style={styles.topicsList}>
                    {item.syllabus_topics.map((topic) => (
                      <TouchableOpacity
                        key={topic.id}
                        onPress={() => handleToggleTopic(item, topic.id)}
                        style={styles.topicRow}>
                        <Text style={[styles.topicCheckMark, topic.is_completed && styles.topicCheckMarkDone]}>
                          {topic.is_completed ? '☑' : '☐'}
                        </Text>
                        <Text
                          style={[
                            styles.topicTitleText,
                            topic.is_completed && styles.topicTitleDone,
                          ]}>
                          {topic.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}

                {/* AI Revision Plan Section */}
                {hasPlan ? (
                  <View style={styles.revisionPlanBox}>
                    <View style={styles.planHeader}>
                      <Text style={styles.planTitle}>✨ 3-Phase AI Revision Schedule</Text>
                      <Text style={styles.planDaysTag}>{item.revision_plan?.total_days} Days Plan</Text>
                    </View>
                    {item.revision_plan?.phases.map((ph) => (
                      <View key={ph.phase_number} style={styles.phaseCard}>
                        <View style={styles.phaseHeaderRow}>
                          <Text style={styles.phaseNumberBadge}>P{ph.phase_number}</Text>
                          <Text style={styles.phaseTitleText}>{ph.title}</Text>
                          <Text style={styles.phaseMinsText}>⏱️ {ph.daily_focus_minutes}m/day</Text>
                        </View>
                        <Text style={styles.phaseDesc}>{ph.description}</Text>
                        {ph.suggested_activities?.slice(0, 2).map((act, i) => (
                          <Text key={i} style={styles.phaseActivityText}>• {act}</Text>
                        ))}
                      </View>
                    ))}
                  </View>
                ) : !item.is_past ? (
                  <TouchableOpacity
                    onPress={() => handleGenerateRevisionPlan(item)}
                    disabled={isGeneratingThis}
                    style={styles.aiPlanTriggerBtn}>
                    {isGeneratingThis ? (
                      <ActivityIndicator size="small" color="#818CF8" />
                    ) : (
                      <>
                        <Text style={styles.aiPlanIcon}>✨</Text>
                        <Text style={styles.aiPlanText}>Generate AI 3-Phase Revision Plan</Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : null}

                {/* Card Action Buttons */}
                <View style={styles.cardFooter}>
                  <TouchableOpacity
                    onPress={() => openEditModal(item)}
                    style={styles.cardActionBtn}>
                    <Text style={styles.cardActionEditText}>✏️ Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteExam(item)}
                    style={styles.cardActionBtn}>
                    <Text style={styles.cardActionDeleteText}>🗑️ Delete</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            );
          }}
        />
      </View>

      {/* CREATE / EDIT EXAM MODAL */}
      <Modal
        visible={isModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText type="headlineMedium" style={{ color: '#FFFFFF' }}>
                {editingExam ? 'Edit Exam' : 'Register New Exam'}
              </ThemedText>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Title */}
              <Text style={styles.inputLabel}>Exam Title *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Operating Systems Midterm"
                placeholderTextColor="#64748B"
                value={title}
                onChangeText={setTitle}
              />

              {/* Subject Selection */}
              <Text style={styles.inputLabel}>Subject *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {subjects.map((sub) => {
                  const isSel = subjectId === sub.id;
                  return (
                    <TouchableOpacity
                      key={sub.id}
                      onPress={() => setSubjectId(sub.id)}
                      style={[
                        styles.modalSubjectChip,
                        isSel && { borderColor: sub.color, backgroundColor: sub.color + '26' },
                      ]}>
                      <View style={[styles.subjectDot, { backgroundColor: sub.color }]} />
                      <Text style={[styles.modalSubjectChipText, isSel && { color: '#FFFFFF', fontWeight: '800' }]}>
                        {sub.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Exam Date Presets */}
              <Text style={styles.inputLabel}>Exam Date Schedule</Text>
              <View style={styles.chipRow}>
                {[
                  { label: '3 Days', days: 3 },
                  { label: '1 Week', days: 7 },
                  { label: '2 Weeks', days: 14 },
                  { label: '1 Month', days: 30 },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.label}
                    onPress={() => setDueDaysOffset(item.days)}
                    style={[styles.presetChip, dueDaysOffset === item.days && styles.presetChipActive]}>
                    <Text style={[styles.presetChipText, dueDaysOffset === item.days && styles.presetChipTextActive]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Exam Time */}
              <Text style={styles.inputLabel}>Exam Start Time</Text>
              <View style={styles.timeRow}>
                {[9, 10, 11, 2, 4].map((h) => (
                  <TouchableOpacity
                    key={h}
                    onPress={() => setDueHour(h)}
                    style={[styles.timeChip, dueHour === h && styles.timeChipActive]}>
                    <Text style={[styles.timeChipText, dueHour === h && styles.timeChipTextActive]}>{h}:00</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  onPress={() => setDuePeriod(duePeriod === 'AM' ? 'PM' : 'AM')}
                  style={styles.ampmChip}>
                  <Text style={styles.ampmText}>{duePeriod}</Text>
                </TouchableOpacity>
              </View>

              {/* Location & Target Score */}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Location / Room</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g. Hall A, Room 302"
                    placeholderTextColor="#64748B"
                    value={location}
                    onChangeText={setLocation}
                  />
                </View>
                <View style={{ width: 100 }}>
                  <Text style={styles.inputLabel}>Target %</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="90"
                    placeholderTextColor="#64748B"
                    keyboardType="numeric"
                    value={targetScore}
                    onChangeText={setTargetScore}
                  />
                </View>
              </View>

              {/* Syllabus Topics */}
              <Text style={[styles.inputLabel, { marginTop: 12 }]}>Syllabus Topics (Modules)</Text>
              {topicInputs.map((tp, idx) => (
                <View key={idx} style={styles.topicInputRow}>
                  <TextInput
                    style={[styles.modalInput, { flex: 1 }]}
                    placeholder={`Topic ${idx + 1} (e.g. Memory Management)`}
                    placeholderTextColor="#64748B"
                    value={tp}
                    onChangeText={(val) => {
                      const next = [...topicInputs];
                      next[idx] = val;
                      setTopicInputs(next);
                    }}
                  />
                  {topicInputs.length > 1 ? (
                    <TouchableOpacity
                      onPress={() => setTopicInputs(topicInputs.filter((_, i) => i !== idx))}
                      style={styles.removeTopicBtn}>
                      <Text style={styles.removeTopicText}>✕</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))}

              <TouchableOpacity
                onPress={() => setTopicInputs([...topicInputs, ''])}
                style={styles.addTopicBtn}>
                <Text style={styles.addTopicBtnText}>＋ Add Another Topic</Text>
              </TouchableOpacity>

              {/* Submit Buttons */}
              <View style={styles.modalActionsRow}>
                <Button
                  title="Cancel"
                  variant="secondary"
                  onPress={() => setIsModalOpen(false)}
                  style={{ flex: 1 }}
                />
                <Button
                  title={isSaving ? 'Saving...' : editingExam ? 'Update Exam' : 'Register Exam'}
                  variant="primary"
                  onPress={handleSaveExam}
                  loading={isSaving}
                  style={{ flex: 1 }}
                />
              </View>
            </ScrollView>
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
    justifyContent: 'space-between',
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
    color: '#10B981',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  countBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  countBadgeText: {
    color: '#34D399',
    fontSize: 9.5,
    fontWeight: '700',
  },
  headerTitleText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1.2,
    borderColor: 'rgba(52, 211, 153, 0.4)',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 3,
  },
  headerAddBtnIcon: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  headerAddBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  listRootContainer: {
    flex: 1,
    width: '100%',
  },
  metricsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(13, 20, 42, 0.85)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginHorizontal: Spacing.md,
    marginTop: 6,
    marginBottom: 6,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  metricDivider: {
    width: 1,
    height: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  metricValUpcoming: {
    fontSize: 16,
    fontWeight: '900',
    color: '#38BDF8',
  },
  metricValReadiness: {
    fontSize: 16,
    fontWeight: '900',
    color: '#34D399',
  },
  metricValCountdown: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FBBF24',
  },
  metricLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#94A3B8',
  },
  searchRow: {
    paddingHorizontal: Spacing.md,
    marginBottom: 6,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    backgroundColor: 'rgba(13, 20, 42, 0.9)',
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    gap: 6,
  },
  searchIcon: {
    fontSize: 14,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    color: '#FFFFFF',
    fontSize: 12.5,
  },
  clearSearchBtn: {
    padding: 3,
  },
  clearSearchIcon: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
  },
  filterRowContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: Spacing.md,
    marginBottom: 8,
  },
  filterPill: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
  },
  filterPillActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.22)',
    borderColor: '#10B981',
  },
  filterPillText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#94A3B8',
  },
  filterPillTextActive: {
    color: '#34D399',
    fontWeight: '800',
  },
  examList: {
    flex: 1,
    width: '100%',
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: 4,
    paddingBottom: 120,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xl * 1.5,
  },
  examCard: {
    marginBottom: 12,
    padding: 14,
    backgroundColor: 'rgba(13, 20, 42, 0.88)',
    borderRadius: 16,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  subjectBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  subjectDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  subjectNameText: {
    fontSize: 11,
    fontWeight: '700',
  },
  countdownBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  countdownBadgeUrgent: {
    backgroundColor: 'rgba(244, 63, 94, 0.2)',
    borderColor: '#F43F5E',
  },
  countdownBadgePast: {
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  countdownText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#38BDF8',
  },
  countdownTextUrgent: {
    color: '#FB7185',
  },
  countdownTextPast: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  examTitleText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  metaText: {
    fontSize: 11.5,
    color: '#94A3B8',
  },
  targetScoreText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FBBF24',
  },
  readinessContainer: {
    marginBottom: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    padding: 8,
    borderRadius: 10,
  },
  readinessHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  readinessLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  readinessPctText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#34D399',
  },
  progressBarTrack: {
    height: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  topicsList: {
    marginBottom: 8,
    gap: 4,
  },
  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  topicCheckMark: {
    fontSize: 14,
    color: '#64748B',
  },
  topicCheckMarkDone: {
    color: '#10B981',
  },
  topicTitleText: {
    fontSize: 12,
    color: '#E2E8F0',
  },
  topicTitleDone: {
    color: '#64748B',
    textDecorationLine: 'line-through',
  },
  revisionPlanBox: {
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.25)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  planTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#818CF8',
  },
  planDaysTag: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#34D399',
  },
  phaseCard: {
    backgroundColor: 'rgba(13, 20, 42, 0.9)',
    borderRadius: 8,
    padding: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  phaseHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  phaseNumberBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  phaseTitleText: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 6,
  },
  phaseMinsText: {
    fontSize: 10.5,
    color: '#38BDF8',
    fontWeight: '600',
  },
  phaseDesc: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 3,
  },
  phaseActivityText: {
    fontSize: 10.5,
    color: '#CBD5E1',
  },
  aiPlanTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.35)',
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 8,
  },
  aiPlanIcon: {
    fontSize: 13,
  },
  aiPlanText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#818CF8',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  cardActionBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  cardActionEditText: {
    fontSize: 11.5,
    color: '#38BDF8',
    fontWeight: '600',
  },
  cardActionDeleteText: {
    fontSize: 11.5,
    color: '#FB7185',
    fontWeight: '600',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0D1527',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(16, 185, 129, 0.3)',
    maxHeight: '90%',
    padding: Spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  modalCloseText: {
    color: '#94A3B8',
    fontSize: 18,
    fontWeight: '700',
  },
  inputLabel: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  modalInput: {
    height: 42,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    color: '#FFFFFF',
    fontSize: 13,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  modalSubjectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginRight: 8,
  },
  modalSubjectChipText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  chipRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  presetChip: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  presetChipActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.22)',
    borderColor: '#10B981',
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  presetChipTextActive: {
    color: '#34D399',
    fontWeight: '800',
  },
  timeRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  timeChip: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  timeChipActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.22)',
    borderColor: '#38BDF8',
  },
  timeChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  timeChipTextActive: {
    color: '#38BDF8',
    fontWeight: '800',
  },
  ampmChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ampmText: {
    color: '#34D399',
    fontWeight: '800',
    fontSize: 11,
  },
  topicInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  removeTopicBtn: {
    width: 38,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeTopicText: {
    color: '#FB7185',
    fontSize: 16,
    fontWeight: '700',
  },
  addTopicBtn: {
    paddingVertical: 6,
    marginBottom: 16,
  },
  addTopicBtnText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
    marginBottom: 20,
  },
});
