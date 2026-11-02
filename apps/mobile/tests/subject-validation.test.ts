import assert from 'node:assert';
import { describe, it } from 'node:test';

import { SUBJECT_COLOR_PRESETS, validateSubjectForm } from '../src/types/subject';

describe('Subject Form Validation', () => {
  it('validates a complete valid subject input', () => {
    const result = validateSubjectForm({
      name: 'Introduction to Computer Science',
      code: 'CS-101',
      semester: 1,
      description: 'Fundamentals of computing, variables, loops, and functions.',
    });

    assert.strictEqual(result.isValid, true);
    assert.deepStrictEqual(result.errors, {});
  });

  it('validates minimal valid subject input with only name', () => {
    const result = validateSubjectForm({
      name: 'History of Art',
    });

    assert.strictEqual(result.isValid, true);
    assert.deepStrictEqual(result.errors, {});
  });

  it('rejects empty subject name', () => {
    const result = validateSubjectForm({
      name: '',
    });

    assert.strictEqual(result.isValid, false);
    assert.strictEqual(result.errors.name, 'Subject name is required.');
  });

  it('rejects whitespace-only subject name', () => {
    const result = validateSubjectForm({
      name: '     ',
    });

    assert.strictEqual(result.isValid, false);
    assert.strictEqual(result.errors.name, 'Subject name is required.');
  });

  it('rejects subject name exceeding 150 characters', () => {
    const longName = 'A'.repeat(151);
    const result = validateSubjectForm({
      name: longName,
    });

    assert.strictEqual(result.isValid, false);
    assert.strictEqual(result.errors.name, 'Subject name cannot exceed 150 characters.');
  });

  it('rejects course code exceeding 50 characters', () => {
    const longCode = 'C'.repeat(51);
    const result = validateSubjectForm({
      name: 'Organic Chemistry',
      code: longCode,
    });

    assert.strictEqual(result.isValid, false);
    assert.strictEqual(result.errors.code, 'Course code cannot exceed 50 characters.');
  });

  it('rejects description exceeding 2000 characters', () => {
    const longDesc = 'D'.repeat(2001);
    const result = validateSubjectForm({
      name: 'Philosophy',
      description: longDesc,
    });

    assert.strictEqual(result.isValid, false);
    assert.strictEqual(result.errors.description, 'Description cannot exceed 2000 characters.');
  });

  it('rejects semester less than 1', () => {
    const result = validateSubjectForm({
      name: 'Microeconomics',
      semester: 0,
    });

    assert.strictEqual(result.isValid, false);
    assert.strictEqual(
      result.errors.semester,
      'Semester must be a whole number between 1 and 50.'
    );
  });

  it('rejects negative semester', () => {
    const result = validateSubjectForm({
      name: 'Microeconomics',
      semester: -3,
    });

    assert.strictEqual(result.isValid, false);
    assert.strictEqual(
      result.errors.semester,
      'Semester must be a whole number between 1 and 50.'
    );
  });

  it('rejects non-integer semester', () => {
    const result = validateSubjectForm({
      name: 'Physics',
      semester: 2.5,
    });

    assert.strictEqual(result.isValid, false);
    assert.strictEqual(
      result.errors.semester,
      'Semester must be a whole number between 1 and 50.'
    );
  });

  it('accepts string semester that converts to valid integer', () => {
    const result = validateSubjectForm({
      name: 'Statistics',
      semester: '4',
    });

    assert.strictEqual(result.isValid, true);
    assert.deepStrictEqual(result.errors, {});
  });

  it('provides accessible color presets with valid hex codes', () => {
    assert.ok(SUBJECT_COLOR_PRESETS.length >= 6);
    for (const preset of SUBJECT_COLOR_PRESETS) {
      assert.ok(preset.name.length > 0);
      assert.match(preset.hex, /^#[0-9A-Fa-f]{6}$/);
    }
  });
});
