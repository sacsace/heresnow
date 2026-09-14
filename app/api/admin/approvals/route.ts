export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  canApproveWorkRequest,
  canManageWorkRequests,
  canReceiveWorkRequests,
} from "@/lib/workRequestAccess";
import { ExceptionStatus, WorkRequestType } from "@prisma/client";
import { NextResponse } from "next/server";

/** 사전 신청(WorkRequest) + 출퇴근 예외(AttendanceException) 통합 목록 */
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
  const statusParam = url.searchParams.get("status") ?? "pending";
  const requestType: WorkRequestType | null =
    kind === "early-leave" ? "EARLY_LEAVE" : kind === "overtime" ? "OVERTIME" : null;

  const manageAll = canManageWorkRequests(session.user.role);
  const isResolved = statusParam === "resolved";
  const statusFilter: ExceptionStatus | { in: ExceptionStatus[] } = isResolved
    ? { in: [ExceptionStatus.APPROVED, ExceptionStatus.REJECTED] }
    : ExceptionStatus.PENDING;

  const [requests, exceptions] = await Promise.all([
    prisma.workRequest.findMany({
      where: {
        companyId,
        status: statusFilter,
        ...(requestType ? { type: requestType } : {}),
        ...(manageAll ? {} : { assignedApproverUserId: session.user.id }),
      },
      orderBy: isResolved
        ? [{ resolvedAt: "desc" }, { createdAt: "desc" }]
        : [{ createdAt: "desc" }],
      include: {
        employee: { select: { name: true } },
        assignedApprover: { select: { id: true, employee: { select: { name: true } } } },
        resolver: { select: { employee: { select: { name: true } } } },
      },
    }),
    manageAll
      ? prisma.attendanceException.findMany({
          where: {
            companyId,
            status: statusFilter,
            attendance: {
              type: "CHECK_OUT",
              ...(requestType === "EARLY_LEAVE"
                ? { isEarlyLeave: true }
                : requestType === "OVERTIME"
                  ? { isEarlyLeave: false }
                  : {}),
            },
          },
          orderBy: isResolved
            ? [{ resolvedAt: "desc" }, { createdAt: "desc" }]
            : [{ createdAt: "desc" }],
          include: {
            attendance: {
              select: {
                employeeId: true,
                type: true,
                timestamp: true,
                isEarlyLeave: true,
                isOvertime: true,
                employee: { select: { name: true } },
                site: { select: { name: true } },
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const checkInByCheckout = new Map<string, string>();
  if (exceptions.length > 0) {
    const checkoutTimes = exceptions.map((ex) => ex.attendance.timestamp.getTime());
    const employeeIds = [...new Set(exceptions.map((ex) => ex.attendance.employeeId))];
    const windowStart = new Date(Math.min(...checkoutTimes) - 48 * 60 * 60 * 1000);
    const checkIns = await prisma.attendanceRecord.findMany({
      where: {
        companyId,
        employeeId: { in: employeeIds },
        type: "CHECK_IN",
        timestamp: { gte: windowStart },
      },
      orderBy: { timestamp: "asc" },
      select: { id: true, employeeId: true, timestamp: true },
    });

    const checkInsByEmployee = new Map<string, typeof checkIns>();
    for (const row of checkIns) {
      const list = checkInsByEmployee.get(row.employeeId) ?? [];
      list.push(row);
      checkInsByEmployee.set(row.employeeId, list);
    }

    for (const ex of exceptions) {
      const checkoutAt = ex.attendance.timestamp;
      const list = checkInsByEmployee.get(ex.attendance.employeeId) ?? [];
      let matched: (typeof checkIns)[number] | null = null;
      for (let i = list.length - 1; i >= 0; i -= 1) {
        if (list[i].timestamp < checkoutAt) {
          matched = list[i];
          break;
        }
      }
      if (matched) {
        checkInByCheckout.set(ex.attendanceId, matched.timestamp.toISOString());
      }
    }
  }

  const exceptionsWithCheckIn = exceptions.map((ex) => ({
    ...ex,
    checkInAt: checkInByCheckout.get(ex.attendanceId) ?? null,
  }));

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

  return NextResponse.json({ requests: requestsWithAcl, exceptions: exceptionsWithCheckIn });
}
