# BetterGPT

A ChatGPT-style app with branching conversations, backed by your own ChatGPT
plan — plus a second product, **GPTBridge**, that turns your ChatGPT account
into an OpenAI-compatible API key. Turborepo monorepo with three apps:

- **`apps/web`** — the Next.js chat frontend (branching/merge graph, history
  sidebar, login with ChatGPT).
- **`apps/keys`** ("GPTBridge") — a Next.js app where you sign in with
  ChatGPT and get a `sk-` API key, usable as a drop-in `OPENAI_API_KEY`
  anywhere, plus an embedded playground to try it without writing code. Its
  own [README](apps/keys/README.md) has **self-hosting instructions** if
  you'd rather run your own instance than trust a hosted one with your
  ChatGPT tokens.
- **`apps/backend`** — a Cloudflare Worker + D1 + KV. Pure storage, shared by
  both frontends: conversation history, session storage, and encrypted
  OAuth-token/API-key storage. It does **not** call OpenAI itself — see
  below.

## Getting started

```bash
pnpm install
pnpm dev
```

This runs all three apps via Turborepo:

- Chat app at [http://localhost:3000](http://localhost:3000)
- GPTBridge at [http://localhost:3001](http://localhost:3001)
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

Login sessions themselves are stored in the Worker's KV namespace (not
in-memory) — see the comment in `apps/web/lib/chatgpt-auth.ts` for why that
matters on a serverless host like Vercel.

**The OpenAI-compatible gateway (`/v1/chat/completions`, `/v1/models`) lives
in `apps/keys`, not the Worker.** A Cloudflare Worker calling `chatgpt.com`
(also Cloudflare-fronted) trips OpenAI's bot protection — Cloudflare's own
detection flags traffic that originates from its own edge network hitting
another Cloudflare-protected origin. So the Worker only ever stores encrypted
tokens; `apps/keys`'s own Vercel-hosted routes (`app/v1/*`) resolve a
Bearer key against the Worker's internal token-storage API
(`apps/backend/src/internal-tokens.ts`), then make the actual request to
OpenAI themselves — the same network path `apps/web`'s existing chat feature
already proved works.

## Data model

**Chat app**: each turn (`ConversationNode` in
`apps/web/lib/conversation-store.ts`) holds both the user's prompt and the
model's response as one node — branching, merging, and deleting all operate
on whole turns. Conversations are stored as one JSON blob per row in D1 (the
frontend owns the tree shape; D1 is just durable storage for snapshots).

**GPTBridge**: `apps/keys` exports the user's ChatGPT OAuth tokens
(`dangerouslyGetTokens`, since this app's whole purpose is holding them
server-side) and hands them to the Worker, which encrypts them at rest
(AES-GCM, `apps/backend/src/crypto.ts`) alongside a hashed `sk-` API key. On
each `/v1` request, `apps/keys` resolves the key via the Worker, decrypts
the tokens, refreshes them if needed (persisting the refresh back to the
Worker), and proxies the request through
`@opencoredev/loginwithchatgpt-ai`'s `createChatGPT` — translating the
incoming OpenAI Chat Completions request into the ChatGPT-backed Responses
API call, and the response back into Chat Completions format (including
streaming). The embedded playground (`app/dashboard/PlaygroundPanel.tsx`)
does the same thing keyed by the signed-in session instead of an API key.

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
`apps/keys` specifically must run somewhere other than Cloudflare Workers
(see above). Set these in the host's environment:

- `BACKEND_URL` — the Worker's `https://*.workers.dev` URL (or custom domain)
- `INTERNAL_SECRET` — must match the Worker's `INTERNAL_SECRET` secret
- `LWC_SECRET` — Login with ChatGPT session-signing secret (each app should
  have its own, independent value)
- `apps/keys` only: `NEXT_PUBLIC_GATEWAY_URL` — **this app's own** deployed
  URL + `/v1` (e.g. `https://your-app.vercel.app/v1`), shown in the
  dashboard's code snippets

CI (`.github/workflows/deploy-backend.yml`) auto-deploys `apps/backend` to
Cloudflare on every push to `main` that touches it.

For a full step-by-step self-hosting walkthrough of GPTBridge specifically
(your own Cloudflare + Vercel, your own secrets), see
[`apps/keys/README.md`](apps/keys/README.md).
