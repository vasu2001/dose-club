import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from 'react';

import { fetchProfile, type Profile } from '@/lib/profile';
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

  const refreshProfile = useCallback(async () => {
    const userId = session?.user.id;
    if (!userId) return;
    setProfile(await fetchProfile(userId));
  }, [session?.user.id]);

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        loading,
        refreshProfile,
        signOut: async () => {
          await supabase.auth.signOut();
        },
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
