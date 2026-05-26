import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAssignRole } from "@/lib/roleHierarchy";
import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

const editRoles = new Set(["COMPANY_ADMIN", "HR_MANAGER", "SUPER_ADMIN"]);

const COMPANY_ROLES = ["COMPANY_ADMIN", "HR_MANAGER", "APPROVER", "EMPLOYEE"] as const;

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

const patchSchema = z.object({
  /** null 로 보내면 부서 미배정 처리 */
  departmentId: z.string().min(1).max(40).nullable().optional(),
  name: z.string().trim().min(1).max(120).optional(),
  role: z.enum(COMPANY_ROLES).optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || !editRoles.has(session.user.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const resolved = resolveCompanyId(session.user.role, session.user.companyId, new URL(req.url));
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
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

  // 회사 격리 — 같은 회사 소속이 아니면 거부
  const existing = await prisma.employee.findUnique({
    where: { id },
    select: {
      companyId: true,
      userId: true,
      user: { select: { id: true, role: true } },
    },
  });
  if (!existing || existing.companyId !== resolved.companyId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // 부서가 들어왔다면 같은 회사 소속인지 검증
  if (parsed.data.departmentId !== undefined && parsed.data.departmentId !== null) {
    const dep = await prisma.department.findUnique({
      where: { id: parsed.data.departmentId },
      select: { companyId: true },
    });
    if (!dep || dep.companyId !== resolved.companyId) {
      return NextResponse.json({ error: "INVALID_DEPARTMENT" }, { status: 400 });
    }
  }

  // 역할 변경 권한 체크 — 호출자보다 엄격히 낮은 등급만 허용
  const wantsRoleChange =
    parsed.data.role !== undefined && parsed.data.role !== existing.user.role;
  if (wantsRoleChange) {
    if (
      !canAssignRole(session.user.role, existing.user.role, parsed.data.role!)
    ) {
      return NextResponse.json(
        { error: "ROLE_NOT_ALLOWED", message: "권한이 부족하거나 허용되지 않는 역할입니다." },
        { status: 403 }
      );
    }
    // 자기 자신의 역할을 본인이 변경하지 못하도록 안전망 (회사 관리자가 자기 자신을 강등하면 잠금)
    if (existing.user.id === session.user.id) {
      return NextResponse.json(
        { error: "CANNOT_CHANGE_OWN_ROLE", message: "본인의 역할은 변경할 수 없습니다." },
        { status: 403 }
      );
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const employee = await tx.employee.update({
        where: { id },
        data: {
          ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
          ...(parsed.data.departmentId !== undefined
            ? { departmentId: parsed.data.departmentId }
            : {}),
        },
        include: {
          user: { select: { id: true, email: true, role: true } },
          department: { select: { id: true, name: true } },
        },
      });

      let userRole = employee.user.role;
      if (wantsRoleChange) {
        const updatedUser = await tx.user.update({
          where: { id: existing.userId },
          data: { role: parsed.data.role as Role },
          select: { role: true },
        });
        userRole = updatedUser.role;
        await tx.approvalLog.create({
          data: {
            companyId: resolved.companyId,
            approverId: session.user.id!,
            action: "USER_ROLE_CHANGE",
            targetType: "User",
            targetId: existing.userId,
          },
        });
      }

      return {
        ...employee,
        user: { ...employee.user, role: userRole },
      };
    });

    return NextResponse.json({ employee: result });
  } catch (e) {
    console.error("[employees PATCH]", e);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
