import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from './themed-text';

export type MainTab = 'index' | 'explore' | 'tasks' | 'profile';

interface BottomNavProps {
  activeTab?: string;
}

export default function BottomNav({ activeTab = 'index' }: BottomNavProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [quickActionVisible, setQuickActionVisible] = useState(false);

  // Normalize active tab
  const isHome = !activeTab || activeTab === 'index' || activeTab === '';
  const isStudyHub = activeTab === 'explore';
  const isTasks = activeTab === 'tasks';
  const isProfile = activeTab === 'profile';

  const navigateTo = (route: string) => {
    router.replace(route as never);
  };

  const handleQuickAction = (route: string) => {
    setQuickActionVisible(false);
    setTimeout(() => {
      router.push(route as never);
    }, 150);
  };

  return (
    <>
      <View
        style={[
          styles.navBar,
          {
            paddingBottom: Math.max(insets.bottom, 10),
            height: 64 + Math.max(insets.bottom, 10),
          },
        ]}>
        {/* Tab 1: Home */}
        <Pressable
          style={styles.tabItem}
          onPress={() => navigateTo('/')}
          accessibilityRole="tab"
          accessibilityState={{ selected: isHome }}
          accessibilityLabel="Home">
          <View style={styles.iconContainer}>
            <Text style={[styles.tabIcon, isHome && styles.activeTabIcon]}>
              🏠
            </Text>
            {isHome && <View style={styles.activeUnderline} />}
          </View>
          <ThemedText
            type="small"
            style={[styles.tabLabel, isHome && styles.activeTabLabel]}>
            Home
          </ThemedText>
        </Pressable>

        {/* Tab 2: StudyHub */}
        <Pressable
          style={styles.tabItem}
          onPress={() => navigateTo('/explore')}
          accessibilityRole="tab"
          accessibilityState={{ selected: isStudyHub }}
          accessibilityLabel="StudyHub">
          <View style={styles.iconContainer}>
            <Text style={[styles.tabIcon, isStudyHub && styles.activeTabIcon]}>
              📖
            </Text>
            {isStudyHub && <View style={styles.activeUnderline} />}
          </View>
          <ThemedText
            type="small"
            style={[styles.tabLabel, isStudyHub && styles.activeTabLabel]}>
            StudyHub
          </ThemedText>
        </Pressable>

        {/* Center Floating Action Button (+) */}
        <View style={styles.fabWrapper}>
          <Pressable
            style={({ pressed }) => [
              styles.fabButton,
              {
                opacity: pressed ? 0.85 : 1,
                transform: [{ scale: pressed ? 0.95 : 1 }],
              },
            ]}
            onPress={() => setQuickActionVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Create or Quick Action">
            <View style={styles.fabInner}>
              <Text style={styles.fabIcon}>+</Text>
            </View>
          </Pressable>
        </View>

        {/* Tab 3: Tasks */}
        <Pressable
          style={styles.tabItem}
          onPress={() => navigateTo('/tasks')}
          accessibilityRole="tab"
          accessibilityState={{ selected: isTasks }}
          accessibilityLabel="Tasks">
          <View style={styles.iconContainer}>
            <Text style={[styles.tabIcon, isTasks && styles.activeTabIcon]}>
              📋
            </Text>
            {isTasks && <View style={styles.activeUnderline} />}
          </View>
          <ThemedText
            type="small"
            style={[styles.tabLabel, isTasks && styles.activeTabLabel]}>
            Tasks
          </ThemedText>
        </Pressable>

        {/* Tab 4: Profile */}
        <Pressable
          style={styles.tabItem}
          onPress={() => navigateTo('/profile')}
          accessibilityRole="tab"
          accessibilityState={{ selected: isProfile }}
          accessibilityLabel="Profile">
          <View style={styles.iconContainer}>
            <Text style={[styles.tabIcon, isProfile && styles.activeTabIcon]}>
              👤
            </Text>
            {isProfile && <View style={styles.activeUnderline} />}
          </View>
          <ThemedText
            type="small"
            style={[styles.tabLabel, isProfile && styles.activeTabLabel]}>
            Profile
          </ThemedText>
        </Pressable>
      </View>

      {/* Quick Action Modal Sheet */}
      <Modal
        visible={quickActionVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setQuickActionVisible(false)}>
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setQuickActionVisible(false)}>
          <View
            style={[
              styles.quickActionCard,
              { paddingBottom: Math.max(insets.bottom, 24) },
            ]}
            onStartShouldSetResponder={() => true}>
            {/* Modal Drag Handle */}
            <View style={styles.dragPill} />

            <ThemedText type="headlineMedium" style={styles.modalTitle}>
              Quick Actions
            </ThemedText>
            <ThemedText type="bodySmall" style={styles.modalSubtitle}>
              Create or manage academic items instantly
            </ThemedText>

            <View style={styles.actionsGrid}>
              <Pressable
                style={styles.actionItem}
                onPress={() => handleQuickAction('/notes')}>
                <View style={[styles.actionIconBox, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}>
                  <Text style={{ fontSize: 24 }}>📝</Text>
                </View>
                <ThemedText type="titleMedium" style={styles.actionItemTitle}>
                  Create Note
                </ThemedText>
                <ThemedText type="bodySmall" style={styles.actionItemDesc}>
                  Capture lecture insights
                </ThemedText>
              </Pressable>

              <Pressable
                style={styles.actionItem}
                onPress={() => handleQuickAction('/tasks')}>
                <View style={[styles.actionIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                  <Text style={{ fontSize: 24 }}>📋</Text>
                </View>
                <ThemedText type="titleMedium" style={styles.actionItemTitle}>
                  Add Task
                </ThemedText>
                <ThemedText type="bodySmall" style={styles.actionItemDesc}>
                  Assignment or checklist
                </ThemedText>
              </Pressable>

              <Pressable
                style={styles.actionItem}
                onPress={() => handleQuickAction('/timetable')}>
                <View style={[styles.actionIconBox, { backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}>
                  <Text style={{ fontSize: 24 }}>📅</Text>
                </View>
                <ThemedText type="titleMedium" style={styles.actionItemTitle}>
                  Add Class
                </ThemedText>
                <ThemedText type="bodySmall" style={styles.actionItemDesc}>
                  Schedule lecture routine
                </ThemedText>
              </Pressable>

              <Pressable
                style={styles.actionItem}
                onPress={() => handleQuickAction('/pomodoro')}>
                <View style={[styles.actionIconBox, { backgroundColor: 'rgba(249, 115, 22, 0.15)' }]}>
                  <Text style={{ fontSize: 24 }}>⏱️</Text>
                </View>
                <ThemedText type="titleMedium" style={styles.actionItemTitle}>
                  Pomodoro Timer
                </ThemedText>
                <ThemedText type="bodySmall" style={styles.actionItemDesc}>
                  25m focus study session
                </ThemedText>
              </Pressable>

              <Pressable
                style={styles.actionItem}
                onPress={() => handleQuickAction('/subjects')}>
                <View style={[styles.actionIconBox, { backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}>
                  <Text style={{ fontSize: 24 }}>📚</Text>
                </View>
                <ThemedText type="titleMedium" style={styles.actionItemTitle}>
                  Add Subject
                </ThemedText>
                <ThemedText type="bodySmall" style={styles.actionItemDesc}>
                  Create course & syllabus
                </ThemedText>
              </Pressable>

              <Pressable
                style={styles.actionItem}
                onPress={() => handleQuickAction('/ai-chat')}>
                <View style={[styles.actionIconBox, { backgroundColor: 'rgba(192, 132, 252, 0.15)' }]}>
                  <Text style={{ fontSize: 24 }}>✨</Text>
                </View>
                <ThemedText type="titleMedium" style={styles.actionItemTitle}>
                  AI Study Tutor
                </ThemedText>
                <ThemedText type="bodySmall" style={styles.actionItemDesc}>
                  Instant Q&A and exam prep
                </ThemedText>
              </Pressable>

              <Pressable
                style={styles.actionItem}
                onPress={() => handleQuickAction('/study-planner')}>
                <View style={[styles.actionIconBox, { backgroundColor: 'rgba(6, 182, 212, 0.15)' }]}>
                  <Text style={{ fontSize: 24 }}>📅</Text>
                </View>
                <ThemedText type="titleMedium" style={styles.actionItemTitle}>
                  Study Planner
                </ThemedText>
                <ThemedText type="bodySmall" style={styles.actionItemDesc}>
                  AI daily schedule & timeboxing
                </ThemedText>
              </Pressable>

              <Pressable
                style={styles.actionItem}
                onPress={() => handleQuickAction('/exams')}>
                <View style={[styles.actionIconBox, { backgroundColor: 'rgba(244, 63, 94, 0.15)' }]}>
                  <Text style={{ fontSize: 24 }}>⏰</Text>
                </View>
                <ThemedText type="titleMedium" style={styles.actionItemTitle}>
                  Exam Prep
                </ThemedText>
                <ThemedText type="bodySmall" style={styles.actionItemDesc}>
                  Revision countdown & plans
                </ThemedText>
              </Pressable>
            </View>

            <Pressable
              style={styles.cancelBtn}
              onPress={() => setQuickActionVisible(false)}>
              <Text style={styles.cancelBtnText}>Dismiss</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(8, 11, 22, 0.98)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(139, 92, 246, 0.25)',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    elevation: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    height: 56,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 28,
  },
  tabIcon: {
    fontSize: 20,
    color: '#64748B',
  },
  activeTabIcon: {
    transform: [{ scale: 1.1 }],
  },
  activeUnderline: {
    width: 20,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#C084FC',
    marginTop: 2,
  },
  tabLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 2,
  },
  activeTabLabel: {
    color: '#C084FC',
    fontWeight: '700',
  },
  fabWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
    height: 60,
    marginTop: -22,
  },
  fabButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#8B5CF6',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 8,
  },
  fabInner: {
    width: '100%',
    height: '100%',
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7C3AED',
  },
  fabIcon: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 30,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  quickActionCard: {
    backgroundColor: '#0F1528',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  dragPill: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 20,
    textAlign: 'center',
  },
  modalSubtitle: {
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionItem: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 16,
    gap: 4,
  },
  actionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionItemTitle: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  actionItemDesc: {
    color: '#94A3B8',
    fontSize: 12,
  },
  cancelBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  cancelBtnText: {
    color: '#94A3B8',
    fontWeight: '600',
    fontSize: 15,
  },
});

