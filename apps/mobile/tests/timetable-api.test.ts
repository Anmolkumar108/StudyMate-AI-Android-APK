import assert from 'node:assert';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { API_CONFIG } from '../src/config/env';
import { _resetRefreshState, timetableApi } from '../src/services/api/client';
import {
  cancelClassReminder,
  getNextClassReminderDate,
  inMemoryNotificationAdapter,
  scheduleClassReminder,
  setNotificationAdapter,
} from '../src/services/notifications';
import { clearTokens, resetStorageAdapter, saveTokens } from '../src/services/storage/token-storage';
import {
  TimetableConflictResponse,
  TimetableEntry,
  TimetableEntryCreate,
  WeeklyTimetableResponse,
} from '../src/types/timetable';

type MockResponseHandler = (
  url: string,
  options?: RequestInit
) => Promise<Response> | Response;

let originalFetch: typeof globalThis.fetch;
let mockHandler: MockResponseHandler | null = null;

function setMockFetch(handler: MockResponseHandler) {
  mockHandler = handler;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (mockHandler) {
      return mockHandler(url, init);
    }
    throw new Error(`Unhandled mock fetch request to ${url}`);
  };
}

function createJsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Timetable & Class Schedule API Client (FR-11)', () => {
  beforeEach(async () => {
    originalFetch = globalThis.fetch;
    resetStorageAdapter();
    setNotificationAdapter(inMemoryNotificationAdapter);
    inMemoryNotificationAdapter.clear();
    await saveTokens({
      accessToken: 'valid-test-access-token',
      refreshToken: 'valid-test-refresh-token',
    });
    _resetRefreshState();
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    mockHandler = null;
    await clearTokens();
    _resetRefreshState();
  });

  const mockEntry: TimetableEntry = {
    id: 'tt-entry-1',
    user_id: 'user-1',
    subject_id: 'sub-1',
    day_of_week: 1, // Monday
    start_time: '09:30:00',
    end_time: '11:00:00',
    room: 'Hall B-201',
    building: 'Science Block',
    professor: 'Dr. Alan Turing',
    color: '#3B82F6',
    is_online: false,
    virtual_url: null,
    reminder_minutes_before: 15,
    subject_name: 'Data Structures',
    subject_code: 'CS201',
    subject_color: '#3B82F6',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  it('lists timetable entries with day and subject filters', async () => {
    setMockFetch((url) => {
      assert.ok(url.includes(API_CONFIG.endpoints.timetable));
      assert.ok(url.includes('day_of_week=1'));
      assert.ok(url.includes('subject_id=sub-1'));
      return createJsonResponse([mockEntry], 200);
    });

    const res = await timetableApi.list({ day_of_week: 1, subject_id: 'sub-1' });
    assert.strictEqual(res.length, 1);
    assert.strictEqual(res[0].subject_name, 'Data Structures');
    assert.strictEqual(res[0].room, 'Hall B-201');
  });

  it('fetches full weekly timetable grouped by day', async () => {
    const weeklyData: WeeklyTimetableResponse = {
      entries: [mockEntry],
      by_day: {
        1: [mockEntry],
        2: [],
        3: [],
        4: [],
        5: [],
        6: [],
        7: [],
      },
      total_classes: 1,
    };

    setMockFetch((url) => {
      assert.ok(url.includes(API_CONFIG.endpoints.timetableWeekly));
      return createJsonResponse(weeklyData, 200);
    });

    const res = await timetableApi.getWeekly();
    assert.strictEqual(res.total_classes, 1);
    assert.strictEqual(res.by_day[1].length, 1);
    assert.strictEqual(res.by_day[1][0].professor, 'Dr. Alan Turing');
  });

  it('fetches today schedule', async () => {
    setMockFetch((url) => {
      assert.ok(url.includes(API_CONFIG.endpoints.timetableToday));
      return createJsonResponse([mockEntry], 200);
    });

    const res = await timetableApi.getToday();
    assert.strictEqual(res.length, 1);
    assert.strictEqual(res[0].subject_code, 'CS201');
  });

  it('checks for class schedule conflicts', async () => {
    const conflictRes: TimetableConflictResponse = {
      has_conflict: true,
      conflicting_entries: [mockEntry],
    };

    setMockFetch((url, options) => {
      assert.strictEqual(options?.method, 'POST');
      assert.ok(url.includes(API_CONFIG.endpoints.timetableCheckConflict));
      const body = JSON.parse(options?.body as string);
      assert.strictEqual(body.day_of_week, 1);
      assert.strictEqual(body.start_time, '10:00:00');
      assert.strictEqual(body.end_time, '11:30:00');
      return createJsonResponse(conflictRes, 200);
    });

    const res = await timetableApi.checkConflict({
      day_of_week: 1,
      start_time: '10:00:00',
      end_time: '11:30:00',
    });
    assert.strictEqual(res.has_conflict, true);
    assert.strictEqual(res.conflicting_entries.length, 1);
  });

  it('creates a new timetable entry', async () => {
    const payload: TimetableEntryCreate = {
      day_of_week: 2,
      start_time: '14:00:00',
      end_time: '15:30:00',
      subject_id: 'sub-2',
      room: 'Room 305',
      professor: 'Dr. Ada Lovelace',
      is_online: false,
      reminder_minutes_before: 15,
    };

    setMockFetch((url, options) => {
      assert.strictEqual(options?.method, 'POST');
      assert.ok(url.includes(API_CONFIG.endpoints.timetable));
      const body = JSON.parse(options?.body as string);
      assert.strictEqual(body.day_of_week, 2);
      assert.strictEqual(body.professor, 'Dr. Ada Lovelace');
      return createJsonResponse(
        {
          id: 'tt-entry-new',
          user_id: 'user-1',
          ...payload,
          subject_name: 'Algorithms',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        201
      );
    });

    const res = await timetableApi.create(payload);
    assert.strictEqual(res.id, 'tt-entry-new');
    assert.strictEqual(res.professor, 'Dr. Ada Lovelace');
  });

  it('updates an existing timetable entry', async () => {
    setMockFetch((url, options) => {
      assert.strictEqual(options?.method, 'PATCH');
      assert.ok(url.includes('/api/v1/timetable/tt-entry-1'));
      const body = JSON.parse(options?.body as string);
      assert.strictEqual(body.room, 'Hall C-102');
      return createJsonResponse({ ...mockEntry, room: 'Hall C-102' }, 200);
    });

    const res = await timetableApi.update('tt-entry-1', { room: 'Hall C-102' });
    assert.strictEqual(res.room, 'Hall C-102');
  });

  it('deletes a timetable entry cleanly on 204 No Content', async () => {
    setMockFetch((url, options) => {
      assert.strictEqual(options?.method, 'DELETE');
      assert.ok(url.includes('/api/v1/timetable/tt-entry-1'));
      return new Response(null, { status: 204 });
    });

    await timetableApi.delete('tt-entry-1');
  });

  it('schedules and cancels class notification reminders', async () => {
    const notifId = await scheduleClassReminder(mockEntry);
    assert.strictEqual(notifId, 'class-reminder-tt-entry-1');
    assert.ok(inMemoryNotificationAdapter.scheduled.has('class-reminder-tt-entry-1'));

    await cancelClassReminder(mockEntry.id);
    assert.ok(!inMemoryNotificationAdapter.scheduled.has('class-reminder-tt-entry-1'));
  });

  it('calculates next class reminder date accurately', () => {
    // Reference: a Wednesday (day 3) at 12:00 PM
    const ref = new Date('2026-11-04T12:00:00Z');
    // Monday (day 1) class at 09:30 AM with 15 min reminder
    const reminderDate = getNextClassReminderDate(1, '09:30:00', 15, ref);
    assert.ok(reminderDate > ref);
  });

  it('batch creates recurring timetable entries across multiple days', async () => {
    setMockFetch((url, options) => {
      assert.strictEqual(options?.method, 'POST');
      assert.ok(url.includes('/api/v1/timetable/batch'));
      const body = JSON.parse(options?.body as string);
      assert.deepStrictEqual(body.days_of_week, [1, 3, 5]);
      return createJsonResponse(
        [
          { ...mockEntry, id: 'tt-1', day_of_week: 1 },
          { ...mockEntry, id: 'tt-2', day_of_week: 3 },
          { ...mockEntry, id: 'tt-3', day_of_week: 5 },
        ],
        201
      );
    });

    const res = await timetableApi.batchCreate({
      days_of_week: [1, 3, 5],
      subject_id: 'sub-1',
      start_time: '09:30:00',
      end_time: '11:00:00',
    });
    assert.strictEqual(res.length, 3);
  });

  it('marks and updates class attendance record', async () => {
    setMockFetch((url, options) => {
      assert.strictEqual(options?.method, 'POST');
      assert.ok(url.includes('/api/v1/timetable/attendance'));
      const body = JSON.parse(options?.body as string);
      assert.strictEqual(body.status, 'present');
      return createJsonResponse(
        {
          id: 'att-1',
          user_id: 'user-1',
          timetable_entry_id: 'tt-entry-1',
          subject_id: 'sub-1',
          attendance_date: '2026-11-03',
          status: 'present',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        200
      );
    });

    const res = await timetableApi.markAttendance({
      timetable_entry_id: 'tt-entry-1',
      subject_id: 'sub-1',
      attendance_date: '2026-11-03',
      status: 'present',
    });
    assert.strictEqual(res.status, 'present');
    assert.strictEqual(res.attendance_date, '2026-11-03');
  });

  it('fetches attendance summary with low attendance detection', async () => {
    setMockFetch((url) => {
      assert.ok(url.includes('/api/v1/timetable/attendance/summary'));
      return createJsonResponse(
        {
          total_classes: 20,
          present_count: 17,
          absent_count: 3,
          late_count: 0,
          overall_percentage: 85.0,
          minimum_required_percentage: 75.0,
          is_overall_low: false,
          subjects: [
            {
              subject_id: 'sub-1',
              subject_name: 'Data Structures',
              total_classes: 20,
              present_count: 17,
              absent_count: 3,
              late_count: 0,
              percentage: 85.0,
              is_low_attendance: false,
            },
          ],
        },
        200
      );
    });

    const summary = await timetableApi.getAttendanceSummary(75.0);
    assert.strictEqual(summary.overall_percentage, 85.0);
    assert.strictEqual(summary.is_overall_low, false);
    assert.strictEqual(summary.subjects.length, 1);
  });
});

