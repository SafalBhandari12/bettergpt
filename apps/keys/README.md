# BetterGPT API

Sign in with your ChatGPT account, get a standard OpenAI-compatible `sk-`
API key, use it in any tool that speaks the Chat Completions format —
billed to your existing ChatGPT plan, no separate API subscription.

This is one of three apps in the [BetterGPT monorepo](../../README.md):

- **This app (`apps/keys`)** — landing page, sign-in, dashboard (create /
  regenerate / revoke your key), and a playground to try it without writing
  code.
- **[`apps/backend`](../backend)** — the Cloudflare Worker + D1 + KV that
  this app talks to. It stores your (encrypted) ChatGPT tokens, your hashed
  API key, and exposes the public `/v1/chat/completions` + `/v1/models`
  gateway your key calls.
- **[`apps/web`](../web)** — a separate chat app (branching conversations).
  Not required for this app to work.

See [How it works](https://your-deployment/how-it-works) and
[Security](https://your-deployment/security) on the live site for a plain-
language explanation of the design and its trade-offs — read the security
page before you point real traffic at any instance of this, including your
own.

## Self-hosting your own instance

Everything above is open source — you don't have to trust anyone else's
deployment. Running your own means your ChatGPT tokens and API key only
ever touch infrastructure you control.

### 1. Prerequisites

- A [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier is enough)
- Node 18+ and [pnpm](https://pnpm.io)
- The [`wrangler`](https://developers.cloudflare.com/workers/wrangler/) CLI (`pnpm dlx wrangler login`)
- Somewhere to host a Next.js app (Vercel is the easiest; any Node host works)

### 2. Clone and install

```bash
git clone https://github.com/SafalBhandari12/bettergpt.git
cd bettergpt
pnpm install
```

### 3. Stand up the backend (Worker + D1 + KV)

```bash
cd apps/backend
wrangler login
wrangler d1 create bettergpt-history          # copy the printed database_id into wrangler.toml
wrangler kv namespace create bettergpt-sessions  # copy the printed id into wrangler.toml
wrangler d1 migrations apply bettergpt-history --remote

# Generate your own random values for these — don't reuse the ones in this repo's history:
wrangler secret put INTERNAL_SECRET
wrangler secret put TOKEN_ENCRYPTION_KEY

wrangler deploy
```

Update `wrangler.toml`'s `[vars] ALLOWED_ORIGINS` to the domain(s) you'll
deploy `apps/keys` (and `apps/web`, if you're using it) to.

Note the deployed Worker URL (`https://<name>.<subdomain>.workers.dev`) —
you'll need it next.

### 4. Configure and deploy this app

Set these in your host's environment (e.g. Vercel project settings):

| Variable                  | Value                                                          |
| -------------------------- | --------------------------------------------------------------- |
| `LWC_SECRET`               | A random secret, unique to this app (`openssl rand -hex 32`)    |
| `BACKEND_URL`               | Your deployed Worker's URL from step 3                          |
| `INTERNAL_SECRET`           | Must exactly match the Worker's `INTERNAL_SECRET` secret        |
| `NEXT_PUBLIC_GATEWAY_URL`   | Your Worker's URL + `/v1` — shown in the dashboard's code snippets |

Then deploy:

```bash
cd apps/keys
vercel link      # or: build with `pnpm --filter keys build` for another host
vercel --prod
```

### 5. Run it locally instead

```bash
pnpm install
pnpm dev
```

This starts `apps/web` on :3000, `apps/keys` on :3001, and the Worker (with
local D1/KV) on :8787, all pre-wired to talk to each other via the `.env.local`
/ `.dev.vars` files already committed for local development. Generate your
own secrets before deploying anywhere real.

### CI/CD

`.github/workflows/deploy-backend.yml` deploys `apps/backend` to Cloudflare
on every push to `main` that touches it. It expects two repo secrets:
`CLOUDFLARE_API_TOKEN` (Workers Scripts:Edit + D1:Edit permissions) and
`CLOUDFLARE_ACCOUNT_ID`.
