import { Host, TextInput } from '@expo/ui';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';

import { ListingCard } from '@/components/listing-card';
import { ScreenShell } from '@/components/screen-shell';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { ROAST_LABEL, roastIndex, ROAST_LEVELS, type RoastLevel } from '@/lib/coffees';
import { fetchActiveListings, type Listing } from '@/lib/listings';

function Chip({
  label,
  selected,
  onPress,
  colors,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  colors: (typeof Colors)['light' | 'dark'];
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.tint : colors.backgroundElement,
          borderColor: selected ? colors.tint : 'transparent',
        },
      ]}>
      <Text
        style={[styles.chipText, { color: selected ? colors.background : colors.text }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function BrowseScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const [listings, setListings] = useState<Listing[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const [query, setQuery] = useState('');
  const [city, setCity] = useState<string | null>(null);
  const [roast, setRoast] = useState<RoastLevel | null>(null);
  const [process, setProcess] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const all = await fetchActiveListings();
      // Your own coffees live on your shelf, not in the browse feed.
      setListings(all.filter((l) => l.owner_id !== session?.user.id));
    } finally {
      setLoaded(true);
      setRefreshing(false);
    }
  }, [session?.user.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Filter options come from what's actually on offer.
  const cities = useMemo(
    () =>
      [...new Set(listings.map((l) => l.owner?.city).filter((c): c is string => !!c))].sort(),
    [listings],
  );
  const processes = useMemo(
    () =>
      [
        ...new Set(
          listings
            .map((l) => l.coffee.process?.trim().toLowerCase())
            .filter((p): p is string => !!p),
        ),
      ].sort(),
    [listings],
  );

  const q = query.trim().toLowerCase();
  const visible = listings.filter((l) => {
    if (q) {
      const hay = [
        l.coffee.name,
        l.coffee.roaster.name,
        l.coffee.origin,
        l.coffee.varietal,
        l.owner?.username,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (city && l.owner?.city !== city) return false;
    if (roast && roastIndex(l.coffee.roast_level) !== ROAST_LEVELS.indexOf(roast)) return false;
    if (process && l.coffee.process?.trim().toLowerCase() !== process) return false;
    return true;
  });

  const filtering = q !== '' || city != null || roast != null || process != null;

  return (
    <ScreenShell
      eyebrow="AVAILABLE DOSES"
      title="What's brewing"
      subtitle="Fresh doses other members are ready to trade."
      insetForTabs>
      <View style={[styles.searchBox, { backgroundColor: colors.backgroundElement }]}>
        <Text style={[styles.searchIcon, { color: colors.textSecondary }]}>⌕</Text>
        <View style={styles.searchInput}>
          <Host matchContents>
            <TextInput
              placeholder="Coffee, roaster, origin, member…"
              autoCorrect={false}
              onChangeText={setQuery}
            />
          </Host>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterStrip}
        contentContainerStyle={styles.filterRow}>
        {cities.map((c) => (
          <Chip
            key={`city-${c}`}
            label={`📍 ${c}`}
            selected={city === c}
            onPress={() => setCity(city === c ? null : c)}
            colors={colors}
          />
        ))}
        {cities.length > 0 && (
          <View style={[styles.filterDivider, { backgroundColor: colors.backgroundSelected }]} />
        )}
        {ROAST_LEVELS.map((r) => (
          <Chip
            key={`roast-${r}`}
            label={ROAST_LABEL[r]}
            selected={roast === r}
            onPress={() => setRoast(roast === r ? null : r)}
            colors={colors}
          />
        ))}
        {processes.length > 0 && (
          <View style={[styles.filterDivider, { backgroundColor: colors.backgroundSelected }]} />
        )}
        {processes.map((p) => (
          <Chip
            key={`process-${p}`}
            label={p.charAt(0).toUpperCase() + p.slice(1)}
            selected={process === p}
            onPress={() => setProcess(process === p ? null : p)}
            colors={colors}
          />
        ))}
      </ScrollView>

      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.tint}
          />
        }
        renderItem={({ item }) => (
          <ListingCard
            listing={item}
            onPress={() => router.push({ pathname: '/listing/[id]', params: { id: item.id } })}
          />
        )}
        ListEmptyComponent={
          loaded ? (
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {filtering
                  ? 'Nothing matches those filters. Loosen up a little.'
                  : 'No doses up for trade right now. Share one of yours to get things moving.'}
              </Text>
            </View>
          ) : null
        }
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    minHeight: 46,
    marginBottom: Spacing.two,
  },
  searchIcon: {
    fontSize: 20,
    lineHeight: 24,
  },
  searchInput: {
    flex: 1,
  },
  filterStrip: {
    flexGrow: 0,
    marginBottom: Spacing.two,
  },
  filterRow: {
    gap: Spacing.one + 2,
    alignItems: 'center',
    paddingRight: Spacing.three,
  },
  filterDivider: {
    width: 1.5,
    height: 20,
    marginHorizontal: Spacing.one,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.two + 4,
    paddingVertical: Spacing.one + 2,
  },
  chipText: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '600',
  },
  list: {
    gap: Spacing.two,
    paddingBottom: Spacing.four,
  },
  empty: {
    paddingVertical: Spacing.four,
  },
  emptyText: {
    fontSize: 15,
    lineHeight: 22,
  },
});
