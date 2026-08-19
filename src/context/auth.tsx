import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { Alert, Platform } from 'react-native';

import { createSessionFromUrl, isAuthUrl } from '@/lib/auth-link';
import { fetchProfile, type Profile } from '@/lib/profile';
import { registerPushToken, unregisterPushToken } from '@/lib/push';
import { queryClient } from '@/lib/query';
import { supabase } from '@/lib/supabase';

type AuthContextValue = {
  session: Session | null;
  profile: Profile | null;
  /** True until the persisted session and its profile have been restored. */
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  session: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadFor = async (nextSession: Session | null) => {
      let nextProfile: Profile | null = null;
      if (nextSession) {
        try {
          nextProfile = await fetchProfile(nextSession.user.id);
        } catch {
          // Leave the profile null; the setup screen will let the user retry.
        }
      }
      if (cancelled) return;
      setSession(nextSession);
      setProfile(nextProfile);
      setLoading(false);
    };

    supabase.auth.getSession().then(({ data }) => loadFor(data.session));

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        // Token refreshes don't change the profile — skip the refetch.
        if (event === 'TOKEN_REFRESHED') {
          setSession(newSession);
          return;
        }
        loadFor(newSession);
      },
    );

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  // Email confirmation links deep-link back into the app with tokens in the
  // URL fragment; exchange them for a session (web handles this via
  // detectSessionInUrl).
  const incomingUrl = Linking.useLinkingURL();
  const handledUrls = useRef(new Set<string>());
  const handleAuthUrl = useCallback(async (url: string | null) => {
    if (!url || Platform.OS === 'web' || !isAuthUrl(url)) return;
    if (handledUrls.current.has(url)) return;
    handledUrls.current.add(url);
    const message = await createSessionFromUrl(url);
    if (message) Alert.alert('Email confirmation', message);
  }, []);

  useEffect(() => {
    Linking.getInitialURL().then(handleAuthUrl);
  }, [handleAuthUrl]);

  useEffect(() => {
    void handleAuthUrl(incomingUrl);
  }, [incomingUrl, handleAuthUrl]);

  const refreshProfile = useCallback(async () => {
    const userId = session?.user.id;
    if (!userId) return;
    setProfile(await fetchProfile(userId));
  }, [session?.user.id]);

  // Register this device for pushes once a user is signed in.
  const userId = session?.user.id;
  useEffect(() => {
    if (userId) void registerPushToken(userId);
  }, [userId]);

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        loading,
        refreshProfile,
        signOut: async () => {
          // Stop pushes to this device first — the delete needs the session
          // to still satisfy the push_tokens RLS policy.
          await unregisterPushToken();
          await supabase.auth.signOut();
          // Cached data belongs to the signed-out user — drop it.
          queryClient.clear();
        },
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
