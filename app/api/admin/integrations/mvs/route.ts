export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { IntegrationProvider } from "@prisma/client";
import { NextResponse } from "next/server";

const viewRoles = new Set(["COMPANY_ADMIN", "HR_MANAGER", "SUPER_ADMIN"]);

function resolveCompanyId(
  role: string | undefined,
  sessionCompanyId: string | null | undefined,
  url: URL
): { companyId: string } | { error: string; status: number } {
  if (role === "SUPER_ADMIN") {
    const q = url.searchParams.get("companyId");
    if (q) return { companyId: q };
    if (sessionCompanyId) return { companyId: sessionCompanyId };
    return { error: "companyId required", status: 400 };
  }
  if (!sessionCompanyId) return { error: "No company", status: 400 };
  return { companyId: sessionCompanyId };
}

/** 회사 관리자·슈퍼관리자: MVS 연동 상태 조회 */
export async function GET(req: Request) {
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user?.id || !role || !viewRoles.has(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const resolved = resolveCompanyId(role, session.user.companyId, new URL(req.url));
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
  const { companyId } = resolved;

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
    companyId,
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
