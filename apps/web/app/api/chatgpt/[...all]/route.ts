import { createChatGPTHandler } from "@opencoredev/loginwithchatgpt-server";

const auth = createChatGPTHandler({
  secret: process.env.LWC_SECRET,
});

export const GET = (request: Request) => auth.handler(request);
export const POST = (request: Request) => auth.handler(request);
export const DELETE = (request: Request) => auth.handler(request);
export const PATCH = (request: Request) => auth.handler(request);
export const PUT = (request: Request) => auth.handler(request);
