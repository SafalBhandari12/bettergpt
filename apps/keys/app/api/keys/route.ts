import { NextResponse } from "next/server";
import { auth } from "@/lib/chatgpt-auth";
import { createKey, getKeys, requireAccountId } from "@/lib/keys-client";

export async function GET(request: Request) {
  const accountId = await requireAccountId(request);
  if (!accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const keys = await getKeys(accountId);
    return NextResponse.json({ keys });
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
    const result = await createKey(accountId, {
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
