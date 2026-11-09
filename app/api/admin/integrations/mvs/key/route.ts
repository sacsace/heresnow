export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { generateMvsApiKey, hashMvsApiKey } from "@/lib/integrations/mvsAuth";
import { prisma } from "@/lib/prisma";
import { IntegrationProvider } from "@prisma/client";
import { NextResponse } from "next/server";

const editRoles = new Set(["COMPANY_ADMIN", "HR_MANAGER", "SUPER_ADMIN"]);

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

/** 회사 관리자·슈퍼관리자: MVS API key 생성/재생성 */
export async function POST(req: Request) {
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user?.id || !role || !editRoles.has(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const resolved = resolveCompanyId(role, session.user.companyId, new URL(req.url));
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
  const { companyId } = resolved;

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true },
  });
  if (!company) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const apiKey = generateMvsApiKey();
  const apiKeyHash = hashMvsApiKey(apiKey);
  const apiKeyLast4 = apiKey.slice(-4);
  const now = new Date();

  await prisma.companyIntegration.upsert({
    where: {
      companyId_provider: { companyId, provider: IntegrationProvider.MVS },
    },
    create: {
      companyId,
      provider: IntegrationProvider.MVS,
      enabled: true,
      externalCompanyId: null,
      webhookUrl: null,
      apiKeyHash,
      apiKeyLast4,
      apiKeyUpdatedAt: now,
    },
    update: {
      enabled: true,
      apiKeyHash,
      apiKeyLast4,
      apiKeyUpdatedAt: now,
    },
  });

  return NextResponse.json({
    ok: true,
    companyId,
    apiKey,
    apiKeyLast4,
    apiKeyUpdatedAt: now.toISOString(),
  });
}
