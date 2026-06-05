export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { verifyIntegrationDispatchSecret } from "@/lib/integrations/mvsAuth";
import { dispatchPendingMvsOutbox } from "@/lib/integrations/dispatchMvs";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  companyId: z.string().cuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

/**
 * PENDING 아웃박스 → MVS webhook POST (크론·수동).
 * Authorization: Bearer {INTEGRATION_DISPATCH_SECRET}
 */
export async function POST(req: Request) {
  const bearer = req.headers.get("authorization");
  const token = bearer?.startsWith("Bearer ") ? bearer.slice(7).trim() : null;
  if (!verifyIntegrationDispatchSecret(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let companyId: string | undefined;
  let limit: number | undefined;
  try {
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (parsed.success) {
      companyId = parsed.data.companyId;
      limit = parsed.data.limit;
    }
  } catch {
    /* empty body OK */
  }

  const result = await dispatchPendingMvsOutbox({ companyId, limit });
  return NextResponse.json(result);
}
