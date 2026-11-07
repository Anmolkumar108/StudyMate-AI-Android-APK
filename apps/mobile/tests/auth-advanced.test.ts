import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { authApi } from '../src/services/api/client';
import { clearTokens, getAccessToken, getRefreshToken } from '../src/services/storage/token-storage';

describe('Advanced Authentication Client Features', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    await clearTokens();
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    await clearTokens();
  });

  it('authenticates with Google OAuth tokens and saves JWT tokens', async () => {
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/v1/auth/google')) {
        return new Response(
          JSON.stringify({
            access_token: 'google_jwt_access_123',
            refresh_token: 'google_jwt_refresh_456',
            token_type: 'bearer',
            expires_in: 900,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
    };

    const tokens = await authApi.loginWithGoogle({
      id_token: 'valid_google_id_token_xyz',
      device_name: 'Android Emulator',
      device_os: 'android',
    });

    assert.equal(tokens.access_token, 'google_jwt_access_123');
    assert.equal(tokens.refresh_token, 'google_jwt_refresh_456');

    // Tokens must be saved in storage
    const storedAccess = await getAccessToken();
    const storedRefresh = await getRefreshToken();
    assert.equal(storedAccess, 'google_jwt_access_123');
    assert.equal(storedRefresh, 'google_jwt_refresh_456');
  });

  it('verifies email with cryptographic token', async () => {
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/v1/auth/verify-email')) {
        return new Response(
          JSON.stringify({
            message: 'Email verified successfully.',
            verified: true,
            email: 'student@example.com',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
    };

    const res = await authApi.verifyEmail('valid_verification_token_abc');
    assert.equal(res.verified, true);
    assert.equal(res.email, 'student@example.com');
  });

  it('resends verification email with rate limit cooldown handling', async () => {
    let callCount = 0;
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/v1/auth/resend-verification')) {
        callCount++;
        if (callCount === 1) {
          return new Response(
            JSON.stringify({ message: 'Verification link resent.' }),
            { status: 200, headers: { 'content-type': 'application/json' } }
          );
        } else {
          return new Response(
            JSON.stringify({ detail: 'Please wait 60 seconds before requesting a new verification email.' }),
            { status: 429, headers: { 'content-type': 'application/json' } }
          );
        }
      }
      return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
    };

    const first = await authApi.resendVerification('student@example.com');
    assert.equal(first.message, 'Verification link resent.');

    await assert.rejects(async () => {
      await authApi.resendVerification('student@example.com');
    }, /429|Please wait 60 seconds/);
  });

  it('submits forgot password and reset password requests', async () => {
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/v1/auth/forgot-password')) {
        return new Response(
          JSON.stringify({ message: 'Password reset link sent.' }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }
      if (url.includes('/api/v1/auth/reset-password')) {
        return new Response(
          JSON.stringify({ message: 'Password reset successfully.' }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
    };

    const forgotRes = await authApi.forgotPassword('student@example.com');
    assert.equal(forgotRes.message, 'Password reset link sent.');

    const resetRes = await authApi.resetPassword({
      token: 'reset_token_123',
      new_password: 'NewStrongPassword123!',
    });
    assert.equal(resetRes.message, 'Password reset successfully.');
  });
});

