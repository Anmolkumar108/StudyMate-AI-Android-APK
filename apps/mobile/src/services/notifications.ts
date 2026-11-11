import type * as NotificationsType from 'expo-notifications';

export interface TaskReminderOptions {
  taskId: string;
  taskTitle: string;
  dueDateTime: string | Date;
  reminderOffsetMinutes?: number; // e.g. 0 = exact time, 15 = 15m before, 120 = 2h before, 1440 = 24h before
  ignoreQuietHours?: boolean;
}

export interface ScheduledReminderRecord {
  identifier: string;
  title: string;
  body: string;
  triggerDate: Date;
  channelId?: string;
  taskId?: string;
  data?: Record<string, unknown>;
}

export interface NotificationPreferences {
  pushNotificationsEnabled: boolean;
  classRemindersEnabled: boolean;
  classReminderAdvanceMinutes: number; // 10, 15, 30
  taskDeadlinesEnabled: boolean;
  task24hReminderEnabled: boolean;
  task2hReminderEnabled: boolean;
  streakRemindersEnabled: boolean;
  streakReminderTime: string; // e.g. "19:00"
  examAlertsEnabled: boolean;
  exam3dReminderEnabled: boolean;
  exam1dReminderEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string; // "22:00"
  quietHoursEnd: string; // "07:00"
  soundEnabled: boolean;
  vibrateEnabled: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  pushNotificationsEnabled: true,
  classRemindersEnabled: true,
  classReminderAdvanceMinutes: 15,
  taskDeadlinesEnabled: true,
  task24hReminderEnabled: true,
  task2hReminderEnabled: true,
  streakRemindersEnabled: true,
  streakReminderTime: '19:00',
  examAlertsEnabled: true,
  exam3dReminderEnabled: true,
  exam1dReminderEnabled: true,
  quietHoursEnabled: true,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  soundEnabled: true,
  vibrateEnabled: true,
};

export const NOTIFICATION_STORAGE_KEY = 'studymate_notification_preferences';

export interface NotificationAdapter {
  schedule(options: {
    identifier: string;
    title: string;
    body: string;
    triggerDate: Date;
    channelId?: string;
    data?: Record<string, unknown>;
  }): Promise<string>;
  cancel(identifier: string): Promise<void>;
  cancelAll(): Promise<void>;
  requestPermissions(): Promise<boolean>;
}

function getExpoNotifications(): typeof NotificationsType | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-notifications');
  } catch {
    return null;
  }
}

function getPlatformOS(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rn = require('react-native');
    return rn.Platform?.OS || 'android';
  } catch {
    return 'node';
  }
}

// In-memory adapter for unit testing and non-native environments
export const inMemoryNotificationAdapter: NotificationAdapter & {
  scheduled: Map<string, ScheduledReminderRecord>;
  clear: () => void;
} = {
  scheduled: new Map(),
  clear() {
    this.scheduled.clear();
  },
  async schedule(opts) {
    this.scheduled.set(opts.identifier, {
      identifier: opts.identifier,
      title: opts.title,
      body: opts.body,
      triggerDate: opts.triggerDate,
      channelId: opts.channelId,
      taskId: (opts.data?.taskId as string) || '',
      data: opts.data,
    });
    return opts.identifier;
  },
  async cancel(identifier: string) {
    this.scheduled.delete(identifier);
  },
  async cancelAll() {
    this.scheduled.clear();
  },
  async requestPermissions() {
    return true;
  },
};

// Native Expo notifications adapter for real Android hardware and emulator
export const nativeNotificationAdapter: NotificationAdapter = {
  async schedule(opts) {
    const notif = getExpoNotifications();
    if (!notif) return opts.identifier;

    const channelId = opts.channelId || 'task-deadlines';
    const isImmediate = opts.triggerDate.getTime() <= Date.now() + 1000;

    const trigger = isImmediate
      ? {
          type: notif.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 1,
          channelId,
        }
      : {
          type: notif.SchedulableTriggerInputTypes.DATE,
          date: opts.triggerDate,
          channelId,
        };

    return await notif.scheduleNotificationAsync({
      identifier: opts.identifier,
      content: {
        title: opts.title,
        body: opts.body,
        data: opts.data,
        sound: 'default',
      },
      trigger: trigger as any,
    });
  },
  async cancel(identifier: string) {
    const notif = getExpoNotifications();
    if (notif) {
      await notif.cancelScheduledNotificationAsync(identifier);
    }
  },
  async cancelAll() {
    const notif = getExpoNotifications();
    if (notif) {
      await notif.cancelAllScheduledNotificationsAsync();
    }
  },
  async requestPermissions() {
    const notif = getExpoNotifications();
    if (!notif) return true;

    if (getPlatformOS() === 'android') {
      try {
        // 1. Class Routine & Lecture Alerts
        await notif.setNotificationChannelAsync('class-reminders', {
          name: 'Class & Lecture Alerts',
          description: 'Upcoming university lectures and routine reminders',
          importance: notif.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#38BDF8',
          sound: 'default',
          enableVibrate: true,
          showBadge: true,
        });

        // 2. Assignment & Task Deadlines
        await notif.setNotificationChannelAsync('task-deadlines', {
          name: 'Assignment & Task Reminders',
          description: 'Homework deadlines and task alerts',
          importance: notif.AndroidImportance.MAX,
          vibrationPattern: [0, 300, 200, 300],
          lightColor: '#F59E0B',
          sound: 'default',
          enableVibrate: true,
          showBadge: true,
        });

        // 3. Daily Study & Streak Reminders
        await notif.setNotificationChannelAsync('streak-reminders', {
          name: 'Daily Study & Streak Alerts',
          description: 'Daily consistency and study streak protection',
          importance: notif.AndroidImportance.HIGH,
          vibrationPattern: [0, 200, 100, 200],
          lightColor: '#10B981',
          sound: 'default',
          enableVibrate: true,
          showBadge: true,
        });

        // 4. Exam Countdown Milestones
        await notif.setNotificationChannelAsync('exam-alerts', {
          name: 'Exam Countdown Milestones',
          description: 'Milestone notifications for upcoming semester exams',
          importance: notif.AndroidImportance.MAX,
          vibrationPattern: [0, 400, 200, 400],
          lightColor: '#F43F5E',
          sound: 'default',
          enableVibrate: true,
          showBadge: true,
        });

        // 5. Pomodoro Timer Alerts
        await notif.setNotificationChannelAsync('pomodoro-alerts', {
          name: 'Pomodoro Timer Alerts',
          description: 'Focus timer completion and break intervals',
          importance: notif.AndroidImportance.DEFAULT,
          lightColor: '#8B5CF6',
          sound: 'default',
          showBadge: true,
        });

        // 6. University & System Broadcast Announcements
        await notif.setNotificationChannelAsync('system-announcements', {
          name: 'System Announcements',
          description: 'Important platform broadcast notifications',
          importance: notif.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#6366F1',
          sound: 'default',
          enableVibrate: true,
          showBadge: true,
        });

        // 7. Background FCM Timetable & Deadline Channels
        await notif.setNotificationChannelAsync('timetable-alerts', {
          name: 'Timetable Alerts (FCM)',
          description: 'Background class routine and lecture start alerts',
          importance: notif.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#38BDF8',
          sound: 'default',
          enableVibrate: true,
          showBadge: true,
        });

        await notif.setNotificationChannelAsync('deadline-reminders', {
          name: 'Deadline Reminders (FCM)',
          description: 'Critical assignment deadlines and submission alerts',
          importance: notif.AndroidImportance.MAX,
          vibrationPattern: [0, 300, 200, 300],
          lightColor: '#F59E0B',
          sound: 'default',
          enableVibrate: true,
          showBadge: true,
        });
      } catch (err) {
        console.warn('[Notifications] Channel setup error:', err);
      }
    }

    try {
      const { status: existingStatus } = await notif.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await notif.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus === 'granted') {
        try {
          let token: string | null = null;
          if (typeof notif.getExpoPushTokenAsync === 'function') {
            const tokenRes = await notif.getExpoPushTokenAsync();
            token = tokenRes.data;
          } else if (typeof notif.getDevicePushTokenAsync === 'function') {
            const tokenRes = await notif.getDevicePushTokenAsync();
            token = tokenRes.data;
          }

          if (token) {
            // Register token with backend for background FCM notifications
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { userSecurityApi } = require('./api/client');
            await userSecurityApi.registerPushToken(token, getPlatformOS());
          }
        } catch (tokenErr) {
          // Push token registration non-blocking on emulators or dev clients
          console.log('[Notifications] Push token notice:', tokenErr);
        }
      }

      return finalStatus === 'granted';
    } catch (err) {
      console.warn('[Notifications] Permission check error:', err);
      return false;
    }
  },
};

// Active adapter: test env uses inMemory, Android native uses nativeNotificationAdapter
let activeAdapter: NotificationAdapter =
  typeof process !== 'undefined' && process.env?.NODE_ENV === 'test'
    ? inMemoryNotificationAdapter
    : nativeNotificationAdapter;

export function setNotificationAdapter(adapter: NotificationAdapter) {
  activeAdapter = adapter;
}

export function resetNotificationAdapter() {
  activeAdapter =
    typeof process !== 'undefined' && process.env?.NODE_ENV === 'test'
      ? inMemoryNotificationAdapter
      : nativeNotificationAdapter;
}

// Configure foreground banner behavior on Android/Expo
try {
  const notif = getExpoNotifications();
  if (notif?.setNotificationHandler) {
    notif.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  }
} catch {
  // Silent fallback
}

/**
 * Initializes notification channels and requests Android POST_NOTIFICATIONS permission.
 */
export async function registerForPushNotificationsAsync(): Promise<boolean> {
  try {
    return await activeAdapter.requestPermissions();
  } catch (error) {
    console.warn('[Notifications] Failed to register push channels:', error);
    return false;
  }
}

let memoryPrefs: NotificationPreferences = { ...DEFAULT_NOTIFICATION_PREFERENCES };

export function resetNotificationPreferencesForTest(): void {
  memoryPrefs = { ...DEFAULT_NOTIFICATION_PREFERENCES };
}

export function setNotificationPreferencesForTest(prefs: Partial<NotificationPreferences>): void {
  memoryPrefs = { ...memoryPrefs, ...prefs };
}

/**
 * Preferences Storage Helper (MMKV/SecureStore)
 */
export async function loadNotificationPreferences(): Promise<NotificationPreferences> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SecureStore = require('expo-secure-store');
    if (SecureStore && typeof SecureStore.getItemAsync === 'function') {
      const raw = await SecureStore.getItemAsync(NOTIFICATION_STORAGE_KEY);
      if (raw) {
        memoryPrefs = { ...DEFAULT_NOTIFICATION_PREFERENCES, ...JSON.parse(raw) };
        return memoryPrefs;
      }
    }
  } catch {
    // Fallback
  }
  return memoryPrefs;
}

export async function saveNotificationPreferences(
  updates: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  const current = await loadNotificationPreferences();
  const merged: NotificationPreferences = { ...current, ...updates };
  memoryPrefs = merged;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SecureStore = require('expo-secure-store');
    if (SecureStore && typeof SecureStore.setItemAsync === 'function') {
      await SecureStore.setItemAsync(NOTIFICATION_STORAGE_KEY, JSON.stringify(merged));
    }
  } catch {
    // Fallback
  }
  return merged;
}

/**
 * Checks if a target trigger date falls within the student's configured Quiet Hours.
 */
export function isWithinQuietHours(
  targetDate: Date,
  prefs: NotificationPreferences = DEFAULT_NOTIFICATION_PREFERENCES
): boolean {
  if (!prefs.quietHoursEnabled || !prefs.quietHoursStart || !prefs.quietHoursEnd) {
    return false;
  }

  const [startH, startM] = prefs.quietHoursStart.split(':').map((p) => parseInt(p, 10));
  const [endH, endM] = prefs.quietHoursEnd.split(':').map((p) => parseInt(p, 10));

  const targetMinutes = targetDate.getHours() * 60 + targetDate.getMinutes();
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes <= endMinutes) {
    return targetMinutes >= startMinutes && targetMinutes < endMinutes;
  }
  // Overnight span (e.g. 22:00 to 07:00)
  return targetMinutes >= startMinutes || targetMinutes < endMinutes;
}

/**
 * Schedules a local notification for a task deadline.
 */
export async function scheduleTaskReminder({
  taskId,
  taskTitle,
  dueDateTime,
  reminderOffsetMinutes = 0,
  ignoreQuietHours = false,
}: TaskReminderOptions): Promise<string | null> {
  try {
    const prefs = await loadNotificationPreferences();
    if (!prefs.pushNotificationsEnabled || !prefs.taskDeadlinesEnabled) {
      return null;
    }

    const targetDate = new Date(dueDateTime);
    if (isNaN(targetDate.getTime())) {
      return null;
    }

    const triggerMs = targetDate.getTime() - reminderOffsetMinutes * 60 * 1000;
    const nowMs = Date.now();

    if (triggerMs <= nowMs) {
      return null;
    }

    const triggerDate = new Date(triggerMs);

    // If scheduled time falls in quiet hours, cancel or suppress unless ignoreQuietHours
    if (!ignoreQuietHours && isWithinQuietHours(triggerDate, prefs)) {
      return null;
    }

    await cancelTaskReminder(taskId);

    let reminderPrefix = '';
    if (reminderOffsetMinutes > 0) {
      reminderPrefix =
        reminderOffsetMinutes >= 60
          ? `[Reminder: ${Math.round(reminderOffsetMinutes / 60)} ghanta pehle] `
          : `[Reminder: ${reminderOffsetMinutes} minute pehle] `;
    }

    const title = `⏰ Task Deadline: ${taskTitle}`;
    const body = `${reminderPrefix}Aapka task complete karne ka samay jo aap set kiye the ho gaya hai. Kripya task ko complete kar lijiye!`;

    const identifier = `task-deadline-${taskId}`;

    return await activeAdapter.schedule({
      identifier,
      title,
      body,
      triggerDate,
      channelId: 'task-deadlines',
      data: { taskId, screen: '/tasks' },
    });
  } catch (err) {
    console.warn('[Notifications] Failed to schedule task reminder:', err);
    return null;
  }
}

/**
 * Automatically schedules multiple milestone reminders for an assignment:
 * - 24 hours before
 * - 2 hours before
 * - Exact due time
 */
export async function scheduleTaskMilestoneReminders(task: {
  id: string;
  title: string;
  due_datetime: string | Date;
}): Promise<string[]> {
  const ids: string[] = [];
  const prefs = await loadNotificationPreferences();
  if (!prefs.pushNotificationsEnabled || !prefs.taskDeadlinesEnabled) {
    return ids;
  }

  // 1. Exact due time
  const idExact = await scheduleTaskReminder({
    taskId: task.id,
    taskTitle: task.title,
    dueDateTime: task.due_datetime,
    reminderOffsetMinutes: 0,
  });
  if (idExact) ids.push(idExact);

  // 2. 2 hours before
  if (prefs.task2hReminderEnabled) {
    const id2h = await scheduleTaskReminder({
      taskId: task.id,
      taskTitle: task.title,
      dueDateTime: task.due_datetime,
      reminderOffsetMinutes: 120,
    });
    if (id2h) ids.push(id2h);
  }

  // 3. 24 hours before
  if (prefs.task24hReminderEnabled) {
    const id24h = await scheduleTaskReminder({
      taskId: task.id,
      taskTitle: task.title,
      dueDateTime: task.due_datetime,
      reminderOffsetMinutes: 1440,
    });
    if (id24h) ids.push(id24h);
  }

  return ids;
}

export async function cancelTaskReminder(taskId: string): Promise<void> {
  try {
    await activeAdapter.cancel(`task-deadline-${taskId}-0`);
    await activeAdapter.cancel(`task-deadline-${taskId}-120`);
    await activeAdapter.cancel(`task-deadline-${taskId}-1440`);
    await activeAdapter.cancel(`task-deadline-${taskId}`);
  } catch (err) {
    console.warn('[Notifications] Failed to cancel task reminder:', err);
  }
}

export async function snoozeTaskReminder(
  taskId: string,
  taskTitle: string,
  snoozeMinutes = 10
): Promise<string | null> {
  try {
    await cancelTaskReminder(taskId);
    const triggerDate = new Date(Date.now() + snoozeMinutes * 60 * 1000);
    const title = `⏰ Snoozed: ${taskTitle}`;
    const body = `Reminder snoozed for ${snoozeMinutes} minute. Kripya task ko complete kar lijiye!`;

    return await activeAdapter.schedule({
      identifier: `task-deadline-${taskId}-snooze`,
      title,
      body,
      triggerDate,
      channelId: 'task-deadlines',
      data: { taskId, screen: '/tasks', snoozed: true },
    });
  } catch (err) {
    console.warn('[Notifications] Failed to snooze task reminder:', err);
    return null;
  }
}

/**
 * Calculates next upcoming occurrence of a weekly timetable class reminder.
 */
export function getNextClassReminderDate(
  dayOfWeek: number, // 1=Mon ... 7=Sun
  startTimeStr: string, // "09:30" or "09:30:00"
  reminderMinutesBefore = 15,
  referenceDate = new Date()
): Date {
  const parts = startTimeStr.split(':').map((p) => parseInt(p, 10));
  const startHour = parts[0] || 0;
  const startMinute = parts[1] || 0;

  const currentJsDay = referenceDate.getDay();
  const currentIsoDay = currentJsDay === 0 ? 7 : currentJsDay;

  let daysAhead = dayOfWeek - currentIsoDay;

  const targetDate = new Date(referenceDate.getTime());
  targetDate.setDate(referenceDate.getDate() + daysAhead);
  targetDate.setHours(startHour, startMinute, 0, 0);

  // If the target day is in the past this week, or if today's class has already ended:
  if (daysAhead < 0 || (daysAhead === 0 && targetDate.getTime() <= referenceDate.getTime())) {
    targetDate.setDate(targetDate.getDate() + 7);
  }

  const reminderDate = new Date(targetDate.getTime() - reminderMinutesBefore * 60 * 1000);

  // If the class is upcoming today (within the reminder advance window, e.g. class in 5 mins):
  // trigger in 2 seconds so the student gets the alert right now!
  if (reminderDate.getTime() <= referenceDate.getTime() && targetDate.getTime() > referenceDate.getTime()) {
    return new Date(referenceDate.getTime() + 2000);
  }

  return reminderDate;
}

/**
 * Schedules a class routine reminder.
 */
export async function scheduleClassReminder(entry: {
  id: string;
  day_of_week: number;
  start_time: string;
  subject_name?: string | null;
  room?: string | null;
  is_online?: boolean;
  reminder_minutes_before?: number;
}): Promise<string | null> {
  try {
    const prefs = await loadNotificationPreferences();
    if (!prefs.pushNotificationsEnabled || !prefs.classRemindersEnabled) {
      return null;
    }

    const reminderMinutes =
      entry.reminder_minutes_before ?? prefs.classReminderAdvanceMinutes ?? 15;
    const triggerDate = getNextClassReminderDate(
      entry.day_of_week,
      entry.start_time,
      reminderMinutes
    );

    if (isWithinQuietHours(triggerDate, prefs)) {
      return null;
    }

    const identifier = `class-reminder-${entry.id}`;
    const subjectName = entry.subject_name || 'Class';
    const timeFormatted = entry.start_time.slice(0, 5);
    const locationStr = entry.is_online ? '(Online Class)' : entry.room ? `in Room ${entry.room}` : '';

    const isStartingVerySoon = triggerDate.getTime() - Date.now() <= 10000;
    const title = `🔔 Class Starting Soon: ${subjectName}`;
    const body = isStartingVerySoon
      ? `Starts in ${reminderMinutes} minutes (Class starting soon at ${timeFormatted} ${locationStr}). Get your notes ready!`
      : `Starts in ${reminderMinutes} minutes at ${timeFormatted} ${locationStr}. Get your notes ready!`;

    await activeAdapter.schedule({
      identifier,
      title,
      body,
      triggerDate,
      channelId: 'class-reminders',
      data: { timetableId: entry.id, screen: '/timetable' },
    });

    return identifier;
  } catch (err) {
    console.warn('[Notifications] Failed to schedule class reminder:', err);
    return null;
  }
}

export async function cancelClassReminder(entryId: string): Promise<void> {
  try {
    await activeAdapter.cancel(`class-reminder-${entryId}`);
  } catch (err) {
    console.warn('[Notifications] Failed to cancel class reminder:', err);
  }
}

/**
 * Schedules a Daily Study Habit & Streak Protection Reminder.
 * Triggers at the user's preferred time (e.g. 19:00 / 7:00 PM).
 */
export async function scheduleDailyStreakReminder(currentStreak = 1): Promise<string | null> {
  try {
    const prefs = await loadNotificationPreferences();
    if (!prefs.pushNotificationsEnabled || !prefs.streakRemindersEnabled) {
      return null;
    }

    const [hour, minute] = (prefs.streakReminderTime || '19:00')
      .split(':')
      .map((p) => parseInt(p, 10));

    const now = new Date();
    const triggerDate = new Date();
    triggerDate.setHours(hour || 19, minute || 0, 0, 0);

    // If today's time has already passed, schedule for tomorrow
    if (triggerDate.getTime() <= now.getTime()) {
      triggerDate.setDate(triggerDate.getDate() + 1);
    }

    const identifier = 'daily-streak-reminder';
    await activeAdapter.cancel(identifier);

    const title = `🔥 Protect Your ${currentStreak || 3}-Day Study Streak!`;
    const body = `A quick 25-minute Pomodoro focus session today will keep your momentum strong. Tap to start studying!`;

    return await activeAdapter.schedule({
      identifier,
      title,
      body,
      triggerDate,
      channelId: 'streak-reminders',
      data: { screen: '/' },
    });
  } catch (err) {
    console.warn('[Notifications] Failed to schedule streak reminder:', err);
    return null;
  }
}

/**
 * Schedules milestone countdown reminders for an upcoming exam:
 * - 3 days before
 * - 1 day before (eve of the exam)
 */
export async function scheduleExamReminders(exam: {
  id: string;
  title: string;
  exam_date: string | Date;
  location?: string | null;
  subject_name?: string | null;
}): Promise<string[]> {
  const ids: string[] = [];
  try {
    const prefs = await loadNotificationPreferences();
    if (!prefs.pushNotificationsEnabled || !prefs.examAlertsEnabled) {
      return ids;
    }

    const examDate = new Date(exam.exam_date);
    if (isNaN(examDate.getTime())) return ids;

    const nowMs = Date.now();

    // 1. 3 Days before exam
    if (prefs.exam3dReminderEnabled) {
      const trigger3d = new Date(examDate.getTime() - 3 * 86400 * 1000);
      trigger3d.setHours(10, 0, 0, 0); // 10:00 AM
      if (trigger3d.getTime() > nowMs && !isWithinQuietHours(trigger3d, prefs)) {
        const id = await activeAdapter.schedule({
          identifier: `exam-reminder-${exam.id}-3d`,
          title: `🎯 Exam in 3 Days: ${exam.title}`,
          body: `Scheduled for ${examDate.toLocaleDateString()}. Make sure to review your flashcards and key notes!`,
          triggerDate: trigger3d,
          channelId: 'exam-alerts',
          data: { examId: exam.id, screen: '/exams' },
        });
        ids.push(id);
      }
    }

    // 2. 1 Day before exam
    if (prefs.exam1dReminderEnabled) {
      const trigger1d = new Date(examDate.getTime() - 1 * 86400 * 1000);
      trigger1d.setHours(18, 0, 0, 0); // 6:00 PM
      if (trigger1d.getTime() > nowMs && !isWithinQuietHours(trigger1d, prefs)) {
        const id = await activeAdapter.schedule({
          identifier: `exam-reminder-${exam.id}-1d`,
          title: `⚡ Tomorrow: ${exam.title} Exam!`,
          body: `Exam is tomorrow${exam.location ? ` in ${exam.location}` : ''}. Rest well and do a light summary review tonight.`,
          triggerDate: trigger1d,
          channelId: 'exam-alerts',
          data: { examId: exam.id, screen: '/exams' },
        });
        ids.push(id);
      }
    }
  } catch (err) {
    console.warn('[Notifications] Failed to schedule exam reminder:', err);
  }
  return ids;
}

/**
 * Sends an IMMEDIATE real notification banner to test sounds, channels, and alerts on Android!
 */
export async function sendTestNotification(
  type: 'general' | 'class' | 'task' | 'streak' | 'exam' = 'general'
): Promise<void> {
  const granted = await activeAdapter.requestPermissions();
  if (!granted) {
    throw new Error('PERMISSION_NOT_GRANTED');
  }

  let title = '🎓 StudyMate AI Alert';
  let body = 'Real push notifications and reminders are active and working!';
  let channelId = 'task-deadlines';
  let data: Record<string, unknown> = { screen: '/' };

  switch (type) {
    case 'class':
      title = '🔔 Class Alert: Web Development';
      body = 'Class starts in 15 minutes in Room B-204 with Dr. Sk Jha. Get ready!';
      channelId = 'class-reminders';
      data = { screen: '/timetable' };
      break;
    case 'task':
      title = '⏰ Task Reminder: Algorithms Assignment';
      body = 'Aapka task complete karne ka samay ho gaya hai. Kripya ise complete kar lijiye!';
      channelId = 'task-deadlines';
      data = { screen: '/tasks' };
      break;
    case 'streak':
      title = '🔥 3-Day Study Streak Active!';
      body = 'Keep your daily momentum alive! Complete a 25-minute Pomodoro session today.';
      channelId = 'streak-reminders';
      data = { screen: '/' };
      break;
    case 'exam':
      title = '🎯 Upcoming Exam: Data Structures & Algorithms';
      body = 'Exam in 3 days in Hall 4B. Open StudyMate to review your high-yield flashcards!';
      channelId = 'exam-alerts';
      data = { screen: '/exams' };
      break;
  }

  await activeAdapter.schedule({
    identifier: `test-immediate-${type}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    title,
    body,
    triggerDate: new Date(),
    channelId,
    data,
  });
}

/**
 * Sends an immediate test notification with arbitrary title/body (backwards-compatible).
 */
export async function sendImmediateNotification(title: string, body: string): Promise<void> {
  try {
    await activeAdapter.schedule({
      identifier: `test-alert-${Date.now()}`,
      title,
      body,
      triggerDate: new Date(),
    });
  } catch (err) {
    console.warn('[Notifications] Failed to send immediate notification:', err);
  }
}

/**
 * Cancels all scheduled reminders across all categories.
 */
export async function cancelAllReminders(): Promise<void> {
  try {
    await activeAdapter.cancelAll();
  } catch (err) {
    console.warn('[Notifications] Failed to cancel all reminders:', err);
  }
}

/**
 * Sets up notification deep-link listener when a student taps on an Android notification.
 */
export function setupNotificationResponseListener(
  navigateFn: (route: string) => void
): () => void {
  const notif = getExpoNotifications();
  if (!notif?.addNotificationResponseReceivedListener) {
    return () => {};
  }

  const subscription = notif.addNotificationResponseReceivedListener((response) => {
    try {
      const data = response.notification.request.content.data;
      if (data && typeof data.screen === 'string') {
        navigateFn(data.screen);
      }
    } catch (err) {
      console.warn('[Notifications] Error handling deep link:', err);
    }
  });

  return () => {
    subscription.remove();
  };
}
