import { NextResponse } from "next/server";
import { auth } from "@/lib/chatgpt-auth";
import { listConversations } from "@/lib/history-client";

export async function GET(request: Request) {
  const session = await auth.getSession(request);
  if (session.status !== "authenticated" || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const list = await listConversations(session.user.accountId);
    return NextResponse.json(list);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Backend unavailable" },
      { status: 502 },
    );
  }
}
