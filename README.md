# TICKER

Multiplayer stock-market board game (Vietnamese name: Cờ chứng khoán).

Share a room code, take a seat, and trade until one fund remains. No accounts.

Play: [tickergame.vercel.app](https://tickergame.vercel.app)

## Stack

- Next.js App Router for the board UI
- Cloudflare PartyServer with one Durable Object per room
- Rulebook: [docs/rulebook/MARKETPOLY_RULEBOOK_V5.md](docs/rulebook/MARKETPOLY_RULEBOOK_V5.md)

## Layout

```text
src/
  app/           Routes
  components/    Board, cards, FX, HUD, room, shell
  content/       Company, news, and PR decks
  lib/game/      Engine, bots, balance harness
  lib/fx/        Peg, cash, and card choreography
  shared/        Protocol and GameState
party/           PartyServer worker
docs/rulebook/   Shipped V5 rules
docs/archive/    Historical drafts
scripts/         Balance and fund-matrix CLIs
```

## Develop

```bash
npm install
cp .env.example .env.local
npm run dev:all
```

Set `NEXT_PUBLIC_PARTY_HOST=localhost:8888` in `.env.local`.

- Next.js: http://localhost:3010
- PartyServer: port 8888

You start in the room lobby as a spectator, then join a seat. If you leave mid-game, that seat keeps autoplaying. New players can open [/tutorial](/tutorial).

## Test and balance

```bash
npm test
npm run balance:sim -- --scenario standard2 --games 200
npm run balance:funds -- --games 12
npm run balance:audit -- --games 600 --fundGames 14
```

## Deploy

| Piece | Host | Production |
| --- | --- | --- |
| Frontend | Vercel | https://tickergame.vercel.app |
| Realtime | Cloudflare Workers | https://ticker.letrinhan123.workers.dev |

```bash
npm run party:deploy
npx vercel deploy --prod
```

On Vercel, set `NEXT_PUBLIC_PARTY_HOST` to `ticker.letrinhan123.workers.dev`.

## itch.io

The live multiplayer table stays on Vercel and Cloudflare. The itch page is a branded HTML wrapper that opens that build.

1. Create the game at [itch.io/game/new](https://itch.io/game/new) with URL slug `ticker` under account `comrade-lenan`.
2. Install butler once: `npm run itch:setup`
3. Export your API key (never commit it): `export ITCH_API_KEY=your_key`
4. Deploy: `npm run itch:deploy`

Default target is `comrade-lenan/ticker:html`. Override with `ITCH_TARGET` if needed. Cover art is at `itch/cover.jpg` and `public/brand/ticker-cover.jpg`.
