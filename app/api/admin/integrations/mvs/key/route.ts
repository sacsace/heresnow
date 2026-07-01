export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { generateMvsApiKey, hashMvsApiKey } from "@/lib/integrations/mvsAuth";
import { prisma } from "@/lib/prisma";
import { IntegrationProvider } from "@prisma/client";
import { NextResponse } from "next/server";

/** 회사 관리자: MVS API key 생성/재생성 */
export async function POST() {
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
      enabled: false,
      externalCompanyId: null,
      webhookUrl: null,
      apiKeyHash,
      apiKeyLast4,
      apiKeyUpdatedAt: now,
    },
    update: {
      apiKeyHash,
      apiKeyLast4,
      apiKeyUpdatedAt: now,
    },
  });

  return NextResponse.json({
    ok: true,
    apiKey,
    apiKeyLast4,
    apiKeyUpdatedAt: now.toISOString(),
  });
}
