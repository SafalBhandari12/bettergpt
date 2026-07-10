import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env, Variables } from "./env";
import { requireInternalSecret } from "./middleware";
import { conversations } from "./conversations";
import { kv } from "./kv";
import { keys } from "./keys";
import { gateway } from "./gateway";

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

// BFF-only surface (apps/web, apps/keys) — gated by the shared internal
// secret, never reachable from a browser directly. Registered on both the
// bare path and its wildcard since "/x/*" doesn't also match "/x".
app.use("/conversations", requireInternalSecret);
app.use("/conversations/*", requireInternalSecret);
app.use("/kv/*", requireInternalSecret);
app.use("/keys", requireInternalSecret);
app.use("/keys/*", requireInternalSecret);
app.route("/conversations", conversations);
app.route("/kv", kv);
app.route("/keys", keys);

// Public OpenAI-compatible gateway — authenticated by the sk- API key itself,
// meant to be called directly by arbitrary third-party tools.
app.route("/v1", gateway);

export default app;
