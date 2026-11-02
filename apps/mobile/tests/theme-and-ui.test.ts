import assert from 'node:assert';
import { describe, it } from 'node:test';

import {
  BorderRadius,
  BrandGradients,
  Colors,
  MinTouchTarget,
  MaxContentWidth,
  Shadows,
  Spacing,
  Typography,
} from '../src/constants/theme';

describe('Design Tokens & Theme System', () => {
  describe('Color Palettes & Semantic Tokens', () => {
    it('defines matching semantic keys in both light and dark modes', () => {
      const lightKeys = Object.keys(Colors.light).sort();
      const darkKeys = Object.keys(Colors.dark).sort();

      assert.deepStrictEqual(
        lightKeys,
        darkKeys,
        'Colors.light and Colors.dark must share identical theme keys'
      );
    });

    it('contains all required brand identity colors', () => {
      assert.strictEqual(Colors.light.brandPrimary, '#4F46E5');
      assert.strictEqual(Colors.dark.brandPrimary, '#6366F1');

      assert.strictEqual(Colors.light.brandSecondary, '#7C3AED');
      assert.strictEqual(Colors.dark.brandSecondary, '#8B5CF6');

      assert.ok(Colors.light.brandMuted);
      assert.ok(Colors.dark.brandMuted);
    });

    it('contains light and dark surface and card elevation tokens', () => {
      assert.strictEqual(Colors.light.cardBackground, '#FFFFFF');
      assert.strictEqual(Colors.dark.cardBackground, '#131B2E');

      assert.strictEqual(Colors.light.cardElevated, '#FFFFFF');
      assert.strictEqual(Colors.dark.cardElevated, '#1A243B');

      assert.strictEqual(Colors.light.surfaceSubtle, '#F8FAFC');
      assert.strictEqual(Colors.dark.surfaceSubtle, '#0F172A');
    });

    it('contains all semantic status alert tokens', () => {
      assert.ok(Colors.light.statusSuccess);
      assert.ok(Colors.dark.statusSuccess);

      assert.ok(Colors.light.statusWarning);
      assert.ok(Colors.dark.statusWarning);

      assert.ok(Colors.light.statusDanger);
      assert.ok(Colors.dark.statusDanger);

      assert.ok(Colors.light.statusInfo);
      assert.ok(Colors.dark.statusInfo);
    });

    it('contains semantic badge backgrounds and text colors for both themes', () => {
      const requiredBadgeKeys = [
        'badgeSuccessBackground',
        'badgeSuccessText',
        'badgeWarningBackground',
        'badgeWarningText',
        'badgeDangerBackground',
        'badgeDangerText',
        'badgeInfoBackground',
        'badgeInfoText',
        'badgeNeutralBackground',
        'badgeNeutralText',
        'badgeBrandBackground',
        'badgeBrandText',
      ] as const;

      for (const key of requiredBadgeKeys) {
        assert.ok(Colors.light[key], `Missing ${key} in Colors.light`);
        assert.ok(Colors.dark[key], `Missing ${key} in Colors.dark`);
      }
    });

    it('defines brand gradients with 2 color stops for light and dark modes', () => {
      assert.strictEqual(BrandGradients.light.length, 2);
      assert.strictEqual(BrandGradients.dark.length, 2);
      assert.strictEqual(BrandGradients.light[0], '#4F46E5');
      assert.strictEqual(BrandGradients.dark[0], '#6366F1');
    });
  });

  describe('Spacing & Layout Scales', () => {
    it('maintains backwards-compatible legacy spacing keys', () => {
      assert.strictEqual(Spacing.half, 2);
      assert.strictEqual(Spacing.one, 4);
      assert.strictEqual(Spacing.two, 8);
      assert.strictEqual(Spacing.three, 16);
      assert.strictEqual(Spacing.four, 24);
      assert.strictEqual(Spacing.five, 32);
      assert.strictEqual(Spacing.six, 64);
    });

    it('defines standard semantic spatial grid', () => {
      assert.strictEqual(Spacing.xxs, 2);
      assert.strictEqual(Spacing.xs, 4);
      assert.strictEqual(Spacing.sm, 8);
      assert.strictEqual(Spacing.md, 16);
      assert.strictEqual(Spacing.lg, 24);
      assert.strictEqual(Spacing.xl, 32);
      assert.strictEqual(Spacing.xxl, 48);
    });

    it('defines standard layout card and screen padding', () => {
      assert.strictEqual(Spacing.cardPadding, 16);
      assert.strictEqual(Spacing.screenPadding, 20);
    });

    it('defines standard MaxContentWidth and MinTouchTarget', () => {
      assert.strictEqual(MaxContentWidth, 800);
      assert.strictEqual(MinTouchTarget, 48);
    });

    it('defines standard border radius tokens', () => {
      assert.strictEqual(BorderRadius.xs, 4);
      assert.strictEqual(BorderRadius.sm, 8);
      assert.strictEqual(BorderRadius.md, 12);
      assert.strictEqual(BorderRadius.lg, 16);
      assert.strictEqual(BorderRadius.xl, 24);
      assert.strictEqual(BorderRadius.full, 9999);
    });

    it('defines standard shadow elevation tokens', () => {
      assert.ok(Shadows.sm.elevation >= 1);
      assert.ok(Shadows.md.elevation >= 2);
      assert.ok(Shadows.lg.elevation >= 4);
    });
  });

  describe('Typography Scales', () => {
    it('defines typography scales aligned with UI/UX guidelines', () => {
      assert.strictEqual(Typography.displayLarge.fontSize, 32);
      assert.strictEqual(Typography.displayLarge.lineHeight, 40);

      assert.strictEqual(Typography.headlineLarge.fontSize, 24);
      assert.strictEqual(Typography.headlineLarge.lineHeight, 32);

      assert.strictEqual(Typography.headlineMedium.fontSize, 20);
      assert.strictEqual(Typography.headlineMedium.lineHeight, 28);

      assert.strictEqual(Typography.titleMedium.fontSize, 16);
      assert.strictEqual(Typography.titleMedium.lineHeight, 24);

      assert.strictEqual(Typography.bodyLarge.fontSize, 16);
      assert.strictEqual(Typography.bodyLarge.lineHeight, 24);

      assert.strictEqual(Typography.bodyMedium.fontSize, 14);
      assert.strictEqual(Typography.bodyMedium.lineHeight, 20);

      assert.strictEqual(Typography.labelMedium.fontSize, 12);
      assert.strictEqual(Typography.labelSmall.fontSize, 11);
    });
  });
});
