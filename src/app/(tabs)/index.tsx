import { Button, Host, TextInput, type TextInputRef } from '@expo/ui';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
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
import { ScreenShell } from '@/components/screen-shell';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { ROAST_LABEL, roastIndex, ROAST_LEVELS, type RoastLevel } from '@/lib/coffees';
import { daysOffRoast, fetchActiveListings, type Listing } from '@/lib/listings';

type QuickTab = 'all' | 'fresh' | 'my-city';

const FRESH_DAYS = 14;

type Filters = {
  roast: RoastLevel | null;
  process: string | null;
  city: string | null;
  maxDays: number | null;
};

const NO_FILTERS: Filters = { roast: null, process: null, city: null, maxDays: null };

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

  const [listings, setListings] = useState<Listing[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<QuickTab>('all');
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Draft edited inside the sheet, applied on "Show doses".
  const [draft, setDraft] = useState<Filters>(NO_FILTERS);
  const searchRef = useRef<TextInputRef>(null);

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
    if (tab === 'fresh' && (days == null || days > FRESH_DAYS)) return false;
    if (tab === 'my-city' && (!profile?.city || l.owner?.city !== profile.city)) return false;
    if (filters.roast && roastIndex(l.coffee.roast_level) !== ROAST_LEVELS.indexOf(filters.roast))
      return false;
    if (filters.process && l.coffee.process?.trim().toLowerCase() !== filters.process)
      return false;
    if (filters.city && l.owner?.city !== filters.city) return false;
    if (filters.maxDays != null && (days == null || days > filters.maxDays)) return false;
    return true;
  });

  const activeChips: { key: keyof Filters; label: string }[] = [];
  if (filters.roast) activeChips.push({ key: 'roast', label: ROAST_LABEL[filters.roast] });
  if (filters.process)
    activeChips.push({
      key: 'process',
      label: filters.process.charAt(0).toUpperCase() + filters.process.slice(1),
    });
  if (filters.city) activeChips.push({ key: 'city', label: `📍 ${filters.city}` });
  if (filters.maxDays != null)
    activeChips.push({ key: 'maxDays', label: `≤ ${filters.maxDays}d off roast` });

  const filterCount = activeChips.length;

  const TABS: { key: QuickTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'fresh', label: 'Fresh' },
    ...(profile?.city ? [{ key: 'my-city' as const, label: profile.city }] : []),
  ];

  return (
    <ScreenShell
      eyebrow="AVAILABLE DOSES"
      title="What's brewing"
      subtitle="Fresh doses other members are ready to trade."
      insetForTabs>
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
        <View style={[styles.tabs, { backgroundColor: colors.backgroundElement }]}>
          {TABS.map(({ key, label }) => {
            const selected = tab === key;
            return (
              <Pressable
                key={key}
                onPress={() => setTab(key)}
                style={[
                  styles.tab,
                  selected && { backgroundColor: colors.backgroundSelected },
                ]}>
                <Text
                  style={[
                    styles.tabText,
                    { color: selected ? colors.text : colors.textSecondary },
                  ]}
                  numberOfLines={1}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
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
      </View>

      {activeChips.length > 0 && (
        <View style={styles.activeRow}>
          {activeChips.map(({ key, label }) => (
            <Pressable
              key={key}
              onPress={() => setFilters((f) => ({ ...f, [key]: null }))}
              style={[styles.activeChip, { backgroundColor: colors.backgroundSelected }]}>
              <Text style={[styles.activeChipText, { color: colors.text }]}>{label}</Text>
              <Text style={[styles.activeChipX, { color: colors.tint }]}>✕</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => setFilters(NO_FILTERS)} hitSlop={8}>
            <Text style={[styles.clearAll, { color: colors.tint }]}>Clear all</Text>
          </Pressable>
        </View>
      )}

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
                {q || filterCount > 0 || tab !== 'all'
                  ? 'Nothing matches. Loosen the filters a little.'
                  : 'No doses up for trade right now. Share one of yours to get things moving.'}
              </Text>
            </View>
          ) : null
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
          <ScrollView contentContainerStyle={styles.sheetContent}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Filter doses</Text>

          <SheetSection label="ROAST LEVEL" colors={colors}>
            {ROAST_LEVELS.map((r) => (
              <FilterChip
                key={r}
                label={ROAST_LABEL[r]}
                selected={draft.roast === r}
                onPress={() =>
                  setDraft((d) => ({ ...d, roast: d.roast === r ? null : r }))
                }
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
                  selected={draft.process === p}
                  onPress={() =>
                    setDraft((d) => ({ ...d, process: d.process === p ? null : p }))
                  }
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
                  selected={draft.city === c}
                  onPress={() =>
                    setDraft((d) => ({ ...d, city: d.city === c ? null : c }))
                  }
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
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  tabs: {
    flex: 1,
    flexDirection: 'row',
    borderRadius: 999,
    padding: 3,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingVertical: Spacing.one + 4,
    paddingHorizontal: Spacing.two,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
  },
  filterIcon: {
    fontSize: 17,
  },
  filterCount: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    fontWeight: '700',
  },
  activeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.one + 2,
    marginBottom: Spacing.two,
  },
  activeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
    borderRadius: 999,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.one + 1,
  },
  activeChipText: {
    fontSize: 13,
    fontWeight: '600',
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
    paddingBottom: Spacing.four,
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
