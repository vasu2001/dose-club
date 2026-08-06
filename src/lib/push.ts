import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

/** The token this device registered under, so sign-out can remove it. */
let currentToken: string | null = null;

function pushSupported(): boolean {
  if (Platform.OS === 'web') return false;
  // iOS simulators on Xcode 14+ can receive pushes; Android emulators need
  // Google Play services, which Device.isDevice doesn't capture — let the
  // token request itself fail there.
  return Device.isDevice || Platform.OS === 'ios';
}

/** Show pushes as banners even while the app is foregrounded. */
export function configureNotificationHandling(): void {
  if (Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'Trade updates',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

/**
 * Ask permission, fetch the Expo push token, and store it for this user.
 * Safe to call on every sign-in; a token row simply moves to the new user.
 */
export async function registerPushToken(userId: string): Promise<void> {
  if (!pushSupported()) return;

  const projectId: string | undefined =
    Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) return;

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== 'granted') return;

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    currentToken = token;
    await supabase.from('push_tokens').upsert({
      token,
      user_id: userId,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      updated_at: new Date().toISOString(),
    });
  } catch {
    // Offline or Expo's token service unreachable — retried on next sign-in
    // or app launch.
  }
}

/**
 * Remove this device's token. Must run BEFORE supabase.auth.signOut(),
 * while the session can still pass the row's RLS delete policy.
 */
export async function unregisterPushToken(): Promise<void> {
  if (!pushSupported()) return;
  try {
    let token = currentToken;
    if (!token) {
      const projectId: string | undefined =
        Constants.expoConfig?.extra?.eas?.projectId;
      if (!projectId) return;
      ({ data: token } = await Notifications.getExpoPushTokenAsync({ projectId }));
    }
    if (token) {
      await supabase.from('push_tokens').delete().eq('token', token);
    }
    currentToken = null;
  } catch {
    // Worst case the dead token lingers until Expo reports DeviceNotRegistered
    // and the edge function prunes it.
  }
}
