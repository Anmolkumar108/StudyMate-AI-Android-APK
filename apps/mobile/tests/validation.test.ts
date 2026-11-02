import assert from 'node:assert';
import { describe, it } from 'node:test';

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  validateConfirmPassword,
  validateEmail,
  validateFullName,
  validatePassword,
} from '../src/utils/validation';

describe('Input Validation Utilities', () => {
  describe('Email validation', () => {
    it('accepts valid university and standard email addresses', () => {
      assert.strictEqual(validateEmail('student@university.edu').isValid, true);
      assert.strictEqual(validateEmail('john.doe@mit.edu').isValid, true);
      assert.strictEqual(validateEmail('test_user+1@domain.co.uk').isValid, true);
    });

    it('rejects empty or whitespace-only emails', () => {
      const res = validateEmail('   ');
      assert.strictEqual(res.isValid, false);
      assert.strictEqual(res.error, 'Email is required.');
    });

    it('rejects malformed email formats', () => {
      assert.strictEqual(validateEmail('plainaddress').isValid, false);
      assert.strictEqual(validateEmail('@missingusername.com').isValid, false);
      assert.strictEqual(validateEmail('user@.com').isValid, false);
      assert.strictEqual(validateEmail('user@domain').isValid, false);
      assert.strictEqual(validateEmail('user with spaces@domain.com').isValid, false);
    });
  });

  describe('Password policy validation (8 - 128 characters)', () => {
    it('accepts passwords at lower bound (8 characters)', () => {
      const res = validatePassword('12345678');
      assert.strictEqual(res.isValid, true);
    });

    it('accepts passwords at upper bound (128 characters)', () => {
      const longPass = 'A'.repeat(PASSWORD_MAX_LENGTH);
      const res = validatePassword(longPass);
      assert.strictEqual(res.isValid, true);
    });

    it('accepts passwords containing spaces and symbols verbatim', () => {
      const res = validatePassword('My Secure Pass 2026!');
      assert.strictEqual(res.isValid, true);
    });

    it('rejects empty passwords', () => {
      const res = validatePassword('');
      assert.strictEqual(res.isValid, false);
      assert.strictEqual(res.error, 'Password is required.');
    });

    it('rejects passwords shorter than 8 characters', () => {
      const res = validatePassword('short12');
      assert.strictEqual(res.isValid, false);
      assert.strictEqual(
        res.error,
        `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`
      );
    });

    it('rejects passwords exceeding 128 characters', () => {
      const tooLongPass = 'B'.repeat(PASSWORD_MAX_LENGTH + 1);
      const res = validatePassword(tooLongPass);
      assert.strictEqual(res.isValid, false);
      assert.strictEqual(
        res.error,
        `Password must not exceed ${PASSWORD_MAX_LENGTH} characters.`
      );
    });
  });

  describe('Full name validation', () => {
    it('accepts valid full names', () => {
      assert.strictEqual(validateFullName('Anmol Kumar').isValid, true);
      assert.strictEqual(validateFullName('Mary-Jane Watson').isValid, true);
    });

    it('rejects empty or whitespace-only names', () => {
      const res = validateFullName('   ');
      assert.strictEqual(res.isValid, false);
      assert.strictEqual(res.error, 'Full name is required.');
    });

    it('rejects names exceeding 150 characters', () => {
      const tooLongName = 'X'.repeat(151);
      const res = validateFullName(tooLongName);
      assert.strictEqual(res.isValid, false);
    });
  });

  describe('Confirm password validation', () => {
    it('accepts matching passwords', () => {
      const res = validateConfirmPassword('SecurePassword123!', 'SecurePassword123!');
      assert.strictEqual(res.isValid, true);
    });

    it('rejects mismatched passwords', () => {
      const res = validateConfirmPassword('SecurePassword123!', 'DifferentPass456!');
      assert.strictEqual(res.isValid, false);
      assert.strictEqual(res.error, 'Passwords do not match.');
    });

    it('rejects empty confirm password', () => {
      const res = validateConfirmPassword('SecurePassword123!', '');
      assert.strictEqual(res.isValid, false);
      assert.strictEqual(res.error, 'Please confirm your password.');
    });
  });
});
