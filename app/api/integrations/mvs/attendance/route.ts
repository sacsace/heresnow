import { verifyMvsIntegrationApiKey } from "@/lib/integrations/mvsAuth";
import { isMvsAttendanceEventV1 } from "@/lib/integrations/mvsTypes";
import { prisma } from "@/lib/prisma";
import { IntegrationProvider } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

function apiKeyFromRequest(req: Request): string | null {
  const bearer = req.headers.get("authorization");
  if (bearer?.startsWith("Bearer ")) return bearer.slice(7).trim();
  return req.headers.get("x-mvs-api-key")?.trim() ?? null;
}

const querySchema = z.object({
  companyId: z.string().cuid().optional(),
  externalCompanyId: z.string().min(1).max(200).optional(),
  status: z.enum(["PENDING", "DELIVERED", "FAILED"]).default("PENDING"),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().cuid().optional(),
});

/**
 * MVS가 HereNow 출퇴근 이벤트를 폴링할 때 사용.
 * Authorization: Bearer {MVS_INTEGRATION_API_KEY}
 */
export async function GET(req: Request) {
  if (!verifyMvsIntegrationApiKey(apiKeyFromRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { companyId, externalCompanyId, status, limit, cursor } = parsed.data;

  if (!companyId && !externalCompanyId) {
    return NextResponse.json(
      { error: "companyId 또는 externalCompanyId가 필요합니다." },
      { status: 400 }
    );
  }

  let resolvedCompanyId = companyId;
  if (!resolvedCompanyId && externalCompanyId) {
    const integration = await prisma.companyIntegration.findFirst({
      where: {
        provider: IntegrationProvider.MVS,
        enabled: true,
        externalCompanyId,
      },
      select: { companyId: true },
    });
    if (!integration) {
      return NextResponse.json({ error: "연동된 회사를 찾을 수 없습니다." }, { status: 404 });
    }
    resolvedCompanyId = integration.companyId;
  }

  const integration = await prisma.companyIntegration.findUnique({
    where: {
      companyId_provider: {
        companyId: resolvedCompanyId!,
        provider: IntegrationProvider.MVS,
      },
    },
  });
  if (!integration?.enabled) {
    return NextResponse.json({ error: "MVS 연동이 비활성화되어 있습니다." }, { status: 403 });
  }

  const rows = await prisma.integrationOutbox.findMany({
    where: {
      companyId: resolvedCompanyId!,
      provider: IntegrationProvider.MVS,
      status,
      ...(cursor ? { id: { gt: cursor } } : {}),
    },
    orderBy: { id: "asc" },
    take: limit,
  });

  const events = rows
    .map((r) => r.payload)
    .filter((p): p is NonNullable<typeof p> => isMvsAttendanceEventV1(p));

  return NextResponse.json({
    companyId: resolvedCompanyId,
    externalCompanyId: integration.externalCompanyId,
    status,
    count: events.length,
    nextCursor: rows.length === limit ? rows[rows.length - 1]?.id ?? null : null,
    events,
    outboxIds: rows.map((r) => r.id),
  });
}

const ackSchema = z.object({
  outboxIds: z.array(z.string().cuid()).min(1).max(500),
});

/** MVS가 수신 완료 후 호출 — 아웃박스를 DELIVERED로 표시 */
export async function POST(req: Request) {
  if (!verifyMvsIntegrationApiKey(apiKeyFromRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = ackSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await prisma.integrationOutbox.updateMany({
    where: {
      id: { in: parsed.data.outboxIds },
      provider: IntegrationProvider.MVS,
      status: "PENDING",
    },
    data: {
      status: "DELIVERED",
      deliveredAt: new Date(),
      lastError: null,
    },
  });

  return NextResponse.json({ acknowledged: updated.count });
}
