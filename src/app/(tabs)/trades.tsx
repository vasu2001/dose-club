import { Button, Host, Row } from '@expo/ui';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';

import { ScreenShell } from '@/components/screen-shell';
import { TradeCardSkeleton } from '@/components/skeleton';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import {
  acceptProposal,
  confirmTrade,
  declineProposal,
  fetchProposals,
  withdrawProposal,
  type Proposal,
  type ProposalStatus,
} from '@/lib/listings';

const STATUS_LABEL: Record<ProposalStatus, string> = {
  pending: 'PENDING',
  accepted: 'ACCEPTED',
  declined: 'DECLINED',
  withdrawn: 'WITHDRAWN',
  completed: 'COMPLETED ✓',
};

const ACTIVE_STATUSES: ProposalStatus[] = ['pending', 'accepted'];

type Segment = 'active' | 'history';

export default function TradesScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const [segment, setSegment] = useState<Segment>('active');
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
      const message =
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message: unknown }).message)
          : 'Something went wrong.';
      setError(message);
    } finally {
      setBusyId(null);
    }
  };

  const visible = proposals.filter((p) =>
    segment === 'active'
      ? ACTIVE_STATUSES.includes(p.status)
      : !ACTIVE_STATUSES.includes(p.status),
  );
  const incoming = visible.filter((p) => p.proposer_id !== session?.user.id);
  const outgoing = visible.filter((p) => p.proposer_id === session?.user.id);

  const renderProposal = (p: Proposal, direction: 'incoming' | 'outgoing') => {
    const busy = busyId === p.id;
    const offered = p.offered_coffee?.name ?? 'a coffee';
    const target = p.listing?.coffee.name ?? 'a listing';
    const title =
      direction === 'incoming'
        ? `@${p.proposer?.username ?? 'someone'} offers ${p.offered_dose_grams}g of ${offered}`
        : `You offered ${p.offered_dose_grams}g of ${offered}`;
    const subtitle =
      direction === 'incoming'
        ? `for your ${target}`
        : `for @${p.listing?.owner?.username ?? 'someone'}'s ${target}`;

    const myConfirmation =
      direction === 'incoming' ? p.owner_confirmed_at : p.proposer_confirmed_at;
    const theirConfirmation =
      direction === 'incoming' ? p.proposer_confirmed_at : p.owner_confirmed_at;

    return (
      <Pressable
        key={p.id}
        onPress={() => router.push({ pathname: '/trade/[id]', params: { id: p.id } })}
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: colors.backgroundElement, opacity: pressed ? 0.85 : 1 },
        ]}>
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
                { color: p.status === 'completed' ? colors.accent : colors.tint },
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

        {p.status === 'accepted' &&
          (myConfirmation ? (
            <Text style={[styles.confirmNote, { color: colors.textSecondary }]}>
              You confirmed. Waiting for the other side to confirm the exchange.
            </Text>
          ) : (
            <>
              {theirConfirmation != null && (
                <Text style={[styles.confirmNote, { color: colors.textSecondary }]}>
                  The other side already confirmed the exchange.
                </Text>
              )}
              <Host matchContents seedColor={colors.tint}>
                <Button
                  variant="filled"
                  label={busy ? '…' : 'Confirm exchange happened'}
                  disabled={busy}
                  style={{ height: 40 }}
                  onPress={() => act(p.id, confirmTrade)}
                />
              </Host>
            </>
          ))}
      </Pressable>
    );
  };

  return (
    <ScreenShell
      eyebrow="TRADE MANAGER"
      title="Your trades"
      subtitle="Proposals on your doses, and offers you've made."
      insetForTabs>
      <View style={styles.segments}>
        {(['active', 'history'] as const).map((s) => {
          const selected = segment === s;
          return (
            <Pressable
              key={s}
              onPress={() => setSegment(s)}
              style={[
                styles.segment,
                {
                  backgroundColor: selected ? colors.backgroundSelected : 'transparent',
                  borderColor: selected ? colors.tint : colors.backgroundSelected,
                },
              ]}>
              <Text
                style={[
                  styles.segmentLabel,
                  { color: selected ? colors.text : colors.textSecondary },
                ]}>
                {s === 'active' ? 'Active' : 'History'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
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
        {!loaded ? (
          <>
            <TradeCardSkeleton />
            <TradeCardSkeleton />
          </>
        ) : incoming.length === 0 ? (
          <Text style={[styles.muted, { color: colors.textSecondary }]}>
            {segment === 'active'
              ? 'No active proposals on your doses.'
              : 'No past proposals on your doses.'}
          </Text>
        ) : (
          incoming.map((p) => renderProposal(p, 'incoming'))
        )}

        <Text style={[styles.sectionLabel, { color: colors.accent, marginTop: Spacing.three }]}>
          OUTGOING
        </Text>
        {!loaded ? (
          <TradeCardSkeleton />
        ) : outgoing.length === 0 ? (
          <Text style={[styles.muted, { color: colors.textSecondary }]}>
            {segment === 'active'
              ? "No active offers. Find something on Browse."
              : 'No past offers.'}
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
  segments: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingBottom: Spacing.three,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1.5,
    paddingVertical: Spacing.two,
  },
  segmentLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    gap: Spacing.two,
    paddingBottom: Spacing.five,
  },
  sectionLabel: {
    fontFamily: Fonts.mono,
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
  confirmNote: {
    fontSize: 13,
    lineHeight: 19,
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
