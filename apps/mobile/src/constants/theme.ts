/**
 * StudyMate AI — Design System Tokens & Mobile Theme
 * Hybrid Premium UI System supporting Light and Dark modes.
 */

// Safe Platform resolution supporting both React Native / Metro and Node test environments
const resolvePlatform = () => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rn = require('react-native');
    if (rn?.Platform) {
      return rn.Platform;
    }
  } catch {
    // Fallback when executed outside React Native runtime (e.g. Node tests)
  }
  return {
    OS: process.env.TEST_PLATFORM || 'android',
    select: <T>(specifics: { [platform: string]: T | undefined; default?: T }): T | undefined => {
      const os = process.env.TEST_PLATFORM || 'android';
      if (os in specifics) {
        return specifics[os];
      }
      return specifics.default;
    },
  };
};

const Platform = resolvePlatform();

if (Platform.OS === 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/global.css');
  } catch {
    // No-op for test/native environments
  }
}

export const Colors = {
  light: {
    // Core text & background
    text: '#0F172A',
    background: '#F8FAFC',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#475569',
    textTertiary: '#94A3B8',

    // Brand identity (Indigo / Violet)
    brandPrimary: '#4F46E5',
    brandSecondary: '#7C3AED',
    brandMuted: '#EEF2FF',

    // Borders
    borderSubtle: '#E2E8F0',
    borderFocus: '#6366F1',
    borderCard: '#E2E8F0',

    // Card & surface colors
    cardBackground: '#FFFFFF',
    cardElevated: '#FFFFFF',
    surfaceSubtle: '#F8FAFC',
    inputBackground: '#F1F5F9',

    // Semantic status colors
    statusDanger: '#DC2626',
    statusSuccess: '#16A34A',
    statusWarning: '#D97706',
    statusInfo: '#0284C7',

    // Semantic badge backgrounds & text
    badgeSuccessBackground: '#DCFCE7',
    badgeSuccessText: '#15803D',
    badgeWarningBackground: '#FEF3C7',
    badgeWarningText: '#B45309',
    badgeDangerBackground: '#FEE2E2',
    badgeDangerText: '#B91C1C',
    badgeInfoBackground: '#E0F2FE',
    badgeInfoText: '#0369A1',
    badgeNeutralBackground: '#F1F5F9',
    badgeNeutralText: '#475569',
    badgeBrandBackground: '#EEF2FF',
    badgeBrandText: '#4F46E5',
  },
  dark: {
    // Core text & background (Obsidian AMOLED)
    text: '#F8FAFC',
    background: '#0B0F19',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#94A3B8',
    textTertiary: '#64748B',

    // Brand identity (Indigo / Violet)
    brandPrimary: '#6366F1',
    brandSecondary: '#8B5CF6',
    brandMuted: '#1E1B4B',

    // Borders
    borderSubtle: '#26334D',
    borderFocus: '#818CF8',
    borderCard: '#1E293B',

    // Card & surface colors (Navy slate)
    cardBackground: '#131B2E',
    cardElevated: '#1A243B',
    surfaceSubtle: '#0F172A',
    inputBackground: '#1E293B',

    // Semantic status colors
    statusDanger: '#EF4444',
    statusSuccess: '#22C55E',
    statusWarning: '#F59E0B',
    statusInfo: '#38BDF8',

    // Semantic badge backgrounds & text
    badgeSuccessBackground: '#052E16',
    badgeSuccessText: '#86EFAC',
    badgeWarningBackground: '#451A03',
    badgeWarningText: '#FCD34D',
    badgeDangerBackground: '#3B151E',
    badgeDangerText: '#FCA5A5',
    badgeInfoBackground: '#082F49',
    badgeInfoText: '#7DD3FC',
    badgeNeutralBackground: '#1E293B',
    badgeNeutralText: '#94A3B8',
    badgeBrandBackground: '#1E1B4B',
    badgeBrandText: '#A5B4FC',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/**
 * Brand gradient palette stops for headers, banners, and hero accents.
 */
export const BrandGradients = {
  light: ['#4F46E5', '#7C3AED'] as const,
  dark: ['#6366F1', '#8B5CF6'] as const,
} as const;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

/**
 * Standard typography scales matching docs/UI_UX_GUIDELINES.md.
 */
export const Typography = {
  displayLarge: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700' as const,
  },
  headlineLarge: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '600' as const,
  },
  headlineMedium: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600' as const,
  },
  titleMedium: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500' as const,
  },
  bodyLarge: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400' as const,
  },
  bodyMedium: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400' as const,
  },
  bodySmall: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400' as const,
  },
  labelMedium: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500' as const,
  },
  labelSmall: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '400' as const,
  },
} as const;

/**
 * Spacing system supporting base 4pt / 8pt spatial grid.
 * Includes legacy names (one..six) for backwards compatibility.
 */
export const Spacing = {
  // Legacy alias names
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,

  // Standard semantic scale
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,

  // Layout semantic spacing
  cardPadding: 16,
  screenPadding: 20,
} as const;

/**
 * Standard corner radii.
 */
export const BorderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

/**
 * Standard elevation / shadow tokens for iOS and Android.
 */
export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
} as const;

/**
 * Minimum touch target accessibility dimension (Android 48dp standard).
 */
export const MinTouchTarget = 48;

export const BottomTabInset = (Platform.select({ ios: 50, android: 80 }) ?? 0) as number;
export const MaxContentWidth = 800;
