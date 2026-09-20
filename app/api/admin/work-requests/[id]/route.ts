export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canApproveWorkRequest } from "@/lib/workRequestAccess";
import { notifyEmployeeOfWorkRequestResult } from "@/lib/workRequestPush";
import { NextResponse } from "next/server";
import { z } from "zod";

const patchSchema = z.object({
  action: z.enum(["approve", "reject"]),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const item = await prisma.workRequest.findUnique({
    where: { id },
    include: { employee: { select: { userId: true } } },
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (session.user.role !== "SUPER_ADMIN") {
    if (!session.user.companyId || item.companyId !== session.user.companyId) {
      return NextResponse.json({ error: "Tenant mismatch" }, { status: 403 });
    }
  }

  if (item.status !== "PENDING") {
    return NextResponse.json({ error: "Already resolved" }, { status: 400 });
  }

  if (
    !canApproveWorkRequest({
      userId: session.user.id,
      role: session.user.role,
      assignedApproverUserId: item.assignedApproverUserId,
    })
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const approved = parsed.data.action === "approve";

  await prisma.$transaction(async (tx) => {
    await tx.workRequest.update({
      where: { id: item.id },
      data: {
        status: approved ? "APPROVED" : "REJECTED",
        resolvedAt: new Date(),
        resolverUserId: session.user.id,
      },
    });
    await tx.approvalLog.create({
      data: {
        companyId: item.companyId,
        approverId: session.user.id,
        action: approved ? "WORK_REQUEST_APPROVE" : "WORK_REQUEST_REJECT",
        targetType: "WorkRequest",
        targetId: item.id,
      },
    });
  });

  void notifyEmployeeOfWorkRequestResult({
    employeeUserId: item.employee.userId,
    requestId: item.id,
    approved,
    type: item.type,
    workDate: item.workDate,
    workEndDate: item.workEndDate,
  }).catch((err) => {
    console.error("[work-request result push]", err);
  });

  return NextResponse.json({ ok: true });
}
