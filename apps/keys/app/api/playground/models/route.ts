import { NextResponse } from "next/server";
import { auth } from "@/lib/chatgpt-auth";

export async function GET(request: Request) {
  const session = await auth.getSession(request);
  if (session.status !== "authenticated" || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const backendUrl = process.env.BACKEND_URL;
  const internalSecret = process.env.INTERNAL_SECRET;
  if (!backendUrl || !internalSecret) {
    return NextResponse.json({ error: "Backend not configured" }, { status: 502 });
  }

  const res = await fetch(`${backendUrl}/playground/models`, {
    headers: { "x-internal-secret": internalSecret, "x-user-id": session.user.accountId },
    cache: "no-store",
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
