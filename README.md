# BetterGPT

A ChatGPT-style app with branching conversations, backed by your own ChatGPT
plan. Turborepo monorepo with two apps:

- **`apps/web`** — the Next.js frontend (chat UI, branching/merge graph,
  history sidebar, login with ChatGPT).
- **`apps/backend`** — a Cloudflare Worker + D1 database that stores
  conversation history.

## Getting started

```bash
pnpm install
pnpm dev
```

This runs both apps via Turborepo:

- Web app at [http://localhost:3000](http://localhost:3000)
- Backend Worker at `http://localhost:8787` (local D1, via `wrangler dev`)

`apps/web/.env.local` and `apps/backend/.dev.vars` already contain matching
dev secrets so the two talk to each other locally out of the box.

Run a single app: `pnpm dev:web` or `pnpm dev:backend`.

## How the two apps talk to each other

The browser never calls the Worker directly. `apps/web`'s own API routes
(`app/api/history/*`) resolve the caller's ChatGPT session server-side (via
`auth.getSession`, see `lib/chatgpt-auth.ts`) into a stable `accountId`, then
forward the request to the Worker with an internal shared secret
(`INTERNAL_SECRET`) and `x-user-id: <accountId>`. The Worker (`apps/backend`)
trusts that header completely — it's never reachable from a browser, so
that's fine — and scopes every row in D1 to that user id. See
`apps/web/lib/history-client.ts` and `apps/backend/src/index.ts`.

Conversations are stored as one JSON blob per row (the whole node tree), not
normalized into per-node tables — the frontend owns the tree shape, D1 is
just durable storage for snapshots keyed by conversation id.

## Data model

Each turn (`ConversationNode` in `apps/web/lib/conversation-store.ts`) holds
both the user's prompt and the model's response as one node — branching,
merging, and deleting all operate on whole turns. A conversation is a tree of
turns (`parentId` chain); the app keeps many conversations, and the history
sidebar lists them (with lazy-loading for conversations opened from another
device that aren't in this browser's local cache yet).

## Deploying the backend

```bash
cd apps/backend
wrangler login                       # if not already authenticated
wrangler d1 create bettergpt-history # update wrangler.toml with the printed database_id
wrangler d1 migrations apply bettergpt-history --remote
wrangler secret put INTERNAL_SECRET  # paste the same value as apps/web's INTERNAL_SECRET
wrangler deploy
```

Then point the deployed `apps/web` at it by setting, in its environment:

- `BACKEND_URL` — the Worker's `https://*.workers.dev` URL (or custom domain)
- `INTERNAL_SECRET` — must match the Worker's `INTERNAL_SECRET` secret
- `LWC_SECRET` — the Login with ChatGPT session-signing secret

## Deploying the web app

Any Next.js host works (Vercel, etc.) — build from `apps/web`, or `pnpm
--filter web build` from the repo root.
