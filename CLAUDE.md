@AGENTS.md

# Dose Club

## What this is

Dose Club is a mobile app for specialty coffee enthusiasts to exchange small amounts ("doses") of coffee beans with each other.

## The problem

Specialty coffee is sold in bags (typically 200–250g), but enthusiasts rarely want to drink an entire bag of one coffee:

- A bag is a big commitment — you might not like it, or you get bored before finishing it.
- Coffee goes stale; most people can't get through their bags while they're at peak freshness.
- Trying many different coffees (origins, processes, roasters) is the whole point of the hobby, but buying full bags of everything is expensive and wasteful.
- There's no easy way to discover what other local enthusiasts are brewing or to trade with them.

Dose Club solves this by letting people trade portions of their bags: you share some of what you have, and in return you get to taste what others have — more variety, less waste, and a community of people who care about the same thing.

## Core flow (v1)

1. **Coffee library**: Users save coffees (roaster, name, origin, process, roast level, notes) once and reuse them everywhere — when sharing and when proposing.
2. **Share**: A user creates a share listing from a saved coffee plus the specifics of the bag (roast date, dose size). A listing stays active until the owner closes it — one bag can serve several trades.
3. **Browse**: Other users browse available listings (search + filters for roast, process, city, freshness).
4. **Propose**: An interested user proposes a trade on a listing by offering a bundle of 1–5 items, each a coffee + dose (5–100g). An item can come straight off the proposer's own shelf (linked to their listing) or from their library — any combination. One pending proposal per proposer per listing; created atomically via the `create_proposal` RPC.
5. **Decide**: The listing owner accepts or declines each proposal independently. Accepting affects ONLY that proposal — rival pending proposals survive and can each be accepted too; one listing serves many trades in parallel.
6. **Confirm**: After acceptance, both sides confirm the physical exchange happened; when both confirm, the trade is completed. At completion each side gets an optional prompt to close any of their still-active listings involved — listings NEVER close automatically.
7. **Close**: Closing a listing is the only auto-archive: pending proposals ON it become `listing_closed`, and pending proposals OFFERING it as an item are auto-withdrawn. Accepted trades in flight are untouched.
8. **Review**: After completion each side can review the coffee(s) they received.

## Inbox & notifications

- Every event a user should see (proposal received / accepted / declined / withdrawn, listing closed, exchange confirmed, trade completed) is written to the `notifications` table by DB triggers — clients never insert, they only stamp `read_at`.
- Inbox tab: unread rows in a NEW section with badge count, read rows under EARLIER; mark-all-read; tap-through to the trade.
- Foreground delivery: each insert is broadcast on the user's private realtime channel (`user:{id}:inbox`) — the app subscribes and invalidates queries; no polling.
- Background delivery: the same trigger POSTs (pg_net) to the `send-push` edge function (`supabase/functions/send-push`), which fans out via the Expo Push API and prunes dead tokens. The webhook is authenticated with a shared secret stored in Supabase Vault (`push_webhook_secret`) and mirrored in the function env (`PUSH_WEBHOOK_SECRET`).
- Devices register their Expo push token on sign-in (`push_tokens` table) and delete it on sign-out. The repo is linked to the `dose-club` EAS project; remote push needs a dev build on a real device (Expo Go can't).

## Development principles

- Commit as you go: after each meaningful, working change (feature slice, fix, redesign), make a git commit. Don't batch a whole session into one commit.
- Database schema is declarative: `supabase/schemas/*.sql` is the source of truth for the Postgres schema (tables, RLS, functions, triggers). Update these files alongside any schema change (see https://supabase.com/docs/guides/local-development/declarative-database-schemas).

## Principles

- Trades are barter-based: coffee for coffee, no money changes hands in v1.
- The unit of exchange is a "dose" — enough for a few brews, not a whole bag.
- Freshness matters: roast dates are first-class data.
- Listings never close automatically; only the owner closes them, and that close is the only thing that auto-archives proposals.
- Keep v1 simple: chat, shipping, and reputation can come later.
