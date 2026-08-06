import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import * as Notifications from 'expo-notifications';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { Colors } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/context/auth';
import { isProfileComplete } from '@/lib/profile';
import { configureNotificationHandling } from '@/lib/push';
import { CACHE_BUSTER, CACHE_MAX_AGE, queryClient, queryPersister } from '@/lib/query';
import { useInboxRealtime } from '@/lib/use-inbox-realtime';

SplashScreen.preventAutoHideAsync();
configureNotificationHandling();

/** Tapping a push lands on the trade (or listing) it is about. */
function useNotificationTaps() {
  const router = useRouter();
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as {
        proposal_id?: string | null;
        listing_id?: string | null;
      };
      if (data?.proposal_id) {
        router.push({ pathname: '/trade/[id]', params: { id: data.proposal_id } });
      } else if (data?.listing_id) {
        router.push({ pathname: '/listing/[id]', params: { id: data.listing_id } });
      }
    });
    return () => sub.remove();
  }, [router]);
}

function RootNavigator() {
  const { session, profile, loading } = useAuth();
  const complete = isProfileComplete(profile);
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  useInboxRealtime(session?.user.id);
  useNotificationTaps();

  // Keep the native splash screen up until the persisted session is restored,
  // so we never flash the wrong screen on launch.
  if (loading) return null;

  // Pushed detail/composer screens share a native header with a back button.
  const pushedScreen = {
    headerShown: true,
    headerStyle: { backgroundColor: colors.background },
    headerShadowVisible: false,
    headerTintColor: colors.tint,
    headerTitle: '',
    headerBackButtonDisplayMode: 'minimal',
  } as const;

  return (
    <>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!!session && complete}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="share-dose" options={pushedScreen} />
          <Stack.Screen name="listing/[id]" options={pushedScreen} />
          <Stack.Screen name="propose/[listingId]" options={pushedScreen} />
          <Stack.Screen name="trade/[id]" options={pushedScreen} />
          <Stack.Screen name="user/[id]" options={pushedScreen} />
          <Stack.Screen name="edit-profile" options={pushedScreen} />
        </Stack.Protected>
        <Stack.Protected guard={!!session && !complete}>
          <Stack.Screen name="profile-setup" />
        </Stack.Protected>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: queryPersister,
        maxAge: CACHE_MAX_AGE,
        buster: CACHE_BUSTER,
      }}>
      <KeyboardProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <AuthProvider>
            <RootNavigator />
          </AuthProvider>
        </ThemeProvider>
      </KeyboardProvider>
    </PersistQueryClientProvider>
  );
}
