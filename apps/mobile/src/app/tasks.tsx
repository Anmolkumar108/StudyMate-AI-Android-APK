import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
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
import { Badge, Button, Card, ScreenWrapper } from '@/components/ui';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { subjectApi, taskApi } from '@/services/api/client';
import {
  cancelTaskReminder,
  registerForPushNotificationsAsync,
  scheduleTaskReminder,
  sendImmediateNotification,
  snoozeTaskReminder,
} from '@/services/notifications';
import {
  applyPendingActionsToTasks,
  clearPendingActions,
  loadCachedTasks,
  loadPendingActions,
  queuePendingAction,
  saveCachedTasks,
} from '@/services/storage/task-cache';
import { Subject } from '@/types/subject';
import {
  Subtask,
  Task,
  TaskAnalyticsResponse,
  TaskDailyBriefingResponse,
  TaskPriority,
  TaskStatus,
  TaskTemplate,
} from '@/types/task';

type ViewMode = 'list' | 'calendar' | 'analytics';
type FilterTab = 'all' | 'todo' | 'in_progress' | 'completed' | 'overdue';

async function readFileAsBase64(uri: string): Promise<string> {
  // Strategy 1: expo-file-system File instance (native C++/Android direct read)
  try {
    const file = new File(uri);
    const b64 = await file.base64();
    if (b64 && b64.length > 0) return b64;
  } catch {
    // Fall back to strategy 2
  }

  // Strategy 2 fallback: fetch local blob + FileReader
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const res = (reader.result as string) || '';
        const commaIdx = res.indexOf(',');
        resolve(commaIdx > -1 ? res.slice(commaIdx + 1) : res);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (err: any) {
    throw new Error(`Could not read file from device storage: ${err?.message || 'Permission denied'}`);
  }
}

export default function TasksScreen() {
  const router = useRouter();
  const theme = useTheme();

  // Navigation & View State
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);

  // Summary Stats
  const [stats, setStats] = useState({ total: 0, completed: 0, pending: 0, overdue: 0, focusMins: 0 });

  // Analytics State
  const [analyticsData, setAnalyticsData] = useState<TaskAnalyticsResponse | null>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);

  // Calendar State
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date>(new Date());

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isTemplatesModalOpen, setIsTemplatesModalOpen] = useState(false);
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [isBriefingModalOpen, setIsBriefingModalOpen] = useState(false);
  const [dailyBriefing, setDailyBriefing] = useState<TaskDailyBriefingResponse | null>(null);
  const [isLoadingBriefing, setIsLoadingBriefing] = useState(false);

  // Form Fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [estimatedMinutes, setEstimatedMinutes] = useState<string>('30');
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [dependsOnTaskId, setDependsOnTaskId] = useState<string | null>(null);
  const [recurrencePattern, setRecurrencePattern] = useState<string | null>(null); // 'daily', 'weekly', 'monthly'
  const [recurrenceInterval, setRecurrenceInterval] = useState<number>(1);

  // Deadline & Notification Form State
  const [dueDaysOffset, setDueDaysOffset] = useState<number | null>(1); // 1 = Tomorrow
  const [dueHour, setDueHour] = useState<number>(12);
  const [dueMinute, setDueMinute] = useState<number>(0);
  const [duePeriod, setDuePeriod] = useState<'AM' | 'PM'>('PM');
  const [reminderOffset, setReminderOffset] = useState<number>(0); // 0 = exact time, 15 = 15m before, etc.
  const [isSaving, setIsSaving] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [naturalPrompt, setNaturalPrompt] = useState('');

  // Initial Fetch & Offline Cache Sync
  const fetchTasks = async () => {
    setIsLoading(true);
    try {
      // Sync any offline queued actions first
      const pending = await loadPendingActions();
      if (pending.length > 0) {
        for (const action of pending) {
          try {
            if (action.type === 'toggle_status' && action.taskId) {
              await taskApi.toggleComplete(action.taskId, 'todo');
            } else if (action.type === 'delete_task' && action.taskId) {
              await taskApi.delete(action.taskId);
            }
          } catch {
            // Keep going
          }
        }
        await clearPendingActions();
      }

      const [taskRes, subList] = await Promise.all([
        taskApi.list({ limit: 100 }),
        subjectApi.list().catch(() => []),
      ]);

      setTasks(taskRes.items);
      setSubjects(subList);
      setIsOffline(false);
      await saveCachedTasks(taskRes.items);

      const totalFocus = taskRes.items.reduce((sum, t) => sum + (t.focus_minutes || 0), 0);
      setStats({
        total: taskRes.total,
        completed: taskRes.completed_count,
        pending: taskRes.pending_count,
        overdue: taskRes.overdue_count,
        focusMins: totalFocus,
      });
    } catch {
      // Fallback to offline cached data
      setIsOffline(true);
      const cached = await loadCachedTasks();
      const pending = await loadPendingActions();
      const updated = applyPendingActionsToTasks(cached, pending);
      setTasks(updated);
      setStats({
        total: updated.length,
        completed: updated.filter((t) => t.status === 'completed').length,
        pending: updated.filter((t) => t.status !== 'completed').length,
        overdue: 0,
        focusMins: updated.reduce((sum, t) => sum + (t.focus_minutes || 0), 0),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadAnalytics = async () => {
    setIsLoadingAnalytics(true);
    try {
      const data = await taskApi.getAnalytics();
      setAnalyticsData(data);
    } catch {
      // Fallback
    } finally {
      setIsLoadingAnalytics(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const list = await taskApi.listTemplates();
      setTemplates(list);
    } catch {
      setTemplates([]);
    }
  };

  const loadDailyBriefing = async () => {
    setIsLoadingBriefing(true);
    setIsBriefingModalOpen(true);
    try {
      const briefing = await taskApi.aiDailyBriefing();
      setDailyBriefing(briefing);
    } catch (err: any) {
      Alert.alert('AI Briefing', err?.message || 'Could not load briefing.');
      setIsBriefingModalOpen(false);
    } finally {
      setIsLoadingBriefing(false);
    }
  };

  useEffect(() => {
    registerForPushNotificationsAsync();
    const timer = setTimeout(() => {
      fetchTasks();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (viewMode === 'analytics') {
      const timer = setTimeout(() => {
        loadAnalytics();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [viewMode]);

  // Form Reset / Open Handlers
  const openCreateModal = () => {
    setEditingTask(null);
    setTitle('');
    setDescription('');
    setSubjectId(subjects.length > 0 ? subjects[0].id : null);
    setPriority('medium');
    setStatus('todo');
    setEstimatedMinutes('30');
    setSubtasks([]);
    setNewSubtaskTitle('');
    setDependsOnTaskId(null);
    setRecurrencePattern(null);
    setRecurrenceInterval(1);
    setDueDaysOffset(1);
    setDueHour(12);
    setDueMinute(0);
    setDuePeriod('PM');
    setReminderOffset(0);
    setNaturalPrompt('');
    setIsModalOpen(true);
  };

  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description || '');
    setSubjectId(task.subject_id || null);
    setPriority(task.priority);
    setStatus(task.status);
    setEstimatedMinutes(task.estimated_minutes ? String(task.estimated_minutes) : '30');
    setSubtasks([...(task.subtasks || [])]);
    setNewSubtaskTitle('');
    setDependsOnTaskId(task.depends_on_task_id || null);
    setRecurrencePattern(task.recurrence_pattern || null);
    setRecurrenceInterval(task.recurrence_interval || 1);
    setNaturalPrompt('');

    if (task.due_datetime) {
      const d = new Date(task.due_datetime);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const targetDay = new Date(d);
      targetDay.setHours(0, 0, 0, 0);
      const diffDays = Math.round((targetDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      setDueDaysOffset(diffDays >= 0 ? diffDays : 0);

      const h = d.getHours();
      setDuePeriod(h >= 12 ? 'PM' : 'AM');
      setDueHour(h % 12 === 0 ? 12 : h % 12);
      setDueMinute(d.getMinutes());
    } else {
      setDueDaysOffset(null);
      setDueHour(12);
      setDueMinute(0);
      setDuePeriod('PM');
    }
    setReminderOffset(0);
    setIsModalOpen(true);
  };

  // Subtask Checklist Management
  const handleAddSubtask = () => {
    if (!newSubtaskTitle.trim()) return;
    const newItem: Subtask = {
      id: String(Date.now()),
      title: newSubtaskTitle.trim(),
      is_completed: false,
      order: subtasks.length,
    };
    setSubtasks((prev) => [...prev, newItem]);
    setNewSubtaskTitle('');
  };

  const handleRemoveSubtask = (id: string) => {
    setSubtasks((prev) => prev.filter((s) => s.id !== id));
  };

  const handleToggleSubtaskInModal = (id: string) => {
    setSubtasks((prev) =>
      prev.map((s) => (s.id === id ? { ...s, is_completed: !s.is_completed } : s))
    );
  };

  const handleMoveSubtask = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === subtasks.length - 1) return;
    const newItems = [...subtasks];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const temp = newItems[index];
    newItems[index] = newItems[targetIdx];
    newItems[targetIdx] = temp;
    setSubtasks(newItems);
  };

  // AI Assistance: Subtask Breakdown
  const handleAiBreakdown = async () => {
    if (!title.trim()) {
      Alert.alert('Title Required', 'Please enter a task title first so AI can break it down.');
      return;
    }
    setIsAiLoading(true);
    try {
      const estMins = parseInt(estimatedMinutes, 10);
      const res = await taskApi.aiBreakdown(title, description, isNaN(estMins) ? undefined : estMins);
      const generated: Subtask[] = res.subtasks.map((st, i) => ({
        id: `ai_${Date.now()}_${i}`,
        title: st.title,
        is_completed: false,
        order: subtasks.length + i,
      }));
      setSubtasks((prev) => [...prev, ...generated]);
      Alert.alert('AI Breakdown', `Added ${generated.length} actionable checklist steps!`);
    } catch (err: any) {
      Alert.alert('AI Breakdown Failed', err?.message || 'Could not generate subtasks.');
    } finally {
      setIsAiLoading(false);
    }
  };

  // AI Assistance: Natural Language Prompt Parser
  const handleAiParsePrompt = async () => {
    if (!naturalPrompt.trim()) return;
    setIsAiLoading(true);
    try {
      const parsed = await taskApi.aiParseNatural(naturalPrompt.trim());
      setTitle(parsed.title);
      if (parsed.description) setDescription(parsed.description);
      setPriority(parsed.priority);
      if (parsed.estimated_minutes) setEstimatedMinutes(String(parsed.estimated_minutes));
      if (parsed.suggested_subtasks?.length > 0) {
        setSubtasks(
          parsed.suggested_subtasks.map((t, idx) => ({
            id: `ai_p_${Date.now()}_${idx}`,
            title: t,
            is_completed: false,
            order: idx,
          }))
        );
      }
      setNaturalPrompt('');
      Alert.alert('Parsed!', 'Draft created from your instruction. Review and save below.');
    } catch (err: any) {
      Alert.alert('Parse Failed', err?.message || 'Could not parse prompt.');
    } finally {
      setIsAiLoading(false);
    }
  };

  // Templates
  const handleApplyTemplate = (tmpl: TaskTemplate) => {
    setTitle(tmpl.title);
    setDescription(tmpl.description || '');
    setPriority(tmpl.default_priority);
    setEstimatedMinutes(tmpl.estimated_minutes ? String(tmpl.estimated_minutes) : '45');
    setSubtasks([...tmpl.subtasks]);
    setDueDaysOffset(2);
    setIsTemplatesModalOpen(false);
    setIsModalOpen(true);
  };

  // Attachments
  const handlePickAttachment = async (targetTask: Task) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const file = result.assets[0];
      let updated: Task;
      try {
        const base64Data = await readFileAsBase64(file.uri);
        updated = await taskApi.uploadAttachmentBase64(targetTask.id, {
          filename: file.name,
          file_type: file.mimeType || 'application/pdf',
          file_base64: base64Data,
        });
      } catch {
        // Fallback to standard multipart upload
        updated = await taskApi.uploadAttachment(targetTask.id, {
          uri: file.uri,
          name: file.name,
          type: file.mimeType || 'application/octet-stream',
        });
      }

      setTasks((prev) => prev.map((t) => (t.id === targetTask.id ? updated : t)));
      Alert.alert('Uploaded', `Attached ${file.name} successfully!`);
    } catch (err: any) {
      Alert.alert('Upload Error', err?.message || 'Could not upload attachment.');
    }
  };

  const handleDeleteAttachment = async (targetTask: Task, attachmentId: string) => {
    try {
      const updated = await taskApi.deleteAttachment(targetTask.id, attachmentId);
      setTasks((prev) => prev.map((t) => (t.id === targetTask.id ? updated : t)));
    } catch (err: any) {
      Alert.alert('Delete Error', err?.message || 'Could not remove attachment.');
    }
  };

  // Snooze Reminder
  const handleSnooze = async (task: Task) => {
    const ok = await snoozeTaskReminder(task.id, task.title, 10);
    if (ok) {
      Alert.alert('Snoozed ⏰', `Alarm for "${task.title}" postponed by 10 minutes.`);
    } else {
      Alert.alert('Snooze', 'Could not snooze alarm.');
    }
  };

  // Notification Test
  const handleTestNotification = async () => {
    const granted = await registerForPushNotificationsAsync();
    if (!granted) {
      Alert.alert(
        'Permission Needed',
        'Please allow notification permissions in your Android settings to receive deadline alerts.'
      );
      return;
    }
    await sendImmediateNotification(
      '⏰ StudyMate Alert Test',
      'Aapka notification system active hai! Set kiye huye task deadline time par alarm notification aayega.'
    );
    Alert.alert('Test Alarm Sent', 'Check your Android notification bar for the test reminder!');
  };

  // Save Task
  const handleSaveTask = async () => {
    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please enter a title for this assignment or task.');
      return;
    }

    let calculatedDueDate: string | null = null;
    if (dueDaysOffset !== null) {
      const d = new Date();
      d.setDate(d.getDate() + dueDaysOffset);
      let hours24 = dueHour % 12;
      if (duePeriod === 'PM') hours24 += 12;
      d.setHours(hours24, dueMinute, 0, 0);
      calculatedDueDate = d.toISOString();
    } else if (editingTask?.due_datetime) {
      calculatedDueDate = editingTask.due_datetime;
    }

    const estMins = parseInt(estimatedMinutes, 10);

    setIsSaving(true);
    try {
      let savedTask: Task;
      if (editingTask) {
        savedTask = await taskApi.update(editingTask.id, {
          title: title.trim(),
          description: description.trim() || null,
          subject_id: subjectId,
          depends_on_task_id: dependsOnTaskId,
          recurrence_pattern: recurrencePattern,
          recurrence_interval: recurrenceInterval,
          priority,
          status,
          estimated_minutes: isNaN(estMins) ? null : estMins,
          subtasks,
          due_datetime: calculatedDueDate,
        });
      } else {
        savedTask = await taskApi.create({
          title: title.trim(),
          description: description.trim() || null,
          subject_id: subjectId,
          depends_on_task_id: dependsOnTaskId,
          recurrence_pattern: recurrencePattern,
          recurrence_interval: recurrenceInterval,
          priority,
          status,
          estimated_minutes: isNaN(estMins) ? null : estMins,
          subtasks,
          due_datetime: calculatedDueDate,
        });
      }

      // Schedule local notification alarm
      if (calculatedDueDate && reminderOffset >= 0 && status !== 'completed') {
        await scheduleTaskReminder({
          taskId: savedTask.id,
          taskTitle: savedTask.title,
          dueDateTime: calculatedDueDate,
          reminderOffsetMinutes: reminderOffset,
        });
      } else {
        await cancelTaskReminder(savedTask.id);
      }

      setIsModalOpen(false);
      await fetchTasks();
    } catch (err: any) {
      Alert.alert('Save Failed', err?.message || 'Could not save task.');
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle Status
  const handleToggleTaskStatus = async (task: Task) => {
    try {
      if (isOffline) {
        // Queue offline
        await queuePendingAction({ type: 'toggle_status', taskId: task.id });
        const newStatus: TaskStatus = task.status === 'completed' ? 'todo' : 'completed';
        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t))
        );
        return;
      }

      const updated = await taskApi.toggleComplete(task.id, task.status);
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));

      if (updated.status === 'completed') {
        await cancelTaskReminder(task.id);
      } else if (updated.due_datetime) {
        await scheduleTaskReminder({
          taskId: task.id,
          taskTitle: task.title,
          dueDateTime: updated.due_datetime,
          reminderOffsetMinutes: 0,
        });
      }

      const taskRes = await taskApi.list();
      setStats({
        total: taskRes.total,
        completed: taskRes.completed_count,
        pending: taskRes.pending_count,
        overdue: taskRes.overdue_count,
        focusMins: taskRes.items.reduce((s, it) => s + (it.focus_minutes || 0), 0),
      });
    } catch (err: any) {
      Alert.alert('Status Error', err?.message || 'Could not toggle task status.');
    }
  };

  const handleToggleSubtaskInline = async (task: Task, subtaskId: string) => {
    const updatedSubtasks = (task.subtasks || []).map((s) =>
      s.id === subtaskId ? { ...s, is_completed: !s.is_completed } : s
    );
    try {
      const updated = await taskApi.update(task.id, { subtasks: updatedSubtasks });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
    } catch {
      // Revert silently on network glitch
    }
  };

  const handleDeleteTask = (task: Task) => {
    Alert.alert('Delete Task', `Are you sure you want to delete "${task.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            if (isOffline) {
              await queuePendingAction({ type: 'delete_task', taskId: task.id });
              setTasks((prev) => prev.filter((t) => t.id !== task.id));
              return;
            }
            await cancelTaskReminder(task.id);
            await taskApi.delete(task.id);
            setTasks((prev) => prev.filter((t) => t.id !== task.id));
            const taskRes = await taskApi.list();
            setStats({
              total: taskRes.total,
              completed: taskRes.completed_count,
              pending: taskRes.pending_count,
              overdue: taskRes.overdue_count,
              focusMins: taskRes.items.reduce((s, it) => s + (it.focus_minutes || 0), 0),
            });
          } catch (err: any) {
            Alert.alert('Delete Failed', err?.message || 'Could not delete task.');
          }
        },
      },
    ]);
  };

  const isOverdue = (task: Task): boolean => {
    if (!task.due_datetime || task.status === 'completed' || task.status === 'cancelled') {
      return false;
    }
    return new Date(task.due_datetime) < new Date();
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (filterTab === 'todo' && t.status !== 'todo') return false;
      if (filterTab === 'in_progress' && t.status !== 'in_progress') return false;
      if (filterTab === 'completed' && t.status !== 'completed') return false;
      if (filterTab === 'overdue' && !isOverdue(t)) return false;

      if (selectedSubjectId && t.subject_id !== selectedSubjectId) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchDesc = t.description?.toLowerCase().includes(q) ?? false;
        if (!matchTitle && !matchDesc) return false;
      }

      return true;
    });
  }, [tasks, filterTab, selectedSubjectId, searchQuery]);

  const getPriorityBadge = (p: TaskPriority) => {
    switch (p) {
      case 'urgent':
        return <Badge label="🚨 Urgent" variant="danger" size="sm" />;
      case 'high':
        return <Badge label="⚡ High" variant="warning" size="sm" />;
      case 'medium':
        return <Badge label="Medium" variant="brand" size="sm" />;
      case 'low':
        return <Badge label="Low" variant="neutral" size="sm" />;
    }
  };

  const formatDueDate = (isoString?: string | null) => {
    if (!isoString) return null;
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return null;

    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    const isToday =
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear();

    const isTomorrow =
      d.getDate() === tomorrow.getDate() &&
      d.getMonth() === tomorrow.getMonth() &&
      d.getFullYear() === tomorrow.getFullYear();

    const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });

    let datePrefix = '';
    if (isToday) datePrefix = 'Today';
    else if (isTomorrow) datePrefix = 'Tomorrow';
    else datePrefix = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

    return `${datePrefix}, ${timeStr}`;
  };

  // Calendar Helpers
  const calendarDays = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const days: { date: Date; isCurrentMonth: boolean; key: string }[] = [];

    // Preceding padding days
    const startDayOfWeek = (firstDay.getDay() + 6) % 7; // Monday = 0
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const prevDate = new Date(year, month, -i);
      days.push({ date: prevDate, isCurrentMonth: false, key: prevDate.toISOString() });
    }

    // Month days
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const curDate = new Date(year, month, d);
      days.push({ date: curDate, isCurrentMonth: true, key: curDate.toISOString() });
    }

    // Trailing padding days to fill 35 or 42 grid cells
    const remaining = 7 - (days.length % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        const nextDate = new Date(year, month + 1, i);
        days.push({ date: nextDate, isCurrentMonth: false, key: nextDate.toISOString() });
      }
    }

    return days;
  }, [calendarDate]);

  const tasksForSelectedCalendarDate = useMemo(() => {
    const target = selectedCalendarDate.toDateString();
    return tasks.filter((t) => {
      if (!t.due_datetime) return false;
      return new Date(t.due_datetime).toDateString() === target;
    });
  }, [tasks, selectedCalendarDate]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/explore' as never);
    }
  };

  return (
    <ScreenWrapper
      includeTopInset
      includeBottomInset
      includeTabInset
      scrollable={false}
      contentContainerStyle={{ flex: 1, paddingHorizontal: 0 }}
      style={{ backgroundColor: '#060913' }}>
      {/* 1. Master Header: Ultra-clean, single-row height (48dp), zero wasted space */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          onPress={handleBack}
          accessibilityLabel="Go back"
          style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <View style={styles.headerBadgeRow}>
            <Text style={styles.headerSubBadge}>COMMAND CENTER</Text>
            {tasks.length > 0 ? (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{tasks.length} tasks</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.headerTitleText} numberOfLines={1}>
            Tasks & Deadlines
          </Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={loadDailyBriefing}
            accessibilityLabel="AI Daily Briefing"
            style={styles.headerAiBtn}>
            <Text style={styles.headerAiBtnIcon}>✨</Text>
            <Text style={styles.headerAiBtnText}>AI</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={openCreateModal}
            accessibilityLabel="Add Task"
            style={styles.headerAddBtn}>
            <Text style={styles.headerAddBtnIcon}>＋</Text>
            <Text style={styles.headerAddBtnText}>Task</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Offline Alert Banner */}
      {isOffline ? (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>
            📶 Offline Mode: Showing cached tasks. Tap 🔄 to reconnect & sync.
          </Text>
        </View>
      ) : null}

      {/* 2. View Mode Switcher: [ 📋 Tasks ] [ 📅 Calendar ] [ 📊 Analytics ] */}
      <View style={styles.viewSwitcherBar}>
        {(
          [
            { key: 'list', label: '📋 Tasks' },
            { key: 'calendar', label: '📅 Calendar' },
            { key: 'analytics', label: '📊 Analytics' },
          ] as const
        ).map((vm) => {
          const isAct = viewMode === vm.key;
          return (
            <TouchableOpacity
              key={vm.key}
              onPress={() => setViewMode(vm.key)}
              style={[
                styles.viewSwitcherBtn,
                isAct && styles.viewSwitcherBtnActive,
              ]}>
              <Text
                style={[
                  styles.viewSwitcherText,
                  isAct && styles.viewSwitcherTextActive,
                ]}>
                {vm.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* VIEW: TASKS LIST */}
      {viewMode === 'list' && (
        <View style={styles.listRootContainer}>
          {/* 3. Summary Metrics Bar: Clean single-row, NO line wrapping! */}
          <View style={styles.metricsBar}>
            <View style={styles.metricItem}>
              <Text style={styles.metricValPending} numberOfLines={1}>
                {stats.pending}
              </Text>
              <Text style={styles.metricLabel} numberOfLines={1}>
                Pending
              </Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricValDone} numberOfLines={1}>
                {stats.completed}
              </Text>
              <Text style={styles.metricLabel} numberOfLines={1}>
                Done
              </Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricValOverdue} numberOfLines={1}>
                {stats.overdue}
              </Text>
              <Text style={styles.metricLabel} numberOfLines={1}>
                Overdue
              </Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricValFocus} numberOfLines={1}>
                {stats.focusMins}m
              </Text>
              <Text style={styles.metricLabel} numberOfLines={1}>
                Focus
              </Text>
            </View>
          </View>

          {/* 4. Search Bar & Quick Action Tool Buttons */}
          <View style={styles.searchAndToolsRow}>
            <View style={styles.searchContainer}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Search tasks, notes, subtasks..."
                placeholderTextColor="#64748B"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery ? (
                <TouchableOpacity
                  onPress={() => setSearchQuery('')}
                  style={styles.clearSearchBtn}>
                  <Text style={styles.clearSearchIcon}>✕</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <TouchableOpacity
              onPress={() => {
                loadTemplates();
                setIsTemplatesModalOpen(true);
              }}
              accessibilityLabel="Task Templates"
              style={styles.quickActionIconBtn}>
              <Text style={styles.quickActionIcon}>📑</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={fetchTasks}
              accessibilityLabel="Refresh and sync"
              style={styles.quickActionIconBtn}>
              <Text style={styles.quickActionIcon}>🔄</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleTestNotification}
              accessibilityLabel="Test Alarm"
              style={styles.quickActionIconBtn}>
              <Text style={styles.quickActionIcon}>🔔</Text>
            </TouchableOpacity>
          </View>

          {/* 5. Status Filter Row (Enclosed in strict container: ZERO OVERLAP!) */}
          <View style={styles.statusRowContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.statusRowContent}>
              {(
                [
                  { key: 'all', label: 'All', count: stats.total },
                  { key: 'todo', label: 'To Do', count: stats.pending },
                  { key: 'in_progress', label: 'In Progress', count: null },
                  { key: 'completed', label: 'Done', count: stats.completed },
                  { key: 'overdue', label: 'Overdue', count: stats.overdue },
                ] as const
              ).map((tab) => {
                const isActive = filterTab === tab.key;
                const isOverdueTab = tab.key === 'overdue' && stats.overdue > 0;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    onPress={() => setFilterTab(tab.key)}
                    style={[
                      styles.statusPill,
                      isActive && styles.statusPillActive,
                      isOverdueTab && styles.statusPillOverdue,
                    ]}>
                    <Text
                      style={[
                        styles.statusPillText,
                        isActive && styles.statusPillTextActive,
                        isOverdueTab && { color: '#FB7185' },
                      ]}>
                      {tab.label}
                      {tab.count != null ? ` (${tab.count})` : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* 6. Subject Filter Row (Enclosed in strict container: ZERO OVERLAP!) */}
          {subjects.length > 0 ? (
            <View style={styles.subjectRowContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.subjectRowContent}>
                <TouchableOpacity
                  onPress={() => setSelectedSubjectId(null)}
                  style={[
                    styles.subjectFilterChip,
                    selectedSubjectId === null && styles.subjectFilterChipActive,
                  ]}>
                  <Text style={styles.subjectFilterDot}>📚</Text>
                  <Text
                    style={[
                      styles.subjectFilterText,
                      selectedSubjectId === null && styles.subjectFilterTextActive,
                    ]}>
                    All Subjects
                  </Text>
                </TouchableOpacity>

                {subjects.map((sub) => {
                  const isSubActive = selectedSubjectId === sub.id;
                  return (
                    <TouchableOpacity
                      key={sub.id}
                      onPress={() => setSelectedSubjectId(isSubActive ? null : sub.id)}
                      style={[
                        styles.subjectFilterChip,
                        isSubActive && {
                          backgroundColor: `${sub.color}26`,
                          borderColor: sub.color,
                        },
                      ]}>
                      <View
                        style={[
                          styles.subjectFilterColorCircle,
                          { backgroundColor: sub.color },
                        ]}
                      />
                      <Text
                        style={[
                          styles.subjectFilterText,
                          isSubActive && { color: '#FFFFFF', fontWeight: '800' },
                        ]}>
                        {sub.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}

          {/* 7. FlatList of Tasks */}
          <FlatList
            data={filteredTasks}
            keyExtractor={(item) => item.id}
            style={styles.taskList}
            contentContainerStyle={styles.listContent}
            refreshing={isLoading}
            onRefresh={fetchTasks}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              !isLoading ? (
                <View style={styles.emptyContainer}>
                  <Text style={{ fontSize: 44, marginBottom: Spacing.sm }}>📝</Text>
                  <ThemedText type="titleMedium" style={{ textAlign: 'center' }}>No Tasks Found</ThemedText>
                  <ThemedText type="bodyMedium" style={{ color: theme.textSecondary, textAlign: 'center', marginTop: Spacing.xs }}>
                    {filterTab === 'all'
                      ? 'Stay on top of your academic workload by creating your first task.'
                      : `No tasks found matching "${filterTab}".`}
                  </ThemedText>
                  <Button
                    title="+ Create New Task"
                    variant="primary"
                    size="md"
                    onPress={openCreateModal}
                    style={{ marginTop: Spacing.md }}
                  />
                </View>
              ) : undefined
            }
            renderItem={({ item }) => {
              const isDone = item.status === 'completed';
              const overdue = isOverdue(item);
              const totalSubtasks = item.subtasks?.length || 0;
              const completedSubtasks = item.subtasks?.filter((s) => s.is_completed).length || 0;
              const progressPct = totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) * 100 : 0;

              return (
                <Card
                  variant="default"
                  style={[
                    styles.taskCard,
                    isDone && styles.taskCardCompleted,
                    overdue && styles.taskCardOverdue,
                  ]}>
                  {/* Top Row: Checkbox + Title + Badges */}
                  <View style={styles.taskHeaderRow}>
                    <TouchableOpacity
                      onPress={() => handleToggleTaskStatus(item)}
                      accessibilityLabel="Toggle task completion"
                      style={[
                        styles.checkbox,
                        isDone && styles.checkboxDone,
                      ]}>
                      {isDone ? <Text style={styles.checkMark}>✓</Text> : null}
                    </TouchableOpacity>

                    <View style={{ flex: 1, marginHorizontal: Spacing.xs }}>
                      <Text
                        style={[
                          styles.taskTitle,
                          isDone && styles.taskTitleDone,
                        ]}>
                        {item.title}
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                      {item.recurrence_pattern ? (
                        <Badge label={`🔁 ${item.recurrence_pattern}`} variant="neutral" size="sm" />
                      ) : null}
                      {getPriorityBadge(item.priority)}
                    </View>
                  </View>

                  {/* Prerequisite Indicator */}
                  {item.depends_on ? (
                    <View style={[styles.prereqBanner, { backgroundColor: 'rgba(255, 255, 255, 0.04)' }]}>
                      <Text style={{ fontSize: 11, color: '#94A3B8' }}>
                        🔗 Prerequisite:{' '}
                        <Text style={{ fontWeight: '700', color: item.depends_on.status === 'completed' ? '#34D399' : '#FBBF24' }}>
                          {item.depends_on.title} {item.depends_on.status === 'completed' ? '(Done ✓)' : '(Pending 🔒)'}
                        </Text>
                      </Text>
                    </View>
                  ) : null}

                  {/* Description */}
                  {item.description ? (
                    <Text numberOfLines={2} style={{ color: '#94A3B8', fontSize: 12, marginTop: 4 }}>
                      {item.description}
                    </Text>
                  ) : null}

                  {/* Meta row: Subject, Due Date, Focus Time */}
                  <View style={styles.metaRow}>
                    {item.subject ? (
                      <View style={[styles.subjectTag, { backgroundColor: item.subject.color + '22' }]}>
                        <View style={[styles.subjectDot, { backgroundColor: item.subject.color }]} />
                        <Text style={{ fontSize: 11, fontWeight: '600', color: item.subject.color }}>
                          {item.subject.name}
                        </Text>
                      </View>
                    ) : null}

                    {item.due_datetime ? (
                      <View
                        style={[
                          styles.dueBadge,
                          {
                            backgroundColor: overdue ? 'rgba(244, 63, 94, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                            borderColor: overdue ? 'rgba(244, 63, 94, 0.4)' : 'rgba(255, 255, 255, 0.08)',
                          },
                        ]}>
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: overdue ? '700' : '600',
                            color: overdue ? '#FB7185' : '#94A3B8',
                          }}>
                          {overdue ? '🚨 Overdue: ' : '⏰ '}
                          {formatDueDate(item.due_datetime)}
                          {!isDone && !overdue ? ' 🔔' : ''}
                        </Text>
                      </View>
                    ) : null}

                    {(item.focus_minutes || 0) > 0 ? (
                      <Text style={{ fontSize: 11, color: '#38BDF8', fontWeight: '600' }}>
                        ⏱️ {item.focus_minutes}m focused ({item.focus_sessions_count}s)
                      </Text>
                    ) : null}
                  </View>

                  {/* Subtasks Progress Bar & Checklist */}
                  {totalSubtasks > 0 ? (
                    <View style={[styles.subtasksContainer, { borderTopColor: 'rgba(255, 255, 255, 0.06)' }]}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#94A3B8' }}>
                          Checklist ({completedSubtasks}/{totalSubtasks})
                        </Text>
                        <Text style={{ fontSize: 11, color: '#94A3B8' }}>{Math.round(progressPct)}%</Text>
                      </View>

                      {/* Progress Line */}
                      <View style={[styles.progressBarTrack, { backgroundColor: 'rgba(255, 255, 255, 0.08)' }]}>
                        <View
                          style={[
                            styles.progressBarFill,
                            {
                              width: `${progressPct}%`,
                              backgroundColor: progressPct === 100 ? '#10B981' : '#38BDF8',
                            },
                          ]}
                        />
                      </View>

                      {item.subtasks.map((st) => (
                        <TouchableOpacity
                          key={st.id}
                          onPress={() => handleToggleSubtaskInline(item, st.id)}
                          style={styles.subtaskRow}>
                          <Text style={{ fontSize: 14, color: st.is_completed ? '#10B981' : '#64748B' }}>
                            {st.is_completed ? '☑' : '☐'}
                          </Text>
                          <Text
                            style={[
                              styles.subtaskText,
                              { color: st.is_completed ? '#64748B' : '#E2E8F0' },
                              st.is_completed && { textDecorationLine: 'line-through' },
                            ]}>
                            {st.title}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : null}

                  {/* Attachments Section */}
                  {item.attachments && item.attachments.length > 0 ? (
                    <View style={[styles.attachmentsContainer, { borderTopColor: 'rgba(255, 255, 255, 0.06)' }]}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#94A3B8', marginBottom: 4 }}>
                        📎 Attachments ({item.attachments.length})
                      </Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {item.attachments.map((att) => (
                          <View key={att.id} style={[styles.attachmentChip, { backgroundColor: 'rgba(255, 255, 255, 0.05)' }]}>
                            <Text style={{ fontSize: 11, color: '#E2E8F0' }}>
                              📄 {att.file_name} ({Math.round(att.file_size / 1024)} KB)
                            </Text>
                            <TouchableOpacity onPress={() => handleDeleteAttachment(item, att.id)}>
                              <Text style={{ color: '#FB7185', marginLeft: 6, fontWeight: '700' }}>✕</Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                      </ScrollView>
                    </View>
                  ) : null}

                  {/* Card Actions Footer */}
                  <View style={styles.cardFooter}>
                    <TouchableOpacity
                      onPress={() => router.push(`/pomodoro?taskId=${item.id}&taskTitle=${encodeURIComponent(item.title)}` as never)}
                      style={styles.actionBtn}>
                      <Text style={{ fontSize: 12, color: '#34D399', fontWeight: '700' }}>
                        ⏱️ Focus
                      </Text>
                    </TouchableOpacity>

                    {item.due_datetime && !isDone ? (
                      <TouchableOpacity onPress={() => handleSnooze(item)} style={styles.actionBtn}>
                        <Text style={{ fontSize: 12, color: '#818CF8', fontWeight: '600' }}>
                          ⏰ Snooze 10m
                        </Text>
                      </TouchableOpacity>
                    ) : null}

                    <TouchableOpacity onPress={() => handlePickAttachment(item)} style={styles.actionBtn}>
                      <Text style={{ fontSize: 12, color: '#94A3B8', fontWeight: '600' }}>
                        📎 Attach
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => openEditModal(item)} style={styles.actionBtn}>
                      <Text style={{ fontSize: 12, color: '#38BDF8', fontWeight: '600' }}>
                        ✏️ Edit
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => handleDeleteTask(item)} style={styles.actionBtn}>
                      <Text style={{ fontSize: 12, color: '#FB7185', fontWeight: '600' }}>
                        🗑️ Delete
                      </Text>
                    </TouchableOpacity>
                  </View>
                </Card>
              );
            }}
          />
        </View>
      )}

      {/* VIEW: CALENDAR */}
      {viewMode === 'calendar' && (
        <ScrollView style={styles.calendarContainer}>
          {/* Calendar Header with Navigation */}
          <View style={styles.calendarNavRow}>
            <TouchableOpacity
              onPress={() => {
                const prev = new Date(calendarDate);
                prev.setMonth(prev.getMonth() - 1);
                setCalendarDate(prev);
              }}
              style={styles.calNavBtn}>
              <Text style={{ fontSize: 18, color: theme.text }}>◀</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setCalendarDate(new Date());
                setSelectedCalendarDate(new Date());
              }}>
              <ThemedText type="titleMedium">
                {calendarDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                const next = new Date(calendarDate);
                next.setMonth(next.getMonth() + 1);
                setCalendarDate(next);
              }}
              style={styles.calNavBtn}>
              <Text style={{ fontSize: 18, color: theme.text }}>▶</Text>
            </TouchableOpacity>
          </View>

          {/* Days of Week Header */}
          <View style={styles.weekHeaderRow}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <Text key={d} style={styles.weekHeaderCell}>
                {d}
              </Text>
            ))}
          </View>

          {/* Month Grid */}
          <View style={styles.gridContainer}>
            {calendarDays.map((cell) => {
              const isSelected = cell.date.toDateString() === selectedCalendarDate.toDateString();
              const isToday = cell.date.toDateString() === new Date().toDateString();

              // Check if any tasks due on this date
              const dateTasks = tasks.filter((t) => {
                if (!t.due_datetime) return false;
                return new Date(t.due_datetime).toDateString() === cell.date.toDateString();
              });

              const hasCompleted = dateTasks.some((t) => t.status === 'completed');
              const hasOverdue = dateTasks.some((t) => isOverdue(t));
              const hasPending = dateTasks.some((t) => t.status !== 'completed' && !isOverdue(t));

              return (
                <TouchableOpacity
                  key={cell.key}
                  onPress={() => setSelectedCalendarDate(cell.date)}
                  style={[
                    styles.gridCell,
                    isSelected && { backgroundColor: theme.brandPrimary + '25', borderColor: theme.brandPrimary, borderWidth: 1.5 },
                  ]}>
                  <Text
                    style={[
                      styles.gridDateText,
                      !cell.isCurrentMonth && { color: theme.textTertiary },
                      isToday && { color: theme.brandPrimary, fontWeight: '800' },
                      isSelected && { color: theme.brandPrimary, fontWeight: '800' },
                    ]}>
                    {cell.date.getDate()}
                  </Text>

                  {/* Task Indicator Dots */}
                  <View style={styles.dotsRow}>
                    {hasOverdue ? <View style={[styles.dot, { backgroundColor: theme.statusDanger }]} /> : null}
                    {hasPending ? <View style={[styles.dot, { backgroundColor: theme.brandPrimary }]} /> : null}
                    {hasCompleted ? <View style={[styles.dot, { backgroundColor: theme.statusSuccess }]} /> : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Tasks Due On Selected Day */}
          <View style={styles.selectedDaySection}>
            <View style={styles.selectedDayHeader}>
              <ThemedText type="titleMedium">
                Tasks for {selectedCalendarDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
              </ThemedText>
              <TouchableOpacity onPress={openCreateModal} style={[styles.addBtn, { backgroundColor: theme.brandPrimary }]}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>+ Add</Text>
              </TouchableOpacity>
            </View>

            {tasksForSelectedCalendarDate.length === 0 ? (
              <ThemedText type="bodyMedium" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
                No tasks scheduled for this day.
              </ThemedText>
            ) : (
              tasksForSelectedCalendarDate.map((task) => (
                <Card key={task.id} variant="default" style={styles.dayTaskCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <TouchableOpacity
                      onPress={() => handleToggleTaskStatus(task)}
                      style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <Text style={{ fontSize: 16, marginRight: 8 }}>
                        {task.status === 'completed' ? '☑' : '☐'}
                      </Text>
                      <ThemedText
                        type="titleMedium"
                        style={[task.status === 'completed' && { textDecorationLine: 'line-through', color: theme.textTertiary }]}>
                        {task.title}
                      </ThemedText>
                    </TouchableOpacity>
                    {getPriorityBadge(task.priority)}
                  </View>
                </Card>
              ))
            )}
          </View>
        </ScrollView>
      )}

      {/* VIEW: ANALYTICS */}
      {viewMode === 'analytics' && (
        <ScrollView style={styles.analyticsContainer}>
          {isLoadingAnalytics ? (
            <ActivityIndicator size="large" color={theme.brandPrimary} style={{ marginTop: 40 }} />
          ) : analyticsData ? (
            <>
              {/* High level metrics cards */}
              <View style={styles.metricGrid}>
                <Card variant="default" style={styles.metricCard}>
                  <Text style={{ fontSize: 24 }}>🎯</Text>
                  <ThemedText type="headlineMedium" style={{ color: theme.brandPrimary, marginVertical: 2 }}>
                    {analyticsData.completion_rate}%
                  </ThemedText>
                  <Text style={{ fontSize: 11, color: theme.textSecondary }}>Completion Rate</Text>
                </Card>

                <Card variant="default" style={styles.metricCard}>
                  <Text style={{ fontSize: 24 }}>⏱️</Text>
                  <ThemedText type="headlineMedium" style={{ color: theme.brandSecondary, marginVertical: 2 }}>
                    {Math.round(analyticsData.total_focus_minutes / 60)}h {analyticsData.total_focus_minutes % 60}m
                  </ThemedText>
                  <Text style={{ fontSize: 11, color: theme.textSecondary }}>Focus Time ({analyticsData.total_focus_sessions} sess)</Text>
                </Card>

                <Card variant="default" style={styles.metricCard}>
                  <Text style={{ fontSize: 24 }}>📋</Text>
                  <ThemedText type="headlineMedium" style={{ color: theme.statusSuccess, marginVertical: 2 }}>
                    {analyticsData.completed_tasks}/{analyticsData.total_tasks}
                  </ThemedText>
                  <Text style={{ fontSize: 11, color: theme.textSecondary }}>Completed Tasks</Text>
                </Card>

                <Card variant="default" style={styles.metricCard}>
                  <Text style={{ fontSize: 24 }}>🚨</Text>
                  <ThemedText type="headlineMedium" style={{ color: theme.statusDanger, marginVertical: 2 }}>
                    {analyticsData.overdue_tasks}
                  </ThemedText>
                  <Text style={{ fontSize: 11, color: theme.textSecondary }}>Overdue Items</Text>
                </Card>
              </View>

              {/* Weekly Trends */}
              <Card variant="default" style={styles.chartCard}>
                <ThemedText type="titleMedium" style={{ marginBottom: Spacing.sm }}>
                  📈 Past 7 Days Activity
                </ThemedText>
                <View style={styles.trendsBarRow}>
                  {analyticsData.weekly_trends.map((day, idx) => (
                    <View key={idx} style={styles.trendCol}>
                      <View style={styles.trendBars}>
                        <View
                          style={[
                            styles.trendBarFill,
                            {
                              height: Math.min(60, day.completed * 15 + 4),
                              backgroundColor: theme.statusSuccess,
                            },
                          ]}
                        />
                        <View
                          style={[
                            styles.trendBarFill,
                            {
                              height: Math.min(60, day.created * 15 + 4),
                              backgroundColor: theme.brandPrimary,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.trendDayLabel}>{day.day}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: theme.statusSuccess }]} />
                  <Text style={{ fontSize: 11, color: theme.textSecondary, marginRight: 12 }}>Completed</Text>
                  <View style={[styles.legendDot, { backgroundColor: theme.brandPrimary }]} />
                  <Text style={{ fontSize: 11, color: theme.textSecondary }}>Created</Text>
                </View>
              </Card>

              {/* Subject Workload */}
              <Card variant="default" style={styles.chartCard}>
                <ThemedText type="titleMedium" style={{ marginBottom: Spacing.sm }}>
                  📚 Subject Workload
                </ThemedText>
                {analyticsData.subject_workload.length === 0 ? (
                  <Text style={{ color: theme.textSecondary, fontSize: 12 }}>No subject tasks recorded yet.</Text>
                ) : (
                  analyticsData.subject_workload.map((sw, i) => {
                    const pct = sw.total_tasks > 0 ? (sw.completed_tasks / sw.total_tasks) * 100 : 0;
                    return (
                      <View key={i} style={{ marginBottom: 12 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                          <Text style={{ fontWeight: '700', fontSize: 13, color: sw.color }}>{sw.subject_name}</Text>
                          <Text style={{ fontSize: 11, color: theme.textSecondary }}>
                            {sw.completed_tasks}/{sw.total_tasks} ({Math.round(pct)}%)
                          </Text>
                        </View>
                        <View style={[styles.progressBarTrack, { backgroundColor: theme.borderSubtle }]}>
                          <View style={[styles.progressBarFill, { width: `${pct}%`, backgroundColor: sw.color }]} />
                        </View>
                      </View>
                    );
                  })
                )}
              </Card>
            </>
          ) : null}
        </ScrollView>
      )}

      {/* CREATE / EDIT TASK MODAL */}
      <Modal visible={isModalOpen} animationType="slide" transparent onRequestClose={() => setIsModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.background, borderColor: theme.borderSubtle }]}>
            <ThemedText type="headlineMedium" style={{ marginBottom: Spacing.xs }}>
              {editingTask ? '✏️ Edit Task' : '📋 New Assignment / Task'}
            </ThemedText>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 440 }}>
              {/* Natural Language Prompt Input */}
              {!editingTask ? (
                <View style={[styles.aiPromptBox, { backgroundColor: theme.surfaceSubtle }]}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: theme.brandPrimary, marginBottom: 2 }}>
                    ✨ AI Quick Draft (Natural Language)
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TextInput
                      style={[styles.aiInput, { backgroundColor: theme.cardBackground, color: theme.text }]}
                      placeholder="e.g. Finish Physics Lab 4 tomorrow at 4pm urgent"
                      placeholderTextColor={theme.textTertiary}
                      value={naturalPrompt}
                      onChangeText={setNaturalPrompt}
                    />
                    <Button
                      title="Draft"
                      variant="primary"
                      size="sm"
                      loading={isAiLoading}
                      onPress={handleAiParsePrompt}
                    />
                  </View>
                </View>
              ) : null}

              {/* Title & AI Breakdown */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <ThemedText type="smallBold" style={styles.fieldLabel}>
                  Task Title *
                </ThemedText>
                <TouchableOpacity onPress={handleAiBreakdown} disabled={isAiLoading}>
                  <Text style={{ color: theme.brandPrimary, fontSize: 11, fontWeight: '700' }}>
                    ✨ AI Break Down
                  </Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={[styles.input, { backgroundColor: theme.surfaceSubtle, color: theme.text, borderColor: theme.borderSubtle }]}
                placeholder="e.g. Complete Database Homework 3"
                placeholderTextColor={theme.textTertiary}
                value={title}
                onChangeText={setTitle}
              />

              {/* Description */}
              <ThemedText type="smallBold" style={styles.fieldLabel}>
                Description / Notes
              </ThemedText>
              <TextInput
                style={[styles.textArea, { backgroundColor: theme.surfaceSubtle, color: theme.text, borderColor: theme.borderSubtle }]}
                placeholder="Include assignment instructions, questions, or links..."
                placeholderTextColor={theme.textTertiary}
                multiline
                numberOfLines={3}
                value={description}
                onChangeText={setDescription}
              />

              {/* Subject Selector */}
              {subjects.length > 0 ? (
                <>
                  <ThemedText type="smallBold" style={styles.fieldLabel}>Linked Subject</ThemedText>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.xs }}>
                    <TouchableOpacity
                      onPress={() => setSubjectId(null)}
                      style={[
                        styles.subjectChip,
                        {
                          backgroundColor: subjectId === null ? theme.brandPrimary : theme.surfaceSubtle,
                          borderColor: subjectId === null ? theme.brandPrimary : theme.borderSubtle,
                        },
                      ]}>
                      <Text style={{ color: subjectId === null ? '#ffffff' : theme.text, fontSize: 12, fontWeight: '600' }}>
                        General
                      </Text>
                    </TouchableOpacity>
                    {subjects.map((sub) => {
                      const isSel = subjectId === sub.id;
                      return (
                        <TouchableOpacity
                          key={sub.id}
                          onPress={() => setSubjectId(isSel ? null : sub.id)}
                          style={[
                            styles.subjectChip,
                            { backgroundColor: isSel ? sub.color : theme.surfaceSubtle, borderColor: sub.color },
                          ]}>
                          <Text style={{ color: isSel ? '#ffffff' : theme.text, fontSize: 12, fontWeight: '600' }}>
                            {sub.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </>
              ) : null}

              {/* Priority Selector */}
              <ThemedText type="smallBold" style={styles.fieldLabel}>Priority Level</ThemedText>
              <View style={styles.priorityRow}>
                {(['low', 'medium', 'high', 'urgent'] as const).map((p) => {
                  const isSel = priority === p;
                  return (
                    <TouchableOpacity
                      key={p}
                      onPress={() => setPriority(p)}
                      style={[
                        styles.priorityChip,
                        {
                          backgroundColor: isSel ? theme.brandPrimary : theme.surfaceSubtle,
                          borderColor: theme.borderSubtle,
                        },
                      ]}>
                      <Text style={{ color: isSel ? '#ffffff' : theme.text, fontSize: 12, fontWeight: '700', textTransform: 'capitalize' }}>
                        {p}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Prerequisite Task Dependency */}
              <ThemedText type="smallBold" style={styles.fieldLabel}>
                Prerequisite Task (Must be done first) 🔗
              </ThemedText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.xs }}>
                <TouchableOpacity
                  onPress={() => setDependsOnTaskId(null)}
                  style={[
                    styles.subjectChip,
                    {
                      backgroundColor: dependsOnTaskId === null ? theme.brandPrimary : theme.surfaceSubtle,
                      borderColor: dependsOnTaskId === null ? theme.brandPrimary : theme.borderSubtle,
                    },
                  ]}>
                  <Text style={{ color: dependsOnTaskId === null ? '#fff' : theme.text, fontSize: 11, fontWeight: '600' }}>
                    None
                  </Text>
                </TouchableOpacity>
                {tasks
                  .filter((t) => t.id !== editingTask?.id)
                  .map((cand) => {
                    const isSel = dependsOnTaskId === cand.id;
                    return (
                      <TouchableOpacity
                        key={cand.id}
                        onPress={() => setDependsOnTaskId(isSel ? null : cand.id)}
                        style={[
                          styles.subjectChip,
                          {
                            backgroundColor: isSel ? theme.brandPrimary : theme.surfaceSubtle,
                            borderColor: theme.borderSubtle,
                          },
                        ]}>
                        <Text style={{ color: isSel ? '#fff' : theme.text, fontSize: 11, fontWeight: '600' }} numberOfLines={1}>
                          {cand.title}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
              </ScrollView>

              {/* Recurrence Selector */}
              <ThemedText type="smallBold" style={styles.fieldLabel}>Recurring Schedule 🔁</ThemedText>
              <View style={styles.priorityRow}>
                {[
                  { label: 'None', val: null },
                  { label: 'Daily', val: 'daily' },
                  { label: 'Weekly', val: 'weekly' },
                  { label: 'Monthly', val: 'monthly' },
                ].map((item) => {
                  const isSel = recurrencePattern === item.val;
                  return (
                    <TouchableOpacity
                      key={item.label}
                      onPress={() => setRecurrencePattern(item.val)}
                      style={[
                        styles.priorityChip,
                        {
                          backgroundColor: isSel ? theme.brandPrimary : theme.surfaceSubtle,
                          borderColor: theme.borderSubtle,
                        },
                      ]}>
                      <Text style={{ color: isSel ? '#fff' : theme.text, fontSize: 11, fontWeight: '600' }}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Target Due Date (Day) */}
              <ThemedText type="smallBold" style={styles.fieldLabel}>Target Due Date (Day)</ThemedText>
              <View style={styles.priorityRow}>
                {[
                  { label: 'Today', days: 0 },
                  { label: 'Tomorrow', days: 1 },
                  { label: 'In 3 Days', days: 3 },
                  { label: '1 Week', days: 7 },
                  { label: 'No Date', days: null },
                ].map((item) => {
                  const isSel = dueDaysOffset === item.days;
                  return (
                    <TouchableOpacity
                      key={item.label}
                      onPress={() => setDueDaysOffset(item.days)}
                      style={[
                        styles.priorityChip,
                        {
                          backgroundColor: isSel ? theme.brandPrimary : theme.surfaceSubtle,
                          borderColor: theme.borderSubtle,
                        },
                      ]}>
                      <Text style={{ color: isSel ? '#fff' : theme.text, fontSize: 11, fontWeight: '600' }}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {dueDaysOffset !== null ? (
                <>
                  <ThemedText type="smallBold" style={styles.fieldLabel}>
                    Deadline Time (e.g. Kalh 12:00 PM) ⏰
                  </ThemedText>

                  {/* Interactive Custom Time Box */}
                  <View style={[styles.timeBox, { backgroundColor: theme.surfaceSubtle, borderColor: theme.borderSubtle }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: theme.textSecondary, width: 42 }}>Hour:</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((h) => {
                          const isH = dueHour === h;
                          return (
                            <TouchableOpacity
                              key={h}
                              onPress={() => setDueHour(h)}
                              style={[
                                styles.timeUnitChip,
                                {
                                  backgroundColor: isH ? theme.brandPrimary : theme.cardBackground,
                                  borderColor: isH ? theme.brandPrimary : theme.borderSubtle,
                                },
                              ]}>
                              <Text style={{ fontSize: 11, fontWeight: '700', color: isH ? '#ffffff' : theme.text }}>
                                {h}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: theme.textSecondary, width: 42 }}>Min:</Text>
                      <View style={{ flexDirection: 'row', gap: 4, flex: 1 }}>
                        {[0, 15, 30, 45, 59].map((m) => {
                          const isM = dueMinute === m;
                          const label = m < 10 ? `:0${m}` : `:${m}`;
                          return (
                            <TouchableOpacity
                              key={m}
                              onPress={() => setDueMinute(m)}
                              style={[
                                styles.timeUnitChip,
                                {
                                  backgroundColor: isM ? theme.brandPrimary : theme.cardBackground,
                                  borderColor: isM ? theme.brandPrimary : theme.borderSubtle,
                                },
                              ]}>
                              <Text style={{ fontSize: 11, fontWeight: '700', color: isM ? '#ffffff' : theme.text }}>
                                {label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      {/* AM / PM Toggle */}
                      <View style={[styles.amPmContainer, { borderColor: theme.borderSubtle }]}>
                        <TouchableOpacity
                          onPress={() => setDuePeriod('AM')}
                          style={[styles.amPmBtn, duePeriod === 'AM' && { backgroundColor: theme.brandPrimary }]}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: duePeriod === 'AM' ? '#ffffff' : theme.text }}>AM</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => setDuePeriod('PM')}
                          style={[styles.amPmBtn, duePeriod === 'PM' && { backgroundColor: theme.brandPrimary }]}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: duePeriod === 'PM' ? '#ffffff' : theme.text }}>PM</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  {/* Notification Alarm Setting */}
                  <ThemedText type="smallBold" style={styles.fieldLabel}>Mobile Notification Alarm 🔔</ThemedText>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.xs }}>
                    {[
                      { label: 'Exact Deadline', offset: 0 },
                      { label: '15m Before', offset: 15 },
                      { label: '30m Before', offset: 30 },
                      { label: '1h Before', offset: 60 },
                      { label: 'No Alert', offset: -1 },
                    ].map((opt) => {
                      const isSel = reminderOffset === opt.offset;
                      return (
                        <TouchableOpacity
                          key={opt.label}
                          onPress={() => setReminderOffset(opt.offset)}
                          style={[
                            styles.timePresetChip,
                            {
                              backgroundColor: isSel ? theme.brandPrimary : theme.surfaceSubtle,
                              borderColor: isSel ? theme.brandPrimary : theme.borderSubtle,
                            },
                          ]}>
                          <Text style={{ color: isSel ? '#ffffff' : theme.text, fontSize: 11, fontWeight: '600' }}>
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </>
              ) : null}

              {/* Subtasks Checklist with Reordering */}
              <ThemedText type="smallBold" style={styles.fieldLabel}>Checklist Subtasks</ThemedText>
              {subtasks.map((st, idx) => (
                <View key={st.id} style={styles.modalSubtaskItem}>
                  <TouchableOpacity onPress={() => handleToggleSubtaskInModal(st.id)}>
                    <Text style={{ fontSize: 16 }}>{st.is_completed ? '☑' : '☐'}</Text>
                  </TouchableOpacity>
                  <Text style={[styles.modalSubtaskTitle, st.is_completed && { textDecorationLine: 'line-through' }]}>
                    {st.title}
                  </Text>
                  <TouchableOpacity onPress={() => handleMoveSubtask(idx, 'up')} style={{ paddingHorizontal: 4 }}>
                    <Text style={{ fontSize: 12 }}>▲</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleMoveSubtask(idx, 'down')} style={{ paddingHorizontal: 4 }}>
                    <Text style={{ fontSize: 12 }}>▼</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleRemoveSubtask(st.id)}>
                    <Text style={{ color: theme.statusDanger, fontSize: 16 }}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}

              <View style={styles.addSubtaskRow}>
                <TextInput
                  style={[styles.subtaskInput, { backgroundColor: theme.surfaceSubtle, color: theme.text, borderColor: theme.borderSubtle }]}
                  placeholder="+ Add checklist step..."
                  placeholderTextColor={theme.textTertiary}
                  value={newSubtaskTitle}
                  onChangeText={setNewSubtaskTitle}
                />
                <Button title="Add" variant="secondary" size="sm" onPress={handleAddSubtask} />
              </View>
            </ScrollView>

            <View style={styles.modalButtonsRow}>
              <Button
                title="Cancel"
                variant="ghost"
                size="sm"
                onPress={() => setIsModalOpen(false)}
                style={{ flex: 1, marginRight: Spacing.sm }}
              />
              <Button
                title={isSaving ? 'Saving...' : 'Save Task'}
                variant="primary"
                size="sm"
                loading={isSaving}
                onPress={handleSaveTask}
                style={{ flex: 1.5 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* TEMPLATES MODAL */}
      <Modal visible={isTemplatesModalOpen} animationType="fade" transparent onRequestClose={() => setIsTemplatesModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.background, borderColor: theme.borderSubtle }]}>
            <ThemedText type="headlineMedium" style={{ marginBottom: Spacing.xs }}>📑 Task Templates</ThemedText>
            <ThemedText type="bodySmall" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
              Choose a proven academic workflow to generate tasks instantly:
            </ThemedText>

            <ScrollView style={{ maxHeight: 380 }}>
              {templates.map((tmpl) => (
                <Card key={tmpl.id} variant="default" style={{ marginBottom: 8, padding: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '700', fontSize: 14, color: theme.text }}>{tmpl.title}</Text>
                      {tmpl.description ? (
                        <Text style={{ fontSize: 11, color: theme.textSecondary }}>{tmpl.description}</Text>
                      ) : null}
                      <Text style={{ fontSize: 10, color: theme.brandPrimary, marginTop: 2 }}>
                        {tmpl.subtasks.length} checklist items • {tmpl.category}
                      </Text>
                    </View>
                    <Button
                      title="Use"
                      variant="primary"
                      size="sm"
                      onPress={() => handleApplyTemplate(tmpl)}
                    />
                  </View>
                </Card>
              ))}
            </ScrollView>

            <Button
              title="Close"
              variant="ghost"
              size="sm"
              onPress={() => setIsTemplatesModalOpen(false)}
              style={{ marginTop: Spacing.sm }}
            />
          </View>
        </View>
      </Modal>

      {/* AI DAILY BRIEFING MODAL */}
      <Modal visible={isBriefingModalOpen} animationType="slide" transparent onRequestClose={() => setIsBriefingModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.background, borderColor: theme.borderSubtle }]}>
            <ThemedText type="headlineMedium" style={{ marginBottom: 4 }}>✨ Daily Study Briefing</ThemedText>
            {isLoadingBriefing ? (
              <ActivityIndicator size="large" color={theme.brandPrimary} style={{ marginVertical: 30 }} />
            ) : dailyBriefing ? (
              <ScrollView style={{ maxHeight: 380 }}>
                <ThemedText type="titleMedium" style={{ color: theme.brandPrimary, marginBottom: 4 }}>
                  {dailyBriefing.greeting}
                </ThemedText>
                <ThemedText type="bodyMedium" style={{ color: theme.text, marginBottom: 12 }}>
                  {dailyBriefing.summary}
                </ThemedText>

                <ThemedText type="smallBold" style={{ color: theme.textSecondary, marginBottom: 6 }}>
                  🚨 Urgent Deadlines Today:
                </ThemedText>
                {dailyBriefing.urgent_tasks.map((u, i) => (
                  <View key={i} style={[styles.briefingItem, { backgroundColor: theme.surfaceSubtle }]}>
                    <Text style={{ fontWeight: '700', fontSize: 13, color: theme.statusDanger }}>{u.title}</Text>
                    <Text style={{ fontSize: 11, color: theme.textSecondary }}>Priority: {u.priority}</Text>
                  </View>
                ))}

                <ThemedText type="smallBold" style={{ color: theme.textSecondary, marginTop: 10, marginBottom: 6 }}>
                  🎯 Recommended Order of Focus:
                </ThemedText>
                {dailyBriefing.recommended_focus_order.map((rec, i) => (
                  <Text key={i} style={{ fontSize: 12, color: theme.text, marginBottom: 4 }}>
                    {i + 1}. {rec}
                  </Text>
                ))}
              </ScrollView>
            ) : null}

            <Button
              title="Got It, Let's Study!"
              variant="primary"
              size="sm"
              onPress={() => setIsBriefingModalOpen(false)}
              style={{ marginTop: Spacing.md }}
            />
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerAiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(99, 102, 241, 0.18)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.35)',
  },
  headerAiBtnIcon: {
    fontSize: 13,
  },
  headerAiBtnText: {
    color: '#818CF8',
    fontSize: 12,
    fontWeight: '800',
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
  offlineBanner: {
    paddingVertical: 5,
    paddingHorizontal: Spacing.md,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245, 158, 11, 0.3)',
    alignItems: 'center',
  },
  offlineBannerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F59E0B',
  },
  viewSwitcherBar: {
    flexDirection: 'row',
    padding: 3,
    marginHorizontal: Spacing.md,
    marginTop: 6,
    marginBottom: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(13, 20, 42, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  viewSwitcherBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 9,
  },
  viewSwitcherBtnActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.22)',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  viewSwitcherText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  viewSwitcherTextActive: {
    color: '#34D399',
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
    marginTop: 4,
    marginBottom: 6,
    paddingVertical: 7,
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
  metricValPending: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FBBF24',
  },
  metricValDone: {
    fontSize: 15,
    fontWeight: '900',
    color: '#34D399',
  },
  metricValOverdue: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FB7185',
  },
  metricValFocus: {
    fontSize: 15,
    fontWeight: '900',
    color: '#38BDF8',
  },
  metricLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#94A3B8',
  },
  searchAndToolsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    marginBottom: 6,
  },
  searchContainer: {
    flex: 1,
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
  quickActionIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionIcon: {
    fontSize: 15,
  },
  statusRowContainer: {
    height: 34,
    width: '100%',
    marginBottom: 5,
  },
  statusRowContent: {
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    gap: 6,
  },
  statusPill: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPillActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.22)',
    borderColor: '#10B981',
  },
  statusPillOverdue: {
    borderColor: 'rgba(244, 63, 94, 0.5)',
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
  },
  statusPillText: {
    color: '#94A3B8',
    fontSize: 11.5,
    fontWeight: '600',
  },
  statusPillTextActive: {
    color: '#F1F5F9',
    fontWeight: '800',
  },
  subjectRowContainer: {
    height: 30,
    width: '100%',
    marginBottom: 6,
  },
  subjectRowContent: {
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    gap: 6,
  },
  subjectFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  subjectFilterChipActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderColor: '#38BDF8',
  },
  subjectFilterDot: {
    fontSize: 10.5,
  },
  subjectFilterColorCircle: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  subjectFilterText: {
    color: '#94A3B8',
    fontSize: 11.5,
    fontWeight: '600',
  },
  subjectFilterTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  taskList: {
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
  taskCard: {
    marginBottom: 10,
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
  taskCardCompleted: {
    opacity: 0.7,
  },
  taskCardOverdue: {
    borderColor: 'rgba(244, 63, 94, 0.6)',
    shadowColor: '#F43F5E',
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  taskHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: 'rgba(52, 211, 153, 0.5)',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  checkMark: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  taskTitleDone: {
    textDecorationLine: 'line-through',
    color: '#64748B',
  },
  prereqBanner: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.xs,
    marginTop: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
    flexWrap: 'wrap',
  },
  subjectTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  subjectDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dueBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  subtasksContainer: {
    borderTopWidth: 1,
    marginTop: Spacing.sm,
    paddingTop: Spacing.xs,
  },
  progressBarTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  subtaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 3,
  },
  subtaskText: {
    fontSize: 12,
  },
  attachmentsContainer: {
    borderTopWidth: 1,
    marginTop: Spacing.xs,
    paddingTop: Spacing.xs,
  },
  attachmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    marginRight: 6,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  actionBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  addBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.sm,
    backgroundColor: '#059669',
  },
  // Calendar Styles
  calendarContainer: {
    flex: 1,
    paddingHorizontal: Spacing.md,
  },
  calendarNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  calNavBtn: {
    padding: Spacing.xs,
  },
  weekHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 4,
  },
  weekHeaderCell: {
    width: 40,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: '#888',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridCell: {
    width: '14.28%',
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.sm,
  },
  gridDateText: {
    fontSize: 12,
    fontWeight: '500',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 2,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  selectedDaySection: {
    marginTop: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  selectedDayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayTaskCard: {
    marginTop: 8,
    padding: 10,
  },
  // Analytics Styles
  analyticsContainer: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xl,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: Spacing.sm,
  },
  metricCard: {
    flex: 1,
    minWidth: '47%',
    alignItems: 'center',
    padding: Spacing.md,
  },
  chartCard: {
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  trendsBarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 70,
    paddingHorizontal: 8,
  },
  trendCol: {
    alignItems: 'center',
  },
  trendBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  trendBarFill: {
    width: 10,
    borderRadius: 2,
  },
  trendDayLabel: {
    fontSize: 10,
    color: '#888',
    marginTop: 4,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  modalCard: {
    width: '100%',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
  },
  aiPromptBox: {
    padding: 8,
    borderRadius: BorderRadius.sm,
    marginBottom: 8,
  },
  aiInput: {
    flex: 1,
    height: 36,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: 8,
    fontSize: 12,
  },
  fieldLabel: {
    fontSize: 12,
    marginVertical: 4,
  },
  input: {
    height: 42,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    paddingHorizontal: Spacing.sm,
    fontSize: 13,
  },
  textArea: {
    minHeight: 64,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    fontSize: 13,
    textAlignVertical: 'top',
  },
  subjectChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginRight: 6,
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: Spacing.xs,
    flexWrap: 'wrap',
  },
  priorityChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  timeBox: {
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    padding: 8,
    marginBottom: 8,
  },
  timeUnitChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    marginRight: 4,
  },
  amPmContainer: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: BorderRadius.xs,
    overflow: 'hidden',
  },
  amPmBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  timePresetChip: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginRight: 6,
  },
  modalSubtaskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  modalSubtaskTitle: {
    flex: 1,
    fontSize: 12,
  },
  addSubtaskRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
    marginBottom: 8,
  },
  subtaskInput: {
    flex: 1,
    height: 36,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    paddingHorizontal: 8,
    fontSize: 12,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    marginTop: Spacing.md,
  },
  briefingItem: {
    padding: 8,
    borderRadius: BorderRadius.sm,
    marginBottom: 6,
  },
});
