# BetterGPT

A ChatGPT-style app with branching conversations, backed by your own ChatGPT
plan — plus a second product that turns your ChatGPT account into an
OpenAI-compatible API key. Turborepo monorepo with three apps:

- **`apps/web`** — the Next.js chat frontend (branching/merge graph, history
  sidebar, login with ChatGPT).
- **`apps/keys`** — a Next.js app where you sign in with ChatGPT and get a
  `sk-` API key, usable as a drop-in `OPENAI_API_KEY` anywhere.
- **`apps/backend`** — a Cloudflare Worker + D1 + KV that both frontends
  share: conversation history storage, session storage, API-key management,
  and the public OpenAI-compatible gateway (`/v1/chat/completions`,
  `/v1/models`) that `apps/keys`-issued keys call.

## Getting started

```bash
pnpm install
pnpm dev
```

This runs all three apps via Turborepo:

- Chat app at [http://localhost:3000](http://localhost:3000)
- Keys app at [http://localhost:3001](http://localhost:3001)
- Backend Worker at `http://localhost:8787` (local D1/KV, via `wrangler dev`)

`apps/web/.env.local`, `apps/keys/.env.local`, and `apps/backend/.dev.vars`
already contain matching dev secrets so all three talk to each other locally
out of the box.

Run a single app: `pnpm dev:web`, `pnpm dev:backend`, or `turbo run dev
--filter=keys`.

## How the apps talk to each other

Browsers never call the Worker directly. Each Next.js app's own API routes
resolve the caller's ChatGPT session server-side (via `auth.getSession`, see
`lib/chatgpt-auth.ts` in each app) into a stable `accountId`, then forward
the request to the Worker with an internal shared secret (`INTERNAL_SECRET`)
and `x-user-id: <accountId>`. The Worker trusts that header completely — it's
never reachable from a browser, so that's fine — and scopes every row in D1
to that user id.

The one exception is the public gateway (`/v1/*`): it's meant to be called
directly by arbitrary third-party tools, so it authenticates by hashing the
`Authorization: Bearer sk-...` key itself and looking it up in D1, rather
than trusting an internal secret.

Login sessions themselves are stored in the Worker's KV namespace (not
in-memory) — see the comment in `apps/web/lib/chatgpt-auth.ts` for why that
matters on a serverless host like Vercel.

## Data model

**Chat app**: each turn (`ConversationNode` in
`apps/web/lib/conversation-store.ts`) holds both the user's prompt and the
model's response as one node — branching, merging, and deleting all operate
on whole turns. Conversations are stored as one JSON blob per row in D1 (the
frontend owns the tree shape; D1 is just durable storage for snapshots).

**Keys app**: `apps/keys` exports the user's ChatGPT OAuth tokens
(`dangerouslyGetTokens`, since this app's whole purpose is holding them
server-side) and hands them to the Worker, which encrypts them at rest
(AES-GCM, `apps/backend/src/crypto.ts`) alongside a hashed `sk-` API key. The
public gateway looks up a key by its hash, decrypts the associated tokens,
refreshes them if needed, and proxies the request through
`@opencoredev/loginwithchatgpt-ai`'s `createChatGPT` — translating the
incoming OpenAI Chat Completions request into the ChatGPT-backed Responses
API call, and the response back into Chat Completions format (including
streaming).

## Deploying the backend

```bash
cd apps/backend
wrangler login                       # if not already authenticated
wrangler d1 create bettergpt-history # update wrangler.toml with the printed database_id
wrangler kv namespace create bettergpt-sessions # update wrangler.toml with the printed id
wrangler d1 migrations apply bettergpt-history --remote
wrangler secret put INTERNAL_SECRET
wrangler secret put TOKEN_ENCRYPTION_KEY
wrangler deploy
```

## Deploying a frontend (apps/web or apps/keys)

Any Next.js host works (Vercel, etc.) — build from the app directory, or
`pnpm --filter web build` / `pnpm --filter keys build` from the repo root.
Set these in the host's environment:

- `BACKEND_URL` — the Worker's `https://*.workers.dev` URL (or custom domain)
- `INTERNAL_SECRET` — must match the Worker's `INTERNAL_SECRET` secret
- `LWC_SECRET` — Login with ChatGPT session-signing secret (each app should
  have its own, independent value)
- `apps/keys` only: `NEXT_PUBLIC_GATEWAY_URL` — the Worker's URL + `/v1`,
  shown in the dashboard's code snippets

CI (`.github/workflows/deploy-backend.yml`) auto-deploys `apps/backend` to
Cloudflare on every push to `main` that touches it.
