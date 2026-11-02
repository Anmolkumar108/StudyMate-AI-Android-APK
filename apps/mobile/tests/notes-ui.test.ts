import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

describe('Notes Screen UI Redesign Integrity', () => {
  it('verifies NotesScreen integrates ScreenWrapper, Input, filter chips, FAB, and EmptyState primitives', () => {
    const filePath = path.resolve(__dirname, '../src/app/notes.tsx');
    assert.ok(fs.existsSync(filePath), 'NotesScreen file must exist');

    const content = fs.readFileSync(filePath, 'utf-8');

    // Header checks
    assert.ok(content.includes('Study Notes'), 'Must contain Study Notes title');
    assert.ok(
      content.includes('STUDY WORKSPACE'),
      'Must contain category pill tag'
    );
    assert.ok(
      content.includes('Capture ideas, lecture summaries, and formulas.'),
      'Must contain Study Notes subtitle'
    );

    // Primitive usage
    assert.ok(
      content.includes('<ScreenWrapper'),
      'Must use ScreenWrapper for responsive layout'
    );
    assert.ok(
      content.includes('includeTabInset'),
      'ScreenWrapper must include tab inset'
    );
    assert.ok(
      content.includes('<Input'),
      'Search bar must use the Phase 1 reusable Input component'
    );
    assert.ok(
      content.includes('showClearButton'),
      'Search input must support clear button'
    );
    assert.ok(
      content.includes('<EmptyState'),
      'Must use EmptyState for empty and no-results states'
    );
    assert.ok(
      content.includes('No matching notes found'),
      'Must have dedicated no-results empty state'
    );

    // Filter chips
    assert.ok(
      content.includes('filterChip'),
      'Must include filter chips for filtering notes'
    );
    assert.ok(
      content.includes('Pinned'),
      'Must include Pinned notes filter chip'
    );

    // Skeleton loading
    assert.ok(
      content.includes('<NoteCardSkeleton'),
      'NotesScreen must use animated skeleton loading while fetching notes'
    );

    // Floating action button
    assert.ok(
      content.includes('floatingAddButton'),
      'NotesScreen must include prominent floating action button for quick creation'
    );
    assert.ok(
      content.includes('New Note'),
      'Floating action button must display New Note label'
    );
  });

  it('verifies NoteCard uses Card, Badge, color accent bar, entrance animation, and pin button', () => {
    const filePath = path.resolve(__dirname, '../src/components/notes/note-card.tsx');
    assert.ok(fs.existsSync(filePath), 'NoteCard file must exist');

    const content = fs.readFileSync(filePath, 'utf-8');

    assert.ok(
      content.includes('<Card'),
      'NoteCard must use Card primitive'
    );
    assert.ok(
      content.includes('<Badge'),
      'NoteCard must use Badge primitive for pinned status and subjects'
    );
    assert.ok(
      content.includes('accentBar'),
      'NoteCard must include color accent bar'
    );
    assert.ok(
      content.includes('accessibilityHint='),
      'NoteCard must provide accessible hint'
    );
    assert.ok(
      content.includes('onTogglePin'),
      'NoteCard must support quick pin toggle'
    );
    assert.ok(
      content.includes('wordCount'),
      'NoteCard must calculate and display word count'
    );
    assert.ok(
      content.includes('translateYAnim'),
      'NoteCard must support smooth entrance animation'
    );
    assert.ok(
      content.includes('pinScaleAnim'),
      'NoteCard must provide feedback animation on pin toggle'
    );
  });

  it('verifies NoteCardSkeleton defines pulsing placeholder cards with native animation', () => {
    const filePath = path.resolve(__dirname, '../src/components/notes/note-card-skeleton.tsx');
    assert.ok(fs.existsSync(filePath), 'NoteCardSkeleton file must exist');

    const content = fs.readFileSync(filePath, 'utf-8');

    assert.ok(
      content.includes('skeletonCard'),
      'NoteCardSkeleton must render skeleton cards'
    );
    assert.ok(
      content.includes('Animated.loop'),
      'NoteCardSkeleton must animate opacity loop'
    );
    assert.ok(
      content.includes('isReduceMotionEnabled'),
      'NoteCardSkeleton must respect accessibility reduced motion'
    );
    assert.ok(
      content.includes('useNativeDriver: true'),
      'NoteCardSkeleton must use native driver for smooth 60fps performance'
    );
  });

  it('verifies NoteDetailModal includes safe deletion confirmation, metrics, and details', () => {
    const filePath = path.resolve(__dirname, '../src/components/notes/note-detail-modal.tsx');
    assert.ok(fs.existsSync(filePath), 'NoteDetailModal file must exist');

    const content = fs.readFileSync(filePath, 'utf-8');

    assert.ok(
      content.includes('Delete Note'),
      'NoteDetailModal must include Delete Note action'
    );
    assert.ok(
      content.includes('Edit Note'),
      'NoteDetailModal must include Edit Note action'
    );
    assert.ok(
      content.includes('Alert.alert('),
      'NoteDetailModal must confirm before deleting on mobile'
    );
    assert.ok(
      content.includes('ACADEMIC TIMELINE'),
      'NoteDetailModal must include Academic Timeline section'
    );
    assert.ok(
      content.includes('NOTE CONTENT'),
      'NoteDetailModal must include Note Content section'
    );
    assert.ok(
      content.includes('readMinutes'),
      'NoteDetailModal must compute estimated reading time'
    );
    assert.ok(
      content.includes('handleBar'),
      'NoteDetailModal must display bottom-sheet handle'
    );
  });

  it('verifies NoteFormModal uses Input primitive, handles validation, and shows counters', () => {
    const filePath = path.resolve(__dirname, '../src/components/notes/note-form-modal.tsx');
    assert.ok(fs.existsSync(filePath), 'NoteFormModal file must exist');

    const content = fs.readFileSync(filePath, 'utf-8');

    assert.ok(
      content.includes('<Input'),
      'NoteFormModal must use reusable Input component'
    );
    assert.ok(
      content.includes('validateNoteForm'),
      'NoteFormModal must run note form validation before submission'
    );
    assert.ok(
      content.includes('fieldErrors.title'),
      'NoteFormModal must show title validation error'
    );
    assert.ok(
      content.includes('fieldErrors.content'),
      'NoteFormModal must show content validation error'
    );
    assert.ok(
      content.includes('subjectChip'),
      'NoteFormModal must provide subject picker chips'
    );
    assert.ok(
      content.includes('Pin to Top'),
      'NoteFormModal must provide Pin to Top toggle'
    );
    assert.ok(
      content.includes('charCounter'),
      'NoteFormModal must show character counter for title'
    );
    assert.ok(
      content.includes('handleBar'),
      'NoteFormModal must display bottom-sheet handle'
    );
  });
});
