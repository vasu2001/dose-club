import { Button, Host } from '@expo/ui';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  useWindowDimensions,
} from 'react-native';

import { ListingCard } from '@/components/listing-card';
import { ScreenShell } from '@/components/screen-shell';
import { BottomTabInset, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { fetchMyListings, type Listing } from '@/lib/listings';

export default function ShelfScreen() {
  const { session, profile } = useAuth();
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { width } = useWindowDimensions();
  const buttonWidth = Math.min(width, MaxContentWidth) - 2 * Spacing.four;

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
      edges={['top']}>
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
                Your shelf is empty. Share a dose of whatever you're brewing to start
                trading.
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          <Host matchContents seedColor={colors.tint} style={styles.cta}>
            <Button
              variant="filled"
              label="Share a dose"
              style={{ width: buttonWidth, height: 50 }}
              onPress={() => router.push('/share-dose')}
            />
          </Host>
        }
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.two,
    // Scroll under the floating tab bar; keep the last card reachable.
    paddingBottom: BottomTabInset + Spacing.five,
  },
  empty: {
    paddingVertical: Spacing.four,
  },
  emptyText: {
    fontSize: 15,
    lineHeight: 22,
  },
  cta: {
    width: '100%',
    marginTop: Spacing.three,
  },
});
