import { Button, Host, TextInput } from '@expo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';

import { isKnownCity } from '@/constants/cities';
import {
  StyleSheet,
  Text,
  useColorScheme,
  useWindowDimensions,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { CityPicker } from '@/components/city-picker';
import { Field } from '@/components/form-field';
import { Fonts, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { normalizeIndianPhone, saveProfile, type Profile } from '@/lib/profile';

type ProfileFormProps = {
  profile: Profile | null;
  submitLabel: string;
  /** Called after a successful save. */
  onSaved?: () => void;
};

export function ProfileForm({ profile, submitLabel, onSaved }: ProfileFormProps) {
  const { session, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { width } = useWindowDimensions();
  const buttonWidth = Math.min(width, MaxContentWidth) - 2 * Spacing.five;

  const displayName = useRef(profile?.display_name ?? '');
  const username = useRef(profile?.username ?? '');
  const [city, setCity] = useState<string | null>(profile?.city ?? null);
  const phone = useRef(profile?.phone ?? '');
  const bio = useRef(profile?.bio ?? '');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    display_name?: string;
    username?: string;
    city?: string;
    phone?: string;
  }>({});
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy || !session) return;
    const name = displayName.current.trim();
    const handle = username.current.trim().toLowerCase();
    const phoneNumber = normalizeIndianPhone(phone.current);

    const errors: typeof fieldErrors = {};
    if (!name) {
      errors.display_name = 'Add a display name — this is how members see you.';
    }
    if (!handle) {
      errors.username = 'Pick a username.';
    } else if (!/^[a-z0-9_]{3,24}$/.test(handle)) {
      errors.username =
        handle.length < 3 || handle.length > 24
          ? 'Must be 3–24 characters long.'
          : 'Only lowercase letters, numbers and underscores.';
    }
    if (!city) {
      errors.city = 'Pick your city — trades happen in person.';
    } else if (!isKnownCity(city)) {
      errors.city = 'Pick your city from the list.';
    }
    if (!phone.current.trim()) {
      errors.phone = 'Add a phone number so trade partners can reach you.';
    } else if (!phoneNumber) {
      errors.phone = 'Enter a valid 10-digit Indian mobile number (starts with 6–9).';
    }
    setFieldErrors(errors);
    setError(null);
    if (Object.keys(errors).length > 0) return;

    setBusy(true);
    setSaved(false);
    try {
      const message = await saveProfile(session.user.id, {
        display_name: name,
        username: handle,
        city: city as string,
        phone: phoneNumber as string,
        bio: bio.current.trim() || null,
      });
      if (message) {
        // Map server-side failures onto the field they belong to.
        if (message.toLowerCase().includes('username')) {
          setFieldErrors({ username: message });
        } else if (message.toLowerCase().includes('phone')) {
          setFieldErrors({ phone: message });
        } else {
          setError(message);
        }
      } else {
        await refreshProfile();
        queryClient.invalidateQueries({ queryKey: ['profiles'] });
        setSaved(true);
        onSaved?.();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAwareScrollView
      showsVerticalScrollIndicator={false}
      style={styles.flex}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      bottomOffset={24}>
        <Field label="DISPLAY NAME" colors={colors} error={fieldErrors.display_name}>
          <TextInput
            placeholder="June Kim"
            defaultValue={profile?.display_name ?? undefined}
            autoCorrect={false}
            onChangeText={(text) => {
              displayName.current = text;
            }}
          />
        </Field>
        <Field label="USERNAME" colors={colors} error={fieldErrors.username}>
          <TextInput
            placeholder="june_brews"
            defaultValue={profile?.username ?? undefined}
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={(text) => {
              username.current = text;
            }}
          />
        </Field>
        <CityPicker value={city} onChange={setCity} error={fieldErrors.city} />
        <Field label="PHONE" colors={colors} error={fieldErrors.phone}>
          <TextInput
            placeholder="+91 98765 43210"
            defaultValue={profile?.phone ?? undefined}
            keyboardType="phone-pad"
            autoCorrect={false}
            onChangeText={(text) => {
              phone.current = text;
            }}
          />
        </Field>
        <Field label="ABOUT YOUR COFFEE (OPTIONAL)" colors={colors} inputHeight={72}>
          <TextInput
            placeholder="Light roasts, V60, always chasing washed Ethiopians."
            defaultValue={profile?.bio ?? undefined}
            multiline
            numberOfLines={3}
            onChangeText={(text) => {
              bio.current = text;
            }}
          />
        </Field>

        {error != null && (
          <Text style={[styles.message, { color: colors.danger }]}>{error}</Text>
        )}
        {saved && error == null && (
          <Text style={[styles.message, { color: colors.accent }]}>Profile saved.</Text>
        )}

        <Host matchContents seedColor={colors.tint} style={styles.actions}>
          <Button
            variant="filled"
            label={busy ? 'Saving…' : submitLabel}
            disabled={busy}
            style={{ width: buttonWidth, height: 50 }}
            onPress={submit}
          />
        </Host>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    gap: Spacing.two,
    paddingBottom: Spacing.five,
  },
  field: {
    borderRadius: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    gap: Spacing.one,
  },
  fieldLabel: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  message: {
    fontSize: 15,
    lineHeight: 21,
    marginTop: Spacing.one,
  },
  actions: {
    width: '100%',
    marginTop: Spacing.two,
  },
});
