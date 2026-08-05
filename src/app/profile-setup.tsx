import { StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileForm } from '@/components/profile-form';
import { Colors, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';

export default function ProfileSetupScreen() {
  const { profile } = useAuth();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={[styles.eyebrow, { color: colors.accent }]}>ALMOST THERE</Text>
          <Text style={[styles.heading, { color: colors.text }]}>Set up your profile</Text>
          <Text style={[styles.subheading, { color: colors.textSecondary }]}>
            This is how other members will know you when trading doses.
          </Text>
        </View>
        <ProfileForm profile={profile} submitLabel="Start trading" />
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
  },
  header: {
    paddingTop: Spacing.four,
    paddingBottom: Spacing.four,
    gap: Spacing.two,
  },
  eyebrow: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 3,
  },
  heading: {
    fontFamily: Fonts.serif,
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '700',
  },
  subheading: {
    fontSize: 16,
    lineHeight: 24,
  },
});
