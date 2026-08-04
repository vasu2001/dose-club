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

1. **Share**: A user with a coffee bag they want to share creates a share listing (the coffee, roaster, origin, process, roast date, how much they're offering, etc.).
2. **Browse**: Other users browse and filter available listings (and can post their own).
3. **Propose**: An interested user makes a proposal on a listing — offering one of their own coffees in exchange.
4. **Decide**: The listing owner reviews incoming proposals and accepts or rejects them.
5. **Trade**: On acceptance, the trade is marked as successful. (Logistics of the physical exchange are between the users for now.)

## Development principles

- Commit as you go: after each meaningful, working change (feature slice, fix, redesign), make a git commit. Don't batch a whole session into one commit.

## Principles

- Trades are barter-based: coffee for coffee, no money changes hands in v1.
- The unit of exchange is a "dose" — enough for a few brews, not a whole bag.
- Freshness matters: roast dates are first-class data.
- Keep v1 simple: listings, proposals, accept/reject, trade status. Ratings, chat, shipping, and reputation can come later.
