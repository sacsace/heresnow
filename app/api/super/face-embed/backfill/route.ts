import { auth } from "@/auth";
import { isFaceEmbedServiceConfigured } from "@/lib/faceEmbedService";
import { backfillDescriptorV2FromPreviews } from "@/lib/faceMatchHybrid";
import { rootForbiddenResponse } from "@/lib/requireRootUser";
import { NextResponse } from "next/server";
import { z } from "zod";

/** root — 기존 preview로 InsightFace descriptorV2 백필 */
export async function POST(req: Request) {
  const session = await auth();
  const denied = rootForbiddenResponse(session);
  if (denied) return denied;

  if (!isFaceEmbedServiceConfigured()) {
    return NextResponse.json(
      {
        error: "FACE_EMBED_NOT_CONFIGURED",
        message: "FACE_EMBED_SERVICE_URL 이 설정되지 않았습니다.",
      },
      { status: 503 }
    );
  }

  let limit = 40;
  try {
    const json = await req.json();
    const parsed = z.object({ limit: z.number().int().min(1).max(200).optional() }).safeParse(json);
    if (parsed.success && parsed.data.limit != null) limit = parsed.data.limit;
  } catch {
    /* empty body ok */
  }

  const result = await backfillDescriptorV2FromPreviews(limit);
  return NextResponse.json({ ok: true, ...result });
}

export async function GET() {
  const session = await auth();
  const denied = rootForbiddenResponse(session);
  if (denied) return denied;
  return NextResponse.json({
    configured: isFaceEmbedServiceConfigured(),
  });
}
