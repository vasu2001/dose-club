import { Button, Host } from '@expo/ui';
import { StyleSheet, Text, View, useColorScheme, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomTabInset, Colors, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';

export default function HomeScreen() {
  const { session, signOut } = useAuth();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { width } = useWindowDimensions();
  const buttonWidth = Math.min(width, MaxContentWidth) - 2 * Spacing.five;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.hero}>
          <Text style={[styles.eyebrow, { color: colors.accent }]}>ON THE SHELF</Text>
          <Text style={[styles.title, { color: colors.text }]}>Nothing brewing yet</Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            Coffee listings are coming soon. You're signed in as{' '}
            {session?.user.email ?? 'unknown'}.
          </Text>
        </View>

        <Host matchContents seedColor={colors.tint} style={styles.actions}>
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
  hero: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.three,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 3,
  },
  title: {
    fontFamily: Fonts.serif,
    fontSize: 40,
    lineHeight: 46,
    fontWeight: '700',
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
  },
  actions: {
    width: '100%',
  },
});
