import { Button, Host, TextInput } from '@expo/ui';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';

import { Field } from '@/components/form-field';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { createCoffee, fetchMyCoffees, type Coffee } from '@/lib/coffees';

type CoffeePickerProps = {
  selectedId: string | null;
  onSelect: (coffee: Coffee) => void;
};

/**
 * Pick one of your saved coffees, or add a new one inline.
 * Used by both the share-a-dose form and the proposal flow.
 */
export function CoffeePicker({ selectedId, onSelect }: CoffeePickerProps) {
  const { session } = useAuth();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const [coffees, setCoffees] = useState<Coffee[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roaster = useRef('');
  const name = useRef('');
  const origin = useRef('');
  const process = useRef('');

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    fetchMyCoffees(session.user.id)
      .then((mine) => {
        if (cancelled) return;
        setCoffees(mine);
        // No saved coffees yet — jump straight to the add form.
        if (mine.length === 0) setAdding(true);
      })
      .finally(() => setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, [session]);

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
        roaster: roasterName,
        name: coffeeName,
        origin: origin.current.trim() || null,
        process: process.current.trim() || null,
        roast_level: null,
        tasting_notes: null,
      });
      setCoffees((prev) => [coffee, ...prev]);
      setAdding(false);
      onSelect(coffee);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) return null;

  return (
    <View style={styles.container}>
      {coffees.map((coffee) => {
        const selected = selectedId === coffee.id;
        return (
          <Pressable
            key={coffee.id}
            onPress={() => onSelect(coffee)}
            style={[
              styles.row,
              {
                backgroundColor: selected
                  ? colors.backgroundSelected
                  : colors.backgroundElement,
                borderColor: selected ? colors.tint : 'transparent',
              },
            ]}>
            <View style={styles.rowText}>
              <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>
                {coffee.name}
              </Text>
              <Text style={[styles.rowMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                {coffee.roaster}
                {coffee.origin ? ` · ${coffee.origin}` : ''}
              </Text>
            </View>
            <Text style={[styles.rowMark, { color: colors.tint }]}>
              {selected ? '●' : '○'}
            </Text>
          </Pressable>
        );
      })}

      {adding ? (
        <View style={styles.addForm}>
          <Field label="ROASTER" colors={colors}>
            <TextInput
              placeholder="Blue Tokai"
              autoCorrect={false}
              onChangeText={(t) => {
                roaster.current = t;
              }}
            />
          </Field>
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
          <Field label="PROCESS (OPTIONAL)" colors={colors}>
            <TextInput
              placeholder="Washed, natural…"
              onChangeText={(t) => {
                process.current = t;
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
  error: {
    fontSize: 14,
    lineHeight: 20,
  },
});
