import type * as NotificationsType from 'expo-notifications';

export interface TaskReminderOptions {
  taskId: string;
  taskTitle: string;
  dueDateTime: string | Date;
  reminderOffsetMinutes?: number; // e.g. 0 = exact time, 15 = 15m before, 60 = 1h before
}

export interface ScheduledReminderRecord {
  identifier: string;
  title: string;
  body: string;
  triggerDate: Date;
  taskId: string;
}

export interface NotificationAdapter {
  schedule(options: {
    identifier: string;
    title: string;
    body: string;
    triggerDate: Date;
    data?: Record<string, unknown>;
  }): Promise<string>;
  cancel(identifier: string): Promise<void>;
  requestPermissions(): Promise<boolean>;
}

function getExpoNotifications(): typeof NotificationsType | null {
  try {
    return require('expo-notifications');
  } catch {
    return null;
  }
}

function getPlatformOS(): string {
  try {
    const rn = require('react-native');
    return rn.Platform?.OS || 'android';
  } catch {
    return 'node';
  }
}

// In-memory adapter for test and non-native environments
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
      taskId: (opts.data?.taskId as string) || '',
    });
    return opts.identifier;
  },
  async cancel(identifier: string) {
    this.scheduled.delete(identifier);
  },
  async requestPermissions() {
    return true;
  },
};

// Native Expo notifications adapter
export const nativeNotificationAdapter: NotificationAdapter = {
  async schedule(opts) {
    const notif = getExpoNotifications();
    if (!notif) return opts.identifier;
    return await notif.scheduleNotificationAsync({
      identifier: opts.identifier,
      content: {
        title: opts.title,
        body: opts.body,
        data: opts.data,
        sound: 'default',
      },
      trigger: {
        type: notif.SchedulableTriggerInputTypes.DATE,
        date: opts.triggerDate,
        channelId: 'task-reminders',
      },
    });
  },
  async cancel(identifier: string) {
    const notif = getExpoNotifications();
    if (notif) {
      await notif.cancelScheduledNotificationAsync(identifier);
    }
  },
  async requestPermissions() {
    const notif = getExpoNotifications();
    if (!notif) return true;
    if (getPlatformOS() === 'android') {
      await notif.setNotificationChannelAsync('task-reminders', {
        name: 'Task Deadlines & Reminders',
        importance: notif.AndroidImportance.MAX,
        vibrationPattern: [0, 300, 200, 300],
        lightColor: '#6366F1',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });
    }

    const { status: existingStatus } = await notif.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await notif.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === 'granted';
  },
};

// Active adapter: detect if running in Node test environment or native device
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

// Configure foreground handler safely on native runtimes
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
 * Initializes notification channels and requests permissions on Android.
 */
export async function registerForPushNotificationsAsync(): Promise<boolean> {
  try {
    return await activeAdapter.requestPermissions();
  } catch (error) {
    console.warn('[Notifications] Failed to register push channels:', error);
    return false;
  }
}

/**
 * Schedules a local alarm notification for a task deadline.
 * Sends the Hindi message requested by the user:
 * "Aapka task complete karne ka time jo aap set kiye the ho gaya hai. Kripya task ko complete kar lijiye!"
 */
export async function scheduleTaskReminder({
  taskId,
  taskTitle,
  dueDateTime,
  reminderOffsetMinutes = 0,
}: TaskReminderOptions): Promise<string | null> {
  try {
    const targetDate = new Date(dueDateTime);
    if (isNaN(targetDate.getTime())) {
      return null;
    }

    const triggerMs = targetDate.getTime() - reminderOffsetMinutes * 60 * 1000;
    const nowMs = Date.now();

    // If deadline has already passed, don't schedule
    if (triggerMs <= nowMs) {
      return null;
    }

    // Cancel existing reminder for this task first
    await cancelTaskReminder(taskId);

    const triggerDate = new Date(triggerMs);

    let reminderPrefix = '';
    if (reminderOffsetMinutes > 0) {
      reminderPrefix = reminderOffsetMinutes >= 60
        ? `[Reminder: ${Math.round(reminderOffsetMinutes / 60)} ghanta pehle] `
        : `[Reminder: ${reminderOffsetMinutes} minute pehle] `;
    }

    const title = `⏰ Task Deadline: ${taskTitle}`;
    const body = `${reminderPrefix}Aapka task complete karne ka samay jo aap set kiye the ho gaya hai. Kripya task ko complete kar lijiye!`;

    const identifier = await activeAdapter.schedule({
      identifier: `task-deadline-${taskId}`,
      title,
      body,
      triggerDate,
      data: { taskId, screen: '/tasks' },
    });

    return identifier;
  } catch (err) {
    console.warn('[Notifications] Failed to schedule task reminder:', err);
    return null;
  }
}

/**
 * Cancels any scheduled notification for the given task.
 */
export async function cancelTaskReminder(taskId: string): Promise<void> {
  try {
    await activeAdapter.cancel(`task-deadline-${taskId}`);
  } catch (err) {
    console.warn('[Notifications] Failed to cancel task reminder:', err);
  }
}

/**
 * Snoozes a task reminder by rescheduling it N minutes into the future.
 */
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
      identifier: `task-deadline-${taskId}`,
      title,
      body,
      triggerDate,
      data: { taskId, screen: '/tasks', snoozed: true },
    });
  } catch (err) {
    console.warn('[Notifications] Failed to snooze task reminder:', err);
    return null;
  }
}

/**
 * Sends an immediate test notification to verify sounds & alerts.
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
