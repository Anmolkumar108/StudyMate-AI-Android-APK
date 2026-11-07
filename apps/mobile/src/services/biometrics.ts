import type * as LocalAuthType from 'expo-local-authentication';

export interface BiometricCapability {
  hasHardware: boolean;
  isEnrolled: boolean;
  supportedTypes: ('FINGERPRINT' | 'FACIAL_RECOGNITION' | 'IRIS')[];
  biometricLabel: string;
}

export interface BiometricAdapter {
  hasHardwareAsync(): Promise<boolean>;
  isEnrolledAsync(): Promise<boolean>;
  supportedAuthenticationTypesAsync(): Promise<number[]>;
  authenticateAsync(options: {
    promptMessage: string;
    fallbackLabel?: string;
    disableDeviceFallback?: boolean;
    cancelLabel?: string;
  }): Promise<{ success: boolean; error?: string }>;
}

export const BIOMETRIC_LOCK_STORAGE_KEY = 'studymate_biometric_lock_enabled';

function getExpoLocalAuth(): typeof LocalAuthType | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-local-authentication');
  } catch {
    return null;
  }
}

// In-memory adapter for unit testing and non-native runtimes
export const inMemoryBiometricAdapter: BiometricAdapter & {
  hasHardware: boolean;
  isEnrolled: boolean;
  shouldSucceed: boolean;
  authTypes: number[];
} = {
  hasHardware: true,
  isEnrolled: true,
  shouldSucceed: true,
  authTypes: [1], // 1 = FINGERPRINT
  async hasHardwareAsync() {
    return this.hasHardware;
  },
  async isEnrolledAsync() {
    return this.isEnrolled;
  },
  async supportedAuthenticationTypesAsync() {
    return this.authTypes;
  },
  async authenticateAsync() {
    if (this.shouldSucceed) {
      return { success: true };
    }
    return { success: false, error: 'Authentication failed' };
  },
};

// Native adapter interfacing with Android Keystore / BiometricPrompt
export const nativeBiometricAdapter: BiometricAdapter = {
  async hasHardwareAsync() {
    const auth = getExpoLocalAuth();
    if (!auth) return false;
    return await auth.hasHardwareAsync();
  },
  async isEnrolledAsync() {
    const auth = getExpoLocalAuth();
    if (!auth) return false;
    return await auth.isEnrolledAsync();
  },
  async supportedAuthenticationTypesAsync() {
    const auth = getExpoLocalAuth();
    if (!auth) return [];
    return await auth.supportedAuthenticationTypesAsync();
  },
  async authenticateAsync(options) {
    const auth = getExpoLocalAuth();
    if (!auth) {
      return { success: false, error: 'Biometric module unavailable on this device.' };
    }
    const res = await auth.authenticateAsync({
      promptMessage: options.promptMessage,
      fallbackLabel: options.fallbackLabel || 'Use Device PIN / Password',
      disableDeviceFallback: options.disableDeviceFallback ?? false,
      cancelLabel: options.cancelLabel || 'Cancel',
    });
    if (res.success) {
      return { success: true };
    }
    return { success: false, error: res.error || 'Biometric authentication canceled or failed.' };
  },
};

let activeAdapter: BiometricAdapter =
  typeof process !== 'undefined' && process.env?.NODE_ENV === 'test'
    ? inMemoryBiometricAdapter
    : nativeBiometricAdapter;

export function setBiometricAdapter(adapter: BiometricAdapter) {
  activeAdapter = adapter;
}

export function resetBiometricAdapter() {
  activeAdapter =
    typeof process !== 'undefined' && process.env?.NODE_ENV === 'test'
      ? inMemoryBiometricAdapter
      : nativeBiometricAdapter;
}

/**
 * Checks hardware presence, enrolled fingerprint/face, and resolves human-friendly name.
 */
export async function checkBiometricCapability(): Promise<BiometricCapability> {
  try {
    const [hasHardware, isEnrolled, rawTypes] = await Promise.all([
      activeAdapter.hasHardwareAsync(),
      activeAdapter.isEnrolledAsync(),
      activeAdapter.supportedAuthenticationTypesAsync(),
    ]);

    const supportedTypes: ('FINGERPRINT' | 'FACIAL_RECOGNITION' | 'IRIS')[] = [];
    // 1: FINGERPRINT, 2: FACIAL_RECOGNITION, 3: IRIS
    if (rawTypes.includes(1)) supportedTypes.push('FINGERPRINT');
    if (rawTypes.includes(2)) supportedTypes.push('FACIAL_RECOGNITION');
    if (rawTypes.includes(3)) supportedTypes.push('IRIS');

    let biometricLabel = 'Fingerprint / Biometric';
    if (supportedTypes.includes('FACIAL_RECOGNITION') && supportedTypes.includes('FINGERPRINT')) {
      biometricLabel = 'Fingerprint & Face Unlock';
    } else if (supportedTypes.includes('FACIAL_RECOGNITION')) {
      biometricLabel = 'Face Unlock';
    } else if (supportedTypes.includes('FINGERPRINT')) {
      biometricLabel = 'Fingerprint Sensor';
    }

    return {
      hasHardware,
      isEnrolled,
      supportedTypes,
      biometricLabel,
    };
  } catch (err) {
    console.warn('[Biometrics] Capability detection error:', err);
    return {
      hasHardware: false,
      isEnrolled: false,
      supportedTypes: [],
      biometricLabel: 'Biometric Lock',
    };
  }
}

/**
 * Reads whether the student has enabled the Biometric App Lock from SecureStore.
 */
export async function isBiometricLockEnabled(): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SecureStore = require('expo-secure-store');
    if (SecureStore && typeof SecureStore.getItemAsync === 'function') {
      const val = await SecureStore.getItemAsync(BIOMETRIC_LOCK_STORAGE_KEY);
      return val === 'true';
    }
  } catch {
    // Fallback
  }
  return false;
}

/**
 * Persists biometric lock preference.
 */
export async function setBiometricLockEnabled(enabled: boolean): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SecureStore = require('expo-secure-store');
    if (SecureStore && typeof SecureStore.setItemAsync === 'function') {
      await SecureStore.setItemAsync(BIOMETRIC_LOCK_STORAGE_KEY, enabled ? 'true' : 'false');
    }
  } catch {
    // Fallback
  }
}

/**
 * Triggers the native Android BiometricPrompt prompt.
 */
export async function authenticateWithBiometrics(
  promptMessage = 'Confirm your fingerprint to access StudyMate AI'
): Promise<{ success: boolean; error?: string }> {
  try {
    const hasHardware = await activeAdapter.hasHardwareAsync();
    if (!hasHardware) {
      return { success: false, error: 'No biometric hardware found on this device.' };
    }

    const isEnrolled = await activeAdapter.isEnrolledAsync();
    if (!isEnrolled) {
      return { success: false, error: 'No biometric credentials (fingerprints) enrolled on this phone.' };
    }

    return await activeAdapter.authenticateAsync({
      promptMessage,
      fallbackLabel: 'Use Device PIN / Password',
      disableDeviceFallback: false,
    });
  } catch (err: any) {
    return { success: false, error: err?.message || 'Biometric authentication failed.' };
  }
}

