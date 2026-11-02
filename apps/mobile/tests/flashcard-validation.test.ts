import assert from 'node:assert';
import { describe, it } from 'node:test';

import { validateCardForm, validateDeckForm } from '../src/types/flashcard';

describe('Flashcard & Deck Validation Utilities', () => {
  describe('Deck form validation', () => {
    it('accepts valid deck input with title and description', () => {
      const res = validateDeckForm({
        title: 'Operating Systems',
        description: 'Memory virtualisation and scheduling algorithms.',
      });
      assert.strictEqual(res.isValid, true);
      assert.strictEqual(Object.keys(res.errors).length, 0);
    });

    it('accepts minimal valid deck with only title', () => {
      const res = validateDeckForm({ title: 'Physics 101' });
      assert.strictEqual(res.isValid, true);
    });

    it('rejects empty title', () => {
      const res = validateDeckForm({ title: '' });
      assert.strictEqual(res.isValid, false);
      assert.strictEqual(res.errors.title, 'Deck title is required.');
    });

    it('rejects whitespace-only title', () => {
      const res = validateDeckForm({ title: '     ' });
      assert.strictEqual(res.isValid, false);
      assert.strictEqual(res.errors.title, 'Deck title is required.');
    });

    it('rejects title exceeding 200 characters', () => {
      const res = validateDeckForm({ title: 'A'.repeat(201) });
      assert.strictEqual(res.isValid, false);
      assert.strictEqual(res.errors.title, 'Deck title cannot exceed 200 characters.');
    });

    it('rejects description exceeding 2000 characters', () => {
      const res = validateDeckForm({
        title: 'Valid Title',
        description: 'D'.repeat(2001),
      });
      assert.strictEqual(res.isValid, false);
      assert.strictEqual(res.errors.description, 'Description cannot exceed 2000 characters.');
    });
  });

  describe('Card form validation', () => {
    it('accepts valid question and answer', () => {
      const res = validateCardForm({
        question: 'What is a binary search tree?',
        answer: 'A tree where left child < parent and right child > parent.',
      });
      assert.strictEqual(res.isValid, true);
      assert.strictEqual(Object.keys(res.errors).length, 0);
    });

    it('rejects empty question', () => {
      const res = validateCardForm({
        question: '',
        answer: 'Valid answer',
      });
      assert.strictEqual(res.isValid, false);
      assert.strictEqual(res.errors.question, 'Question is required.');
    });

    it('rejects whitespace-only question', () => {
      const res = validateCardForm({
        question: '    ',
        answer: 'Valid answer',
      });
      assert.strictEqual(res.isValid, false);
      assert.strictEqual(res.errors.question, 'Question is required.');
    });

    it('rejects empty answer', () => {
      const res = validateCardForm({
        question: 'Valid question',
        answer: '',
      });
      assert.strictEqual(res.isValid, false);
      assert.strictEqual(res.errors.answer, 'Answer is required.');
    });

    it('rejects whitespace-only answer', () => {
      const res = validateCardForm({
        question: 'Valid question',
        answer: '    ',
      });
      assert.strictEqual(res.isValid, false);
      assert.strictEqual(res.errors.answer, 'Answer is required.');
    });

    it('rejects question exceeding 2000 characters', () => {
      const res = validateCardForm({
        question: 'Q'.repeat(2001),
        answer: 'Valid answer',
      });
      assert.strictEqual(res.isValid, false);
      assert.strictEqual(res.errors.question, 'Question cannot exceed 2000 characters.');
    });

    it('rejects answer exceeding 2000 characters', () => {
      const res = validateCardForm({
        question: 'Valid question',
        answer: 'A'.repeat(2001),
      });
      assert.strictEqual(res.isValid, false);
      assert.strictEqual(res.errors.answer, 'Answer cannot exceed 2000 characters.');
    });
  });
});
