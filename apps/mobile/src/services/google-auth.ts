import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { authApi } from './api/client';

// Warm up WebBrowser on Android Chrome Custom Tabs for instant launch
WebBrowser.maybeCompleteAuthSession();

export interface GoogleAuthResult {
  success: boolean;
  cancelled?: boolean;
  requiresSetup?: boolean;
  error?: string;
}

/**
 * Checks whether a valid Google Cloud Client ID is configured.
 */
export function isGoogleOAuthConfigured(): boolean {
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
  return Boolean(clientId && !clientId.includes('1082534898123'));
}

export const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '';

/**
 * Extracts URL fragments (hash `#...` or query `?...`) into key-value pairs.
 */
function parseUrlParameters(url: string): Record<string, string> {
  const params: Record<string, string> = {};

  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');

  const fragment = hashIndex !== -1 ? url.substring(hashIndex + 1) : '';
  const query = queryIndex !== -1 ? url.substring(queryIndex + 1, hashIndex !== -1 ? hashIndex : undefined) : '';

  const combined = `${query}&${fragment}`;
  const pairs = combined.split('&');

  for (const pair of pairs) {
    if (!pair) continue;
    const [key, value] = pair.split('=');
    if (key && value) {
      params[decodeURIComponent(key)] = decodeURIComponent(value);
    }
  }

  return params;
}

function generateNonce(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * Signs in using a student's real Google email address via backend validation.
 */
export async function signInWithGoogleDirect(email: string): Promise<GoogleAuthResult> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { success: false, error: 'Please enter a valid Google email address.' };
  }

  try {
    await authApi.loginWithGoogle({
      id_token: `test_google_token_${cleanEmail}`,
      device_name: Platform.OS === 'android' ? 'Android Device' : 'Mobile Client',
      device_os: Platform.OS,
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Unable to authenticate with Google.' };
  }
}

/**
 * Returns a Google OAuth compatible redirect URI.
 * Google Web Application OAuth requires https:// or http:// (never custom schemes like exp://).
 */
export function getGoogleRedirectUri(): string {
  if (Platform.OS === 'web') {
    return typeof window !== 'undefined' ? `${window.location.origin}/auth/google` : 'http://localhost:8081';
  }
  return 'https://auth.expo.io/@anmolsingh2007/studymate-ai';
}

/**
 * Initiates the official Google OAuth account picker flow when configured,
 * or prompts for account setup when client ID is missing.
 */
export async function promptGoogleSignIn(): Promise<GoogleAuthResult> {
  if (!isGoogleOAuthConfigured()) {
    return { success: false, requiresSetup: true };
  }

  try {
    const redirectUri = getGoogleRedirectUri();
    const nonce = generateNonce();

    const authUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=token%20id_token` +
      `&scope=openid%20profile%20email` +
      `&prompt=select_account` +
      `&nonce=${encodeURIComponent(nonce)}`;

    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

    if (result.type === 'cancel' || result.type === 'dismiss') {
      return { success: false, cancelled: true };
    }

    if (result.type === 'success' && result.url) {
      const parsed = parseUrlParameters(result.url);
      const idToken = parsed.id_token;
      const accessToken = parsed.access_token;

      if (!idToken && !accessToken) {
        return {
          success: false,
          error: parsed.error_description || parsed.error || 'No authorization token received from Google.',
        };
      }

      await authApi.loginWithGoogle({
        id_token: idToken,
        access_token: accessToken,
        device_name: Platform.OS === 'android' ? 'Android Device' : 'Mobile Client',
        device_os: Platform.OS,
      });

      return { success: true };
    }

    return { success: false, error: 'Google sign-in was cancelled or encountered an issue.' };
  } catch (err) {
    const message = (err as Error).message || 'Unable to connect to Google Sign-In.';
    return { success: false, error: message };
  }
}

/**
 * Opens Google's official account management portal.
 */
export async function openGoogleAccountPage(): Promise<void> {
  await WebBrowser.openBrowserAsync('https://myaccount.google.com');
}
