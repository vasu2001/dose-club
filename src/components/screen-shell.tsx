import { StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView, type Edges } from 'react-native-safe-area-context';

import {
  BottomTabInset,
  Colors,
  Fonts,
  MaxContentWidth,
  Spacing,
} from '@/constants/theme';

type ScreenShellProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  /** Pad the bottom for the native tab bar. */
  insetForTabs?: boolean;
  edges?: Edges;
  children?: React.ReactNode;
};

export function ScreenShell({
  eyebrow,
  title,
  subtitle,
  insetForTabs,
  edges,
  children,
}: ScreenShellProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <SafeAreaView
        edges={edges}
        style={[
          styles.safeArea,
          insetForTabs && { paddingBottom: BottomTabInset + Spacing.three },
        ]}>
        <View style={styles.header}>
          {eyebrow != null && (
            <Text style={[styles.eyebrow, { color: colors.accent }]}>{eyebrow}</Text>
          )}
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          {subtitle != null && (
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
          )}
        </View>
        {children}
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
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
  },
  header: {
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
    gap: Spacing.one,
  },
  eyebrow: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 3,
  },
  title: {
    fontFamily: Fonts.serif,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
});
