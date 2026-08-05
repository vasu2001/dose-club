import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';

import { ListingCard } from '@/components/listing-card';
import { ScreenShell } from '@/components/screen-shell';
import { BottomTabInset, Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { fetchMyListings, type Listing } from '@/lib/listings';

export default function ShelfScreen() {
  const { session, profile } = useAuth();
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const [listings, setListings] = useState<Listing[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    try {
      setListings(await fetchMyListings(session.user.id));
    } finally {
      setLoaded(true);
      setRefreshing(false);
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <ScreenShell
      eyebrow="YOUR SHELF"
      title={profile?.display_name ? `${profile.display_name}'s doses` : 'Your doses'}
      subtitle="Coffees you've put up for trade."
      edges={['top']}
      headerAction={
        <Pressable
          onPress={() => router.push('/share-dose')}
          hitSlop={8}
          style={({ pressed }) => [
            styles.addButton,
            { backgroundColor: colors.tint, opacity: pressed ? 0.85 : 1 },
          ]}>
          <Text style={[styles.addIcon, { color: colors.background }]}>+</Text>
        </Pressable>
      }>
      <FlatList
        data={listings}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
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
            hideOwner
            onPress={() => router.push({ pathname: '/listing/[id]', params: { id: item.id } })}
          />
        )}
        ListEmptyComponent={
          loaded ? (
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Your shelf is empty. Tap + to share a dose of whatever you're
                brewing and start trading.
              </Text>
            </View>
          ) : null
        }
      />
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
});
