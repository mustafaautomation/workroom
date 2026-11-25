import { NextResponse } from "next/server";
import { decideDeliverable } from "@/lib/work/service";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { decision?: string; comment?: string };
  const decision = body.decision === "changes_requested" ? "changes_requested" : "approved";
  const result = await decideDeliverable(id, decision, body.comment ?? "");
  const status = result.ok ? 200 : result.error === "This demo is read-only." ? 403 : result.error === "Sign in to continue." ? 401 : 400;
  return NextResponse.json(result, { status });
}
