import { useRouter } from 'expo-router';

import { AuthForm } from '@/components/auth-form';
import { supabase } from '@/lib/supabase';

export default function LoginScreen() {
  const router = useRouter();

  return (
    <AuthForm
      heading="Welcome back"
      subheading="Sign in to see what's brewing."
      submitLabel="Sign in"
      onSubmit={async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        // On success the auth listener flips the route guard to the tabs.
        return error ? error.message : null;
      }}
      footerLabel="New here? Create an account"
      onFooterPress={() => router.replace('/signup')}
    />
  );
}
