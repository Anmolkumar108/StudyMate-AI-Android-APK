import { DarkTheme, DefaultTheme, Slot, ThemeProvider, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useState } from 'react';
import { AppState, AppStateStatus, BackHandler, Platform, ToastAndroid, useColorScheme, View } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { BiometricLockOverlay } from '@/components/biometric-lock-overlay';
import BottomNav from '@/components/bottom-nav';
import { AuthProvider, useAuth } from '@/context/auth-context';
import { isBiometricLockEnabled } from '@/services/biometrics';
import { getDeviceDetails } from '@/services/device-info';
import { telemetryApi } from '@/services/api/client';
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

  // Non-blocking device launch telemetry ping
  useEffect(() => {
    try {
      const dev = getDeviceDetails();
      telemetryApi
        .devicePing({
          device_name: dev.deviceName,
          device_os: dev.deviceOs,
          app_version: dev.appVersion,
          is_first_launch: false,
        })
        .catch(() => {});
    } catch {
      // Non-blocking telemetry
    }
  }, []);

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

  // Hardware Back Button & Edge Gesture Handler for Android Devices
  useEffect(() => {
    let lastBackPressTime = 0;

    const handleHardwareBackPress = () => {
      // 1. If biometric lock overlay is active or auth is initializing, block back
      if (isLocked || status === 'initializing') {
        return true;
      }

      // 2. If in auth group (login, register, verify-email, forgot-password)
      if (isAuthRoute) {
        if (router.canGoBack()) {
          router.back();
          return true;
        }
        return false; // let Android OS exit or handle from login screen
      }

      // 3. If in a standalone / inner route (e.g. /pomodoro, /study-planner, /notes, /exams, /subjects, etc.)
      if (isStandaloneRoute) {
        if (router.canGoBack()) {
          router.back();
        } else {
          // Safe fallback to home or explore if stack was cleared
          router.replace('/');
        }
        return true;
      }

      // 4. If in a secondary main tab (explore/StudyHub, tasks, profile)
      if (currentRoute !== 'index' && currentRoute !== '') {
        router.replace('/');
        return true;
      }

      // 5. If on the Home screen ('index' or '')
      // Standard Android Double-Back-to-Exit safety pattern
      const now = Date.now();
      if (now - lastBackPressTime < 2000) {
        return false; // second tap within 2s: allow Android default exit
      }

      lastBackPressTime = now;
      if (Platform.OS === 'android' && ToastAndroid && typeof ToastAndroid.show === 'function') {
        ToastAndroid.show('Press back again to exit', ToastAndroid.SHORT);
      }
      return true; // prevent exit on first back press on Home
    };

    if (BackHandler && typeof BackHandler.addEventListener === 'function') {
      const sub = BackHandler.addEventListener(
        'hardwareBackPress',
        handleHardwareBackPress
      );
      return () => {
        sub.remove();
      };
    }
  }, [isLocked, status, isAuthRoute, isStandaloneRoute, currentRoute, router]);

  if (status === 'initializing') {
    return null;
  }

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
