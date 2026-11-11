export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { isShiftCode } from "@/lib/employeeWorkSchedule";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

const editRoles = new Set(["COMPANY_ADMIN", "HR_MANAGER", "SUPER_ADMIN"]);

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
  name: z.string().trim().min(1).max(80).optional(),
  workScheduleMode: z.enum(["COMPANY", "SHIFT", "CUSTOM"]).optional(),
  shiftCode: z.enum(["A", "B", "C"]).nullable().optional(),
  workStartTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable()
    .optional(),
  workEndTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable()
    .optional(),
});

const departmentSelect = {
  id: true,
  name: true,
  workScheduleMode: true,
  shiftCode: true,
  workStartTime: true,
  workEndTime: true,
  createdAt: true,
  _count: { select: { employees: true } },
} as const;

function mapDepartment(dep: {
  id: string;
  name: string;
  workScheduleMode: string;
  shiftCode: string | null;
  workStartTime: string | null;
  workEndTime: string | null;
  createdAt: Date;
  _count: { employees: number };
}) {
  return {
    id: dep.id,
    name: dep.name,
    workScheduleMode: dep.workScheduleMode,
    shiftCode: dep.shiftCode,
    workStartTime: dep.workStartTime,
    workEndTime: dep.workEndTime,
    createdAt: dep.createdAt,
    employeeCount: dep._count.employees,
  };
}

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

  if (
    parsed.data.name === undefined &&
    parsed.data.workScheduleMode === undefined &&
    parsed.data.shiftCode === undefined &&
    parsed.data.workStartTime === undefined &&
    parsed.data.workEndTime === undefined
  ) {
    return NextResponse.json({ error: "No changes" }, { status: 400 });
  }

  const existing = await prisma.department.findUnique({
    where: { id },
    select: {
      companyId: true,
      workScheduleMode: true,
      shiftCode: true,
      workStartTime: true,
      workEndTime: true,
    },
  });
  if (!existing || existing.companyId !== resolved.companyId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const nextMode = parsed.data.workScheduleMode ?? existing.workScheduleMode;
  const data: Prisma.DepartmentUpdateInput = {};

  if (parsed.data.name !== undefined) data.name = parsed.data.name;

  if (parsed.data.workScheduleMode !== undefined || parsed.data.shiftCode !== undefined) {
    if (nextMode === "COMPANY") {
      data.workScheduleMode = "COMPANY";
      data.shiftCode = null;
      data.workStartTime = null;
      data.workEndTime = null;
    } else if (nextMode === "SHIFT") {
      const code = parsed.data.shiftCode ?? existing.shiftCode;
      if (!isShiftCode(code)) {
        return NextResponse.json({ error: "SHIFT_CODE_REQUIRED" }, { status: 400 });
      }
      data.workScheduleMode = "SHIFT";
      data.shiftCode = code;
      data.workStartTime = null;
      data.workEndTime = null;
    } else if (nextMode === "CUSTOM") {
      const start =
        parsed.data.workStartTime !== undefined
          ? parsed.data.workStartTime
          : existing.workStartTime;
      const end =
        parsed.data.workEndTime !== undefined ? parsed.data.workEndTime : existing.workEndTime;
      if (!start || !end) {
        return NextResponse.json({ error: "CUSTOM_TIMES_REQUIRED" }, { status: 400 });
      }
      data.workScheduleMode = "CUSTOM";
      data.shiftCode = null;
      data.workStartTime = start;
      data.workEndTime = end;
    }
  } else if (nextMode === "CUSTOM") {
    if (parsed.data.workStartTime !== undefined) data.workStartTime = parsed.data.workStartTime;
    if (parsed.data.workEndTime !== undefined) data.workEndTime = parsed.data.workEndTime;
  }

  try {
    const dep = await prisma.department.update({
      where: { id },
      data,
      select: departmentSelect,
    });
    return NextResponse.json({ department: mapDepartment(dep) });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "DUPLICATE_NAME" }, { status: 409 });
    }
    console.error("[departments PATCH]", e);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || !editRoles.has(session.user.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const resolved = resolveCompanyId(session.user.role, session.user.companyId, new URL(req.url));
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  const { id } = await ctx.params;

  const existing = await prisma.department.findUnique({ where: { id }, select: { companyId: true } });
  if (!existing || existing.companyId !== resolved.companyId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await prisma.department.delete({ where: { id } });
  } catch (e) {
    console.error("[departments DELETE]", e);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
