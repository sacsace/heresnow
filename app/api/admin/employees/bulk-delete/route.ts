export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canDeleteEmployee } from "@/lib/roleHierarchy";
import { NextResponse } from "next/server";
import { z } from "zod";

const editRoles = new Set(["COMPANY_ADMIN", "HR_MANAGER", "SUPER_ADMIN"]);

const bulkDeleteSchema = z.object({
  employeeIds: z.array(z.string().min(1)).min(1).max(200),
});

function resolveCompanyId(
  role: string | undefined,
  sessionCompanyId: string | null | undefined,
  url: URL
): { companyId: string } | { error: string; status: number } {
  if (role === "SUPER_ADMIN") {
    const q = url.searchParams.get("companyId");
    if (!q) return { error: "companyId required", status: 400 };
    return { companyId: q };
  }
  if (!sessionCompanyId) return { error: "No company", status: 400 };
  return { companyId: sessionCompanyId };
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id || !editRoles.has(session.user.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const resolved = resolveCompanyId(session.user.role, session.user.companyId, new URL(req.url));
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bulkDeleteSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const employeeIds = [...new Set(parsed.data.employeeIds)];
  const employees = await prisma.employee.findMany({
    where: { id: { in: employeeIds }, companyId: resolved.companyId },
    select: {
      id: true,
      userId: true,
      name: true,
      user: { select: { id: true, role: true } },
    },
  });

  if (employees.length !== employeeIds.length) {
    return NextResponse.json(
      { error: "NOT_FOUND", message: "일부 직원을 찾을 수 없거나 같은 회사 소속이 아닙니다." },
      { status: 404 }
    );
  }

  for (const emp of employees) {
    if (emp.user.id === session.user.id) {
      return NextResponse.json(
        { error: "CANNOT_DELETE_SELF", message: "본인 계정은 삭제할 수 없습니다." },
        { status: 403 }
      );
    }
    if (!canDeleteEmployee(session.user.role, emp.user.role, false)) {
      return NextResponse.json(
        { error: "ROLE_NOT_ALLOWED", message: "권한이 부족하거나 삭제할 수 없는 사용자가 포함되어 있습니다." },
        { status: 403 }
      );
    }
  }

  const deletingAdminCount = employees.filter((e) => e.user.role === "COMPANY_ADMIN").length;
  if (deletingAdminCount > 0) {
    const adminCount = await prisma.user.count({
      where: { companyId: resolved.companyId, role: "COMPANY_ADMIN" },
    });
    if (adminCount - deletingAdminCount < 1) {
      return NextResponse.json(
        {
          error: "LAST_ADMIN",
          message: "마지막 회사 관리자는 삭제할 수 없습니다. 다른 관리자를 먼저 지정해 주세요.",
        },
        { status: 403 }
      );
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.approvalLog.createMany({
        data: employees.map((emp) => ({
          companyId: resolved.companyId,
          approverId: session.user.id!,
          action: "USER_DELETE",
          targetType: "User",
          targetId: emp.userId,
        })),
      });
      await tx.user.deleteMany({
        where: { id: { in: employees.map((e) => e.userId) } },
      });
    });
    return NextResponse.json({ ok: true, deletedCount: employees.length });
  } catch (e) {
    console.error("[employees BULK_DELETE]", e);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
