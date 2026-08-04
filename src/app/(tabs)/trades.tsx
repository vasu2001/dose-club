import { Button, Host, Row } from '@expo/ui';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';

import { ScreenShell } from '@/components/screen-shell';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import {
  acceptProposal,
  declineProposal,
  fetchProposals,
  withdrawProposal,
  type Proposal,
} from '@/lib/listings';

const STATUS_LABEL: Record<Proposal['status'], string> = {
  pending: 'PENDING',
  accepted: 'TRADED ✓',
  declined: 'DECLINED',
  withdrawn: 'WITHDRAWN',
};

export default function TradesScreen() {
  const { session } = useAuth();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setProposals(await fetchProposals());
    } finally {
      setLoaded(true);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const act = async (id: string, action: (id: string) => Promise<void>) => {
    if (busyId) return;
    setBusyId(id);
    setError(null);
    try {
      await action(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusyId(null);
    }
  };

  const incoming = proposals.filter((p) => p.proposer_id !== session?.user.id);
  const outgoing = proposals.filter((p) => p.proposer_id === session?.user.id);

  const renderProposal = (p: Proposal, direction: 'incoming' | 'outgoing') => {
    const busy = busyId === p.id;
    const title =
      direction === 'incoming'
        ? `@${p.proposer?.username ?? 'someone'} offers ${p.offered_listing?.coffee_name ?? 'a coffee'}`
        : `You offered ${p.offered_listing?.coffee_name ?? 'a coffee'}`;
    const subtitle =
      direction === 'incoming'
        ? `for your ${p.listing?.coffee_name ?? 'listing'}`
        : `for @${p.listing?.owner?.username ?? 'someone'}'s ${p.listing?.coffee_name ?? 'listing'}`;

    return (
      <View
        key={p.id}
        style={[styles.card, { backgroundColor: colors.backgroundElement }]}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleBlock}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>
            <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
              {subtitle}
            </Text>
          </View>
          <View style={[styles.statusChip, { backgroundColor: colors.backgroundSelected }]}>
            <Text
              style={[
                styles.statusText,
                { color: p.status === 'accepted' ? colors.accent : colors.tint },
              ]}>
              {STATUS_LABEL[p.status]}
            </Text>
          </View>
        </View>

        {p.message != null && (
          <Text style={[styles.messageText, { color: colors.textSecondary }]}>
            “{p.message}”
          </Text>
        )}

        {p.status === 'pending' && (
          <Host matchContents seedColor={colors.tint}>
            <Row spacing={Spacing.two}>
              {direction === 'incoming' ? (
                <>
                  <Button
                    variant="filled"
                    label={busy ? '…' : 'Accept trade'}
                    disabled={busy}
                    style={{ height: 40 }}
                    onPress={() => act(p.id, acceptProposal)}
                  />
                  <Button
                    variant="outlined"
                    label="Decline"
                    disabled={busy}
                    style={{ height: 40 }}
                    onPress={() => act(p.id, declineProposal)}
                  />
                </>
              ) : (
                <Button
                  variant="outlined"
                  label={busy ? '…' : 'Withdraw'}
                  disabled={busy}
                  style={{ height: 40 }}
                  onPress={() => act(p.id, withdrawProposal)}
                />
              )}
            </Row>
          </Host>
        )}
      </View>
    );
  };

  return (
    <ScreenShell
      eyebrow="TRADE MANAGER"
      title="Your trades"
      subtitle="Proposals on your doses, and offers you've made."
      insetForTabs>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.tint}
          />
        }>
        {error != null && (
          <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
        )}

        <Text style={[styles.sectionLabel, { color: colors.accent }]}>INCOMING</Text>
        {incoming.length === 0 && loaded ? (
          <Text style={[styles.muted, { color: colors.textSecondary }]}>
            No proposals on your doses yet.
          </Text>
        ) : (
          incoming.map((p) => renderProposal(p, 'incoming'))
        )}

        <Text style={[styles.sectionLabel, { color: colors.accent, marginTop: Spacing.three }]}>
          OUTGOING
        </Text>
        {outgoing.length === 0 && loaded ? (
          <Text style={[styles.muted, { color: colors.textSecondary }]}>
            You haven't offered any trades yet. Find something on Browse.
          </Text>
        ) : (
          outgoing.map((p) => renderProposal(p, 'outgoing'))
        )}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    gap: Spacing.two,
    paddingBottom: Spacing.five,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 3,
  },
  card: {
    borderRadius: 20,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  cardTitleBlock: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontFamily: Fonts.serif,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
  },
  cardSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  statusChip: {
    borderRadius: 8,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  statusText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  muted: {
    fontSize: 14,
    lineHeight: 20,
  },
  error: {
    fontSize: 14,
    lineHeight: 20,
  },
});
