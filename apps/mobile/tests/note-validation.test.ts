import assert from 'node:assert';
import { describe, it } from 'node:test';

import { validateNoteForm } from '../src/types/note';

describe('Note Form Validation', () => {
  it('validates a complete valid note input', () => {
    const result = validateNoteForm({
      title: 'Machine Learning - Linear Regression',
      content: 'Cost function: J(theta) = 1/(2m) * sum((h(x) - y)^2). Gradient descent updates.',
    });

    assert.strictEqual(result.isValid, true);
    assert.deepStrictEqual(result.errors, {});
  });

  it('validates a minimal valid note input', () => {
    const result = validateNoteForm({
      title: 'Quick formula',
      content: 'E = mc^2',
    });

    assert.strictEqual(result.isValid, true);
    assert.deepStrictEqual(result.errors, {});
  });

  it('rejects empty note title', () => {
    const result = validateNoteForm({
      title: '',
      content: 'Valid content',
    });

    assert.strictEqual(result.isValid, false);
    assert.strictEqual(result.errors.title, 'Note title is required.');
  });

  it('rejects whitespace-only note title', () => {
    const result = validateNoteForm({
      title: '     ',
      content: 'Valid content',
    });

    assert.strictEqual(result.isValid, false);
    assert.strictEqual(result.errors.title, 'Note title is required.');
  });

  it('rejects note title exceeding 200 characters', () => {
    const longTitle = 'T'.repeat(201);
    const result = validateNoteForm({
      title: longTitle,
      content: 'Valid content',
    });

    assert.strictEqual(result.isValid, false);
    assert.strictEqual(result.errors.title, 'Note title cannot exceed 200 characters.');
  });

  it('accepts note title at upper boundary of 200 characters', () => {
    const maxTitle = 'T'.repeat(200);
    const result = validateNoteForm({
      title: maxTitle,
      content: 'Valid content',
    });

    assert.strictEqual(result.isValid, true);
    assert.deepStrictEqual(result.errors, {});
  });

  it('rejects empty note content', () => {
    const result = validateNoteForm({
      title: 'Valid Title',
      content: '',
    });

    assert.strictEqual(result.isValid, false);
    assert.strictEqual(result.errors.content, 'Note content is required.');
  });

  it('rejects whitespace-only note content', () => {
    const result = validateNoteForm({
      title: 'Valid Title',
      content: '     \n  \t  ',
    });

    assert.strictEqual(result.isValid, false);
    assert.strictEqual(result.errors.content, 'Note content is required.');
  });

  it('reports both title and content errors when both are invalid', () => {
    const result = validateNoteForm({
      title: '',
      content: '',
    });

    assert.strictEqual(result.isValid, false);
    assert.strictEqual(result.errors.title, 'Note title is required.');
    assert.strictEqual(result.errors.content, 'Note content is required.');
  });
});
