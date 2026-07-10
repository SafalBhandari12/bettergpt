import { NextResponse } from "next/server";
import { auth } from "@/lib/chatgpt-auth";
import { deleteConversation, getConversation, saveConversation } from "@/lib/history-client";

async function requireAccountId(request: Request): Promise<string | null> {
  const session = await auth.getSession(request);
  if (session.status !== "authenticated" || !session.user) return null;
  return session.user.accountId;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const accountId = await requireAccountId(request);
  if (!accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const conversation = await getConversation(accountId, id);
    if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(conversation);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Backend unavailable" },
      { status: 502 },
    );
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const accountId = await requireAccountId(request);
  if (!accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await request.json()) as { title?: unknown; data?: unknown };
  if (typeof body.title !== "string" || body.data === undefined) {
    return NextResponse.json({ error: "Expected { title, data }" }, { status: 400 });
  }

  try {
    const result = await saveConversation(accountId, id, body.title, body.data);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Backend unavailable" },
      { status: 502 },
    );
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const accountId = await requireAccountId(request);
  if (!accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    await deleteConversation(accountId, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Backend unavailable" },
      { status: 502 },
    );
  }
}
