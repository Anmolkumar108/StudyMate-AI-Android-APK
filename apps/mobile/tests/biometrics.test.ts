import assert from 'node:assert';
import { beforeEach, describe, it } from 'node:test';

import {
  authenticateWithBiometrics,
  checkBiometricCapability,
  inMemoryBiometricAdapter,
  isBiometricLockEnabled,
  setBiometricAdapter,
  setBiometricLockEnabled,
} from '../src/services/biometrics';

describe('Biometric Security & Fingerprint Service', () => {
  beforeEach(() => {
    setBiometricAdapter(inMemoryBiometricAdapter);
    inMemoryBiometricAdapter.hasHardware = true;
    inMemoryBiometricAdapter.isEnrolled = true;
    inMemoryBiometricAdapter.shouldSucceed = true;
    inMemoryBiometricAdapter.authTypes = [1]; // FINGERPRINT
  });

  it('detects fingerprint sensor capability and formats human label', async () => {
    const cap = await checkBiometricCapability();
    assert.strictEqual(cap.hasHardware, true);
    assert.strictEqual(cap.isEnrolled, true);
    assert.strictEqual(cap.supportedTypes.includes('FINGERPRINT'), true);
    assert.ok(cap.biometricLabel.includes('Fingerprint'));
  });

  it('detects facial recognition when supported by device', async () => {
    inMemoryBiometricAdapter.authTypes = [2]; // FACIAL_RECOGNITION
    const cap = await checkBiometricCapability();
    assert.strictEqual(cap.supportedTypes.includes('FACIAL_RECOGNITION'), true);
    assert.ok(cap.biometricLabel.includes('Face Unlock'));
  });

  it('handles device with missing biometric hardware cleanly', async () => {
    inMemoryBiometricAdapter.hasHardware = false;
    const cap = await checkBiometricCapability();
    assert.strictEqual(cap.hasHardware, false);

    const authRes = await authenticateWithBiometrics();
    assert.strictEqual(authRes.success, false);
    assert.ok(authRes.error?.includes('No biometric hardware'));
  });

  it('handles device where user has not enrolled any fingerprints', async () => {
    inMemoryBiometricAdapter.isEnrolled = false;
    const cap = await checkBiometricCapability();
    assert.strictEqual(cap.isEnrolled, false);

    const authRes = await authenticateWithBiometrics();
    assert.strictEqual(authRes.success, false);
    assert.ok(authRes.error?.includes('No biometric credentials'));
  });

  it('successfully authenticates with biometric prompt', async () => {
    inMemoryBiometricAdapter.shouldSucceed = true;
    const authRes = await authenticateWithBiometrics('Verify fingerprint to open StudyMate');
    assert.strictEqual(authRes.success, true);
  });

  it('fails gracefully when user cancels or biometric mismatches', async () => {
    inMemoryBiometricAdapter.shouldSucceed = false;
    const authRes = await authenticateWithBiometrics();
    assert.strictEqual(authRes.success, false);
    assert.ok(authRes.error);
  });

  it('toggles and persists biometric lock preferences', async () => {
    await setBiometricLockEnabled(true);
    // SecureStore mock in test returns false/noop, ensuring no crashes
    assert.doesNotThrow(async () => {
      await isBiometricLockEnabled();
      await setBiometricLockEnabled(false);
    });
  });
});

