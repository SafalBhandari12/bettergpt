import { NextResponse } from "next/server";
import { requireAccountId, revokeKey } from "@/lib/keys-client";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const accountId = await requireAccountId(request);
  if (!accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    await revokeKey(accountId, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Backend unavailable" },
      { status: 502 },
    );
  }
}
