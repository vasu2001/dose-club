import { Button, Host, Row, TextInput } from '@expo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';

import { Field } from '@/components/form-field';
import { ScreenShell } from '@/components/screen-shell';
import { TradeDetailSkeleton } from '@/components/skeleton';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import {
  acceptProposal,
  confirmTrade,
  declineProposal,
  fetchProposal,
  withdrawProposal,
  type Proposal,
} from '@/lib/listings';
import { queryKeys } from '@/lib/query';
import { createReview, fetchMyReceivedReview } from '@/lib/reviews';

type TimelineEvent = {
  label: string;
  at: string;
};

function buildTimeline(p: Proposal, proposerName: string, ownerName: string): TimelineEvent[] {
  const events: TimelineEvent[] = [
    { label: `${proposerName} proposed the trade`, at: p.created_at },
  ];
  if (p.accepted_at) events.push({ label: `${ownerName} accepted`, at: p.accepted_at });
  if (p.declined_at) events.push({ label: `${ownerName} declined`, at: p.declined_at });
  if (p.withdrawn_at) events.push({ label: `${proposerName} withdrew`, at: p.withdrawn_at });
  if (p.proposer_confirmed_at)
    events.push({ label: `${proposerName} confirmed the exchange`, at: p.proposer_confirmed_at });
  if (p.owner_confirmed_at)
    events.push({ label: `${ownerName} confirmed the exchange`, at: p.owner_confirmed_at });
  if (p.completed_at) events.push({ label: 'Trade completed', at: p.completed_at });
  return events.sort((a, b) => a.at.localeCompare(b.at));
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function CoffeeSide({
  heading,
  coffeeName,
  meta,
  dose,
  colors,
}: {
  heading: string;
  coffeeName: string;
  meta: string;
  dose: string;
  colors: (typeof Colors)['light' | 'dark'];
}) {
  return (
    <View style={[styles.side, { backgroundColor: colors.backgroundElement }]}>
      <Text style={[styles.sideHeading, { color: colors.textSecondary }]}>{heading}</Text>
      <Text style={[styles.sideName, { color: colors.text }]}>{coffeeName}</Text>
      <Text style={[styles.sideMeta, { color: colors.textSecondary }]}>{meta}</Text>
      <Text style={[styles.sideDose, { color: colors.tint }]}>{dose}</Text>
    </View>
  );
}

export default function TradeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reviewBody = useRef('');

  const { data: proposal = null, isLoading } = useQuery({
    queryKey: queryKeys.proposal(id ?? ''),
    queryFn: () => fetchProposal(id as string),
    enabled: id != null,
  });
  const { data: myReview = null } = useQuery({
    queryKey: queryKeys.myReceivedReview(proposal?.id ?? '', session?.user.id ?? ''),
    queryFn: () => fetchMyReceivedReview(proposal!.id, session!.user.id),
    enabled: proposal?.status === 'completed' && session != null,
  });
  const loaded = !isLoading;

  const act = async (action: (id: string) => Promise<void>) => {
    if (busy || !proposal) return;
    setBusy(true);
    setError(null);
    try {
      await action(proposal.id);
      await queryClient.invalidateQueries({ queryKey: ['proposals'] });
      queryClient.invalidateQueries({ queryKey: ['listings'] });
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

  if (!proposal) {
    return (
      <ScreenShell title={loaded ? 'Not found' : ' '} edges={['bottom']}>
        {loaded ? (
          <Text style={[styles.muted, { color: colors.textSecondary }]}>
            This trade doesn't exist or you're not part of it.
          </Text>
        ) : (
          <TradeDetailSkeleton />
        )}
      </ScreenShell>
    );
  }

  const iAmProposer = proposal.proposer_id === session?.user.id;
  const proposerName = iAmProposer
    ? 'You'
    : `@${proposal.proposer?.username ?? 'someone'}`;
  const ownerName = iAmProposer
    ? `@${proposal.listing?.owner?.username ?? 'someone'}`
    : 'You';
  const otherUserId = iAmProposer ? proposal.listing?.owner_id : proposal.proposer_id;
  const otherUserName = iAmProposer ? ownerName : proposerName;
  const timeline = buildTimeline(proposal, proposerName, ownerName);
  const myConfirmation = iAmProposer
    ? proposal.proposer_confirmed_at
    : proposal.owner_confirmed_at;
  const receivedCoffee = iAmProposer
    ? proposal.listing?.coffee
    : proposal.offered_coffee;

  const submitReview = async () => {
    if (busy || !session || !receivedCoffee) return;
    const body = reviewBody.current.trim();
    if (!body) {
      setError('Write a few words about the coffee first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createReview({
        coffee_id: receivedCoffee.id,
        author_id: session.user.id,
        proposal_id: proposal.id,
        context: 'received',
        body,
      });
      await queryClient.invalidateQueries({ queryKey: ['reviews'] });
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

  return (
    <ScreenShell
      eyebrow={`TRADE · ${proposal.status.toUpperCase()}`}
      title={`${proposal.offered_coffee?.name ?? 'A coffee'} ⇄ ${proposal.listing?.coffee.name ?? 'a coffee'}`}
      edges={['bottom']}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <CoffeeSide
          heading={`${proposerName === 'You' ? 'YOU GIVE' : `${proposerName} GIVES`}`}
          coffeeName={proposal.offered_coffee?.name ?? '—'}
          meta={[proposal.offered_coffee?.roaster.name, proposal.offered_coffee?.origin]
            .filter(Boolean)
            .join(' · ')}
          dose={`${proposal.offered_dose_grams}g dose`}
          colors={colors}
        />
        <CoffeeSide
          heading={`${ownerName === 'You' ? 'YOU GIVE' : `${ownerName} GIVES`}`}
          coffeeName={proposal.listing?.coffee.name ?? '—'}
          meta={[proposal.listing?.coffee.roaster.name, proposal.listing?.coffee.origin]
            .filter(Boolean)
            .join(' · ')}
          dose={`${proposal.listing?.dose_grams ?? '—'}g dose`}
          colors={colors}
        />

        {proposal.message != null && (
          <Text style={[styles.messageText, { color: colors.textSecondary }]}>
            “{proposal.message}”
          </Text>
        )}

        {otherUserId != null && (
          <Link href={{ pathname: '/user/[id]', params: { id: otherUserId } }}>
            <Text style={[styles.profileLink, { color: colors.tint }]}>
              View {otherUserName}'s profile →
            </Text>
          </Link>
        )}

        <Text style={[styles.sectionLabel, { color: colors.accent }]}>TIMELINE</Text>
        <View style={styles.timeline}>
          {timeline.map((event, i) => (
            <View key={`${event.label}-${event.at}`} style={styles.timelineRow}>
              <View style={styles.timelineMarker}>
                <View style={[styles.timelineDot, { backgroundColor: colors.tint }]} />
                {i < timeline.length - 1 && (
                  <View
                    style={[styles.timelineLine, { backgroundColor: colors.backgroundSelected }]}
                  />
                )}
              </View>
              <View style={styles.timelineBody}>
                <Text style={[styles.timelineLabel, { color: colors.text }]}>
                  {event.label}
                </Text>
                <Text style={[styles.timelineDate, { color: colors.textSecondary }]}>
                  {formatDate(event.at)}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {error != null && (
          <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
        )}

        {proposal.status === 'pending' && (
          <Host matchContents seedColor={colors.tint}>
            <Row spacing={Spacing.two}>
              {iAmProposer ? (
                <Button
                  variant="outlined"
                  label={busy ? '…' : 'Withdraw proposal'}
                  disabled={busy}
                  style={{ height: 44 }}
                  onPress={() => act(withdrawProposal)}
                />
              ) : (
                <>
                  <Button
                    variant="filled"
                    label={busy ? '…' : 'Accept trade'}
                    disabled={busy}
                    style={{ height: 44 }}
                    onPress={() => act(acceptProposal)}
                  />
                  <Button
                    variant="outlined"
                    label="Decline"
                    disabled={busy}
                    style={{ height: 44 }}
                    onPress={() => act(declineProposal)}
                  />
                </>
              )}
            </Row>
          </Host>
        )}

        {proposal.status === 'accepted' &&
          (myConfirmation ? (
            <Text style={[styles.muted, { color: colors.textSecondary }]}>
              You confirmed. Waiting for the other side to confirm the exchange.
            </Text>
          ) : (
            <Host matchContents seedColor={colors.tint}>
              <Button
                variant="filled"
                label={busy ? '…' : 'Confirm exchange happened'}
                disabled={busy}
                style={{ height: 44 }}
                onPress={() => act(confirmTrade)}
              />
            </Host>
          ))}

        {proposal.status === 'completed' &&
          receivedCoffee != null &&
          (myReview ? (
            <>
              <Text style={[styles.sectionLabel, { color: colors.accent }]}>
                YOUR REVIEW OF {receivedCoffee.name.toUpperCase()}
              </Text>
              <Text style={[styles.messageText, { color: colors.textSecondary }]}>
                “{myReview.body}”
              </Text>
            </>
          ) : (
            <>
              <Text style={[styles.sectionLabel, { color: colors.accent }]}>
                HOW WAS {receivedCoffee.name.toUpperCase()}?
              </Text>
              <Field label="YOUR REVIEW" colors={colors} inputHeight={72}>
                <TextInput
                  placeholder="Brewed it yet? Tell the club how it cups."
                  multiline
                  numberOfLines={3}
                  onChangeText={(t) => {
                    reviewBody.current = t;
                  }}
                />
              </Field>
              <Host matchContents seedColor={colors.tint}>
                <Button
                  variant="outlined"
                  label={busy ? '…' : 'Post review'}
                  disabled={busy}
                  style={{ height: 44 }}
                  onPress={submitReview}
                />
              </Host>
            </>
          ))}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    gap: Spacing.three,
    paddingBottom: Spacing.five,
  },
  side: {
    borderRadius: 20,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  sideHeading: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
  },
  sideName: {
    fontFamily: Fonts.serif,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
  },
  sideMeta: {
    fontSize: 14,
  },
  sideDose: {
    fontFamily: Fonts.mono,
    fontSize: 13,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  profileLink: {
    fontSize: 15,
    fontWeight: '600',
  },
  sectionLabel: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 3,
  },
  timeline: {
    gap: 0,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  timelineMarker: {
    alignItems: 'center',
    width: 12,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    marginVertical: 2,
  },
  timelineBody: {
    flex: 1,
    paddingBottom: Spacing.three,
    gap: 1,
  },
  timelineLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  timelineDate: {
    fontFamily: Fonts.mono,
    fontSize: 12,
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
