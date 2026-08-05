import { Button, Host, TextInput, type TextInputRef } from '@expo/ui';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';

import { ListingCard } from '@/components/listing-card';
import { ListingListSkeleton } from '@/components/skeleton';
import { ScreenShell } from '@/components/screen-shell';
import { BottomTabInset, Colors, Fonts, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { ROAST_LABEL, roastIndex, ROAST_LEVELS, type RoastLevel } from '@/lib/coffees';
import { daysOffRoast, fetchActiveListings } from '@/lib/listings';
import { queryKeys } from '@/lib/query';
import { useRefetchOnFocus } from '@/lib/use-refetch-on-focus';

const FRESH_DAYS = 14;

type Filters = {
  roasts: RoastLevel[];
  processes: string[];
  cities: string[];
  maxDays: number | null;
};

const NO_FILTERS: Filters = { roasts: [], processes: [], cities: [], maxDays: null };

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function FilterChip({
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
          backgroundColor: selected ? colors.tint : colors.backgroundSelected,
        },
      ]}>
      <Text style={[styles.chipText, { color: selected ? colors.background : colors.text }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function SheetSection({
  label,
  colors,
  children,
}: {
  label: string;
  colors: (typeof Colors)['light' | 'dark'];
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sheetSection}>
      <Text style={[styles.sheetLabel, { color: colors.accent }]}>{label}</Text>
      <View style={styles.sheetChips}>{children}</View>
    </View>
  );
}

export default function BrowseScreen() {
  const { session, profile } = useAuth();
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Draft edited inside the sheet, applied on "Show doses".
  const [draft, setDraft] = useState<Filters>(NO_FILTERS);
  const searchRef = useRef<TextInputRef>(null);

  // Spinner only for a manual pull — background revalidation stays invisible,
  // otherwise the list jumps every time focus returns from a sub screen.
  const [refreshing, setRefreshing] = useState(false);
  const {
    data: allListings = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: queryKeys.activeListings,
    queryFn: fetchActiveListings,
  });
  // Your own coffees live on your shelf, not in the browse feed.
  const listings = useMemo(
    () => allListings.filter((l) => l.owner_id !== session?.user.id),
    [allListings, session?.user.id],
  );
  const loaded = !isLoading;
  useRefetchOnFocus(queryKeys.activeListings);

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
    const days = daysOffRoast(l);
    if (filters.roasts.length > 0) {
      const idx = roastIndex(l.coffee.roast_level);
      if (idx == null || !filters.roasts.includes(ROAST_LEVELS[idx])) return false;
    }
    if (
      filters.processes.length > 0 &&
      !filters.processes.includes(l.coffee.process?.trim().toLowerCase() ?? '')
    )
      return false;
    if (filters.cities.length > 0 && !filters.cities.includes(l.owner?.city ?? ''))
      return false;
    if (filters.maxDays != null && (days == null || days > filters.maxDays)) return false;
    return true;
  });

  const activeChips: { key: string; label: string; remove: () => void }[] = [
    ...filters.roasts.map((r) => ({
      key: `roast-${r}`,
      label: ROAST_LABEL[r],
      remove: () => setFilters((f) => ({ ...f, roasts: f.roasts.filter((x) => x !== r) })),
    })),
    ...filters.processes.map((p) => ({
      key: `process-${p}`,
      label: p.charAt(0).toUpperCase() + p.slice(1),
      remove: () =>
        setFilters((f) => ({ ...f, processes: f.processes.filter((x) => x !== p) })),
    })),
    ...filters.cities.map((c) => ({
      key: `city-${c}`,
      label: `📍 ${c}`,
      remove: () => setFilters((f) => ({ ...f, cities: f.cities.filter((x) => x !== c) })),
    })),
    ...(filters.maxDays != null
      ? [
          {
            key: 'maxDays',
            label: `≤ ${filters.maxDays}d off roast`,
            remove: () => setFilters((f) => ({ ...f, maxDays: null })),
          },
        ]
      : []),
  ];

  const filterCount = activeChips.length;

  return (
    <ScreenShell
      eyebrow="AVAILABLE DOSES"
      title="What's brewing"
      subtitle="Fresh doses other members are ready to trade."
      edges={['top']}>
      <Pressable
        onPress={() => searchRef.current?.focus?.()}
        style={[styles.searchBox, { backgroundColor: colors.backgroundElement }]}>
        <Text style={[styles.searchIcon, { color: colors.textSecondary }]}>⌕</Text>
        <View style={styles.searchInput}>
          <Host matchContents>
            <TextInput
              ref={searchRef}
              placeholder="Coffee, roaster, origin, member…"
              autoCorrect={false}
              onChangeText={setQuery}
            />
          </Host>
        </View>
      </Pressable>

      <View style={styles.controls}>
        <Pressable
          onPress={() => {
            setDraft(filters);
            setSheetOpen(true);
          }}
          style={[
            styles.filterButton,
            {
              backgroundColor:
                filterCount > 0 ? colors.tint : colors.backgroundElement,
            },
          ]}>
          <Text
            style={[
              styles.filterIcon,
              { color: filterCount > 0 ? colors.background : colors.text },
            ]}>
            ☰
          </Text>
          {filterCount > 0 && (
            <Text style={[styles.filterCount, { color: colors.background }]}>
              {filterCount}
            </Text>
          )}
        </Pressable>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.controlsRow}>
          {filterCount === 0 ? (
            <>
              <Pressable
                onPress={() => setFilters({ ...NO_FILTERS, maxDays: FRESH_DAYS })}
                style={[styles.pill, { backgroundColor: colors.backgroundElement }]}>
                <Text style={[styles.pillText, { color: colors.text }]}>Fresh</Text>
              </Pressable>
              {profile?.city != null && (
                <Pressable
                  onPress={() =>
                    setFilters({ ...NO_FILTERS, cities: [profile.city as string] })
                  }
                  style={[styles.pill, { backgroundColor: colors.backgroundElement }]}>
                  <Text style={[styles.pillText, { color: colors.text }]}>
                    📍 {profile.city}
                  </Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => setFilters({ ...NO_FILTERS, roasts: ['ultralight', 'light'] })}
                style={[styles.pill, { backgroundColor: colors.backgroundElement }]}>
                <Text style={[styles.pillText, { color: colors.text }]}>Light roasts</Text>
              </Pressable>
            </>
          ) : (
            <>
              {activeChips.map(({ key, label, remove }) => (
                <Pressable
                  key={key}
                  onPress={remove}
                  style={[styles.pill, styles.activePill, { borderColor: colors.tint }]}>
                  <Text style={[styles.pillText, { color: colors.text }]}>{label}</Text>
                  <Text style={[styles.activeChipX, { color: colors.tint }]}>✕</Text>
                </Pressable>
              ))}
              <Pressable
                onPress={() => setFilters(NO_FILTERS)}
                hitSlop={8}
                style={styles.clearAllWrap}>
                <Text style={[styles.clearAll, { color: colors.tint }]}>Clear all</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </View>

      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              refetch().finally(() => setRefreshing(false));
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
                {q || filterCount > 0
                  ? 'Nothing matches. Loosen the filters a little.'
                  : 'No doses up for trade right now. Share one of yours to get things moving.'}
              </Text>
            </View>
          ) : (
            <ListingListSkeleton count={4} />
          )
        }
      />

      <Modal
        visible={sheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setSheetOpen(false)} />
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          <View style={[styles.grabber, { backgroundColor: colors.backgroundSelected }]} />
          <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Filter doses</Text>

          <SheetSection label="ROAST LEVEL" colors={colors}>
            {ROAST_LEVELS.map((r) => (
              <FilterChip
                key={r}
                label={ROAST_LABEL[r]}
                selected={draft.roasts.includes(r)}
                onPress={() => setDraft((d) => ({ ...d, roasts: toggle(d.roasts, r) }))}
                colors={colors}
              />
            ))}
          </SheetSection>

          {processes.length > 0 && (
            <SheetSection label="PROCESS" colors={colors}>
              {processes.map((p) => (
                <FilterChip
                  key={p}
                  label={p.charAt(0).toUpperCase() + p.slice(1)}
                  selected={draft.processes.includes(p)}
                  onPress={() => setDraft((d) => ({ ...d, processes: toggle(d.processes, p) }))}
                  colors={colors}
                />
              ))}
            </SheetSection>
          )}

          {cities.length > 0 && (
            <SheetSection label="CITY" colors={colors}>
              {cities.map((c) => (
                <FilterChip
                  key={c}
                  label={c}
                  selected={draft.cities.includes(c)}
                  onPress={() => setDraft((d) => ({ ...d, cities: toggle(d.cities, c) }))}
                  colors={colors}
                />
              ))}
            </SheetSection>
          )}

          <SheetSection label="FRESHNESS" colors={colors}>
            {[7, 14, 30].map((days) => (
              <FilterChip
                key={days}
                label={`≤ ${days} days`}
                selected={draft.maxDays === days}
                onPress={() =>
                  setDraft((d) => ({ ...d, maxDays: d.maxDays === days ? null : days }))
                }
                colors={colors}
              />
            ))}
          </SheetSection>

            <View style={styles.sheetActions}>
              <Pressable onPress={() => setDraft(NO_FILTERS)} hitSlop={8}>
                <Text style={[styles.clearAll, { color: colors.textSecondary }]}>
                  Clear all
                </Text>
              </Pressable>
              <Host matchContents seedColor={colors.tint}>
                <Button
                  variant="filled"
                  label="Show doses"
                  style={{ height: 44 }}
                  onPress={() => {
                    setFilters(draft);
                    setSheetOpen(false);
                  }}
                />
              </Host>
            </View>
          </ScrollView>
        </View>
      </Modal>
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
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
    paddingRight: Spacing.three,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 4,
  },
  activePill: {
    borderWidth: 1.5,
  },
  pillText: {
    fontSize: 14,
    fontWeight: '600',
  },
  clearAllWrap: {
    justifyContent: 'center',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 4,
  },
  filterIcon: {
    fontSize: 17,
  },
  filterCount: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    fontWeight: '700',
  },
  activeChipX: {
    fontSize: 12,
    fontWeight: '700',
  },
  clearAll: {
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: Spacing.one,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: Spacing.two + 4,
    paddingVertical: Spacing.one + 3,
  },
  chipText: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    fontWeight: '600',
  },
  list: {
    gap: Spacing.two,
    // Scroll under the floating tab bar; keep the last card reachable.
    paddingBottom: BottomTabInset + Spacing.six,
  },
  empty: {
    paddingVertical: Spacing.four,
  },
  emptyText: {
    fontSize: 15,
    lineHeight: 22,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  sheet: {
    maxHeight: '80%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: Spacing.two,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    marginBottom: Spacing.one,
  },
  sheetContent: {
    padding: Spacing.four,
    paddingBottom: Spacing.five + Spacing.three,
    gap: Spacing.three,
  },
  sheetTitle: {
    fontFamily: Fonts.serif,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '700',
  },
  sheetSection: {
    gap: Spacing.two,
  },
  sheetLabel: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },
  sheetChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one + 2,
  },
  sheetActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.two,
  },
});
