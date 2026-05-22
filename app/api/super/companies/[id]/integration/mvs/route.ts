import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { IntegrationProvider } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: companyId } = await ctx.params;
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
  if (!company) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const integration = await prisma.companyIntegration.findUnique({
    where: {
      companyId_provider: { companyId, provider: IntegrationProvider.MVS },
    },
  });

  const pendingCount = await prisma.integrationOutbox.count({
    where: {
      companyId,
      provider: IntegrationProvider.MVS,
      status: "PENDING",
    },
  });

  return NextResponse.json({
    integration: integration ?? {
      companyId,
      provider: IntegrationProvider.MVS,
      enabled: false,
      externalCompanyId: null,
      webhookUrl: null,
    },
    pendingOutboxCount: pendingCount,
  });
}

const putSchema = z.object({
  enabled: z.boolean().optional(),
  externalCompanyId: z.union([z.string().min(1).max(200), z.null()]).optional(),
  webhookUrl: z.union([z.string().url().max(2000), z.null(), z.literal("")]).optional(),
});

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: companyId } = await ctx.params;
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
  if (!company) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = putSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const webhookUrl =
    parsed.data.webhookUrl === undefined
      ? undefined
      : parsed.data.webhookUrl === "" || parsed.data.webhookUrl === null
        ? null
        : parsed.data.webhookUrl;

  const integration = await prisma.companyIntegration.upsert({
    where: {
      companyId_provider: { companyId, provider: IntegrationProvider.MVS },
    },
    create: {
      companyId,
      provider: IntegrationProvider.MVS,
      enabled: parsed.data.enabled ?? false,
      externalCompanyId: parsed.data.externalCompanyId ?? null,
      webhookUrl: webhookUrl ?? null,
    },
    update: {
      ...(parsed.data.enabled !== undefined ? { enabled: parsed.data.enabled } : {}),
      ...(parsed.data.externalCompanyId !== undefined
        ? { externalCompanyId: parsed.data.externalCompanyId }
        : {}),
      ...(webhookUrl !== undefined ? { webhookUrl } : {}),
    },
  });

  return NextResponse.json({ integration });
}
