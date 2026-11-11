export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { createCompanyEmployee } from "@/lib/employeeCreate";
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  WEAK_PASSWORD_MESSAGE,
  isStrongPassword,
} from "@/lib/passwordPolicy";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const postSchema = z.object({
  email: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v.toLowerCase() : null)),
  name: z.string().min(1).max(120),
  password: z.string().min(MIN_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH),
  externalEmployeeId: z
    .string()
    .trim()
    .max(80)
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  role: z.enum(["COMPANY_ADMIN", "HR_MANAGER", "APPROVER", "EMPLOYEE", "DOOR"]),
});

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

  const users = await prisma.user.findMany({
    where: { companyId },
    orderBy: { email: "asc" },
    select: {
      id: true,
      email: true,
      role: true,
      consentGivenAt: true,
      createdAt: true,
      employee: { select: { id: true, name: true, externalEmployeeId: true } },
    },
  });

  return NextResponse.json({ users });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: companyId } = await ctx.params;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = postSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { email, name, password, role, externalEmployeeId } = parsed.data;
  if (!isStrongPassword(password)) {
    return NextResponse.json(
      { error: "WEAK_PASSWORD", message: WEAK_PASSWORD_MESSAGE },
      { status: 400 }
    );
  }

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const result = await createCompanyEmployee(
    {
      companyId,
      email,
      name,
      password,
      departmentId: null,
      role,
      externalEmployeeId,
    },
    { callerRole: "SUPER_ADMIN" }
  );

  if (!result.ok) {
    const status =
      result.code === "EMAIL_TAKEN" || result.code === "EXTERNAL_ID_TAKEN"
        ? 409
        : result.code === "CREATE_FAILED"
          ? 500
          : 400;
    return NextResponse.json(
      { error: result.message, code: result.code, message: result.message },
      { status }
    );
  }

  return NextResponse.json({ ok: true });
}
