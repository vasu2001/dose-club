import { Button, Host, TextInput } from '@expo/ui';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';

import { Field } from '@/components/form-field';
import { Colors, Spacing } from '@/constants/theme';
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
  selectedId: string | null;
  onSelect: (coffee: Coffee) => void;
};

function CoffeeRow({
  coffee,
  selected,
  onPress,
  colors,
}: {
  coffee: Coffee;
  selected: boolean;
  onPress: () => void;
  colors: (typeof Colors)['light' | 'dark'];
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.row,
        {
          backgroundColor: selected ? colors.backgroundSelected : colors.backgroundElement,
          borderColor: selected ? colors.tint : 'transparent',
        },
      ]}>
      <View style={styles.rowText}>
        <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>
          {coffee.name}
        </Text>
        <Text style={[styles.rowMeta, { color: colors.textSecondary }]} numberOfLines={1}>
          {coffee.roaster.name}
          {coffee.origin ? ` · ${coffee.origin}` : ''}
          {coffee.varietal ? ` · ${coffee.varietal}` : ''}
        </Text>
      </View>
      <Text style={[styles.rowMark, { color: colors.tint }]}>{selected ? '●' : '○'}</Text>
    </Pressable>
  );
}

/**
 * Pick a coffee: your saved coffees up top, a search over the whole shared
 * catalog (everyone's entries — keeps the data consistent), and an inline
 * add-new form with roaster autocomplete as the last resort.
 */
export function CoffeePicker({ selectedId, onSelect }: CoffeePickerProps) {
  const { session } = useAuth();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const [mine, setMine] = useState<Coffee[]>([]);
  const [results, setResults] = useState<Coffee[]>([]);
  const [query, setQuery] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [roasterQuery, setRoasterQuery] = useState('');
  // Bumped when a suggestion is picked, to remount the uncontrolled input
  // with the chosen name as its defaultValue.
  const [roasterPickCount, setRoasterPickCount] = useState(0);
  const [roasterSuggestions, setRoasterSuggestions] = useState<Roaster[]>([]);
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
        if (cancelled) return;
        setMine(rows);
        if (rows.length === 0) setAdding(true);
      })
      .finally(() => setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, [session]);

  // Catalog search, debounced.
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      searchCoffees(q)
        .then(setResults)
        .catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  // Roaster autocomplete inside the add form, debounced.
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

  const mineIds = new Set(mine.map((c) => c.id));
  const catalogResults = results.filter((c) => !mineIds.has(c.id));

  return (
    <View style={styles.container}>
      {mine.map((coffee) => (
        <CoffeeRow
          key={coffee.id}
          coffee={coffee}
          selected={selectedId === coffee.id}
          onPress={() => onSelect(coffee)}
          colors={colors}
        />
      ))}

      <Field label="SEARCH THE COFFEE CATALOG" colors={colors}>
        <TextInput
          placeholder="Coffee or roaster name…"
          autoCorrect={false}
          onChangeText={setQuery}
        />
      </Field>

      {catalogResults.map((coffee) => (
        <CoffeeRow
          key={coffee.id}
          coffee={coffee}
          selected={selectedId === coffee.id}
          onPress={() => onSelect(coffee)}
          colors={colors}
        />
      ))}
      {query.trim() !== '' && catalogResults.length === 0 && (
        <Text style={[styles.muted, { color: colors.textSecondary }]}>
          Nothing in the catalog yet — add it below.
        </Text>
      )}

      {adding ? (
        <View style={styles.addForm}>
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
          <Field label="ORIGIN (OPTIONAL)" colors={colors}>
            <TextInput
              placeholder="Karnataka, India"
              onChangeText={(t) => {
                origin.current = t;
              }}
            />
          </Field>
          <Field label="VARIETAL (OPTIONAL)" colors={colors}>
            <TextInput
              placeholder="SL9, Gesha, Catuai…"
              autoCorrect={false}
              onChangeText={(t) => {
                varietal.current = t;
              }}
            />
          </Field>
          <Field label="PROCESS (OPTIONAL)" colors={colors}>
            <TextInput
              placeholder="Washed, natural…"
              onChangeText={(t) => {
                process.current = t;
              }}
            />
          </Field>
          <Field label="ROASTER'S NOTES (OPTIONAL)" colors={colors}>
            <TextInput
              placeholder="What the roaster says: stone fruit, jasmine, honey…"
              multiline
              onChangeText={(t) => {
                roasterNotes.current = t;
              }}
            />
          </Field>
          {error != null && (
            <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
          )}
          <Host matchContents seedColor={colors.tint}>
            <Button
              variant="outlined"
              label={busy ? 'Saving…' : 'Save coffee'}
              disabled={busy}
              style={{ height: 44 }}
              onPress={saveCoffee}
            />
          </Host>
        </View>
      ) : (
        <Pressable
          onPress={() => setAdding(true)}
          style={[styles.row, styles.addRow, { borderColor: colors.backgroundSelected }]}>
          <Text style={[styles.addLabel, { color: colors.tint }]}>+ Add a new coffee</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    fontSize: 16,
    fontWeight: '600',
  },
  rowMeta: {
    fontSize: 13,
  },
  rowMark: {
    fontSize: 18,
  },
  addRow: {
    justifyContent: 'center',
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  addLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  addForm: {
    gap: Spacing.two,
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
  muted: {
    fontSize: 13,
    lineHeight: 18,
  },
  error: {
    fontSize: 14,
    lineHeight: 20,
  },
});
