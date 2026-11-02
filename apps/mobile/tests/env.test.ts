import assert from 'node:assert';
import { afterEach, beforeEach, describe, it } from 'node:test';

import {
  API_CONFIG,
  DEFAULT_PORT,
  getApiBaseUrl,
  resolveCurrentPlatform,
  resolveDefaultBaseUrl,
} from '../src/config/env';

describe('Environment & Base URL Configuration', () => {
  const originalEnvUrl = process.env.EXPO_PUBLIC_API_URL;
  const originalTestPlatform = process.env.TEST_PLATFORM;
  const originalTestIsEmulator = process.env.TEST_IS_EMULATOR;
  const originalTestIsDevice = process.env.TEST_IS_DEVICE;

  beforeEach(() => {
    delete process.env.EXPO_PUBLIC_API_URL;
    delete process.env.TEST_PLATFORM;
    delete process.env.TEST_IS_EMULATOR;
    delete process.env.TEST_IS_DEVICE;
  });

  afterEach(() => {
    if (originalEnvUrl !== undefined) {
      process.env.EXPO_PUBLIC_API_URL = originalEnvUrl;
    } else {
      delete process.env.EXPO_PUBLIC_API_URL;
    }

    if (originalTestPlatform !== undefined) {
      process.env.TEST_PLATFORM = originalTestPlatform;
    } else {
      delete process.env.TEST_PLATFORM;
    }

    if (originalTestIsEmulator !== undefined) {
      process.env.TEST_IS_EMULATOR = originalTestIsEmulator;
    } else {
      delete process.env.TEST_IS_EMULATOR;
    }

    if (originalTestIsDevice !== undefined) {
      process.env.TEST_IS_DEVICE = originalTestIsDevice;
    } else {
      delete process.env.TEST_IS_DEVICE;
    }
  });

  describe('Explicit EXPO_PUBLIC_API_URL resolution', () => {
    it('uses configured EXPO_PUBLIC_API_URL when set for physical device', () => {
      process.env.TEST_PLATFORM = 'android';
      process.env.TEST_IS_DEVICE = 'true';
      process.env.EXPO_PUBLIC_API_URL = 'http://192.168.31.189:8000';
      assert.strictEqual(getApiBaseUrl(), 'http://192.168.31.189:8000');
      assert.strictEqual(API_CONFIG.baseUrl, 'http://192.168.31.189:8000');
    });

    it('automatically remaps LAN IP to 10.0.2.2 when running inside Android emulator', () => {
      process.env.TEST_PLATFORM = 'android';
      process.env.TEST_IS_EMULATOR = 'true';
      process.env.EXPO_PUBLIC_API_URL = 'http://192.168.31.189:8000';
      assert.strictEqual(getApiBaseUrl(), 'http://10.0.2.2:8000');
      assert.strictEqual(API_CONFIG.baseUrl, 'http://10.0.2.2:8000');
    });

    it('remaps LAN IP with custom port and path when running in Android emulator', () => {
      process.env.TEST_PLATFORM = 'android';
      process.env.TEST_IS_EMULATOR = 'true';
      process.env.EXPO_PUBLIC_API_URL = 'http://10.124.118.13:8001/api/v1';
      assert.strictEqual(getApiBaseUrl(), 'http://10.0.2.2:8001/api/v1');
    });

    it('preserves remote staging HTTPS domain without remapping in Android emulator', () => {
      process.env.TEST_PLATFORM = 'android';
      process.env.TEST_IS_EMULATOR = 'true';
      process.env.EXPO_PUBLIC_API_URL = 'https://api.studymate.ai';
      assert.strictEqual(getApiBaseUrl(), 'https://api.studymate.ai');
    });

    it('strips trailing slashes from configured URL', () => {
      process.env.EXPO_PUBLIC_API_URL = 'http://192.168.31.189:8000///';
      assert.strictEqual(getApiBaseUrl(), 'http://192.168.31.189:8000');
    });

    it('supports https protocol for staging or remote servers', () => {
      process.env.EXPO_PUBLIC_API_URL = 'https://api.studymate.ai';
      assert.strictEqual(getApiBaseUrl(), 'https://api.studymate.ai');
    });

    it('throws validation error if EXPO_PUBLIC_API_URL does not start with http:// or https://', () => {
      process.env.EXPO_PUBLIC_API_URL = 'ftp://192.168.31.189:8000';
      assert.throws(
        () => getApiBaseUrl(),
        /Invalid EXPO_PUBLIC_API_URL/
      );
    });
  });

  describe('Platform default fallback resolution', () => {
    it('falls back to 10.0.2.2 on Android emulator when no env variable is set', () => {
      process.env.TEST_PLATFORM = 'android';
      const url = resolveDefaultBaseUrl();
      assert.strictEqual(url, `http://10.0.2.2:${DEFAULT_PORT}`);
    });

    it('falls back to localhost on iOS when no env variable is set', () => {
      process.env.TEST_PLATFORM = 'ios';
      const url = resolveDefaultBaseUrl();
      assert.strictEqual(url, `http://localhost:${DEFAULT_PORT}`);
    });

    it('falls back to localhost on Web when no env variable is set', () => {
      process.env.TEST_PLATFORM = 'web';
      const url = resolveDefaultBaseUrl();
      assert.strictEqual(url, `http://localhost:${DEFAULT_PORT}`);
    });
  });

  describe('API Endpoints validation', () => {
    it('defines exact backend authentication endpoint routes', () => {
      assert.strictEqual(API_CONFIG.endpoints.register, '/api/v1/auth/register');
      assert.strictEqual(API_CONFIG.endpoints.login, '/api/v1/auth/login');
      assert.strictEqual(API_CONFIG.endpoints.refresh, '/api/v1/auth/refresh');
      assert.strictEqual(API_CONFIG.endpoints.me, '/api/v1/auth/me');
      assert.strictEqual(API_CONFIG.endpoints.logout, '/api/v1/auth/logout');
      assert.strictEqual(API_CONFIG.endpoints.logoutAll, '/api/v1/auth/logout-all');
      assert.strictEqual(API_CONFIG.endpoints.sessions, '/api/v1/auth/sessions');
      assert.strictEqual(
        API_CONFIG.endpoints.revokeSession('abc-123'),
        '/api/v1/auth/sessions/abc-123'
      );
      assert.strictEqual(API_CONFIG.endpoints.subjects, '/api/v1/subjects');
      assert.strictEqual(API_CONFIG.endpoints.subjectById('sub-1'), '/api/v1/subjects/sub-1');
      assert.strictEqual(API_CONFIG.endpoints.notes, '/api/v1/notes');
      assert.strictEqual(API_CONFIG.endpoints.noteById('note-1'), '/api/v1/notes/note-1');
      assert.strictEqual(API_CONFIG.endpoints.decks, '/api/v1/flashcards/decks');
      assert.strictEqual(
        API_CONFIG.endpoints.deckById('deck-1'),
        '/api/v1/flashcards/decks/deck-1'
      );
      assert.strictEqual(
        API_CONFIG.endpoints.cards('deck-1'),
        '/api/v1/flashcards/decks/deck-1/cards'
      );
      assert.strictEqual(
        API_CONFIG.endpoints.cardById('deck-1', 'card-1'),
        '/api/v1/flashcards/decks/deck-1/cards/card-1'
      );
    });
  });
});
