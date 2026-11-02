import assert from 'node:assert';
import { beforeEach, describe, it } from 'node:test';

import {
  cancelTaskReminder,
  inMemoryNotificationAdapter,
  registerForPushNotificationsAsync,
  resetNotificationAdapter,
  scheduleTaskReminder,
  sendImmediateNotification,
  setNotificationAdapter,
} from '../src/services/notifications';

describe('Task Notifications & Alarm Reminders', () => {
  beforeEach(() => {
    setNotificationAdapter(inMemoryNotificationAdapter);
    inMemoryNotificationAdapter.clear();
  });

  it('registers notification channels and permissions successfully', async () => {
    const granted = await registerForPushNotificationsAsync();
    assert.strictEqual(granted, true);
  });

  it('schedules an alarm reminder with Hindi notification body for future task', async () => {
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // Tomorrow
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
    const futureDate = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // 2 hours in future
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
    const futureDate = new Date(Date.now() + 3600000).toISOString();
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
});
