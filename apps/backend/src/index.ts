import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env, Variables } from "./env";
import { requireInternalSecret } from "./middleware";
import { conversations } from "./conversations";
import { kv } from "./kv";
import { keys } from "./keys";
import { internalTokens } from "./internal-tokens";

const DEFAULT_ALLOWED_ORIGINS = ["http://localhost:3000"];

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use(
  "*",
  cors({
    origin: (origin, c) => {
      const configured = c.env.ALLOWED_ORIGINS?.split(",").map((o: string) => o.trim()) ?? [];
      const allowed = configured.length ? configured : DEFAULT_ALLOWED_ORIGINS;
      return origin && allowed.includes(origin) ? origin : null;
    },
    allowMethods: ["GET", "PUT", "POST", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "x-internal-secret", "x-user-id"],
    maxAge: 600,
  }),
);

// Everything this Worker exposes is BFF-only (apps/web, apps/keys), gated by
// the shared internal secret, never reachable from a browser directly.
// Registered on both the bare path and its wildcard since "/x/*" doesn't
// also match "/x". There is deliberately no public-facing route here — the
// OpenAI-compatible gateway lives in apps/keys instead (see internal-tokens.ts
// for why).
app.use("/conversations", requireInternalSecret);
app.use("/conversations/*", requireInternalSecret);
app.use("/kv/*", requireInternalSecret);
app.use("/keys", requireInternalSecret);
app.use("/keys/*", requireInternalSecret);
app.use("/internal/*", requireInternalSecret);
app.route("/conversations", conversations);
app.route("/kv", kv);
app.route("/keys", keys);
app.route("/internal", internalTokens);

export default app;
