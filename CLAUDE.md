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
3. **Browse**: Other users browse available listings.
4. **Propose**: An interested user proposes a trade on a listing by offering a coffee + dose from their own library (no listing of their own required). Multiple proposals on one listing are fine, including several from the same user.
5. **Decide**: The listing owner accepts or declines each proposal independently.
6. **Confirm**: After acceptance, both sides confirm the physical exchange happened; when both confirm, the trade is completed.

## Development principles

- Commit as you go: after each meaningful, working change (feature slice, fix, redesign), make a git commit. Don't batch a whole session into one commit.
- Database schema is declarative: `supabase/schemas/*.sql` is the source of truth for the Postgres schema (tables, RLS, functions, triggers). Update these files alongside any schema change (see https://supabase.com/docs/guides/local-development/declarative-database-schemas).

## Principles

- Trades are barter-based: coffee for coffee, no money changes hands in v1.
- The unit of exchange is a "dose" — enough for a few brews, not a whole bag.
- Freshness matters: roast dates are first-class data.
- Keep v1 simple: listings, proposals, accept/reject, trade status. Ratings, chat, shipping, and reputation can come later.
