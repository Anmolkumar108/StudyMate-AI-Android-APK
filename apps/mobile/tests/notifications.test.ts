import assert from 'node:assert';
import { beforeEach, describe, it } from 'node:test';

import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  cancelTaskReminder,
  inMemoryNotificationAdapter,
  isWithinQuietHours,
  registerForPushNotificationsAsync,
  resetNotificationAdapter,
  resetNotificationPreferencesForTest,
  scheduleClassReminder,
  scheduleDailyStreakReminder,
  scheduleExamReminders,
  scheduleTaskReminder,
  sendImmediateNotification,
  sendTestNotification,
  setNotificationAdapter,
  setNotificationPreferencesForTest,
} from '../src/services/notifications';

function getFutureDaytimeDate(daysAhead = 1, hour = 14): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

describe('Task Notifications & Alarm Reminders', () => {
  beforeEach(() => {
    setNotificationAdapter(inMemoryNotificationAdapter);
    inMemoryNotificationAdapter.clear();
    resetNotificationPreferencesForTest();
  });

  it('registers notification channels and permissions successfully', async () => {
    const granted = await registerForPushNotificationsAsync();
    assert.strictEqual(granted, true);
  });

  it('schedules an alarm reminder with Hindi notification body for future task', async () => {
    const futureDate = getFutureDaytimeDate(1, 14); // Tomorrow 2:00 PM (outside quiet hours)
    const result = await scheduleTaskReminder({
      taskId: 'assignment-101',
      taskTitle: 'Math Assignment 4',
      dueDateTime: futureDate,
      reminderOffsetMinutes: 0,
    });

    assert.strictEqual(result, 'task-deadline-assignment-101');
    const scheduled = inMemoryNotificationAdapter.scheduled.get('task-deadline-assignment-101');
    assert.ok(scheduled);
    assert.strictEqual(scheduled.title, '⏰ Task Deadline: Math Assignment 4');
    assert.ok(scheduled.body.includes('Aapka task complete karne ka samay jo aap set kiye the ho gaya hai'));
  });

  it('schedules reminder with offset prefix (e.g. 15 minutes before)', async () => {
    const futureDate = getFutureDaytimeDate(1, 16); // Tomorrow 4:00 PM
    const result = await scheduleTaskReminder({
      taskId: 'assignment-102',
      taskTitle: 'Physics Lab Viva',
      dueDateTime: futureDate,
      reminderOffsetMinutes: 15,
    });

    assert.strictEqual(result, 'task-deadline-assignment-102');
    const scheduled = inMemoryNotificationAdapter.scheduled.get('task-deadline-assignment-102');
    assert.ok(scheduled);
    assert.ok(scheduled.body.includes('15 minute pehle'));
  });

  it('rejects scheduling a reminder for past deadlines', async () => {
    const pastDate = new Date(Date.now() - 60000).toISOString();
    const result = await scheduleTaskReminder({
      taskId: 'past-task',
      taskTitle: 'Past Assignment',
      dueDateTime: pastDate,
      reminderOffsetMinutes: 0,
    });
    assert.strictEqual(result, null);
    assert.strictEqual(inMemoryNotificationAdapter.scheduled.size, 0);
  });

  it('handles invalid dates gracefully without throwing', async () => {
    const result = await scheduleTaskReminder({
      taskId: 'invalid-task',
      taskTitle: 'Invalid Date Task',
      dueDateTime: 'invalid-iso-string',
      reminderOffsetMinutes: 0,
    });
    assert.strictEqual(result, null);
  });

  it('cancels a scheduled reminder when completed or deleted', async () => {
    const futureDate = getFutureDaytimeDate(1, 15);
    await scheduleTaskReminder({
      taskId: 'task-to-cancel',
      taskTitle: 'Chemistry Quiz',
      dueDateTime: futureDate,
      reminderOffsetMinutes: 0,
    });

    assert.strictEqual(inMemoryNotificationAdapter.scheduled.has('task-deadline-task-to-cancel'), true);
    await cancelTaskReminder('task-to-cancel');
    assert.strictEqual(inMemoryNotificationAdapter.scheduled.has('task-deadline-task-to-cancel'), false);
  });

  it('sends immediate test notification into adapter', async () => {
    await sendImmediateNotification(
      '⏰ StudyMate Test Alert',
      'Test message delivered successfully'
    );
    assert.strictEqual(inMemoryNotificationAdapter.scheduled.size, 1);
  });

  it('schedules class routine reminder with class-reminders channel', async () => {
    const id = await scheduleClassReminder({
      id: 'class-01',
      day_of_week: 1,
      start_time: '14:30:00',
      subject_name: 'Database Systems',
      room: 'Lab 3',
      reminder_minutes_before: 15,
    });
    assert.strictEqual(id, 'class-reminder-class-01');
    const scheduled = inMemoryNotificationAdapter.scheduled.get('class-reminder-class-01');
    assert.ok(scheduled);
    assert.strictEqual(scheduled.channelId, 'class-reminders');
    assert.ok(scheduled.title.includes('Database Systems'));
    assert.ok(scheduled.body.includes('15 minutes'));
  });

  it('schedules daily study streak reminder with streak-reminders channel', async () => {
    const id = await scheduleDailyStreakReminder(5);
    assert.strictEqual(id, 'daily-streak-reminder');
    const scheduled = inMemoryNotificationAdapter.scheduled.get('daily-streak-reminder');
    assert.ok(scheduled);
    assert.strictEqual(scheduled.channelId, 'streak-reminders');
    assert.ok(scheduled.title.includes('5-Day'));
  });

  it('schedules upcoming exam countdown reminders with exam-alerts channel', async () => {
    const examDate = new Date(Date.now() + 5 * 86400 * 1000).toISOString();
    const ids = await scheduleExamReminders({
      id: 'exam-42',
      title: 'Operating Systems Midterm',
      exam_date: examDate,
      location: 'Hall A',
    });
    assert.ok(ids.length > 0);
    const scheduled3d = inMemoryNotificationAdapter.scheduled.get('exam-reminder-exam-42-3d');
    assert.ok(scheduled3d);
    assert.strictEqual(scheduled3d.channelId, 'exam-alerts');
    assert.ok(scheduled3d.title.includes('Operating Systems Midterm'));
  });

  it('correctly detects quiet hours time window', () => {
    const prefs = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      quietHoursEnabled: true,
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
    };

    // 23:30 is in quiet hours
    const lateNight = new Date();
    lateNight.setHours(23, 30, 0, 0);
    assert.strictEqual(isWithinQuietHours(lateNight, prefs), true);

    // 04:15 is in quiet hours
    const earlyMorning = new Date();
    earlyMorning.setHours(4, 15, 0, 0);
    assert.strictEqual(isWithinQuietHours(earlyMorning, prefs), true);

    // 14:00 is NOT in quiet hours
    const afternoon = new Date();
    afternoon.setHours(14, 0, 0, 0);
    assert.strictEqual(isWithinQuietHours(afternoon, prefs), false);
  });

  it('triggers test notifications across multiple channels', async () => {
    await sendTestNotification('class');
    await sendTestNotification('task');
    await sendTestNotification('streak');
    await sendTestNotification('exam');

    assert.ok(inMemoryNotificationAdapter.scheduled.size >= 4);
  });
});
