import { useRouter } from 'expo-router';
import { useState } from 'react';

import { AuthForm } from '@/components/auth-form';
import { supabase } from '@/lib/supabase';

export default function SignupScreen() {
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <AuthForm
      heading="Join Dose Club"
      subheading="Trade doses, not whole bags."
      submitLabel="Create account"
      notice={notice}
      onSubmit={async (email, password) => {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) return error.message;
        if (!data.session) {
          // Email confirmation is enabled — no session until the link is clicked.
          setNotice('Check your inbox and confirm your email, then sign in.');
        }
        return null;
      }}
      footerLabel="Already a member? Sign in"
      onFooterPress={() => router.replace('/login')}
    />
  );
}
