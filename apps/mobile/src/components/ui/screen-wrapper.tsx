import React from 'react';
import {
  Platform,
  RefreshControl,
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface ScreenWrapperProps {
  /**
   * Screen content components.
   */
  children: React.ReactNode;

  /**
   * Whether to wrap content in a scrollable view. Defaults to false.
   */
  scrollable?: boolean;

  /**
   * Whether to include top safe-area inset. Defaults to true.
   */
  includeTopInset?: boolean;

  /**
   * Whether to include bottom safe-area inset. Defaults to true.
   */
  includeBottomInset?: boolean;

  /**
   * Whether to include bottom tab bar clearance. Defaults to false.
   */
  includeTabInset?: boolean;

  /**
   * Whether the screen is currently refreshing (only applicable when scrollable is true).
   */
  refreshing?: boolean;

  /**
   * Callback invoked on pull-to-refresh (only applicable when scrollable is true).
   */
  onRefresh?: () => void;

  /**
   * Style override for the root background container.
   */
  style?: StyleProp<ViewStyle>;

  /**
   * Style override for the inner responsive content container.
   */
  contentContainerStyle?: StyleProp<ViewStyle>;

  /**
   * Custom background color. Defaults to theme.background.
   */
  backgroundColor?: string;

  /**
   * Test identifier.
   */
  testID?: string;
}

/**
 * Master responsive screen wrapper for all StudyMate AI mobile screens.
 * Automatically handles:
 * - Safe area insets (status bar & soft navigation bar)
 * - Tablet and landscape layout constraints (MaxContentWidth: 800dp centered)
 * - Mobile responsive horizontal padding
 * - Pull-to-refresh and keyboard tap persistence
 */
export function ScreenWrapper({
  children,
  scrollable = false,
  includeTopInset = true,
  includeBottomInset = true,
  includeTabInset = false,
  refreshing = false,
  onRefresh,
  style,
  contentContainerStyle,
  backgroundColor,
  testID,
}: ScreenWrapperProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const effectiveBg = backgroundColor || theme.background;

  const paddingTop = includeTopInset
    ? insets.top + (Platform.OS === 'android' ? 8 : 4)
    : 0;

  const userContentStyle = (StyleSheet.flatten(contentContainerStyle) || {}) as ViewStyle;
  const userPaddingBottom = typeof userContentStyle.paddingBottom === 'number' ? userContentStyle.paddingBottom : 0;

  const tabClearance = includeTabInset ? BottomTabInset + 35 : 0;
  const bottomInset = includeBottomInset ? insets.bottom : 0;
  const effectivePaddingBottom = includeBottomInset
    ? Math.max(tabClearance + bottomInset + Spacing.md, userPaddingBottom + tabClearance)
    : tabClearance + userPaddingBottom;

  const finalContentStyle: ViewStyle = {
    ...userContentStyle,
    paddingTop: userContentStyle.paddingTop ?? paddingTop,
    paddingBottom: effectivePaddingBottom,
  };

  if (scrollable) {
    return (
      <View
        testID={testID}
        style={[styles.root, { backgroundColor: effectiveBg }, style]}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            finalContentStyle,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme.brandPrimary}
                colors={[theme.brandPrimary]}
              />
            ) : undefined
          }>
          <View style={styles.responsiveInnerContainer}>
            {children}
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View
      testID={testID}
      style={[
        styles.root,
        { backgroundColor: effectiveBg },
        { paddingTop, paddingBottom: effectivePaddingBottom },
        style,
      ]}>
      <View
        style={[
          styles.responsiveInnerContainer,
          styles.staticContent,
          contentContainerStyle,
        ]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.screenPadding,
  },
  staticContent: {
    flex: 1,
    paddingHorizontal: Spacing.screenPadding,
  },
  responsiveInnerContainer: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
});
