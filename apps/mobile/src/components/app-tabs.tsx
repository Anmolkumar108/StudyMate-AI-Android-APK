import { NativeTabs } from 'expo-router/native-tabs';
import React from 'react';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

/**
 * Native bottom navigation tabs for Android and iOS.
 * Features:
 * - Distinct Material Symbol icons on Android (home, menu_book, edit_note, school)
 * - Distinct SF Symbols on iOS (house.fill, book.closed.fill, note.text, sparkles)
 * - Indigo brand active indicators and high contrast states
 * - Guaranteed minimum touch targets and native Android Material 3 pill styling
 */
export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const indicatorBg = scheme === 'dark' ? colors.brandMuted : '#EEF2FF';

  return (
    <NativeTabs
      backgroundColor={colors.cardBackground}
      indicatorColor={indicatorBg}
      iconColor={{
        default: colors.textTertiary,
        selected: colors.brandPrimary,
      }}
      labelStyle={{
        default: {
          color: colors.textSecondary,
          fontSize: 11,
          fontWeight: '500',
        },
        selected: {
          color: colors.brandPrimary,
          fontSize: 11,
          fontWeight: '700',
        },
      }}
      rippleColor={colors.brandPrimary + '25'}>
      {/* 1. Home Dashboard */}
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          md="home"
          sf="house.fill"
          src={require('@/assets/images/tabIcons/home.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      {/* 2. Academic Subjects */}
      <NativeTabs.Trigger name="subjects">
        <NativeTabs.Trigger.Label>Subjects</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          md="menu_book"
          sf="book.closed.fill"
          src={require('@/assets/images/tabIcons/home.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      {/* 3. Study Notes */}
      <NativeTabs.Trigger name="notes">
        <NativeTabs.Trigger.Label>Notes</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          md="edit_note"
          sf="note.text"
          src={require('@/assets/images/tabIcons/explore.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      {/* 4. Study Hub (Explore) */}
      <NativeTabs.Trigger name="explore">
        <NativeTabs.Trigger.Label>Study Hub</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          md="school"
          sf="sparkles"
          src={require('@/assets/images/tabIcons/explore.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
