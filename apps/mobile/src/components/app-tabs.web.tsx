import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { SymbolView } from 'expo-symbols';
import React from 'react';
import { Pressable, StyleSheet, useColorScheme, View } from 'react-native';

import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

interface TabButtonProps extends TabTriggerSlotProps {
  iconName: {
    ios: 'house.fill' | 'book.closed.fill' | 'note.text' | 'sparkles';
    android: 'home' | 'menu_book' | 'edit_note' | 'school';
    web: 'home' | 'menu_book' | 'edit_note' | 'school';
  };
}

export function TabButton({ children, isFocused, iconName, ...props }: TabButtonProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  return (
    <Pressable {...(props as any)} style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView
        type={isFocused ? 'backgroundSelected' : 'backgroundElement'}
        style={[
          styles.tabButtonView,
          isFocused && { borderColor: colors.brandPrimary, borderWidth: 1 },
        ]}>
        <SymbolView
          tintColor={isFocused ? colors.brandPrimary : colors.textSecondary}
          name={iconName}
          size={16}
        />
        <ThemedText
          type="small"
          style={{
            fontWeight: isFocused ? '700' : '500',
            color: isFocused ? colors.brandPrimary : colors.textSecondary,
          }}>
          {children}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  return (
    <View {...props} style={styles.tabListContainer}>
      <ThemedView type="backgroundElement" style={styles.innerContainer}>
        <ThemedText
          type="smallBold"
          style={[styles.brandText, { color: colors.brandPrimary }]}>
          StudyMate AI
        </ThemedText>

        {props.children}
      </ThemedView>
    </View>
  );
}

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="home" href="/" asChild>
            <TabButton
              iconName={{
                ios: 'house.fill',
                android: 'home',
                web: 'home',
              }}>
              Home
            </TabButton>
          </TabTrigger>

          <TabTrigger name="subjects" href={'/subjects' as never} asChild>
            <TabButton
              iconName={{
                ios: 'book.closed.fill',
                android: 'menu_book',
                web: 'menu_book',
              }}>
              Subjects
            </TabButton>
          </TabTrigger>

          <TabTrigger name="notes" href={'/notes' as never} asChild>
            <TabButton
              iconName={{
                ios: 'note.text',
                android: 'edit_note',
                web: 'edit_note',
              }}>
              Notes
            </TabButton>
          </TabTrigger>

          <TabTrigger name="explore" href="/explore" asChild>
            <TabButton
              iconName={{
                ios: 'sparkles',
                android: 'school',
                web: 'school',
              }}>
              Study Hub
            </TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    width: '100%',
    padding: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  innerContainer: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.five,
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
    borderWidth: 1,
    borderColor: 'rgba(150, 150, 150, 0.2)',
  },
  brandText: {
    marginRight: 'auto',
    letterSpacing: 0.5,
  },
  pressed: {
    opacity: 0.7,
  },
  tabButtonView: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
});
