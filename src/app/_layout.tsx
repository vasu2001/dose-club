import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { Colors } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/context/auth';
import { isProfileComplete } from '@/lib/profile';
import { CACHE_BUSTER, CACHE_MAX_AGE, queryClient, queryPersister } from '@/lib/query';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { session, profile, loading } = useAuth();
  const complete = isProfileComplete(profile);
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

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
