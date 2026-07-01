export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { IntegrationProvider } from "@prisma/client";
import { NextResponse } from "next/server";

/** 회사 관리자: MVS 연동 상태 조회 (설정 변경은 슈퍼 전용) */
export async function GET() {
  const session = await auth();
  const role = session?.user?.role;
  const companyId = session?.user?.companyId;
  if (
    !session?.user?.id ||
    !companyId ||
    (role !== "COMPANY_ADMIN" && role !== "HR_MANAGER" && role !== "SUPER_ADMIN")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const integration = await prisma.companyIntegration.findUnique({
    where: {
      companyId_provider: { companyId, provider: IntegrationProvider.MVS },
    },
    select: {
      enabled: true,
      externalCompanyId: true,
      apiKeyLast4: true,
      apiKeyUpdatedAt: true,
      updatedAt: true,
    },
  });

  const [pending, failed] = await Promise.all([
    prisma.integrationOutbox.count({
      where: { companyId, provider: IntegrationProvider.MVS, status: "PENDING" },
    }),
    prisma.integrationOutbox.count({
      where: { companyId, provider: IntegrationProvider.MVS, status: "FAILED" },
    }),
  ]);

  return NextResponse.json({
    enabled: integration?.enabled ?? false,
    externalCompanyId: integration?.externalCompanyId ?? null,
    pendingOutboxCount: pending,
    failedOutboxCount: failed,
    hasApiKey: Boolean(integration?.apiKeyLast4),
    apiKeyLast4: integration?.apiKeyLast4 ?? null,
    apiKeyUpdatedAt: integration?.apiKeyUpdatedAt?.toISOString() ?? null,
    configured: !!integration,
  });
}
