import * as Linking from 'expo-linking';

import { supabase } from '@/lib/supabase';

/**
 * Where Supabase auth emails redirect back to. `createURL('/')` resolves to
 * `doseclub:///` in dev/standalone builds (and `exp://…` in Expo Go), and the
 * root path lets the Stack.Protected guards route by session state.
 */
export const authRedirectUrl = Linking.createURL('/');

/** Pull auth params out of both the query string and the URL fragment. */
function parseAuthParams(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const part of url.split(/[?#]/).slice(1)) {
    for (const pair of part.split('&')) {
      const [key, value] = pair.split('=');
      if (key && value !== undefined) params[key] = decodeURIComponent(value);
    }
  }
  return params;
}

/** True when a deep link carries Supabase auth tokens or an auth error. */
export function isAuthUrl(url: string): boolean {
  return /[?#&](access_token|error_code|error)=/.test(url);
}

/**
 * Complete an email-link sign-in from an incoming deep link.
 * Returns a user-facing error message, or null when a session was set
 * (or the URL wasn't an auth link at all).
 */
export async function createSessionFromUrl(url: string): Promise<string | null> {
  const params = parseAuthParams(url);

  if (params.error_code === 'otp_expired') {
    return 'That confirmation link has expired. Sign in to get a new one.';
  }
  if (params.error) {
    return params.error_description?.replace(/\+/g, ' ') ?? 'Sign-in link failed.';
  }

  const { access_token, refresh_token } = params;
  if (!access_token || !refresh_token) return null;

  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  return error ? error.message : null;
}
