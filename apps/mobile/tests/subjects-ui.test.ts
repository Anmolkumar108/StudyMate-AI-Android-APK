import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

describe('Subjects Screen UI Redesign Integrity', () => {
  it('verifies SubjectsScreen integrates ScreenWrapper, Input, and EmptyState primitives', () => {
    const filePath = path.resolve(__dirname, '../src/app/subjects.tsx');
    assert.ok(fs.existsSync(filePath), 'SubjectsScreen file must exist');

    const content = fs.readFileSync(filePath, 'utf-8');

    // Header checks
    assert.ok(content.includes('My Subjects'), 'Must contain My Subjects title');
    assert.ok(
      content.includes('Organize your academic journey.'),
      'Must contain My Subjects subtitle'
    );
    assert.ok(
      content.includes('ACADEMIC COURSES'),
      'Must contain category pill tag'
    );

    // Primitive usage
    assert.ok(
      content.includes('<ScreenWrapper'),
      'Must use ScreenWrapper for responsive safe area & layout'
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
      content.includes('No matching subjects found'),
      'Must have dedicated no-results empty state'
    );
  });

  it('verifies SubjectCard uses Card, Badge, and color accent bar', () => {
    const filePath = path.resolve(__dirname, '../src/components/subjects/subject-card.tsx');
    assert.ok(fs.existsSync(filePath), 'SubjectCard file must exist');

    const content = fs.readFileSync(filePath, 'utf-8');

    assert.ok(
      content.includes('<Card'),
      'SubjectCard must use Card primitive'
    );
    assert.ok(
      content.includes('<Badge'),
      'SubjectCard must use Badge primitive for code and semester'
    );
    assert.ok(
      content.includes('colorBar'),
      'SubjectCard must include color accent bar'
    );
    assert.ok(
      content.includes('accessibilityHint='),
      'SubjectCard must provide accessible hint'
    );
  });

  it('verifies SubjectDetailModal includes safe deletion confirmation and details', () => {
    const filePath = path.resolve(__dirname, '../src/components/subjects/subject-detail-modal.tsx');
    assert.ok(fs.existsSync(filePath), 'SubjectDetailModal file must exist');

    const content = fs.readFileSync(filePath, 'utf-8');

    assert.ok(
      content.includes('Delete Subject'),
      'SubjectDetailModal must include Delete Subject action'
    );
    assert.ok(
      content.includes('Edit Subject'),
      'SubjectDetailModal must include Edit Subject action'
    );
    assert.ok(
      content.includes('Alert.alert('),
      'SubjectDetailModal must confirm before deleting on mobile'
    );
    assert.ok(
      content.includes('DESCRIPTION & SYLLABUS'),
      'SubjectDetailModal must include Description section'
    );
    assert.ok(
      content.includes('ACADEMIC TIMELINE'),
      'SubjectDetailModal must include Academic Timeline section'
    );
  });

  it('verifies SubjectFormModal uses Input primitive and handles validation', () => {
    const filePath = path.resolve(__dirname, '../src/components/subjects/subject-form-modal.tsx');
    assert.ok(fs.existsSync(filePath), 'SubjectFormModal file must exist');

    const content = fs.readFileSync(filePath, 'utf-8');

    assert.ok(
      content.includes('<Input'),
      'SubjectFormModal must use Input primitive'
    );
    assert.ok(
      content.includes('validateSubjectForm'),
      'SubjectFormModal must validate form inputs'
    );
    assert.ok(
      content.includes('SUBJECT_COLOR_PRESETS'),
      'SubjectFormModal must use color presets'
    );
    assert.ok(
      content.includes('KeyboardAvoidingView'),
      'SubjectFormModal must handle keyboard gracefully'
    );
  });
});
