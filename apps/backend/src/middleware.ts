import type { MiddlewareHandler } from "hono";
import type { Env, Variables } from "./env";

type AppEnv = { Bindings: Env; Variables: Variables };

/** Guards BFF-only routes (conversations, kv, keys) — never reachable from a browser. */
export const requireInternalSecret: MiddlewareHandler<AppEnv> = async (c, next) => {
  const secret = c.req.header("x-internal-secret");
  if (!secret || secret !== c.env.INTERNAL_SECRET) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
};

/** The BFF resolves the caller's ChatGPT session into an accountId and
 * forwards it here — this Worker trusts it completely. */
export const requireUserId: MiddlewareHandler<AppEnv> = async (c, next) => {
  const userId = c.req.header("x-user-id");
  if (!userId) return c.json({ error: "Missing x-user-id" }, 400);
  c.set("userId", userId);
  await next();
};
