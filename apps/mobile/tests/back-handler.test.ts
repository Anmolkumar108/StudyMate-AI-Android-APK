import assert from 'node:assert';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

describe('Android Hardware Back Handler & Navigation Protection', () => {
  const layoutPath = path.resolve(__dirname, '../src/app/_layout.tsx');

  it('verifies _layout.tsx imports and registers BackHandler for Android', () => {
    assert.ok(fs.existsSync(layoutPath), 'Root layout file must exist');
    const content = fs.readFileSync(layoutPath, 'utf-8');

    assert.ok(content.includes('BackHandler'), 'Must import BackHandler from react-native');
    assert.ok(content.includes("'hardwareBackPress'"), 'Must register hardwareBackPress event listener');
  });

  it('verifies safe back navigation from standalone inner routes to prevent app closure', () => {
    const content = fs.readFileSync(layoutPath, 'utf-8');

    assert.ok(
      content.includes('isStandaloneRoute'),
      'Must check if route is standalone to safely navigate back'
    );
    assert.ok(
      content.includes('router.canGoBack()'),
      'Must verify if router can go back before calling back'
    );
    assert.ok(
      content.includes('router.back()'),
      'Must call router.back() when hardware back is pressed'
    );
  });

  it('verifies secondary tabs navigate back to Home rather than exiting', () => {
    const content = fs.readFileSync(layoutPath, 'utf-8');

    assert.ok(
      content.includes("currentRoute !== 'index'"),
      'Must check if user is on secondary tab to navigate to Home'
    );
    assert.ok(
      content.includes("router.replace('/')"),
      'Must fallback to Home rather than killing the app'
    );
  });

  it('verifies double-back to exit safety pattern on Android', () => {
    const content = fs.readFileSync(layoutPath, 'utf-8');

    assert.ok(
      content.includes('Press back again to exit'),
      'Must show standard Android double-back toast warning on Home screen'
    );
    assert.ok(
      content.includes('lastBackPressTime'),
      'Must track timestamp to debounce back presses and prevent accidental exit'
    );
  });

  it('verifies all modals have onRequestClose to handle hardware back cleanly', () => {
    const examsPath = path.resolve(__dirname, '../src/app/exams.tsx');
    const timetablePath = path.resolve(__dirname, '../src/app/timetable.tsx');
    const tasksPath = path.resolve(__dirname, '../src/app/tasks.tsx');

    const examsContent = fs.readFileSync(examsPath, 'utf-8');
    assert.ok(
      examsContent.includes('onRequestClose={() => setIsModalOpen(false)}'),
      'Exams modal must handle Android hardware back'
    );

    const timetableContent = fs.readFileSync(timetablePath, 'utf-8');
    assert.ok(
      timetableContent.includes('onRequestClose={() => setIsAttendanceModalOpen(false)}'),
      'Timetable attendance modal must handle Android hardware back'
    );
    assert.ok(
      timetableContent.includes('onRequestClose={() => setIsModalOpen(false)}'),
      'Timetable schedule modal must handle Android hardware back'
    );

    const tasksContent = fs.readFileSync(tasksPath, 'utf-8');
    assert.ok(
      tasksContent.includes('onRequestClose={() => setIsModalOpen(false)}'),
      'Tasks modal must handle Android hardware back'
    );
  });
});

