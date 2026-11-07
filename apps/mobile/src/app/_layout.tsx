import { DarkTheme, DefaultTheme, Slot, ThemeProvider, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useState } from 'react';
import { AppState, AppStateStatus, useColorScheme, View } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { BiometricLockOverlay } from '@/components/biometric-lock-overlay';
import BottomNav from '@/components/bottom-nav';
import { AuthProvider, useAuth } from '@/context/auth-context';
import { isBiometricLockEnabled } from '@/services/biometrics';
import {
  registerForPushNotificationsAsync,
  setupNotificationResponseListener,
} from '@/services/notifications';

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootLayoutNav() {
  const { status, logout } = useAuth();
  const segments = useSegments() as string[];
  const router = useRouter();
  const colorScheme = useColorScheme();
  const [isLocked, setIsLocked] = useState(false);

  // Check biometric lock on initial authentication and app foregrounding
  useEffect(() => {
    let isMounted = true;

    const checkLockStatus = async () => {
      if (status === 'authenticated') {
        const enabled = await isBiometricLockEnabled();
        if (enabled && isMounted) {
          setIsLocked(true);
        }
      } else {
        if (isMounted) {
          setIsLocked(false);
        }
      }
    };

    checkLockStatus();

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && status === 'authenticated') {
        isBiometricLockEnabled().then((enabled) => {
          if (enabled && isMounted) {
            setIsLocked(true);
          }
        });
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      isMounted = false;
      sub.remove();
    };
  }, [status]);

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

  // Initialize Android push notification channels and listen for taps
  useEffect(() => {
    registerForPushNotificationsAsync().catch(() => {});
    const unsubscribe = setupNotificationResponseListener((route) => {
      try {
        router.push(route as never);
      } catch {
        // Fallback
      }
    });
    return () => {
      unsubscribe();
    };
  }, [router]);

  if (status === 'initializing') {
    return null;
  }

  const firstSegment = segments[0] as string | undefined;
  const isAuthRoute = firstSegment === '(auth)';

  // Main navigation tabs: Home, StudyHub, Tasks, Profile
  const MAIN_TABS = new Set(['', 'index', 'explore', 'tasks', 'profile']);

  // Standalone routes without bottom navigation bar
  const STANDALONE_ROUTES = new Set([
    'timetable',
    'quizzes',
    'documents',
    'ai-chat',
    'flashcards',
    'pomodoro',
    'settings',
    'subjects',
    'notes',
    'exams',
    'study-planner',
    'analytics',
    'search',
  ]);

  const currentRoute = firstSegment || 'index';
  const isStandaloneRoute = Boolean(firstSegment) && STANDALONE_ROUTES.has(firstSegment as string);
  const showBottomNav = !isAuthRoute && !isStandaloneRoute && MAIN_TABS.has(currentRoute);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <View style={{ flex: 1, backgroundColor: '#080B16' }}>
        <Slot />
        {showBottomNav && <BottomNav activeTab={currentRoute} />}
      </View>
      {status === 'authenticated' && (
        <BiometricLockOverlay
          visible={isLocked}
          onUnlocked={() => setIsLocked(false)}
          onLogout={async () => {
            setIsLocked(false);
            await logout();
            router.replace('/(auth)/login');
          }}
        />
      )}
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
