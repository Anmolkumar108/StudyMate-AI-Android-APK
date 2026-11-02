import assert from 'node:assert';
import { describe, it } from 'node:test';

describe('Navigation Routes & Study Hub Integrity', () => {
  it('defines the 4 required standard Expo Router bottom tab routes', () => {
    const expectedRoutes = [
      { name: 'index', path: '/', label: 'Home' },
      { name: 'subjects', path: '/subjects', label: 'Subjects' },
      { name: 'notes', path: '/notes', label: 'Notes' },
      { name: 'explore', path: '/explore', label: 'Study Hub' },
    ];

    assert.strictEqual(expectedRoutes.length, 4);
    assert.strictEqual(expectedRoutes[0].name, 'index');
    assert.strictEqual(expectedRoutes[1].name, 'subjects');
    assert.strictEqual(expectedRoutes[2].name, 'notes');
    assert.strictEqual(expectedRoutes[3].name, 'explore');
  });

  it('verifies Study Hub is simplified, removed academic resources, and has honest Coming Soon state', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');

    const exploreFilePath = path.resolve(__dirname, '../src/app/explore.tsx');
    assert.ok(fs.existsSync(exploreFilePath), 'Study Hub file src/app/explore.tsx must exist');

    const content = fs.readFileSync(exploreFilePath, 'utf-8');

    // Must NOT contain the old Academic Resources section or external resource cards
    assert.ok(
      !content.includes('ACADEMIC_RESOURCES'),
      'Must not contain ACADEMIC_RESOURCES array'
    );
    assert.ok(
      !content.includes('Open Academic Resources'),
      'Must not contain Open Academic Resources section'
    );
    assert.ok(!content.includes('arxiv.org'), 'Must not contain arXiv resource');
    assert.ok(!content.includes('openstax.org'), 'Must not contain OpenStax resource');
    assert.ok(!content.includes('gutenberg.org'), 'Must not contain Gutenberg resource');

    // Must NOT contain misleading labels or fake algorithm widgets
    assert.ok(
      !content.includes('Upcoming V1.1'),
      'Must not contain misleading Upcoming V1.1 badge'
    );
    assert.ok(
      !content.includes('Spaced Repetition Algorithm'),
      'Must not contain fake algorithm feature badge'
    );
    assert.ok(
      !content.includes('Confidence Ratings (1-5)'),
      'Must not contain fake confidence rating badge'
    );

    // Must contain Focus Timer card with working navigation
    assert.ok(content.includes('Focus Timer'), 'Must include Focus Timer card');
    assert.ok(content.includes("router.push('/pomodoro'"), 'Must navigate to /pomodoro');
    assert.ok(
      content.includes('loadPomodoroSettings'),
      'Must dynamically load configured timer durations'
    );

    // Must contain working Active Tool entry point for Active Recall & Flashcards
    assert.ok(
      content.includes('Active Recall & Flashcards'),
      'Must include Active Recall & Flashcards entry point'
    );
    assert.ok(
      content.includes("router.push('/flashcards'"),
      'Must navigate to /flashcards'
    );
    assert.ok(
      content.includes('Open Flashcards →'),
      'Must display Open Flashcards action button'
    );
  });

  it('verifies distinct icon symbols assigned to each tab', () => {
    const tabSymbols = {
      index: { android: 'home', sf: 'house.fill' },
      subjects: { android: 'menu_book', sf: 'book.closed.fill' },
      notes: { android: 'edit_note', sf: 'note.text' },
      explore: { android: 'school', sf: 'sparkles' },
    };

    const androidIcons = Object.values(tabSymbols).map((s) => s.android);
    const sfIcons = Object.values(tabSymbols).map((s) => s.sf);

    // Assert all 4 Android Material icons are unique
    const uniqueAndroidIcons = new Set(androidIcons);
    assert.strictEqual(
      uniqueAndroidIcons.size,
      4,
      'Every navigation tab must have a unique Android Material icon'
    );

    // Assert all 4 iOS SF Symbols are unique
    const uniqueSfIcons = new Set(sfIcons);
    assert.strictEqual(
      uniqueSfIcons.size,
      4,
      'Every navigation tab must have a unique iOS SF Symbol'
    );
  });

  it('verifies Home Dashboard removed session security section and links to Settings', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');

    const homeFilePath = path.resolve(__dirname, '../src/app/index.tsx');
    assert.ok(fs.existsSync(homeFilePath), 'Home screen file src/app/index.tsx must exist');

    const homeContent = fs.readFileSync(homeFilePath, 'utf-8');

    // Must NOT contain the old Session & Account section or logout buttons on Home
    assert.ok(
      !homeContent.includes('SECTION G: Account & Session Management'),
      'Home dashboard must not contain SECTION G Session & Account Management'
    );
    assert.ok(
      !homeContent.includes('title="Log Out"'),
      'Home dashboard must not contain a Log Out button'
    );
    assert.ok(
      !homeContent.includes('title="Log Out All Devices"'),
      'Home dashboard must not contain a Log Out All Devices button'
    );

    // Must contain navigation to /settings in the header
    assert.ok(
      homeContent.includes("router.push('/settings'"),
      'Home dashboard must include navigation to /settings'
    );
    assert.ok(
      homeContent.includes('accessibilityLabel="Settings"'),
      'Home dashboard must include an accessible Settings button'
    );
  });

  it('verifies dedicated Settings screen contains account identity and session security controls', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');

    const settingsFilePath = path.resolve(__dirname, '../src/app/settings.tsx');
    assert.ok(fs.existsSync(settingsFilePath), 'Settings screen file src/app/settings.tsx must exist');

    const settingsContent = fs.readFileSync(settingsFilePath, 'utf-8');

    // Must contain Student Profile and Account Info
    assert.ok(
      settingsContent.includes('Student Profile'),
      'Settings must include Student Profile section'
    );
    assert.ok(
      settingsContent.includes('Daily Study Goal'),
      'Settings must include Daily Study Goal'
    );

    // Must contain Session & Security with both logout capabilities
    assert.ok(
      settingsContent.includes('Session & Security'),
      'Settings must include Session & Security section'
    );
    assert.ok(
      settingsContent.includes('title="Log Out"'),
      'Settings must include Log Out button'
    );
    assert.ok(
      settingsContent.includes('title="Log Out All Devices"'),
      'Settings must include Log Out All Devices button'
    );

    // Must contain App Information section
    assert.ok(
      settingsContent.includes('About StudyMate AI'),
      'Settings must include About StudyMate AI section'
    );

    // Must contain back navigation
    assert.ok(
      settingsContent.includes('accessibilityLabel="Go back to Home"'),
      'Settings must include accessible Back button'
    );
    assert.ok(
      settingsContent.includes('router.back()'),
      'Settings must support router.back() navigation'
    );
  });
});
