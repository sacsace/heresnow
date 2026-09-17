export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canApproveWorkRequest, canReceiveWorkRequests } from "@/lib/workRequestAccess";
import { ExceptionStatus, WorkRequestType } from "@prisma/client";
import { NextResponse } from "next/server";

/** 받은 결재 — 로그인 사용자에게 지정된 사전 신청(WorkRequest) 목록 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const employeeMeta = session.user.employeeId
    ? await prisma.employee.findFirst({
        where: { id: session.user.employeeId, companyId: session.user.companyId ?? undefined },
        select: { isTeamLeader: true },
      })
    : null;

  const isTeamLeader = Boolean(employeeMeta?.isTeamLeader);
  if (!canReceiveWorkRequests(session.user.role, isTeamLeader)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  let companyId = session.user.companyId;
  if (session.user.role === "SUPER_ADMIN") {
    const q = url.searchParams.get("companyId");
    if (!q) return NextResponse.json({ error: "companyId required" }, { status: 400 });
    companyId = q;
  }
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const kind = url.searchParams.get("kind") ?? "all";
  const statusParam = url.searchParams.get("status") ?? "all";
  const requestType: WorkRequestType | null =
    kind === "early-leave" ? "EARLY_LEAVE" : kind === "overtime" ? "OVERTIME" : null;

  const isResolved = statusParam === "resolved";
  const isPending = statusParam === "pending";
  const statusFilter: ExceptionStatus | { in: ExceptionStatus[] } | undefined = isResolved
    ? { in: [ExceptionStatus.APPROVED, ExceptionStatus.REJECTED] }
    : isPending
      ? ExceptionStatus.PENDING
      : undefined;

  const requests = await prisma.workRequest.findMany({
    where: {
      companyId,
      assignedApproverUserId: session.user.id,
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(requestType ? { type: requestType } : {}),
    },
    orderBy: isResolved
      ? [{ resolvedAt: "desc" }, { createdAt: "desc" }]
      : [{ createdAt: "desc" }, { workDate: "desc" }],
    include: {
      employee: { select: { name: true } },
      assignedApprover: { select: { id: true, employee: { select: { name: true } } } },
      resolver: { select: { employee: { select: { name: true } } } },
    },
  });

  const requestsWithAcl = requests.map((item) => ({
    ...item,
    assignedApproverName: item.assignedApprover?.employee?.name ?? null,
    resolverName: item.resolver?.employee?.name ?? null,
    canApprove:
      item.status === "PENDING" &&
      canApproveWorkRequest({
        userId: session.user!.id!,
        role: session.user.role,
        assignedApproverUserId: item.assignedApproverUserId,
      }),
  }));

  return NextResponse.json({ requests: requestsWithAcl, exceptions: [] });
}
