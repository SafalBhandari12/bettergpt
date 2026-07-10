import { createChatGPTHandler } from "@opencoredev/loginwithchatgpt-server";

/**
 * Single shared handler instance. Its default session store is an
 * in-process Map, so the `/api/chatgpt/*` login routes and the
 * `/api/history/*` routes below must import this same instance (not each
 * construct their own) to see the same sessions.
 */
export const auth = createChatGPTHandler({
  secret: process.env.LWC_SECRET,
});
