# TICKER

Multiplayer stock-market board game. Share a room code, take a seat, trade until one fund remains. No accounts.

## Stack

- Next.js (App Router) for the board UI
- Cloudflare PartyServer for one Durable Object per room
- Rules: [`docs/rulebook/MARKETPOLY_RULEBOOK_V5.md`](docs/rulebook/MARKETPOLY_RULEBOOK_V5.md)

## Layout

```text
src/
  app/              # Routes
  components/       # board | cards | fx | hud | room | shell
  content/          # Canonical decks (companies, news, PR)
  lib/game/         # Engine, bots, balance harness
  lib/fx/           # Peg / cash / card choreography
  shared/           # Protocol + GameState
party/              # PartyServer worker
docs/rulebook/      # Shipped V5 rules
docs/archive/       # Historical drafts only
scripts/            # Balance / fund-matrix CLIs
```

## Develop

```bash
npm install
cp .env.example .env.local   # NEXT_PUBLIC_PARTY_HOST=localhost:8888
npm run dev:all              # Next :3010 + Party :8888
```

Open http://localhost:3010. You land in a room lobby as a spectator, then join a seat. Leave mid-game and that seat keeps autoplaying. New players can read [/tutorial](/tutorial).

## Test / balance

```bash
npm test
npm run balance:sim -- --scenario standard2 --games 200
npm run balance:funds -- --games 12
npm run balance:audit -- --games 600 --fundGames 14
```

## Deploy

| Piece | Host | Production |
|-------|------|------------|
| Frontend | Vercel | `ticker` project |
| Realtime | Cloudflare Workers | `ticker.<account>.workers.dev` |

```bash
npm run party:deploy
npx vercel deploy --prod
```

Set `NEXT_PUBLIC_PARTY_HOST` on Vercel to `ticker.<account>.workers.dev`, then rebuild the frontend.
