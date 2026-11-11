import assert from 'node:assert';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { AMBIENT_TRACKS, ambientSoundEngine } from '../src/services/audio/ambient-player';
import { getDeviceDetails } from '../src/services/device-info';
import { offlineSyncManager } from '../src/services/offline-sync-manager';
import {
  clearCachedDecks,
  loadCachedDecks,
  resetFlashcardsCacheAdapter,
  saveCachedDecks,
  setFlashcardsCacheAdapter,
} from '../src/services/storage/flashcards-cache';
import {
  clearPendingNoteActions,
  loadPendingNoteActions,
  queuePendingNoteAction,
  resetNotesCacheAdapter,
} from '../src/services/storage/notes-cache';
import {
  clearCachedSubjects,
  loadCachedSubjects,
  resetSubjectsCacheAdapter,
  saveCachedSubjects,
  setSubjectsCacheAdapter,
} from '../src/services/storage/subjects-cache';
import {
  clearPendingActions,
  loadPendingActions,
  queuePendingAction,
  resetTaskCacheAdapter,
} from '../src/services/storage/task-cache';
import {
  clearCachedTimetable,
  loadCachedTimetable,
  resetTimetableCacheAdapter,
  saveCachedTimetable,
  setTimetableCacheAdapter,
} from '../src/services/storage/timetable-cache';
import { clearTokens, resetStorageAdapter, saveTokens } from '../src/services/storage/token-storage';
import { FlashcardDeck } from '../src/types/flashcard';
import { Subject } from '../src/types/subject';
import { WeeklyTimetableResponse } from '../src/types/timetable';

// In-Memory Test Storage Adapter Factory
function createMemoryStorageAdapter() {
  const store = new Map<string, string>();
  return {
    store,
    adapter: {
      getItem: async (key: string) => store.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        store.set(key, value);
      },
      deleteItem: async (key: string) => {
        store.delete(key);
      },
    },
  };
}

let originalFetch: typeof globalThis.fetch;
type MockFetchHandler = (url: string, options?: RequestInit) => Promise<Response> | Response;
let mockFetchHandler: MockFetchHandler | null = null;

function setMockFetch(handler: MockFetchHandler) {
  mockFetchHandler = handler;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (mockFetchHandler) {
      return mockFetchHandler(url, init);
    }
    throw new Error(`Unhandled mock fetch request to ${url}`);
  };
}

describe('Phase 3: Mobile Offline Sync, Storage Resilience & Device Profiling', () => {
  beforeEach(async () => {
    originalFetch = globalThis.fetch;
    resetStorageAdapter();
    resetNotesCacheAdapter();
    resetTaskCacheAdapter();
    resetSubjectsCacheAdapter();
    resetFlashcardsCacheAdapter();
    resetTimetableCacheAdapter();

    await clearPendingNoteActions();
    await clearPendingActions();
    await saveTokens({
      accessToken: 'valid-test-access-token',
      refreshToken: 'valid-test-refresh-token',
    });
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    mockFetchHandler = null;
    await clearPendingNoteActions();
    await clearPendingActions();
    await clearTokens();

    resetStorageAdapter();
    resetNotesCacheAdapter();
    resetTaskCacheAdapter();
    resetSubjectsCacheAdapter();
    resetFlashcardsCacheAdapter();
    resetTimetableCacheAdapter();
  });

  // ============================================================================
  // 1. Multi-Domain Cache Isolation & Corrupted JSON Recovery
  // ============================================================================
  describe('Multi-Domain Offline Caches', () => {
    it('saves, loads, and clears cached subjects', async () => {
      const { adapter } = createMemoryStorageAdapter();
      setSubjectsCacheAdapter(adapter);

      const subjects: Subject[] = [
        {
          id: 'sub-1',
          user_id: 'user-1',
          name: 'Computer Networks',
          code: 'CS301',
          description: 'Core networking',
          semester: 5,
          color: '#3B82F6',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      await saveCachedSubjects(subjects);
      const loaded = await loadCachedSubjects();
      assert.strictEqual(loaded.length, 1);
      assert.strictEqual(loaded[0].name, 'Computer Networks');

      await clearCachedSubjects();
      const cleared = await loadCachedSubjects();
      assert.strictEqual(cleared.length, 0);
    });

    it('recovers gracefully from corrupted JSON in subjects cache without crashing', async () => {
      const { adapter, store } = createMemoryStorageAdapter();
      setSubjectsCacheAdapter(adapter);

      // Inject unparseable malformed string
      store.set('studymate_subjects_cache', '{not valid json:');

      const loaded = await loadCachedSubjects();
      assert.deepStrictEqual(loaded, [], 'Corrupted cache must fall back to empty array');
    });

    it('saves, loads, and clears cached flashcard decks', async () => {
      const { adapter } = createMemoryStorageAdapter();
      setFlashcardsCacheAdapter(adapter);

      const decks: FlashcardDeck[] = [
        {
          id: 'deck-1',
          user_id: 'user-1',
          subject_id: null,
          title: 'Algorithms & Complexity',
          description: null,
          card_count: 15,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      await saveCachedDecks(decks);
      const loaded = await loadCachedDecks();
      assert.strictEqual(loaded.length, 1);
      assert.strictEqual(loaded[0].title, 'Algorithms & Complexity');

      await clearCachedDecks();
      const cleared = await loadCachedDecks();
      assert.strictEqual(cleared.length, 0);
    });

    it('saves, loads, and clears cached weekly timetable', async () => {
      const { adapter } = createMemoryStorageAdapter();
      setTimetableCacheAdapter(adapter);

      const sampleEntry = {
        id: 'tt-1',
        user_id: 'user-1',
        day_of_week: 1,
        subject_id: 'sub-1',
        start_time: '10:00',
        end_time: '11:30',
        class_type: 'lecture' as const,
        is_online: false,
        reminder_enabled: true,
        reminder_minutes_before: 10,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const timetable: WeeklyTimetableResponse = {
        entries: [sampleEntry],
        by_day: { 1: [sampleEntry] },
        total_classes: 1,
      };

      await saveCachedTimetable(timetable);
      const loaded = await loadCachedTimetable();
      assert.ok(loaded !== null);
      assert.strictEqual(loaded.entries.length, 1);
      assert.strictEqual(loaded.entries[0].id, 'tt-1');
      assert.strictEqual(loaded.total_classes, 1);

      await clearCachedTimetable();
      const cleared = await loadCachedTimetable();
      assert.strictEqual(cleared, null);
    });
  });

  // ============================================================================
  // 2. Offline Action Queue & Reconnect Auto-Sync
  // ============================================================================
  describe('Offline Queue & Auto-Sync Engine', () => {
    it('queues multiple offline actions and synchronizes completely upon reconnection', async () => {
      // 1. Queue offline Note creation
      await queuePendingNoteAction({
        type: 'create',
        noteId: 'temp_note_99',
        payload: {
          title: 'Offline Physics Revision',
          content: 'Thermodynamics Carnot Cycle',
        },
      });

      // 2. Queue offline Task creation
      await queuePendingAction({
        type: 'create_task',
        taskId: 'temp_task_88',
        payload: {
          title: 'Complete Lab Report',
          priority: 'urgent',
        },
      });

      const countBefore = await offlineSyncManager.getPendingCount();
      assert.strictEqual(countBefore.notes, 1);
      assert.strictEqual(countBefore.tasks, 1);
      assert.strictEqual(countBefore.total, 2);

      // 3. Mock backend endpoints responding 201 Created
      const syncedCalls: string[] = [];
      setMockFetch((url, options) => {
        syncedCalls.push(`${options?.method ?? 'GET'} ${url}`);
        if (url.includes('/api/v1/notes')) {
          return new Response(
            JSON.stringify({
              id: 'server_note_99',
              title: 'Offline Physics Revision',
              content: 'Thermodynamics Carnot Cycle',
            }),
            { status: 201, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (url.includes('/api/v1/tasks')) {
          return new Response(
            JSON.stringify({
              id: 'server_task_88',
              title: 'Complete Lab Report',
              priority: 'urgent',
              status: 'todo',
            }),
            { status: 201, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response('Not found', { status: 404 });
      });

      // 4. Trigger Auto-Sync
      const summary = await offlineSyncManager.syncAllPending();
      assert.strictEqual(summary.syncedNotes, 1);
      assert.strictEqual(summary.syncedTasks, 1);

      // 5. Assert queue is completely drained and both POST actions executed
      const countAfter = await offlineSyncManager.getPendingCount();
      assert.strictEqual(countAfter.total, 0);
      assert.ok(syncedCalls.some((c) => c.startsWith('POST') && c.includes('/notes')));
      assert.ok(syncedCalls.some((c) => c.startsWith('POST') && c.includes('/tasks')));
    });

    it('preserves pending actions in queue if network error occurs during sync', async () => {
      await queuePendingNoteAction({
        type: 'create',
        noteId: 'offline_persist_note',
        payload: {
          title: 'Crucial Unsaved Note',
          content: 'Formulas',
        },
      });

      // Simulate network disconnect / server offline error
      setMockFetch(() => {
        throw new TypeError('Network request failed: No internet connectivity');
      });

      const summary = await offlineSyncManager.syncAllPending();
      assert.strictEqual(summary.syncedNotes, 0);

      // Verify that the note action was NOT lost
      const remainingNotes = await loadPendingNoteActions();
      assert.strictEqual(remainingNotes.length, 1);
      assert.strictEqual(remainingNotes[0].noteId, 'offline_persist_note');
    });
  });

  // ============================================================================
  // 3. Ambient Audio Focus Engine
  // ============================================================================
  describe('Ambient Audio Focus Engine', () => {
    it('provides all 5 core ambient tracks with metadata', () => {
      assert.strictEqual(AMBIENT_TRACKS.length, 5);
      const trackIds = AMBIENT_TRACKS.map((t) => t.id);
      assert.ok(trackIds.includes('rain'));
      assert.ok(trackIds.includes('whitenoise'));
      assert.ok(trackIds.includes('cafe'));
      assert.ok(trackIds.includes('forest'));
      assert.ok(trackIds.includes('mute'));
    });

    it('validates and clamps volume settings within 0.0 to 1.0', () => {
      ambientSoundEngine.setVolume(0.5);
      assert.strictEqual(ambientSoundEngine.getVolume(), 0.5);

      // Clamping upper bound
      ambientSoundEngine.setVolume(1.8);
      assert.strictEqual(ambientSoundEngine.getVolume(), 1.0);

      // Clamping lower bound
      ambientSoundEngine.setVolume(-0.4);
      assert.strictEqual(ambientSoundEngine.getVolume(), 0.0);

      // Reset to standard
      ambientSoundEngine.setVolume(0.7);
    });

    it('transitions to mute track cleanly', async () => {
      await ambientSoundEngine.setTrack('mute');
      assert.strictEqual(ambientSoundEngine.getCurrentTrack(), 'mute');
      assert.strictEqual(ambientSoundEngine.getIsPlaying(), false);
    });
  });

  // ============================================================================
  // 4. Device Radar Profiling & Safety
  // ============================================================================
  describe('Device Radar Profiling', () => {
    it('extracts device metadata safely without throwing native errors', () => {
      const details = getDeviceDetails();
      assert.ok(details !== null);
      assert.ok(typeof details.deviceName === 'string');
      assert.ok(details.deviceName.length > 0);
      assert.ok(typeof details.deviceOs === 'string');
      assert.strictEqual(details.appVersion, '1.0.0');
    });
  });
});
