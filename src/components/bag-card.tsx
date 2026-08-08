import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';

import { Colors, Fonts, Spacing } from '@/constants/theme';
import { frozenDays, restedDays, type Bag, type BagStatus } from '@/lib/bags';

const STATUS_LABEL: Record<BagStatus, string> = {
  shelf: 'ON SHELF',
  frozen: 'FROZEN',
  finished: 'FINISHED',
};

export function BagStatusChip({ status }: { status: BagStatus }) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const color =
    status === 'frozen' ? '#5AA9E6' : status === 'finished' ? colors.textSecondary : colors.tint;
  return (
    <View style={[styles.chip, { backgroundColor: colors.backgroundSelected }]}>
      <Text style={[styles.chipText, { color }]}>{STATUS_LABEL[status]}</Text>
    </View>
  );
}

function Stat({ label, value, color, valueColor }: {
  label: string;
  value: string;
  color: string;
  valueColor: string;
}) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statLabel, { color }]}>{label}</Text>
      <Text style={[styles.statValue, { color: valueColor }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export function BagCard({
  bag,
  listed,
  onPress,
}: {
  bag: Bag;
  /** Bag currently has an active listing sharing it. */
  listed?: boolean;
  onPress?: () => void;
}) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const rested = restedDays(bag);
  const frozen = frozenDays(bag);
  const finished = bag.status === 'finished';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.backgroundElement,
          opacity: pressed ? 0.85 : finished ? 0.6 : 1,
        },
      ]}>
      <View style={styles.titleRow}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
          {bag.coffee.name}
        </Text>
        <View style={styles.chips}>
          {listed && (
            <View style={[styles.chip, { backgroundColor: colors.tint }]}>
              <Text style={[styles.chipText, { color: colors.background }]}>LISTED</Text>
            </View>
          )}
          <BagStatusChip status={bag.status} />
        </View>
      </View>

      <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
        {bag.coffee.roaster.name}
        {bag.coffee.origin ? ` · ${bag.coffee.origin}` : ''}
      </Text>

      <View style={[styles.statsRow, { borderTopColor: colors.backgroundSelected }]}>
        <Stat
          label="RESTED"
          value={rested != null ? `${rested}d` : '—'}
          color={colors.textSecondary}
          valueColor={colors.text}
        />
        <Stat
          label="FROZEN"
          value={frozen > 0 ? `${frozen}d` : '—'}
          color={colors.textSecondary}
          valueColor={colors.text}
        />
        <Stat
          label="BAG"
          value={bag.size_grams != null ? `${bag.size_grams}g` : '—'}
          color={colors.textSecondary}
          valueColor={colors.text}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  name: {
    flex: 1,
    fontFamily: Fonts.serif,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
  },
  chips: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  chip: {
    borderRadius: 8,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  chipText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.two,
  },
  stat: {
    flex: 1,
    gap: 2,
  },
  statLabel: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
  },
});
