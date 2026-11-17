# PlotParty / Marketpoly

Light multiplayer stock-market board game. Create a room, share a 6-character code, play online. No accounts.

Fan-made property trading game — not affiliated with Hasbro or Monopoly.

## Stack

- **Frontend:** Next.js (App Router) — 2D board UI
- **Realtime:** Cloudflare PartyServer (Durable Object per room)
- **Rules:** [`docs/rulebook/MARKETPOLY_RULEBOOK_V5.md`](docs/rulebook/MARKETPOLY_RULEBOOK_V5.md)

## Layout

```text
src/
  content/          # Runtime JSON decks (canonical)
  shared/           # Protocol + GameState types
  lib/game/         # Engine, board, pricing, content loaders, bots
  components/       # board | cards | hud | room | shell
party/              # PartyServer Durable Object
docs/rulebook/      # Shipped V4 rulebook
docs/archive/       # Historical / design-only files
```

## Local development

```bash
npm install
cp .env.example .env.local   # NEXT_PUBLIC_PARTY_HOST=localhost:8888
npm run dev:all              # Next :3010 + PartyServer :8888
```

Or two terminals:

```bash
npm run party:dev   # wrangler on :8888
npm run dev         # Next on :3010
```

1. Open http://localhost:3010 → **Create room** or **Play vs bot**
2. Open the invite link in another browser / incognito → enter a name
3. Both **Ready up** → host **Start game**

## Tests

```bash
npm test
npm run build
```

## Production

| Piece | URL |
|-------|-----|
| Frontend (Vercel) | https://plotparty-amber.vercel.app |
| Realtime (Cloudflare) | https://plotparty.letrinhan123.workers.dev |

### Redeploy

```bash
# PartyServer
npm run party:deploy

# Frontend (env must be set on Vercel project)
npx vercel env add NEXT_PUBLIC_PARTY_HOST production
# value: plotparty.letrinhan123.workers.dev
npx vercel deploy --prod
```

Rebuild the frontend after changing the party host (it is baked in at build time).

## Scripts

| Script | Purpose |
|--------|---------|
| `dev` | Next only |
| `party:dev` | Wrangler PartyServer |
| `dev:all` | Both |
| `test` | Vitest engine tests |
| `build` | Next production build |
| `party:deploy` | Deploy PartyServer |
