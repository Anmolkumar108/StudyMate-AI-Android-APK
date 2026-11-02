import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

describe('Flashcards UI & Screen Integrity', () => {
  it('verifies Flashcards screen exists and integrates design system primitives', () => {
    const filePath = path.resolve(__dirname, '../src/app/flashcards.tsx');
    assert.ok(fs.existsSync(filePath), 'Flashcards screen src/app/flashcards.tsx must exist');

    const content = fs.readFileSync(filePath, 'utf-8');

    assert.ok(content.includes('ScreenWrapper'), 'Must integrate ScreenWrapper primitive');
    assert.ok(content.includes('EmptyState'), 'Must integrate EmptyState primitive');
    assert.ok(content.includes('DeckCard'), 'Must integrate DeckCard component');
    assert.ok(content.includes('FlashcardFlipCard'), 'Must integrate FlashcardFlipCard component');
    assert.ok(content.includes('DeckFormModal'), 'Must integrate DeckFormModal');
    assert.ok(content.includes('CardFormModal'), 'Must integrate CardFormModal');
    assert.ok(content.includes('useFlashcards'), 'Must consume useFlashcards hook');
    assert.ok(content.includes('useSubjects'), 'Must consume useSubjects hook');
  });

  it('verifies DeckCard component structure and accessibility', () => {
    const filePath = path.resolve(
      __dirname,
      '../src/components/flashcards/deck-card.tsx'
    );
    assert.ok(fs.existsSync(filePath), 'DeckCard must exist');

    const content = fs.readFileSync(filePath, 'utf-8');
    assert.ok(content.includes('deck.card_count'), 'Must show card count');
    assert.ok(content.includes('subjectName'), 'Must support subject association');
    assert.ok(content.includes('Study Now'), 'Must provide quick Study action');
    assert.ok(content.includes('accessibilityRole="button"'), 'Must have accessible role');
    assert.ok(
      content.includes('AccessibilityInfo.isReduceMotionEnabled'),
      'Must respect reduced motion preferences'
    );
  });

  it('verifies FlashcardFlipCard implements 3D flip transform and accessible toggle', () => {
    const filePath = path.resolve(
      __dirname,
      '../src/components/flashcards/flashcard-flip-card.tsx'
    );
    assert.ok(fs.existsSync(filePath), 'FlashcardFlipCard must exist');

    const content = fs.readFileSync(filePath, 'utf-8');
    assert.ok(content.includes('rotateY'), 'Must use rotateY for flip effect');
    assert.ok(content.includes('isFlipped'), 'Must react to isFlipped state');
    assert.ok(content.includes('QUESTION'), 'Must render Question front face');
    assert.ok(content.includes('ANSWER'), 'Must render Answer back face');
    assert.ok(content.includes('accessibilityRole="button"'), 'Must be accessible button');
  });

  it('verifies DeckFormModal includes title validation and subject selector', () => {
    const filePath = path.resolve(
      __dirname,
      '../src/components/flashcards/deck-form-modal.tsx'
    );
    assert.ok(fs.existsSync(filePath), 'DeckFormModal must exist');

    const content = fs.readFileSync(filePath, 'utf-8');
    assert.ok(content.includes('validateDeckForm'), 'Must run client-side validation');
    assert.ok(content.includes('subjects.map'), 'Must render user subject options');
    assert.ok(content.includes('Deck Title'), 'Must include title input');
  });

  it('verifies CardFormModal includes question and answer inputs with validation', () => {
    const filePath = path.resolve(
      __dirname,
      '../src/components/flashcards/card-form-modal.tsx'
    );
    assert.ok(fs.existsSync(filePath), 'CardFormModal must exist');

    const content = fs.readFileSync(filePath, 'utf-8');
    assert.ok(content.includes('validateCardForm'), 'Must run card validation');
    assert.ok(content.includes('Question / Front'), 'Must include question input');
    assert.ok(content.includes('Answer / Back'), 'Must include answer input');
  });

  it('verifies RootLayout registers flashcards as a standalone route', () => {
    const filePath = path.resolve(__dirname, '../src/app/_layout.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');
    assert.ok(
      content.includes("'flashcards'"),
      'RootLayout must include flashcards in standalone routes'
    );
  });
});
