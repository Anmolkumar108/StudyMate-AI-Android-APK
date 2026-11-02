import { DarkTheme, DefaultTheme, Slot, ThemeProvider, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { AuthProvider, useAuth } from '@/context/auth-context';

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootLayoutNav() {
  const { status } = useAuth();
  const segments = useSegments() as string[];
  const router = useRouter();
  const colorScheme = useColorScheme();

  useEffect(() => {
    if (status === 'initializing') {
      return;
    }

    SplashScreen.hideAsync().catch(() => {});

    const firstSegment = segments[0] as string | undefined;
    const inAuthGroup = firstSegment === '(auth)';

    if (status === 'unauthenticated' && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (
      status === 'pending_verification' &&
      segments[1] !== 'pending-verification'
    ) {
      router.replace('/(auth)/pending-verification');
    } else if (status === 'authenticated' && inAuthGroup) {
      router.replace('/');
    }
  }, [status, segments, router]);

  if (status === 'initializing') {
    return null;
  }

  const isAuthRoute = (segments[0] as string | undefined) === '(auth)';
  const isStandaloneRoute =
    (segments[0] as string | undefined) === 'settings' ||
    (segments[0] as string | undefined) === 'pomodoro' ||
    (segments[0] as string | undefined) === 'flashcards' ||
    (segments[0] as string | undefined) === 'ai-chat' ||
    (segments[0] as string | undefined) === 'documents' ||
    (segments[0] as string | undefined) === 'quizzes' ||
    (segments[0] as string | undefined) === 'tasks';

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      {isAuthRoute || isStandaloneRoute ? <Slot /> : <AppTabs />}
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
