/**
 * Environment configuration for StudyMate AI Mobile.
 *
 * API Base URL Resolution Priority:
 * 1. Android Emulator:
 *    - Automatically routes local development traffic through `http://10.0.2.2:<port>`.
 *    - Even if a host Wi-Fi LAN IP or localhost is configured in .env, in the Android emulator
 *      the host machine's loopback alias is 10.0.2.2.
 *    - Remote public domains (e.g. `https://api.studymate.ai`) remain untouched.
 * 2. Physical Android Device:
 *    - Explicit `EXPO_PUBLIC_API_URL` (e.g. `http://192.168.x.x:8000` or `http://10.x.x.x:8000`).
 *    - Dynamic Metro Host extraction (`http://${metroHost}:8000`) so physical phones running Expo Go
 *      connect seamlessly to the dev PC without manual IP editing.
 * 3. iOS Simulator / Web / Desktop:
 *    - Explicit `EXPO_PUBLIC_API_URL` if set, otherwise `http://localhost:8000`.
 *
 * Security Invariants:
 * - Never silently falls back to an unintended production server.
 * - Enforces http/https protocol validation.
 * - Strips trailing slashes to guarantee clean route concatenation.
 */

export const DEFAULT_PORT = 8000;

export function resolveCurrentPlatform(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rn = require('react-native');
    if (rn?.Platform?.OS) {
      return rn.Platform.OS;
    }
  } catch {
    // Fallback when running outside of React Native runtime (e.g. Node tests)
  }
  return process.env.TEST_PLATFORM || 'android';
}

export function isAndroidEmulator(): boolean {
  const os = resolveCurrentPlatform();
  if (os !== 'android') {
    return false;
  }

  // Explicit test overrides for deterministic unit testing
  if (process.env.TEST_IS_EMULATOR === 'true') {
    return true;
  }
  if (process.env.TEST_IS_DEVICE === 'true' || process.env.TEST_IS_EMULATOR === 'false') {
    return false;
  }

  try {
    // 1. expo-device check: on physical devices isDevice is true, on emulators false
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Device = require('expo-device');
    if (typeof Device?.isDevice === 'boolean') {
      return !Device.isDevice;
    }
  } catch {
    // Graceful fallback for non-Expo / pure Node test environments
  }

  try {
    // 2. React Native Platform.constants heuristics for Android emulator
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Platform } = require('react-native');
    const constants = Platform?.constants;
    if (constants) {
      const brand = String(constants.Brand || '').toLowerCase();
      const model = String(constants.Model || '').toLowerCase();
      const hardware = String(constants.Hardware || '').toLowerCase();
      const fingerprint = String(constants.Fingerprint || '').toLowerCase();
      const product = String(constants.Product || '').toLowerCase();

      if (
        (brand.includes('google') && model.includes('sdk')) ||
        model.includes('emulator') ||
        model.includes('gphone') ||
        hardware.includes('goldfish') ||
        hardware.includes('ranchu') ||
        product.includes('sdk') ||
        product.includes('vbox') ||
        fingerprint.includes('generic')
      ) {
        return true;
      }
    }
  } catch {
    // Graceful fallback
  }

  return false;
}

export function getExpoMetroHost(): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Constants = require('expo-constants').default || require('expo-constants');
    const hostUri =
      Constants?.expoConfig?.hostUri ||
      Constants?.manifest2?.extra?.expoClient?.hostUri ||
      Constants?.manifest?.debuggerHost;

    if (typeof hostUri === 'string' && hostUri.trim()) {
      const colonIdx = hostUri.indexOf(':');
      const host = colonIdx > -1 ? hostUri.substring(0, colonIdx).trim() : hostUri.trim();
      if (host && host !== 'localhost' && host !== '127.0.0.1') {
        return host;
      }
    }
  } catch {
    // Graceful fallback when expo-constants is unavailable (e.g. pure Node unit tests)
  }
  return null;
}

export function isLocalDevHost(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '10.0.2.2' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.16.') ||
      hostname.startsWith('172.17.') ||
      hostname.startsWith('172.18.') ||
      hostname.startsWith('172.19.') ||
      hostname.startsWith('172.20.') ||
      hostname.startsWith('172.21.') ||
      hostname.startsWith('172.22.') ||
      hostname.startsWith('172.23.') ||
      hostname.startsWith('172.24.') ||
      hostname.startsWith('172.25.') ||
      hostname.startsWith('172.26.') ||
      hostname.startsWith('172.27.') ||
      hostname.startsWith('172.28.') ||
      hostname.startsWith('172.29.') ||
      hostname.startsWith('172.30.') ||
      hostname.startsWith('172.31.')
    );
  } catch {
    return false;
  }
}

export function resolveDefaultBaseUrl(): string {
  // 1. Android Emulator: always connects to the host machine through 10.0.2.2
  if (isAndroidEmulator()) {
    return `http://10.0.2.2:${DEFAULT_PORT}`;
  }

  // 2. Physical device connecting to dev machine via Expo Metro on LAN
  const metroHost = getExpoMetroHost();
  if (metroHost) {
    return `http://${metroHost}:${DEFAULT_PORT}`;
  }

  const os = resolveCurrentPlatform();
  if (os === 'android') {
    // Android emulator loopback alias to development machine
    return `http://10.0.2.2:${DEFAULT_PORT}`;
  }

  // iOS Simulator, Web browser, or local desktop development
  return `http://localhost:${DEFAULT_PORT}`;
}

export function getApiBaseUrl(): string {
  const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (configuredUrl) {
    if (!configuredUrl.startsWith('http://') && !configuredUrl.startsWith('https://')) {
      throw new Error(
        `Invalid EXPO_PUBLIC_API_URL: '${configuredUrl}'. Must start with http:// or https://.`
      );
    }

    const cleanUrl = configuredUrl.replace(/\/+$/, '');

    // In Android Emulator, remap local LAN / loopback host IPs to 10.0.2.2
    // to prevent emulator timeouts when Wi-Fi IP changes or when .env has a LAN IP.
    if (isAndroidEmulator()) {
      try {
        const parsed = new URL(cleanUrl);
        if (isLocalDevHost(cleanUrl) && parsed.hostname !== '10.0.2.2') {
          const port = parsed.port ? `:${parsed.port}` : `:${DEFAULT_PORT}`;
          const path = parsed.pathname === '/' ? '' : parsed.pathname;
          return `${parsed.protocol}//10.0.2.2${port}${path}`.replace(/\/+$/, '');
        }
      } catch {
        // Fall back to cleanUrl if parsing fails
      }
    }

    return cleanUrl;
  }

  return resolveDefaultBaseUrl();
}

export const API_CONFIG = {
  get baseUrl(): string {
    return getApiBaseUrl();
  },
  timeoutMs: 15000,
  endpoints: {
    register: '/api/v1/auth/register',
    login: '/api/v1/auth/login',
    refresh: '/api/v1/auth/refresh',
    me: '/api/v1/auth/me',
    logout: '/api/v1/auth/logout',
    logoutAll: '/api/v1/auth/logout-all',
    sessions: '/api/v1/auth/sessions',
    revokeSession: (id: string) => `/api/v1/auth/sessions/${id}`,
    subjects: '/api/v1/subjects',
    subjectById: (id: string) => `/api/v1/subjects/${id}`,
    notes: '/api/v1/notes',
    noteById: (id: string) => `/api/v1/notes/${id}`,
    tasks: '/api/v1/tasks',
    taskById: (id: string) => `/api/v1/tasks/${id}`,
    taskAnalytics: '/api/v1/tasks/analytics',
    taskTemplates: '/api/v1/tasks/templates',
    taskTemplateById: (id: string) => `/api/v1/tasks/templates/${id}`,
    taskFromTemplate: '/api/v1/tasks/from-template',
    taskLogFocus: (id: string) => `/api/v1/tasks/${id}/log-focus`,
    taskAttachments: (id: string) => `/api/v1/tasks/${id}/attachments`,
    taskAttachmentBase64: (id: string) => `/api/v1/tasks/${id}/attachments-base64`,
    taskAttachmentDownload: (id: string, attId: string) => `/api/v1/tasks/${id}/attachments/${attId}/download`,
    taskAttachmentDelete: (id: string, attId: string) => `/api/v1/tasks/${id}/attachments/${attId}`,
    taskAiBreakdown: '/api/v1/tasks/ai/breakdown',
    taskAiSuggestSchedule: '/api/v1/tasks/ai/suggest-schedule',
    taskAiParseNatural: '/api/v1/tasks/ai/parse-natural',
    taskAiDailyBriefing: '/api/v1/tasks/ai/daily-briefing',
    decks: '/api/v1/flashcards/decks',
    deckById: (id: string) => `/api/v1/flashcards/decks/${id}`,
    cards: (deckId: string) => `/api/v1/flashcards/decks/${deckId}/cards`,
    cardById: (deckId: string, cardId: string) =>
      `/api/v1/flashcards/decks/${deckId}/cards/${cardId}`,
    documents: '/api/v1/documents',
    documentUpload: '/api/v1/documents/upload',
    documentById: (id: string) => `/api/v1/documents/${id}`,
    documentFileById: (id: string) => `/api/v1/documents/${id}/file`,
    aiChatStream: '/api/v1/ai/chat/stream',
    aiChat: '/api/v1/ai/chat',
    aiChatSessions: '/api/v1/ai/chat/sessions',
    aiChatSessionById: (id: string) => `/api/v1/ai/chat/sessions/${id}`,
    aiExplain: '/api/v1/ai/explain',
    aiGenerateNotes: '/api/v1/ai/generate-notes',
    quizzes: '/api/v1/quizzes',
    quizGenerate: '/api/v1/quizzes/generate',
    quizById: (id: string) => `/api/v1/quizzes/${id}`,
    quizSubmit: (id: string) => `/api/v1/quizzes/${id}/submit`,
    quizConvertMissed: (id: string, attemptId: string) =>
      `/api/v1/quizzes/${id}/attempts/${attemptId}/convert-to-flashcards`,
  },
} as const;
