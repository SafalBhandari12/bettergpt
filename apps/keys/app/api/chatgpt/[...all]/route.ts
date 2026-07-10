import { auth } from "@/lib/chatgpt-auth";

export const GET = (request: Request) => auth.handler(request);
export const POST = (request: Request) => auth.handler(request);
export const DELETE = (request: Request) => auth.handler(request);
export const PATCH = (request: Request) => auth.handler(request);
export const PUT = (request: Request) => auth.handler(request);
