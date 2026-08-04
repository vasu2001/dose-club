import { Button, Column, Host } from '@expo/ui';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';

export default function WelcomeScreen() {
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.hero}>
          <Text style={[styles.eyebrow, { color: colors.accent }]}>
            SPECIALTY COFFEE EXCHANGE
          </Text>
          <Text style={[styles.title, { color: colors.text }]}>Dose{'\n'}Club</Text>

          <View style={styles.ratioRow}>
            <View style={[styles.rule, { backgroundColor: colors.backgroundSelected }]} />
            <Text style={[styles.ratio, { color: colors.textSecondary }]}>18g ⇄ 18g</Text>
            <View style={[styles.rule, { backgroundColor: colors.backgroundSelected }]} />
          </View>

          <Text style={[styles.tagline, { color: colors.textSecondary }]}>
            Share a dose of what you're brewing.{'\n'}Taste what everyone else is.
          </Text>
        </View>

        <Host matchContents seedColor={colors.tint} style={styles.actions}>
          <Column spacing={Spacing.two}>
            <Button
              variant="filled"
              label="Create account"
              style={{ width: '100%', height: 50 }}
              onPress={() => router.push('/signup')}
            />
            <Button
              variant="text"
              label="I already have an account"
              style={{ width: '100%', height: 44 }}
              onPress={() => router.push('/login')}
            />
          </Column>
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
    paddingBottom: Spacing.four,
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
    fontSize: 72,
    lineHeight: 74,
    fontWeight: '700',
  },
  ratioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  rule: {
    height: StyleSheet.hairlineWidth * 2,
    flex: 1,
  },
  ratio: {
    fontFamily: Fonts.mono,
    fontSize: 14,
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 17,
    lineHeight: 26,
  },
  actions: {
    width: '100%',
  },
});
