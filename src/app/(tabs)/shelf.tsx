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

import { BagCard } from '@/components/bag-card';
import { ListingCard } from '@/components/listing-card';
import { ListingListSkeleton } from '@/components/skeleton';
import { ScreenShell } from '@/components/screen-shell';
import { BottomTabInset, Colors, Fonts, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { fetchMyBags, type Bag, type BagStatus } from '@/lib/bags';
import { ROAST_LABEL, roastIndex, ROAST_LEVELS, type RoastLevel } from '@/lib/coffees';
import { fetchMyListings, type Listing } from '@/lib/listings';
import { queryKeys } from '@/lib/query';
import { useRefetchOnFocus } from '@/lib/use-refetch-on-focus';

const STATUS_FILTER_LABEL: Record<BagStatus, string> = {
  shelf: 'On shelf',
  frozen: 'Frozen',
  finished: 'Finished',
};

type Filters = {
  statuses: BagStatus[];
  /** null = both; 'yes' = has an active listing; 'no' = not listed. */
  listed: 'yes' | 'no' | null;
  roasts: RoastLevel[];
  processes: string[];
};

const NO_FILTERS: Filters = { statuses: [], listed: null, roasts: [], processes: [] };

/** One row on the shelf: a stash bag, or a legacy listing with no bag behind it. */
type ShelfRow =
  | { kind: 'bag'; key: string; bag: Bag; listed: boolean }
  | { kind: 'listing'; key: string; listing: Listing };

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

export default function ShelfScreen() {
  const { session, profile } = useAuth();
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const userId = session?.user.id;
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Draft edited inside the sheet, applied on "Show coffees".
  const [draft, setDraft] = useState<Filters>(NO_FILTERS);
  const searchRef = useRef<TextInputRef>(null);

  // Spinner only for a manual pull — background revalidation stays invisible,
  // otherwise the list jumps every time focus returns from a sub screen.
  const [refreshing, setRefreshing] = useState(false);
  const bagsQuery = useQuery({
    queryKey: queryKeys.myBags(userId ?? ''),
    queryFn: () => fetchMyBags(userId as string),
    enabled: userId != null,
  });
  const listingsQuery = useQuery({
    queryKey: queryKeys.myListings(userId ?? ''),
    queryFn: () => fetchMyListings(userId as string),
    enabled: userId != null,
  });
  useRefetchOnFocus(queryKeys.myBags(userId ?? ''));
  useRefetchOnFocus(queryKeys.myListings(userId ?? ''));
  const loaded = !bagsQuery.isLoading && !listingsQuery.isLoading;

  const bags = bagsQuery.data ?? [];
  const listings = listingsQuery.data ?? [];

  const rows: ShelfRow[] = useMemo(() => {
    const listedBagIds = new Set(
      listings.filter((l) => l.status === 'active' && l.bag_id != null).map((l) => l.bag_id),
    );
    const bagRows: ShelfRow[] = bags.map((bag) => ({
      kind: 'bag',
      key: `bag-${bag.id}`,
      bag,
      listed: listedBagIds.has(bag.id),
    }));
    // Active listings with no bag behind them (created before the stash
    // existed) still belong on the shelf.
    const orphanRows: ShelfRow[] = listings
      .filter((l) => l.status === 'active' && l.bag_id == null)
      .map((listing) => ({ kind: 'listing', key: `listing-${listing.id}`, listing }));
    return [...bagRows, ...orphanRows];
  }, [bags, listings]);

  const processes = useMemo(
    () =>
      [
        ...new Set(
          rows
            .map((row) =>
              (row.kind === 'bag' ? row.bag.coffee : row.listing.coffee).process
                ?.trim()
                .toLowerCase(),
            )
            .filter((p): p is string => !!p),
        ),
      ].sort(),
    [rows],
  );

  const q = query.trim().toLowerCase();
  const visible = rows.filter((row) => {
    const coffee = row.kind === 'bag' ? row.bag.coffee : row.listing.coffee;
    const listed = row.kind === 'bag' ? row.listed : true;
    if (q) {
      const hay = [coffee.name, coffee.roaster.name, coffee.origin, coffee.varietal, coffee.process]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (filters.statuses.length > 0) {
      // A bagless listing has no shelf/frozen state to match.
      if (row.kind !== 'bag' || !filters.statuses.includes(row.bag.status)) return false;
    }
    if (filters.listed === 'yes' && !listed) return false;
    if (filters.listed === 'no' && listed) return false;
    if (filters.roasts.length > 0) {
      const idx = roastIndex(coffee.roast_level);
      if (idx == null || !filters.roasts.includes(ROAST_LEVELS[idx])) return false;
    }
    if (
      filters.processes.length > 0 &&
      !filters.processes.includes(coffee.process?.trim().toLowerCase() ?? '')
    )
      return false;
    return true;
  });

  const activeChips: { key: string; label: string; remove: () => void }[] = [
    ...filters.statuses.map((s) => ({
      key: `status-${s}`,
      label: STATUS_FILTER_LABEL[s],
      remove: () =>
        setFilters((f) => ({ ...f, statuses: f.statuses.filter((x) => x !== s) })),
    })),
    ...(filters.listed != null
      ? [
          {
            key: 'listed',
            label: filters.listed === 'yes' ? 'Listed' : 'Not listed',
            remove: () => setFilters((f) => ({ ...f, listed: null })),
          },
        ]
      : []),
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
  ];

  const filterCount = activeChips.length;

  return (
    <ScreenShell
      eyebrow="YOUR STASH"
      title={profile?.display_name ? `${profile.display_name}'s coffees` : 'Your coffees'}
      subtitle="Everything you own — and what's up for trade."
      edges={['top']}
      headerAction={
        <Pressable
          onPress={() => router.push('/add-bag')}
          hitSlop={8}
          style={({ pressed }) => [
            styles.addButton,
            { backgroundColor: colors.tint, opacity: pressed ? 0.85 : 1 },
          ]}>
          <Text style={[styles.addIcon, { color: colors.background }]}>+</Text>
        </Pressable>
      }>
      <Pressable
        onPress={() => searchRef.current?.focus?.()}
        style={[styles.searchBox, { backgroundColor: colors.backgroundElement }]}>
        <Text style={[styles.searchIcon, { color: colors.textSecondary }]}>⌕</Text>
        <View style={styles.searchInput}>
          <Host matchContents>
            <TextInput
              ref={searchRef}
              placeholder="Coffee, roaster, origin, process…"
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
              backgroundColor: filterCount > 0 ? colors.tint : colors.backgroundElement,
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
                onPress={() => setFilters({ ...NO_FILTERS, statuses: ['shelf'] })}
                style={[styles.pill, { backgroundColor: colors.backgroundElement }]}>
                <Text style={[styles.pillText, { color: colors.text }]}>On shelf</Text>
              </Pressable>
              <Pressable
                onPress={() => setFilters({ ...NO_FILTERS, statuses: ['frozen'] })}
                style={[styles.pill, { backgroundColor: colors.backgroundElement }]}>
                <Text style={[styles.pillText, { color: colors.text }]}>Frozen</Text>
              </Pressable>
              <Pressable
                onPress={() => setFilters({ ...NO_FILTERS, listed: 'yes' })}
                style={[styles.pill, { backgroundColor: colors.backgroundElement }]}>
                <Text style={[styles.pillText, { color: colors.text }]}>Listed</Text>
              </Pressable>
              <Pressable
                onPress={() => setFilters({ ...NO_FILTERS, listed: 'no' })}
                style={[styles.pill, { backgroundColor: colors.backgroundElement }]}>
                <Text style={[styles.pillText, { color: colors.text }]}>Not listed</Text>
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
        keyExtractor={(item) => item.key}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              Promise.all([bagsQuery.refetch(), listingsQuery.refetch()]).finally(() =>
                setRefreshing(false),
              );
            }}
            tintColor={colors.tint}
          />
        }
        renderItem={({ item }) =>
          item.kind === 'bag' ? (
            <BagCard
              bag={item.bag}
              listed={item.listed}
              onPress={() =>
                router.push({ pathname: '/bag/[id]', params: { id: item.bag.id } })
              }
            />
          ) : (
            <ListingCard
              listing={item.listing}
              hideOwner
              onPress={() =>
                router.push({ pathname: '/listing/[id]', params: { id: item.listing.id } })
              }
            />
          )
        }
        ListEmptyComponent={
          loaded ? (
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {q || filterCount > 0
                  ? 'Nothing matches. Loosen the filters a little.'
                  : 'Nothing in your stash yet. Tap + to add a bag you own and start tracking rest and freezer time.'}
              </Text>
            </View>
          ) : (
            <ListingListSkeleton count={3} hideOwner />
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
          <ScrollView
            contentContainerStyle={styles.sheetContent}
            showsVerticalScrollIndicator={false}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Filter your stash</Text>

            <SheetSection label="STATUS" colors={colors}>
              {(Object.keys(STATUS_FILTER_LABEL) as BagStatus[]).map((s) => (
                <FilterChip
                  key={s}
                  label={STATUS_FILTER_LABEL[s]}
                  selected={draft.statuses.includes(s)}
                  onPress={() => setDraft((d) => ({ ...d, statuses: toggle(d.statuses, s) }))}
                  colors={colors}
                />
              ))}
            </SheetSection>

            <SheetSection label="LISTED FOR TRADE" colors={colors}>
              <FilterChip
                label="Listed"
                selected={draft.listed === 'yes'}
                onPress={() =>
                  setDraft((d) => ({ ...d, listed: d.listed === 'yes' ? null : 'yes' }))
                }
                colors={colors}
              />
              <FilterChip
                label="Not listed"
                selected={draft.listed === 'no'}
                onPress={() =>
                  setDraft((d) => ({ ...d, listed: d.listed === 'no' ? null : 'no' }))
                }
                colors={colors}
              />
            </SheetSection>

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
                    onPress={() =>
                      setDraft((d) => ({ ...d, processes: toggle(d.processes, p) }))
                    }
                    colors={colors}
                  />
                ))}
              </SheetSection>
            )}

            <View style={styles.sheetActions}>
              <Pressable onPress={() => setDraft(NO_FILTERS)} hitSlop={8}>
                <Text style={[styles.clearAll, { color: colors.textSecondary }]}>
                  Clear all
                </Text>
              </Pressable>
              <Host matchContents seedColor={colors.tint}>
                <Button
                  variant="filled"
                  label="Show coffees"
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
  addButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  addIcon: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '400',
    marginTop: -2,
  },
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
