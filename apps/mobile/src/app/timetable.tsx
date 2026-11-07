import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { ScreenWrapper } from '@/components/ui';
import { subjectApi, timetableApi } from '@/services/api/client';
import {
  cancelClassReminder,
  scheduleClassReminder,
  sendImmediateNotification,
} from '@/services/notifications';
import { Subject } from '@/types/subject';
import {
  AttendanceRecord,
  AttendanceStatus,
  AttendanceSummaryResponse,
  DAYS_OF_WEEK,
  TimetableEntry,
  TimetableEntryCreate,
  WeeklyTimetableResponse,
} from '@/types/timetable';

const _TIME_HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const _TIME_MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

type ViewMode = 'weekly' | 'today';

interface WeekDayItem {
  day: number;
  name: string;
  short: string;
  dateNum: number;
  monthShort: string;
  year: number;
  isoDate: string;
  isToday: boolean;
}

// Icon and color mapper to match the reference UI
const getSubjectIconAndColor = (subjectName?: string | null, subjectColor?: string | null) => {
  const name = (subjectName || '').toLowerCase();
  if (name.includes('web') || name.includes('dev') || name.includes('code') || name.includes('site') || name.includes('html')) {
    return { icon: '</>', color: subjectColor || '#3B82F6', bg: '#1D4ED8' };
  }
  if (name.includes('data') || name.includes('struct') || name.includes('algo') || name.includes('math') || name.includes('stat')) {
    return { icon: '📊', color: subjectColor || '#10B981', bg: '#047857' };
  }
  if (name.includes('python') || name.includes('prog') || name.includes('java') || name.includes('tech') || name.includes('c++')) {
    return { icon: '💻', color: subjectColor || '#F59E0B', bg: '#B45309' };
  }
  if (name.includes('ai') || name.includes('ml') || name.includes('intel') || name.includes('robot')) {
    return { icon: '🤖', color: subjectColor || '#8B5CF6', bg: '#6D28D9' };
  }
  if (name.includes('sci') || name.includes('phys') || name.includes('chem') || name.includes('bio')) {
    return { icon: '🔬', color: subjectColor || '#EC4899', bg: '#BE185D' };
  }
  return { icon: '📚', color: subjectColor || '#6366F1', bg: '#4338CA' };
};

export default function TimetableScreen() {
  const router = useRouter();

  // Current date/time ticker for live status & countdown
  const [nowDate, setNowDate] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNowDate(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const todayDow = useMemo(() => {
    const d = nowDate.getDay();
    return d === 0 ? 7 : d; // 1=Mon ... 7=Sun
  }, [nowDate]);

  const currentTimeStr = useMemo(() => {
    const h = nowDate.getHours().toString().padStart(2, '0');
    const m = nowDate.getMinutes().toString().padStart(2, '0');
    const s = nowDate.getSeconds().toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  }, [nowDate]);

  // Compute 7 days of the active week dynamically (Mon to Sun)
  const weekDays = useMemo<WeekDayItem[]>(() => {
    const d = new Date(nowDate);
    const dayOfWeek = d.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(d);
    monday.setDate(d.getDate() + diffToMonday);

    const fullNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const shortNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return [1, 2, 3, 4, 5, 6, 7].map((dow, idx) => {
      const dayDate = new Date(monday);
      dayDate.setDate(monday.getDate() + idx);
      const isoDate = dayDate.toISOString().split('T')[0];
      return {
        day: dow,
        name: fullNames[idx],
        short: shortNames[idx],
        dateNum: dayDate.getDate(),
        monthShort: dayDate.toLocaleDateString('en-US', { month: 'short' }),
        year: dayDate.getFullYear(),
        isoDate,
        isToday: dow === todayDow,
      };
    });
  }, [nowDate, todayDow]);

  // UI State: default viewMode to 'weekly' to match reference screenshot
  const [viewMode, setViewMode] = useState<ViewMode>('weekly');
  const [selectedDay, setSelectedDay] = useState<number>(() => {
    const jsDay = new Date().getDay();
    return jsDay === 0 ? 7 : jsDay;
  });

  const currentDayInfo = useMemo(() => {
    return weekDays.find((w) => w.day === selectedDay) || weekDays[0];
  }, [weekDays, selectedDay]);

  const selectedDateStr = useMemo(() => {
    return currentDayInfo.isoDate;
  }, [currentDayInfo]);

  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string | null>(null);

  // Attendance State
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummaryResponse | null>(null);
  const [dateAttendanceMap, setDateAttendanceMap] = useState<Record<string, AttendanceStatus>>({});
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimetableEntry | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form Fields
  const [formSubjectId, setFormSubjectId] = useState<string>('');
  const [formDays, setFormDays] = useState<number[]>([1]);
  const [formStartHour, setFormStartHour] = useState<number>(9);
  const [formStartMinute, setFormStartMinute] = useState<number>(0);
  const [formStartPeriod, setFormStartPeriod] = useState<'AM' | 'PM'>('AM');
  const [formEndHour, setFormEndHour] = useState<number>(10);
  const [formEndMinute, setFormEndMinute] = useState<number>(30);
  const [formEndPeriod, setFormEndPeriod] = useState<'AM' | 'PM'>('AM');
  const [formRoom, setFormRoom] = useState<string>('');
  const [formBuilding, setFormBuilding] = useState<string>('');
  const [formProfessor, setFormProfessor] = useState<string>('');
  const [formIsOnline, setFormIsOnline] = useState<boolean>(false);
  const [formVirtualUrl, setFormVirtualUrl] = useState<string>('');
  const [formReminderMinutes, setFormReminderMinutes] = useState<number>(15);
  const [formStartDate, setFormStartDate] = useState<string>('');
  const [formEndDate, setFormEndDate] = useState<string>('');
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);

  // Initial Data Fetch
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [weeklyData, subjectList, summary, dayAtt] = await Promise.all([
        timetableApi.getWeekly().catch(() => ({ entries: [], by_day: {}, total_classes: 0 } as WeeklyTimetableResponse)),
        subjectApi.list().catch(() => []),
        timetableApi.getAttendanceSummary(75.0).catch(() => null),
        timetableApi.listAttendance({ attendance_date: selectedDateStr }).catch(() => [] as AttendanceRecord[]),
      ]);
      setEntries(weeklyData.entries);
      setSubjects(subjectList);
      setAttendanceSummary(summary);

      const attMap: Record<string, AttendanceStatus> = {};
      dayAtt.forEach((rec) => {
        if (rec.timetable_entry_id) {
          attMap[rec.timetable_entry_id] = rec.status;
        }
      });
      setDateAttendanceMap(attMap);
    } catch (err: any) {
      Alert.alert('Load Error', err?.message || 'Could not load timetable.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch attendance specifically for the currently selected date
  useEffect(() => {
    if (!selectedDateStr) return;
    timetableApi
      .listAttendance({ attendance_date: selectedDateStr })
      .then((records) => {
        const attMap: Record<string, AttendanceStatus> = {};
        records.forEach((rec) => {
          if (rec.timetable_entry_id) {
            attMap[rec.timetable_entry_id] = rec.status;
          }
        });
        setDateAttendanceMap(attMap);
      })
      .catch(() => {});
  }, [selectedDateStr]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/explore' as never);
    }
  };

  // Today's classes sorted chronologically
  const todayClasses = useMemo(() => {
    return entries
      .filter((e) => e.day_of_week === todayDow)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [entries, todayDow]);

  // Live class (currently running)
  const liveClass = useMemo(() => {
    return (
      todayClasses.find((c) => {
        return c.start_time <= currentTimeStr && c.end_time > currentTimeStr;
      }) || null
    );
  }, [todayClasses, currentTimeStr]);

  // Next upcoming class today
  const nextClass = useMemo(() => {
    if (liveClass) return null;
    return todayClasses.find((c) => c.start_time > currentTimeStr) || null;
  }, [todayClasses, liveClass, currentTimeStr]);

  // Countdown text
  const countdownMinutes = useMemo(() => {
    if (liveClass) {
      const [endH, endM] = liveClass.end_time.split(':').map(Number);
      const endMinutes = endH * 60 + endM;
      const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
      return Math.max(1, endMinutes - nowMinutes);
    }
    if (nextClass) {
      const [startH, startM] = nextClass.start_time.split(':').map(Number);
      const startMinutes = startH * 60 + startM;
      const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
      return Math.max(1, startMinutes - nowMinutes);
    }
    return null;
  }, [liveClass, nextClass, nowDate]);

  // Filtered classes for the day currently being viewed
  const activeDayNumber = viewMode === 'today' ? todayDow : selectedDay;

  const dayEntries = useMemo(() => {
    let list = entries.filter((e) => e.day_of_week === activeDayNumber);
    if (selectedSubjectFilter) {
      list = list.filter((e) => e.subject_id === selectedSubjectFilter);
    }
    return list.sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [entries, activeDayNumber, selectedSubjectFilter]);

  // Helper to format 24h string to 12h AM/PM
  const formatTime12 = (timeStr: string) => {
    const parts = timeStr.split(':');
    let h = parseInt(parts[0], 10);
    const m = parts[1] || '00';
    const period = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${m} ${period}`;
  };

  const to24HourStr = (hour: number, minute: number, period: 'AM' | 'PM') => {
    let h = hour;
    if (period === 'PM' && h < 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    const hh = h.toString().padStart(2, '0');
    const mm = minute.toString().padStart(2, '0');
    return `${hh}:${mm}:00`;
  };

  const parseFrom24Hour = (timeStr: string) => {
    const parts = timeStr.split(':');
    let h = parseInt(parts[0], 10);
    const m = parseInt(parts[1] || '0', 10);
    const period: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return { hour: h, minute: m, period };
  };

  // Conflict live check
  const checkLiveConflict = async (day: number, startStr: string, endStr: string, excludeId?: string) => {
    try {
      const res = await timetableApi.checkConflict({
        day_of_week: day,
        start_time: startStr,
        end_time: endStr,
        exclude_id: excludeId,
      });
      if (res.has_conflict && res.conflicting_entries.length > 0) {
        const names = res.conflicting_entries.map((c) => c.subject_name || 'Class').join(', ');
        setConflictWarning(`⚠️ Time clash with: ${names}`);
      } else {
        setConflictWarning(null);
      }
    } catch {
      setConflictWarning(null);
    }
  };

  const handleUpdateStartTime = (h: number, m: number, p: 'AM' | 'PM') => {
    setFormStartHour(h);
    setFormStartMinute(m);
    setFormStartPeriod(p);
    const startStr = to24HourStr(h, m, p);
    const endStr = to24HourStr(formEndHour, formEndMinute, formEndPeriod);
    checkLiveConflict(formDays[0] || selectedDay, startStr, endStr, editingEntry?.id);
  };

  const handleUpdateEndTime = (h: number, m: number, p: 'AM' | 'PM') => {
    setFormEndHour(h);
    setFormEndMinute(m);
    setFormEndPeriod(p);
    const startStr = to24HourStr(formStartHour, formStartMinute, formStartPeriod);
    const endStr = to24HourStr(h, m, p);
    checkLiveConflict(formDays[0] || selectedDay, startStr, endStr, editingEntry?.id);
  };

  const incrementStartHour = (delta: number) => {
    let next = formStartHour + delta;
    if (next > 12) next = 1;
    if (next < 1) next = 12;
    handleUpdateStartTime(next, formStartMinute, formStartPeriod);
  };

  const incrementStartMinute = (delta: number) => {
    let next = formStartMinute + delta;
    if (next >= 60) next = 0;
    if (next < 0) next = 55;
    handleUpdateStartTime(formStartHour, next, formStartPeriod);
  };

  const incrementEndHour = (delta: number) => {
    let next = formEndHour + delta;
    if (next > 12) next = 1;
    if (next < 1) next = 12;
    handleUpdateEndTime(next, formEndMinute, formEndPeriod);
  };

  const incrementEndMinute = (delta: number) => {
    let next = formEndMinute + delta;
    if (next >= 60) next = 0;
    if (next < 0) next = 55;
    handleUpdateEndTime(formEndHour, next, formEndPeriod);
  };

  const handleQuickDuration = (addedMinutes: number) => {
    let startH = formStartHour;
    if (formStartPeriod === 'PM' && startH < 12) startH += 12;
    if (formStartPeriod === 'AM' && startH === 12) startH = 0;

    const totalStartMins = startH * 60 + formStartMinute;
    const totalEndMins = (totalStartMins + addedMinutes) % (24 * 60);

    const end24 = Math.floor(totalEndMins / 60);
    const endM = totalEndMins % 60;

    const period: 'AM' | 'PM' = end24 >= 12 ? 'PM' : 'AM';
    let h12 = end24 % 12;
    if (h12 === 0) h12 = 12;

    handleUpdateEndTime(h12, endM, period);
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingEntry(null);
    setFormSubjectId(subjects[0]?.id || '');
    setFormDays([activeDayNumber]);
    setFormStartHour(10);
    setFormStartMinute(10);
    setFormStartPeriod('AM');
    setFormEndHour(11);
    setFormEndMinute(0);
    setFormEndPeriod('AM');
    setFormRoom('');
    setFormBuilding('');
    setFormProfessor('');
    setFormIsOnline(false);
    setFormVirtualUrl('');
    setFormReminderMinutes(10);
    setFormStartDate('');
    setFormEndDate('');
    setConflictWarning(null);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (entry: TimetableEntry) => {
    setEditingEntry(entry);
    setFormSubjectId(entry.subject_id);
    setFormDays([entry.day_of_week]);

    const s = parseFrom24Hour(entry.start_time);
    setFormStartHour(s.hour);
    setFormStartMinute(s.minute);
    setFormStartPeriod(s.period);

    const e = parseFrom24Hour(entry.end_time);
    setFormEndHour(e.hour);
    setFormEndMinute(e.minute);
    setFormEndPeriod(e.period);

    setFormRoom(entry.room || '');
    setFormBuilding(entry.building || '');
    setFormProfessor(entry.professor || '');
    setFormIsOnline(entry.is_online);
    setFormVirtualUrl(entry.virtual_url || '');
    setFormReminderMinutes(entry.reminder_minutes_before ?? 10);
    setFormStartDate(entry.start_date || '');
    setFormEndDate(entry.end_date || '');
    setConflictWarning(null);
    setIsModalOpen(true);
  };

  const toggleFormDay = (dayNum: number) => {
    if (editingEntry) {
      setFormDays([dayNum]);
      return;
    }
    setFormDays((prev) => {
      if (prev.includes(dayNum)) {
        if (prev.length === 1) return prev;
        return prev.filter((d) => d !== dayNum);
      }
      return [...prev, dayNum].sort((a, b) => a - b);
    });
  };

  // Save handler with client-side date sanitization to prevent date errors
  const handleSave = async () => {
    if (!formSubjectId) {
      Alert.alert('Validation', 'Please select a subject for this class.');
      return;
    }
    if (formDays.length === 0) {
      Alert.alert('Validation', 'Please select at least one day of the week.');
      return;
    }

    const startStr = to24HourStr(formStartHour, formStartMinute, formStartPeriod);
    const endStr = to24HourStr(formEndHour, formEndMinute, formEndPeriod);

    if (endStr <= startStr) {
      Alert.alert('Invalid Times', 'Class end time must be after the start time.');
      return;
    }

    // Client-side date sanitization (Prevents Pydantic validation crashes)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    let cleanStartDate: string | undefined = undefined;
    let cleanEndDate: string | undefined = undefined;

    if (formStartDate.trim()) {
      if (!dateRegex.test(formStartDate.trim())) {
        Alert.alert(
          'Date Format Error',
          'Please enter Term Start in YYYY-MM-DD format (e.g. 2026-08-01) or leave it empty.'
        );
        return;
      }
      cleanStartDate = formStartDate.trim();
    }

    if (formEndDate.trim()) {
      if (!dateRegex.test(formEndDate.trim())) {
        Alert.alert(
          'Date Format Error',
          'Please enter Term End in YYYY-MM-DD format (e.g. 2026-12-15) or leave it empty.'
        );
        return;
      }
      cleanEndDate = formEndDate.trim();
    }

    if (cleanStartDate && cleanEndDate && cleanEndDate < cleanStartDate) {
      Alert.alert('Invalid Dates', 'Term End date must be on or after Term Start date.');
      return;
    }

    setIsSaving(true);
    try {
      if (editingEntry) {
        const payload: TimetableEntryCreate = {
          subject_id: formSubjectId,
          day_of_week: formDays[0],
          start_time: startStr,
          end_time: endStr,
          room: formRoom.trim() || undefined,
          building: formBuilding.trim() || undefined,
          professor: formProfessor.trim() || undefined,
          is_online: formIsOnline,
          virtual_url: formVirtualUrl.trim() || undefined,
          reminder_minutes_before: formReminderMinutes,
          start_date: cleanStartDate,
          end_date: cleanEndDate,
        };
        const updated = await timetableApi.update(editingEntry.id, payload);
        const subjName = updated.subject_name || subjects.find((s) => s.id === updated.subject_id)?.name || 'Class';
        const entryWithSubj = { ...updated, subject_name: subjName };
        setEntries((prev) => prev.map((e) => (e.id === updated.id ? entryWithSubj : e)));
        await cancelClassReminder(editingEntry.id);
        await scheduleClassReminder(entryWithSubj);
        Alert.alert('Updated', 'Class schedule updated successfully.');
      } else if (formDays.length > 1) {
        const createdList = await timetableApi.batchCreate({
          days_of_week: formDays,
          subject_id: formSubjectId,
          start_time: startStr,
          end_time: endStr,
          room: formRoom.trim() || undefined,
          building: formBuilding.trim() || undefined,
          professor: formProfessor.trim() || undefined,
          is_online: formIsOnline,
          virtual_url: formVirtualUrl.trim() || undefined,
          reminder_minutes_before: formReminderMinutes,
          start_date: cleanStartDate,
          end_date: cleanEndDate,
        });
        const subjName = subjects.find((s) => s.id === formSubjectId)?.name || 'Class';
        const createdWithSubj = createdList.map((item) => ({ ...item, subject_name: item.subject_name || subjName }));
        setEntries((prev) => [...prev, ...createdWithSubj]);
        for (const item of createdWithSubj) {
          await scheduleClassReminder(item);
        }
        Alert.alert('Added', `${createdList.length} recurring classes added to your timetable!`);
      } else {
        const payload: TimetableEntryCreate = {
          subject_id: formSubjectId,
          day_of_week: formDays[0],
          start_time: startStr,
          end_time: endStr,
          room: formRoom.trim() || undefined,
          building: formBuilding.trim() || undefined,
          professor: formProfessor.trim() || undefined,
          is_online: formIsOnline,
          virtual_url: formVirtualUrl.trim() || undefined,
          reminder_minutes_before: formReminderMinutes,
          start_date: cleanStartDate,
          end_date: cleanEndDate,
        };
        const created = await timetableApi.create(payload);
        const subjName = created.subject_name || subjects.find((s) => s.id === formSubjectId)?.name || 'Class';
        const createdWithSubj = { ...created, subject_name: subjName };
        setEntries((prev) => [...prev, createdWithSubj]);
        await scheduleClassReminder(createdWithSubj);
        Alert.alert('Added', 'Class added to your timetable!');
      }

      setIsModalOpen(false);
    } catch (err: any) {
      Alert.alert('Save Error', err?.message || 'Could not save timetable entry.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (entry: TimetableEntry) => {
    Alert.alert(
      'Delete Class',
      `Are you sure you want to remove ${entry.subject_name || 'this class'} from your timetable?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await timetableApi.delete(entry.id);
              await cancelClassReminder(entry.id);
              setEntries((prev) => prev.filter((e) => e.id !== entry.id));
            } catch (err: any) {
              Alert.alert('Delete Failed', err?.message || 'Could not remove entry.');
            }
          },
        },
      ]
    );
  };

  // Test Reminder Notification
  const handleTestReminder = async (entry: TimetableEntry) => {
    await sendImmediateNotification(
      `🔔 Class Reminder: ${entry.subject_name || 'Class'}`,
      `Class starts at ${formatTime12(entry.start_time)} ${entry.room ? `in ${entry.room}` : ''}!`
    );
    Alert.alert('Notification Sent', 'A test reminder notification has been triggered on your device.');
  };

  // Attendance marking for the active day date
  const handleMarkAttendance = async (entry: TimetableEntry, status: AttendanceStatus) => {
    try {
      await timetableApi.markAttendance({
        timetable_entry_id: entry.id,
        subject_id: entry.subject_id,
        attendance_date: selectedDateStr,
        status,
      });
      setDateAttendanceMap((prev) => ({ ...prev, [entry.id]: status }));
      const updatedSummary = await timetableApi.getAttendanceSummary(75.0);
      setAttendanceSummary(updatedSummary);

      const statusWord = status === 'present' ? 'Present ✅' : status === 'absent' ? 'Absent ❌' : 'Late ⏱️';
      Alert.alert(
        `Marked ${statusWord}`,
        `Recorded for ${entry.subject_name || 'Class'} on ${currentDayInfo.name}, ${currentDayInfo.dateNum} ${currentDayInfo.monthShort}.`
      );
    } catch (err: any) {
      Alert.alert('Attendance Error', err?.message || 'Could not mark attendance.');
    }
  };

  // Share / Export Routine
  const handleShareTimetable = async () => {
    try {
      let text = `📅 StudyMate AI — Weekly Class Routine\n\n`;
      DAYS_OF_WEEK.forEach((d) => {
        const dayClasses = entries
          .filter((e) => e.day_of_week === d.day)
          .sort((a, b) => a.start_time.localeCompare(b.start_time));
        if (dayClasses.length > 0) {
          text += `🔹 ${d.name.toUpperCase()} (${dayClasses.length} classes):\n`;
          dayClasses.forEach((c) => {
            text += `  • ${formatTime12(c.start_time)} - ${formatTime12(c.end_time)}: ${c.subject_name || 'Class'}\n`;
            if (c.room) text += `    Room: ${c.room} ${c.building ? `(${c.building})` : ''}\n`;
            if (c.professor) text += `    Prof: ${c.professor}\n`;
            if (c.is_online && c.virtual_url) text += `    Meeting: ${c.virtual_url}\n`;
          });
          text += `\n`;
        }
      });

      if (attendanceSummary && attendanceSummary.total_classes > 0) {
        text += `📊 Attendance: ${attendanceSummary.overall_percentage}% (Required: ${attendanceSummary.minimum_required_percentage}%)\n`;
      }
      text += `\nGenerated with StudyMate AI`;

      await Share.share({
        message: text,
        title: 'Weekly Class Routine',
      });
    } catch {
      // User dismissed dialog
    }
  };

  return (
    <ScreenWrapper
      scrollable={false}
      includeTopInset
      includeBottomInset
      includeTabInset
      contentContainerStyle={styles.container}>
      {/* 1. TOP HEADER (Back button, 🎓 Cap, Class Timetable, Plan • Attend • Excel, ⚙️ Settings) */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          onPress={handleBack}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          style={styles.circleIconButton}>
          <Text style={styles.circleIconText}>←</Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <View style={styles.capTitleRow}>
            <View style={styles.capGlowWrapper}>
              <Text style={{ fontSize: 24 }}>🎓</Text>
            </View>
            <View>
              <Text style={styles.headerTitleText}>Class Timetable</Text>
              <Text style={styles.headerSubtitleText}>Plan • Attend • Excel</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          onPress={handleShareTimetable}
          accessibilityLabel="Timetable Settings & Share"
          accessibilityRole="button"
          style={styles.circleIconButton}>
          <Text style={{ fontSize: 18 }}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* 2. TOP VIEW TOGGLE SWITCH ([📅 Weekly View] | [☰ Today View]) */}
      <View style={styles.viewToggleContainer}>
        <TouchableOpacity
          onPress={() => setViewMode('weekly')}
          activeOpacity={0.85}
          style={[
            styles.viewToggleTab,
            viewMode === 'weekly' ? styles.viewToggleTabActive : styles.viewToggleTabInactive,
          ]}>
          <Text style={{ fontSize: 13, marginRight: 6 }}>📅</Text>
          <Text
            style={[
              styles.viewToggleTabText,
              viewMode === 'weekly' ? styles.viewToggleTextActive : styles.viewToggleTextInactive,
            ]}>
            Weekly View
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            setViewMode('today');
            setSelectedDay(todayDow);
          }}
          activeOpacity={0.85}
          style={[
            styles.viewToggleTab,
            viewMode === 'today' ? styles.viewToggleTabActive : styles.viewToggleTabInactive,
          ]}>
          <Text style={{ fontSize: 13, marginRight: 6 }}>☰</Text>
          <Text
            style={[
              styles.viewToggleTabText,
              viewMode === 'today' ? styles.viewToggleTextActive : styles.viewToggleTextInactive,
            ]}>
            Today View
          </Text>
        </TouchableOpacity>
      </View>

      {/* 3. 7-DAY DATE SELECTOR STRIP (Mon 3, Tue 4, Wed 5, Thu 6, Fri 7, Sat 8, Sun 9) */}
      <View style={styles.weekStripWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weekStripScroll}>
          {weekDays.map((item) => {
            const isSelected = activeDayNumber === item.day;
            return (
              <TouchableOpacity
                key={item.day}
                onPress={() => {
                  setSelectedDay(item.day);
                  if (viewMode === 'today' && item.day !== todayDow) {
                    setViewMode('weekly');
                  }
                }}
                activeOpacity={0.8}
                style={[
                  styles.dayCard,
                  isSelected ? styles.dayCardActive : styles.dayCardInactive,
                ]}>
                <Text style={[styles.dayCardName, isSelected ? styles.dayCardNameActive : styles.dayCardNameInactive]}>
                  {item.short}
                </Text>
                <Text style={[styles.dayCardNumber, isSelected ? styles.dayCardNumberActive : styles.dayCardNumberInactive]}>
                  {item.dateNum}
                </Text>
                {isSelected ? <View style={styles.dayActiveDot} /> : <View style={{ height: 4 }} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 4. HERO BANNER: "Next Class in 25 min" / Live Class */}
      <View style={styles.heroBanner}>
        <View style={styles.heroClockBadge}>
          <Text style={{ fontSize: 18 }}>🕒</Text>
        </View>

        <View style={styles.heroCountdownBlock}>
          <Text style={styles.heroCountdownLabel}>
            {liveClass ? 'Live Class Now' : 'Next Class in'}
          </Text>
          <Text style={styles.heroCountdownValue}>
            {liveClass
              ? `${countdownMinutes} min left`
              : nextClass
              ? `${countdownMinutes} min`
              : 'All Done!'}
          </Text>
        </View>

        <View style={styles.heroDivider} />

        <View style={styles.heroSubjectBlock}>
          <Text style={styles.heroSubjectName} numberOfLines={1}>
            {liveClass?.subject_name || nextClass?.subject_name || 'No more lectures today'}
          </Text>
          <Text style={styles.heroSubjectTime}>
            {liveClass
              ? `${formatTime12(liveClass.start_time)} – ${formatTime12(liveClass.end_time)}`
              : nextClass
              ? `${formatTime12(nextClass.start_time)} – ${formatTime12(nextClass.end_time)}`
              : 'Enjoy your study break'}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => router.push('/pomodoro' as never)}
          accessibilityLabel="Study action"
          style={styles.heroArrowBtn}>
          <Text style={styles.heroArrowText}>→</Text>
        </TouchableOpacity>
      </View>

      {/* 5. SECTION HEADER: "Wednesday, 5 Nov 2026" & "3 Classes" */}
      <View style={styles.sectionHeaderRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 16 }}>📚</Text>
          <Text style={styles.sectionHeaderTitle}>
            {`${currentDayInfo.name}, ${currentDayInfo.dateNum} ${currentDayInfo.monthShort} ${currentDayInfo.year}`}
          </Text>
        </View>
        <View style={styles.classCountBadge}>
          <Text style={styles.classCountBadgeText}>{dayEntries.length} Classes</Text>
        </View>
      </View>

      {/* Subject Filter Bar (Clean horizontal pills without stretching) */}
      {subjects.length > 0 ? (
        <View style={styles.filterBarContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterBarScroll}>
            <TouchableOpacity
              onPress={() => setSelectedSubjectFilter(null)}
              style={[
                styles.filterPill,
                selectedSubjectFilter === null ? styles.filterPillActive : styles.filterPillInactive,
              ]}>
              <Text
                style={[
                  styles.filterPillText,
                  selectedSubjectFilter === null ? styles.filterPillTextActive : styles.filterPillTextInactive,
                ]}>
                All ({dayEntries.length})
              </Text>
            </TouchableOpacity>
            {subjects.map((sub) => {
              const isSel = selectedSubjectFilter === sub.id;
              const subCount = entries.filter(
                (e) => e.day_of_week === activeDayNumber && e.subject_id === sub.id
              ).length;
              return (
                <TouchableOpacity
                  key={sub.id}
                  onPress={() => setSelectedSubjectFilter(isSel ? null : sub.id)}
                  style={[
                    styles.filterPill,
                    isSel ? { backgroundColor: sub.color || '#6366F1', borderColor: sub.color || '#6366F1' } : styles.filterPillInactive,
                  ]}>
                  <View style={[styles.filterDot, { backgroundColor: isSel ? '#FFFFFF' : sub.color || '#6366F1' }]} />
                  <Text
                    style={[
                      styles.filterPillText,
                      isSel ? styles.filterPillTextActive : styles.filterPillTextInactive,
                    ]}>
                    {sub.name} ({subCount})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {/* 6. CLASS SCHEDULE LIST */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={{ marginTop: 10, color: '#94A3B8', fontSize: 13 }}>Loading schedule...</Text>
        </View>
      ) : (
        <FlatList
          data={dayEntries}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.classesListContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={{ fontSize: 42 }}>☕</Text>
              <Text style={styles.emptyTitle}>
                No Classes on {currentDayInfo.name}
              </Text>
              <Text style={styles.emptySubtitle}>
                Enjoy your break or tap "+ Add Class" below to schedule a lecture.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const subInfo = getSubjectIconAndColor(item.subject_name, item.color || item.subject_color);
            const currentAttendance = dateAttendanceMap[item.id];
            const isItemLive = liveClass?.id === item.id;

            return (
              <View style={[styles.classCardWrapper, { borderLeftColor: subInfo.color }]}>
                {/* Upper Row: Icon Box, Subject Details, Time & Action Button */}
                <View style={styles.classCardTopRow}>
                  {/* Left Subject Icon Box */}
                  <View style={[styles.subjectIconBox, { backgroundColor: subInfo.bg }]}>
                    <Text style={styles.subjectIconText}>{subInfo.icon}</Text>
                  </View>

                  {/* Middle Subject Info */}
                  <View style={styles.classMainInfo}>
                    <Text style={styles.subjectTitleText} numberOfLines={1}>
                      {item.subject_name || 'Class Lecture'}
                    </Text>

                    <View style={styles.teacherRoomRow}>
                      <Text style={styles.teacherRoomText} numberOfLines={1}>
                        👤 {item.professor || 'Faculty'}   🏛️ {item.room || item.building || 'Hall'}
                      </Text>
                    </View>

                    {/* Status Pill */}
                    {isItemLive ? (
                      <View style={styles.liveNowPill}>
                        <View style={styles.livePulseDot} />
                        <Text style={styles.liveNowPillText}>Live Now</Text>
                      </View>
                    ) : (
                      <View style={styles.reminderPill}>
                        <Text style={styles.reminderPillText}>
                          🔔 Reminder: {item.reminder_minutes_before ?? 10} min before
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Right Column: Time Pill & Action Button */}
                  <View style={styles.classCardRightCol}>
                    <Text style={styles.classTimeText}>
                      🕒 {formatTime12(item.start_time)} – {formatTime12(item.end_time)}
                    </Text>

                    {isItemLive ? (
                      <TouchableOpacity
                        onPress={() => router.push('/pomodoro' as never)}
                        style={styles.studyNowButton}>
                        <Text style={styles.studyNowButtonText}>Study Now →</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        onPress={() => handleOpenEdit(item)}
                        style={styles.viewDetailsButton}>
                        <Text style={styles.viewDetailsButtonText}>View Details →</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Lower Row: Attendance Marking for Everyday College Log */}
                <View style={styles.cardAttendanceRow}>
                  <Text style={styles.cardAttendanceLabel}>Attendance:</Text>

                  <TouchableOpacity
                    onPress={() => handleMarkAttendance(item, 'present')}
                    activeOpacity={0.7}
                    style={[
                      styles.cardAttBtn,
                      currentAttendance === 'present' ? styles.cardAttBtnPresentActive : styles.cardAttBtnInactive,
                    ]}>
                    <Text
                      style={[
                        styles.cardAttBtnText,
                        currentAttendance === 'present' && { color: '#FFFFFF', fontWeight: '800' },
                      ]}>
                      ✓ Present
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleMarkAttendance(item, 'absent')}
                    activeOpacity={0.7}
                    style={[
                      styles.cardAttBtn,
                      currentAttendance === 'absent' ? styles.cardAttBtnAbsentActive : styles.cardAttBtnInactive,
                    ]}>
                    <Text
                      style={[
                        styles.cardAttBtnText,
                        currentAttendance === 'absent' && { color: '#FFFFFF', fontWeight: '800' },
                      ]}>
                      ✗ Absent
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleMarkAttendance(item, 'late')}
                    activeOpacity={0.7}
                    style={[
                      styles.cardAttBtn,
                      currentAttendance === 'late' ? styles.cardAttBtnLateActive : styles.cardAttBtnInactive,
                    ]}>
                    <Text
                      style={[
                        styles.cardAttBtnText,
                        currentAttendance === 'late' && { color: '#FFFFFF', fontWeight: '800' },
                      ]}>
                      ⏱ Late
                    </Text>
                  </TouchableOpacity>

                  <View style={{ flex: 1 }} />

                  <TouchableOpacity
                    onPress={() => handleTestReminder(item)}
                    accessibilityLabel="Test reminder"
                    style={styles.cardActionIconBtn}>
                    <Text style={{ fontSize: 14 }}>🔔</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleOpenEdit(item)}
                    accessibilityLabel="Edit class"
                    style={styles.cardActionIconBtn}>
                    <Text style={{ fontSize: 14 }}>✏️</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleDelete(item)}
                    accessibilityLabel="Delete class"
                    style={styles.cardActionIconBtn}>
                    <Text style={{ fontSize: 14 }}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
          ListFooterComponent={
            /* 7. ATTENDANCE OVERVIEW WIDGET (Matching the 3rd image) */
            <View style={styles.attendanceOverviewCardWrapper}>
              <View style={styles.attendanceOverviewHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 16 }}>📊</Text>
                  <Text style={styles.attendanceOverviewTitle}>Attendance Overview</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setIsAttendanceModalOpen(true)}
                  style={styles.attendanceOverviewFilterPill}>
                  <Text style={styles.attendanceOverviewFilterText}>This Month ⌄</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={() => setIsAttendanceModalOpen(true)}
                activeOpacity={0.9}
                style={styles.attendanceOverviewContent}>
                {/* Left: Circular Donut Ring */}
                <View style={styles.donutGauge}>
                  <View
                    style={[
                      styles.donutCircle,
                      {
                        borderColor:
                          attendanceSummary && attendanceSummary.total_classes > 0
                            ? attendanceSummary.overall_percentage >= 75
                              ? '#10B981'
                              : '#EF4444'
                            : '#334155',
                      },
                    ]}>
                    <Text style={styles.donutPercentageText}>
                      {attendanceSummary && attendanceSummary.total_classes > 0
                        ? `${Math.round(attendanceSummary.overall_percentage)}%`
                        : '0%'}
                    </Text>
                  </View>
                </View>

                {/* Middle: Stats breakdown */}
                <View style={styles.attendanceStatsColumn}>
                  <View style={styles.statLine}>
                    <View style={[styles.statDot, { backgroundColor: '#10B981' }]} />
                    <Text style={styles.statLabel}>Present</Text>
                    <Text style={styles.statValue}>
                      {attendanceSummary ? attendanceSummary.present_count : 0}
                    </Text>
                  </View>
                  <View style={styles.statLine}>
                    <View style={[styles.statDot, { backgroundColor: '#EF4444' }]} />
                    <Text style={styles.statLabel}>Absent</Text>
                    <Text style={styles.statValue}>
                      {attendanceSummary ? attendanceSummary.absent_count : 0}
                    </Text>
                  </View>
                  <View style={styles.statLine}>
                    <View style={[styles.statDot, { backgroundColor: '#CBD5E1' }]} />
                    <Text style={styles.statLabel}>Total Classes</Text>
                    <Text style={styles.statValue}>
                      {attendanceSummary ? attendanceSummary.total_classes : 0}
                    </Text>
                  </View>
                </View>

                {/* Right: Trophy Badge */}
                <View style={styles.trophyWrapper}>
                  <Text style={{ fontSize: 26 }}>🏆</Text>
                  <Text style={styles.trophyTitle}>Great!</Text>
                  <Text style={styles.trophySubtitle}>Keep it up!</Text>
                  <View style={styles.trophyUnderline} />
                </View>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* 8. FLOATING ACTION BUTTON (+ Add Class) */}
      <TouchableOpacity
        onPress={handleOpenCreate}
        activeOpacity={0.85}
        accessibilityLabel="Add Class"
        accessibilityRole="button"
        style={styles.floatingAddButton}>
        <Text style={styles.floatingAddIcon}>+</Text>
        <Text style={styles.floatingAddText}>Add Class</Text>
      </TouchableOpacity>

      {/* ATTENDANCE ANALYTICS MODAL */}
      <Modal visible={isAttendanceModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalHeaderTitle}>Attendance Analytics</Text>
                <Text style={styles.modalHeaderSubtitle}>
                  University Target: {attendanceSummary?.minimum_required_percentage ?? 75}%
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsAttendanceModalOpen(false)}>
                <Text style={styles.modalCloseIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 24 }}>
              <View
                style={[
                  styles.overallAnalyticsCard,
                  {
                    borderColor:
                      attendanceSummary && attendanceSummary.total_classes > 0
                        ? attendanceSummary.overall_percentage >= 75
                          ? '#10B981'
                          : '#EF4444'
                        : '#334155',
                  },
                ]}>
                <Text style={styles.overallAnalyticsLabel}>OVERALL ATTENDANCE</Text>
                <Text
                  style={[
                    styles.overallAnalyticsValue,
                    {
                      color:
                        attendanceSummary && attendanceSummary.total_classes > 0
                          ? attendanceSummary.overall_percentage >= 75
                            ? '#10B981'
                            : '#EF4444'
                          : '#94A3B8',
                    },
                  ]}>
                  {attendanceSummary && attendanceSummary.total_classes > 0
                    ? `${attendanceSummary.overall_percentage}%`
                    : '0%'}
                </Text>
                <Text style={styles.overallAnalyticsSubtext}>
                  Total: {attendanceSummary ? attendanceSummary.total_classes : 0} | Attended:{' '}
                  {attendanceSummary ? attendanceSummary.present_count + attendanceSummary.late_count : 0} | Absent:{' '}
                  {attendanceSummary ? attendanceSummary.absent_count : 0}
                </Text>
              </View>

              <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFFFFF', marginTop: 4 }}>
                Subject Breakdown:
              </Text>

              {attendanceSummary && attendanceSummary.subjects.length > 0 ? (
                attendanceSummary.subjects.map((sub) => (
                  <View key={sub.subject_id} style={styles.subBreakdownCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFFFFF' }}>
                        {sub.subject_name}
                      </Text>
                      <Text style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>
                        {sub.present_count} Present • {sub.late_count} Late • {sub.absent_count} Absent ({sub.total_classes} total)
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.subPercentageBadge,
                        {
                          backgroundColor:
                            sub.total_classes > 0
                              ? sub.is_low_attendance
                                ? '#EF444425'
                                : '#10B98125'
                              : '#334155',
                        },
                      ]}>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '800',
                          color:
                            sub.total_classes > 0
                              ? sub.is_low_attendance
                                ? '#EF4444'
                                : '#10B981'
                              : '#94A3B8',
                        }}>
                        {sub.total_classes > 0 ? `${sub.percentage}%` : '0%'}
                      </Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={{ fontSize: 13, color: '#94A3B8', fontStyle: 'italic' }}>
                  No subject attendance marked yet. Tap [✓ Present] or [✗ Absent] on any class card to log your attendance.
                </Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ADD / EDIT CLASS SCHEDULE MODAL */}
      <Modal visible={isModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitle}>
                {editingEntry ? 'Edit Class Routine' : 'Add Class Schedule'}
              </Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                <Text style={styles.modalCloseIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.formScroll} showsVerticalScrollIndicator={false}>
              {conflictWarning ? (
                <View style={styles.formConflictBanner}>
                  <Text style={styles.formConflictText}>{conflictWarning}</Text>
                </View>
              ) : null}

              {/* Subject Selector */}
              <Text style={styles.formFieldLabel}>Subject *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ marginBottom: 8, gap: 6 }}>
                {subjects.map((sub) => {
                  const isChosen = formSubjectId === sub.id;
                  return (
                    <TouchableOpacity
                      key={sub.id}
                      onPress={() => setFormSubjectId(sub.id)}
                      style={[
                        styles.formSubjectPill,
                        isChosen
                          ? { backgroundColor: sub.color || '#6366F1', borderColor: sub.color || '#6366F1' }
                          : styles.formSubjectPillInactive,
                      ]}>
                      <Text style={{ color: isChosen ? '#FFF' : '#CBD5E1', fontWeight: '700', fontSize: 12 }}>
                        {sub.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Repeating Weekdays */}
              <Text style={styles.formFieldLabel}>
                {editingEntry ? 'Day of Week *' : 'Repeating Weekdays (Select Multiple) *'}
              </Text>
              <View style={styles.formDaysRow}>
                {DAYS_OF_WEEK.map((d) => {
                  const isSelected = formDays.includes(d.day);
                  return (
                    <TouchableOpacity
                      key={d.day}
                      onPress={() => toggleFormDay(d.day)}
                      style={[
                        styles.formDayBtn,
                        isSelected ? { backgroundColor: '#6366F1' } : { backgroundColor: '#1E293B' },
                      ]}>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '700',
                          color: isSelected ? '#FFFFFF' : '#94A3B8',
                        }}>
                        {d.short}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Start Time Section */}
              <View style={styles.formTimeContainer}>
                <View style={styles.formTimeHeader}>
                  <Text style={styles.formFieldLabelNoMargin}>Start Time *</Text>
                  <View style={styles.timeBadgeActive}>
                    <Text style={styles.timeBadgeActiveText}>
                      {`${formStartHour}:${formStartMinute.toString().padStart(2, '0')} ${formStartPeriod}`}
                    </Text>
                  </View>
                </View>

                <View style={styles.stepperRow}>
                  <View style={styles.stepperGroup}>
                    <Text style={styles.stepperLabel}>Hour:</Text>
                    <TouchableOpacity onPress={() => incrementStartHour(-1)} style={styles.stepperBtn}>
                      <Text style={styles.stepperBtnText}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.stepperValue}>{formStartHour}</Text>
                    <TouchableOpacity onPress={() => incrementStartHour(1)} style={styles.stepperBtn}>
                      <Text style={styles.stepperBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.stepperGroup}>
                    <Text style={styles.stepperLabel}>Min:</Text>
                    <TouchableOpacity onPress={() => incrementStartMinute(-5)} style={styles.stepperBtn}>
                      <Text style={styles.stepperBtnText}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.stepperValue}>
                      {formStartMinute.toString().padStart(2, '0')}
                    </Text>
                    <TouchableOpacity onPress={() => incrementStartMinute(5)} style={styles.stepperBtn}>
                      <Text style={styles.stepperBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.amPmToggle}>
                    <TouchableOpacity
                      onPress={() => handleUpdateStartTime(formStartHour, formStartMinute, 'AM')}
                      style={[styles.amPmBtn, formStartPeriod === 'AM' && { backgroundColor: '#6366F1' }]}>
                      <Text style={{ color: formStartPeriod === 'AM' ? '#FFF' : '#94A3B8', fontWeight: '800', fontSize: 11 }}>AM</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleUpdateStartTime(formStartHour, formStartMinute, 'PM')}
                      style={[styles.amPmBtn, formStartPeriod === 'PM' && { backgroundColor: '#6366F1' }]}>
                      <Text style={{ color: formStartPeriod === 'PM' ? '#FFF' : '#94A3B8', fontWeight: '800', fontSize: 11 }}>PM</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* End Time Section */}
              <View style={[styles.formTimeContainer, { marginTop: 10 }]}>
                <View style={styles.formTimeHeader}>
                  <Text style={styles.formFieldLabelNoMargin}>End Time *</Text>
                  <View style={styles.timeBadgeActive}>
                    <Text style={styles.timeBadgeActiveText}>
                      {`${formEndHour}:${formEndMinute.toString().padStart(2, '0')} ${formEndPeriod}`}
                    </Text>
                  </View>
                </View>

                {/* Quick Duration Presets */}
                <View style={{ marginBottom: 8 }}>
                  <Text style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>Quick Duration:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                    {[
                      { label: '+45 min', mins: 45 },
                      { label: '+50 min', mins: 50 },
                      { label: '+1 Hour', mins: 60 },
                      { label: '+1.5 Hours', mins: 90 },
                      { label: '+2 Hours', mins: 120 },
                    ].map((item) => (
                      <TouchableOpacity
                        key={item.label}
                        onPress={() => handleQuickDuration(item.mins)}
                        style={styles.durationPill}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#818CF8' }}>{item.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                <View style={styles.stepperRow}>
                  <View style={styles.stepperGroup}>
                    <Text style={styles.stepperLabel}>Hour:</Text>
                    <TouchableOpacity onPress={() => incrementEndHour(-1)} style={styles.stepperBtn}>
                      <Text style={styles.stepperBtnText}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.stepperValue}>{formEndHour}</Text>
                    <TouchableOpacity onPress={() => incrementEndHour(1)} style={styles.stepperBtn}>
                      <Text style={styles.stepperBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.stepperGroup}>
                    <Text style={styles.stepperLabel}>Min:</Text>
                    <TouchableOpacity onPress={() => incrementEndMinute(-5)} style={styles.stepperBtn}>
                      <Text style={styles.stepperBtnText}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.stepperValue}>
                      {formEndMinute.toString().padStart(2, '0')}
                    </Text>
                    <TouchableOpacity onPress={() => incrementEndMinute(5)} style={styles.stepperBtn}>
                      <Text style={styles.stepperBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.amPmToggle}>
                    <TouchableOpacity
                      onPress={() => handleUpdateEndTime(formEndHour, formEndMinute, 'AM')}
                      style={[styles.amPmBtn, formEndPeriod === 'AM' && { backgroundColor: '#6366F1' }]}>
                      <Text style={{ color: formEndPeriod === 'AM' ? '#FFF' : '#94A3B8', fontWeight: '800', fontSize: 11 }}>AM</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleUpdateEndTime(formEndHour, formEndMinute, 'PM')}
                      style={[styles.amPmBtn, formEndPeriod === 'PM' && { backgroundColor: '#6366F1' }]}>
                      <Text style={{ color: formEndPeriod === 'PM' ? '#FFF' : '#94A3B8', fontWeight: '800', fontSize: 11 }}>PM</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Room & Building */}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formFieldLabel}>Room / Hall</Text>
                  <TextInput
                    placeholder="e.g. B-204"
                    placeholderTextColor="#64748B"
                    value={formRoom}
                    onChangeText={setFormRoom}
                    style={styles.formTextInput}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formFieldLabel}>Building / Block</Text>
                  <TextInput
                    placeholder="e.g. Science Block"
                    placeholderTextColor="#64748B"
                    value={formBuilding}
                    onChangeText={setFormBuilding}
                    style={styles.formTextInput}
                  />
                </View>
              </View>

              {/* Professor Name */}
              <Text style={[styles.formFieldLabel, { marginTop: 10 }]}>Teacher / Professor</Text>
              <TextInput
                placeholder="e.g. Dr. Sk Jha"
                placeholderTextColor="#64748B"
                value={formProfessor}
                onChangeText={setFormProfessor}
                style={styles.formTextInput}
              />

              {/* Online Lecture Toggle */}
              <View style={styles.formToggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', fontSize: 13, color: '#FFFFFF' }}>Online / Virtual Lecture</Text>
                  <Text style={{ fontSize: 11, color: '#94A3B8' }}>Attach Zoom, Google Meet or Teams link</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setFormIsOnline(!formIsOnline)}
                  style={[
                    styles.formToggleSwitch,
                    { backgroundColor: formIsOnline ? '#6366F1' : '#334155' },
                  ]}>
                  <View
                    style={[
                      styles.formToggleKnob,
                      formIsOnline ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' },
                    ]}
                  />
                </TouchableOpacity>
              </View>

              {formIsOnline ? (
                <View style={{ marginTop: 6 }}>
                  <Text style={styles.formFieldLabel}>Meeting URL</Text>
                  <TextInput
                    placeholder="https://meet.google.com/..."
                    placeholderTextColor="#64748B"
                    value={formVirtualUrl}
                    onChangeText={setFormVirtualUrl}
                    keyboardType="url"
                    autoCapitalize="none"
                    style={styles.formTextInput}
                  />
                </View>
              ) : null}

              {/* Notification Alarm */}
              <Text style={[styles.formFieldLabel, { marginTop: 10 }]}>Notification Alarm</Text>
              <View style={styles.reminderButtonsRow}>
                {[5, 10, 15, 30, 60].map((mins) => {
                  const isCur = formReminderMinutes === mins;
                  return (
                    <TouchableOpacity
                      key={mins}
                      onPress={() => setFormReminderMinutes(mins)}
                      style={[
                        styles.reminderBtn,
                        { backgroundColor: isCur ? '#6366F1' : '#1E293B' },
                      ]}>
                      <Text style={{ color: isCur ? '#FFF' : '#94A3B8', fontSize: 12, fontWeight: '700' }}>
                        {mins}m
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Term Dates (With Presets to avoid manual typing mistakes) */}
              <View style={{ marginTop: 10 }}>
                <Text style={styles.formFieldLabel}>Term Schedule Range (Optional)</Text>
                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
                  <TouchableOpacity
                    onPress={() => {
                      setFormStartDate('');
                      setFormEndDate('');
                    }}
                    style={[styles.durationPill, !formStartDate && !formEndDate && { borderColor: '#6366F1' }]}>
                    <Text style={{ fontSize: 11, color: '#A5B4FC', fontWeight: '700' }}>Whole Year</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setFormStartDate('2026-08-01');
                      setFormEndDate('2026-12-15');
                    }}
                    style={styles.durationPill}>
                    <Text style={{ fontSize: 11, color: '#A5B4FC', fontWeight: '700' }}>Aug - Dec Sem</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setFormStartDate('2027-01-10');
                      setFormEndDate('2027-05-30');
                    }}
                    style={styles.durationPill}>
                    <Text style={{ fontSize: 11, color: '#A5B4FC', fontWeight: '700' }}>Jan - May Sem</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <TextInput
                      placeholder="Start (YYYY-MM-DD)"
                      placeholderTextColor="#64748B"
                      value={formStartDate}
                      onChangeText={setFormStartDate}
                      style={styles.formTextInput}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <TextInput
                      placeholder="End (YYYY-MM-DD)"
                      placeholderTextColor="#64748B"
                      value={formEndDate}
                      onChangeText={setFormEndDate}
                      style={styles.formTextInput}
                    />
                  </View>
                </View>
              </View>

              {/* Save Button */}
              <TouchableOpacity
                onPress={handleSave}
                disabled={isSaving}
                activeOpacity={0.85}
                style={styles.formSaveBtn}>
                <Text style={styles.formSaveBtnText}>
                  {isSaving
                    ? 'Saving...'
                    : editingEntry
                    ? 'Save Changes'
                    : `Save ${formDays.length > 1 ? `${formDays.length} Classes` : 'Class'}`}
                </Text>
              </TouchableOpacity>
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
    backgroundColor: '#090D16',
    paddingHorizontal: 14,
  },

  // 1. Top Header
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 8,
  },
  circleIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#131927',
    borderWidth: 1,
    borderColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleIconText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  headerCenter: {
    alignItems: 'center',
  },
  capTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  capGlowWrapper: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#1E1B4B',
    borderWidth: 1,
    borderColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  headerSubtitleText: {
    color: '#818CF8',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },

  // 2. View Toggle Switch
  viewToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#111726',
    borderRadius: 24,
    padding: 3,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  viewToggleTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 20,
  },
  viewToggleTabActive: {
    backgroundColor: '#6366F1',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  viewToggleTabInactive: {
    backgroundColor: 'transparent',
  },
  viewToggleTabText: {
    fontSize: 13,
    fontWeight: '700',
  },
  viewToggleTextActive: {
    color: '#FFFFFF',
  },
  viewToggleTextInactive: {
    color: '#94A3B8',
  },

  // 3. 7-Day Date Selector Strip
  weekStripWrapper: {
    marginVertical: 4,
  },
  weekStripScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  dayCard: {
    width: 46,
    height: 64,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  dayCardActive: {
    backgroundColor: '#1E1B4B',
    borderColor: '#818CF8',
    borderWidth: 1.5,
    shadowColor: '#818CF8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 4,
  },
  dayCardInactive: {
    backgroundColor: '#111726',
    borderColor: '#1E293B',
  },
  dayCardName: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  dayCardNameActive: {
    color: '#A5B4FC',
  },
  dayCardNameInactive: {
    color: '#64748B',
  },
  dayCardNumber: {
    fontSize: 16,
    fontWeight: '800',
  },
  dayCardNumberActive: {
    color: '#FFFFFF',
  },
  dayCardNumberInactive: {
    color: '#CBD5E1',
  },
  dayActiveDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#818CF8',
    marginTop: 3,
  },

  // 4. Hero Banner ("Next Class in" / Countdown)
  heroBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#12132C',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: '#6366F1',
    marginVertical: 6,
  },
  heroClockBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  heroCountdownBlock: {
    justifyContent: 'center',
  },
  heroCountdownLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroCountdownValue: {
    fontSize: 17,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  heroDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#334155',
    marginHorizontal: 12,
  },
  heroSubjectBlock: {
    flex: 1,
    justifyContent: 'center',
  },
  heroSubjectName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  heroSubjectTime: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  heroArrowBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  heroArrowText: {
    color: '#A5B4FC',
    fontSize: 16,
    fontWeight: '800',
  },

  // 5. Section Header ("Wednesday, 5 Nov 2026" & "3 Classes")
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 4,
  },
  sectionHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  classCountBadge: {
    backgroundColor: '#1E1B4B',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4338CA',
  },
  classCountBadgeText: {
    color: '#A5B4FC',
    fontSize: 11,
    fontWeight: '700',
  },

  // Filter Bar
  filterBarContainer: {
    marginVertical: 4,
  },
  filterBarScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  filterPillActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  filterPillInactive: {
    backgroundColor: '#111726',
    borderColor: '#1E293B',
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  filterPillTextInactive: {
    color: '#94A3B8',
  },
  filterDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },

  // 6. Class Schedule List & Cards
  classesListContent: {
    paddingBottom: 90,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 8,
  },
  emptySubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 20,
  },
  classCardWrapper: {
    backgroundColor: '#101625',
    borderRadius: 14,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 12,
    marginBottom: 8,
  },
  classCardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  subjectIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subjectIconText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  classMainInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  subjectTitleText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  teacherRoomRow: {
    marginTop: 2,
    marginBottom: 4,
  },
  teacherRoomText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  liveNowPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#064E3B',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 4,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  liveNowPillText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '800',
  },
  reminderPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#78350F25',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B4530940',
  },
  reminderPillText: {
    color: '#F59E0B',
    fontSize: 10,
    fontWeight: '700',
  },
  classCardRightCol: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  classTimeText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
    marginBottom: 8,
  },
  studyNowButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  studyNowButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  viewDetailsButton: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  viewDetailsButtonText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700',
  },
  cardAttendanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    marginTop: 8,
    paddingTop: 8,
    gap: 6,
  },
  cardAttendanceLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    marginRight: 2,
  },
  cardAttBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  cardAttBtnInactive: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  cardAttBtnPresentActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  cardAttBtnAbsentActive: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
  cardAttBtnLateActive: {
    backgroundColor: '#F59E0B',
    borderColor: '#F59E0B',
  },
  cardAttBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#CBD5E1',
  },
  cardActionIconBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },

  // 7. Attendance Overview Widget
  attendanceOverviewCardWrapper: {
    marginTop: 8,
    marginBottom: 16,
  },
  attendanceOverviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  attendanceOverviewTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  attendanceOverviewFilterPill: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  attendanceOverviewFilterText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  attendanceOverviewContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#101625',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
    justifyContent: 'space-between',
  },
  donutGauge: {
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0B0F19',
  },
  donutPercentageText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  attendanceStatsColumn: {
    flex: 1,
    paddingHorizontal: 12,
    gap: 4,
  },
  statLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
    flex: 1,
  },
  statValue: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  trophyWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 4,
  },
  trophyTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F59E0B',
    marginTop: 2,
  },
  trophySubtitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F59E0B',
  },
  trophyUnderline: {
    width: 48,
    height: 2,
    backgroundColor: '#8B5CF6',
    borderRadius: 1,
    marginTop: 3,
  },

  // 8. Floating Add Button
  floatingAddButton: {
    position: 'absolute',
    bottom: 20,
    right: 18,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366F1',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 6,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 99,
  },
  floatingAddIcon: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 20,
  },
  floatingAddText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalHeaderTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  modalHeaderSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  modalCloseIcon: {
    fontSize: 20,
    color: '#94A3B8',
    fontWeight: '700',
    padding: 4,
  },
  overallAnalyticsCard: {
    backgroundColor: '#1E293B',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  overallAnalyticsLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  overallAnalyticsValue: {
    fontSize: 32,
    fontWeight: '900',
    marginVertical: 4,
  },
  overallAnalyticsSubtext: {
    fontSize: 12,
    color: '#94A3B8',
  },
  subBreakdownCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  subPercentageBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },

  // Form styles
  formScroll: {
    gap: 8,
  },
  formConflictBanner: {
    backgroundColor: '#EF444420',
    borderWidth: 1,
    borderColor: '#EF4444',
    padding: 8,
    borderRadius: 8,
  },
  formConflictText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '700',
  },
  formFieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 4,
  },
  formFieldLabelNoMargin: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  formSubjectPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  formSubjectPillInactive: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  formDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
    marginBottom: 8,
  },
  formDayBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  formTimeContainer: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  formTimeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  timeBadgeActive: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  timeBadgeActiveText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepperGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepperLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginRight: 4,
  },
  stepperBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 18,
  },
  stepperValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    paddingHorizontal: 8,
    minWidth: 26,
    textAlign: 'center',
  },
  amPmToggle: {
    flexDirection: 'row',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
  },
  amPmBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  durationPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0F172A',
  },
  formTextInput: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#334155',
  },
  formToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    padding: 10,
    borderRadius: 10,
    marginTop: 8,
  },
  formToggleSwitch: {
    width: 42,
    height: 22,
    borderRadius: 11,
    padding: 2,
    justifyContent: 'center',
  },
  formToggleKnob: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
  },
  reminderButtonsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  reminderBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: 8,
  },
  formSaveBtn: {
    backgroundColor: '#6366F1',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 20,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  formSaveBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
});
