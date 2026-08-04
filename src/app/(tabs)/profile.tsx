import { Button, Host } from '@expo/ui';
import {
  StyleSheet,
  Text,
  View,
  useColorScheme,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileForm } from '@/components/profile-form';
import {
  BottomTabInset,
  Colors,
  Fonts,
  MaxContentWidth,
  Spacing,
} from '@/constants/theme';
import { useAuth } from '@/context/auth';

export default function ProfileScreen() {
  const { session, profile, signOut } = useAuth();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { width } = useWindowDimensions();
  const buttonWidth = Math.min(width, MaxContentWidth) - 2 * Spacing.five;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={[styles.heading, { color: colors.text }]}>
            {profile?.display_name ?? 'Your profile'}
          </Text>
          <Text style={[styles.subheading, { color: colors.textSecondary }]}>
            @{profile?.username ?? '—'} · {session?.user.email}
          </Text>
        </View>
        <ProfileForm profile={profile} submitLabel="Save changes" />
        <Host matchContents seedColor={colors.tint} style={styles.signOut}>
          <Button
            variant="outlined"
            label="Sign out"
            style={{ width: buttonWidth, height: 44 }}
            onPress={() => signOut()}
          />
        </Host>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.five,
    paddingBottom: BottomTabInset + Spacing.three,
  },
  header: {
    paddingTop: Spacing.four,
    paddingBottom: Spacing.four,
    gap: Spacing.one,
  },
  heading: {
    fontFamily: Fonts.serif,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700',
  },
  subheading: {
    fontSize: 15,
    lineHeight: 22,
  },
  signOut: {
    width: '100%',
    marginTop: Spacing.two,
  },
});
