import { Button, Host, TextInput } from '@expo/ui';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';

import { Field } from '@/components/form-field';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import {
  createCoffee,
  fetchMyCoffees,
  searchCoffees,
  searchRoasters,
  type Coffee,
  type Roaster,
} from '@/lib/coffees';

type CoffeePickerProps = {
  selected: Coffee | null;
  onSelect: (coffee: Coffee | null) => void;
};

function coffeeMeta(coffee: Coffee): string {
  return [coffee.origin, coffee.varietal, coffee.process]
    .filter(Boolean)
    .join(' · ');
}

/** Compact result row shown under the search field. */
function ResultRow({
  coffee,
  mine,
  onPress,
  colors,
}: {
  coffee: Coffee;
  mine: boolean;
  onPress: () => void;
  colors: (typeof Colors)['light' | 'dark'];
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.resultRow,
        { borderBottomColor: colors.backgroundSelected, opacity: pressed ? 0.6 : 1 },
      ]}>
      <View style={styles.resultText}>
        <Text style={[styles.resultName, { color: colors.text }]} numberOfLines={1}>
          {coffee.name}
        </Text>
        <Text style={[styles.resultMeta, { color: colors.textSecondary }]} numberOfLines={1}>
          {coffee.roaster.name}
          {coffee.origin ? ` · ${coffee.origin}` : ''}
        </Text>
      </View>
      {mine && (
        <Text style={[styles.resultBadge, { color: colors.accent }]}>YOURS</Text>
      )}
    </Pressable>
  );
}

/**
 * Search-first coffee picker.
 *
 * Idle: one search field over the shared catalog, with your recent coffees
 * ready underneath. Selecting collapses everything into a single card with a
 * "change" affordance. Adding is a last resort: two required fields, the
 * rest tucked behind "more detail".
 */
export function CoffeePicker({ selected, onSelect }: CoffeePickerProps) {
  const { session } = useAuth();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const [mine, setMine] = useState<Coffee[]>([]);
  const [results, setResults] = useState<Coffee[]>([]);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [roasterQuery, setRoasterQuery] = useState('');
  const [roasterSuggestions, setRoasterSuggestions] = useState<Roaster[]>([]);
  const [roasterPickCount, setRoasterPickCount] = useState(0);
  const roaster = useRef('');
  const name = useRef('');
  const origin = useRef('');
  const varietal = useRef('');
  const process = useRef('');
  const roasterNotes = useRef('');

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    fetchMyCoffees(session.user.id)
      .then((rows) => {
        if (!cancelled) setMine(rows);
      })
      .finally(() => setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      searchCoffees(q)
        .then(setResults)
        .catch(() => {})
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const q = roasterQuery.trim();
    if (!q) {
      setRoasterSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      searchRoasters(q)
        .then(setRoasterSuggestions)
        .catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
  }, [roasterQuery]);

  const saveCoffee = async () => {
    if (busy || !session) return;
    const roasterName = roaster.current.trim();
    const coffeeName = name.current.trim();
    if (!roasterName || !coffeeName) {
      setError('Roaster and coffee name are required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const coffee = await createCoffee(session.user.id, {
        roaster_name: roasterName,
        name: coffeeName,
        origin: origin.current.trim() || null,
        varietal: varietal.current.trim() || null,
        process: process.current.trim() || null,
        roast_level: null,
        roaster_notes: roasterNotes.current.trim() || null,
      });
      setMine((prev) => [coffee, ...prev]);
      setAdding(false);
      onSelect(coffee);
    } catch (e) {
      const message =
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message: unknown }).message)
          : 'Something went wrong.';
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) return null;

  // ── Selected: one card, everything else out of the way. ──────────────
  if (selected) {
    const meta = coffeeMeta(selected);
    return (
      <View
        style={[
          styles.selectedCard,
          { backgroundColor: colors.backgroundElement, borderColor: colors.tint },
        ]}>
        <View style={styles.selectedText}>
          <Text style={[styles.selectedKicker, { color: colors.accent }]}>
            {selected.roaster.name.toUpperCase()}
          </Text>
          <Text style={[styles.selectedName, { color: colors.text }]}>{selected.name}</Text>
          {meta !== '' && (
            <Text style={[styles.selectedMeta, { color: colors.textSecondary }]}>{meta}</Text>
          )}
        </View>
        <Pressable onPress={() => onSelect(null)} hitSlop={8}>
          <Text style={[styles.changeLink, { color: colors.tint }]}>Change</Text>
        </Pressable>
      </View>
    );
  }

  // ── Adding: essentials up top, the rest behind "more detail". ────────
  if (adding) {
    return (
      <View style={styles.container}>
        <Field label="ROASTER" colors={colors}>
          <TextInput
            key={roasterPickCount}
            placeholder="Blue Tokai"
            autoCorrect={false}
            defaultValue={roaster.current}
            onChangeText={(t) => {
              roaster.current = t;
              setRoasterQuery(t);
            }}
          />
        </Field>
        {roasterSuggestions.length > 0 && (
          <View style={styles.suggestions}>
            {roasterSuggestions.map((r) => (
              <Pressable
                key={r.id}
                onPress={() => {
                  roaster.current = r.name;
                  setRoasterQuery('');
                  setRoasterSuggestions([]);
                  setRoasterPickCount((n) => n + 1);
                }}
                style={[styles.suggestionChip, { backgroundColor: colors.backgroundSelected }]}>
                <Text style={[styles.suggestionText, { color: colors.tint }]}>{r.name}</Text>
              </Pressable>
            ))}
          </View>
        )}
        <Field label="COFFEE NAME" colors={colors}>
          <TextInput
            placeholder="Attikan Estate"
            autoCorrect={false}
            onChangeText={(t) => {
              name.current = t;
            }}
          />
        </Field>

        {showDetail ? (
          <>
            <Field label="ORIGIN" colors={colors}>
              <TextInput
                placeholder="Karnataka, India"
                onChangeText={(t) => {
                  origin.current = t;
                }}
              />
            </Field>
            <Field label="VARIETAL" colors={colors}>
              <TextInput
                placeholder="SL9, Gesha, Catuai…"
                autoCorrect={false}
                onChangeText={(t) => {
                  varietal.current = t;
                }}
              />
            </Field>
            <Field label="PROCESS" colors={colors}>
              <TextInput
                placeholder="Washed, natural…"
                onChangeText={(t) => {
                  process.current = t;
                }}
              />
            </Field>
            <Field label="ROASTER'S NOTES" colors={colors}>
              <TextInput
                placeholder="What's on the bag: stone fruit, jasmine, honey…"
                multiline
                onChangeText={(t) => {
                  roasterNotes.current = t;
                }}
              />
            </Field>
          </>
        ) : (
          <Pressable onPress={() => setShowDetail(true)} hitSlop={8}>
            <Text style={[styles.detailLink, { color: colors.tint }]}>
              + Origin, varietal, process, notes…
            </Text>
          </Pressable>
        )}

        {error != null && (
          <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
        )}

        <View style={styles.addActions}>
          <Pressable onPress={() => setAdding(false)} hitSlop={8}>
            <Text style={[styles.cancelLink, { color: colors.textSecondary }]}>Cancel</Text>
          </Pressable>
          <Host matchContents seedColor={colors.tint}>
            <Button
              variant="filled"
              label={busy ? 'Saving…' : 'Save & select'}
              disabled={busy}
              style={{ height: 44 }}
              onPress={saveCoffee}
            />
          </Host>
        </View>
      </View>
    );
  }

  // ── Idle: search-first, your coffees a tap away. ─────────────────────
  const q = query.trim();
  const mineIds = new Set(mine.map((c) => c.id));
  const rows = q
    ? [...results.filter((c) => mineIds.has(c.id)), ...results.filter((c) => !mineIds.has(c.id))]
    : mine.slice(0, 4);

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.searchBox,
          { backgroundColor: colors.backgroundElement },
        ]}>
        <Text style={[styles.searchIcon, { color: colors.textSecondary }]}>⌕</Text>
        <View style={styles.searchInput}>
          <Host matchContents>
            <TextInput
              placeholder="Search coffee or roaster…"
              autoCorrect={false}
              onChangeText={setQuery}
            />
          </Host>
        </View>
        {searching && <ActivityIndicator size="small" color={colors.tint} />}
      </View>

      {rows.length > 0 && (
        <View style={[styles.resultsCard, { backgroundColor: colors.backgroundElement }]}>
          {!q && (
            <Text style={[styles.resultsHeading, { color: colors.textSecondary }]}>
              FROM YOUR SHELF
            </Text>
          )}
          {rows.map((coffee) => (
            <ResultRow
              key={coffee.id}
              coffee={coffee}
              mine={q ? mineIds.has(coffee.id) : false}
              onPress={() => onSelect(coffee)}
              colors={colors}
            />
          ))}
        </View>
      )}

      {q !== '' && !searching && results.length === 0 && (
        <Text style={[styles.noMatch, { color: colors.textSecondary }]}>
          No “{q}” in the club's catalog yet.
        </Text>
      )}

      <Pressable onPress={() => setAdding(true)} hitSlop={8}>
        <Text style={[styles.addLink, { color: colors.tint }]}>
          + New coffee{q ? ` “${q}”` : ''}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    minHeight: 46,
  },
  searchIcon: {
    fontSize: 20,
    lineHeight: 24,
  },
  searchInput: {
    flex: 1,
  },
  resultsCard: {
    borderRadius: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  resultsHeading: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 1.5,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.one,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  resultText: {
    flex: 1,
    gap: 1,
  },
  resultName: {
    fontSize: 16,
    fontWeight: '600',
  },
  resultMeta: {
    fontSize: 13,
  },
  resultBadge: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
  },
  noMatch: {
    fontSize: 14,
    lineHeight: 20,
  },
  addLink: {
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: Spacing.one,
  },
  selectedCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    borderRadius: 20,
    borderWidth: 1.5,
    padding: Spacing.three,
  },
  selectedText: {
    flex: 1,
    gap: 2,
  },
  selectedKicker: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 1.5,
  },
  selectedName: {
    fontFamily: Fonts.serif,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
  },
  selectedMeta: {
    fontSize: 14,
    lineHeight: 20,
  },
  changeLink: {
    fontSize: 14,
    fontWeight: '600',
    paddingTop: 2,
  },
  suggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  suggestionChip: {
    borderRadius: 999,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.one,
  },
  suggestionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  detailLink: {
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: Spacing.one,
  },
  addActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.one,
  },
  cancelLink: {
    fontSize: 15,
    fontWeight: '600',
  },
  error: {
    fontSize: 14,
    lineHeight: 20,
  },
});
