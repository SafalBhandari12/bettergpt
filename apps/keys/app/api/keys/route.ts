import { NextResponse } from "next/server";
import { auth } from "@/lib/chatgpt-auth";
import { createOrRotateKey, getKey, revokeKey } from "@/lib/keys-client";

async function requireAccountId(request: Request): Promise<string | null> {
  const session = await auth.getSession(request);
  if (session.status !== "authenticated" || !session.user) return null;
  return session.user.accountId;
}

export async function GET(request: Request) {
  const accountId = await requireAccountId(request);
  if (!accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const key = await getKey(accountId);
    return NextResponse.json({ key });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Backend unavailable" },
      { status: 502 },
    );
  }
}

export async function POST(request: Request) {
  const accountId = await requireAccountId(request);
  if (!accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tokens = await auth.dangerouslyGetTokens(request, { includeRefreshToken: true });
  if (!tokens) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = await createOrRotateKey(accountId, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      idToken: tokens.idToken,
      expiresAt: tokens.expiresAt,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Backend unavailable" },
      { status: 502 },
    );
  }
}

export async function DELETE(request: Request) {
  const accountId = await requireAccountId(request);
  if (!accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await revokeKey(accountId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Backend unavailable" },
      { status: 502 },
    );
  }
}
