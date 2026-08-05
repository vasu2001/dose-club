import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';

import { RoastDots } from '@/components/roast-slider';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { roastIndex } from '@/lib/coffees';
import { daysOffRoast, type Listing } from '@/lib/listings';

type ListingCardProps = {
  listing: Listing;
  onPress?: () => void;
  /** Hide the owner row (e.g. on your own shelf). */
  hideOwner?: boolean;
};

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

export function ListingCard({ listing, onPress, hideOwner }: ListingCardProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const days = daysOffRoast(listing);
  const roastIdx = roastIndex(listing.coffee.roast_level);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.backgroundElement, opacity: pressed ? 0.85 : 1 },
      ]}>
      <View style={styles.titleRow}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
          {listing.coffee.name}
        </Text>
        {days != null && (
          <View style={[styles.chip, { backgroundColor: colors.backgroundSelected }]}>
            <Text style={[styles.chipText, { color: colors.tint }]}>
              {days === 0 ? 'ROASTED TODAY' : `${days}D OFF ROAST`}
            </Text>
          </View>
        )}
      </View>

      <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
        {listing.coffee.roaster.name}
        {listing.coffee.origin ? ` · ${listing.coffee.origin}` : ''}
        {listing.coffee.varietal ? ` · ${listing.coffee.varietal}` : ''}
      </Text>

      <View style={[styles.statsRow, { borderTopColor: colors.backgroundSelected }]}>
        <Stat
          label="PROCESS"
          value={listing.coffee.process ?? '—'}
          color={colors.textSecondary}
          valueColor={colors.text}
        />
        <View style={styles.stat}>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>ROAST</Text>
          {roastIdx != null ? (
            <RoastDots level={listing.coffee.roast_level} />
          ) : (
            <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1}>
              {listing.coffee.roast_level ?? '—'}
            </Text>
          )}
        </View>
        <Stat
          label="DOSE"
          value={`${listing.dose_grams}g`}
          color={colors.textSecondary}
          valueColor={colors.text}
        />
      </View>

      {!hideOwner && listing.owner && (
        <Text style={[styles.owner, { color: colors.textSecondary }]}>
          @{listing.owner.username ?? 'someone'}
          {listing.owner.city ? `  ·  ${listing.owner.city}` : ''}
        </Text>
      )}

      {listing.status !== 'active' && (
        <View style={[styles.statusChip, { backgroundColor: colors.backgroundSelected }]}>
          <Text style={[styles.chipText, { color: colors.accent }]}>
            {listing.status.toUpperCase()}
          </Text>
        </View>
      )}
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
  owner: {
    fontSize: 13,
  },
  statusChip: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
});
