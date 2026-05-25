import { auth } from "@/auth";
import { DEFAULT_SITE_RADIUS_M } from "@/lib/siteGeofence";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const adminRoles = new Set(["COMPANY_ADMIN", "HR_MANAGER", "APPROVER", "SUPER_ADMIN"]);
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

const putSchema = z.object({
  name: z.string().trim().min(1).max(120),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  allowedRadius: z.number().finite().min(50).max(2000).optional(),
});

/** 회사 대표 근무지 (GPS 출근 반경) 조회 */
export async function GET(req: Request) {
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user?.id || !role || !adminRoles.has(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const resolved = resolveCompanyId(role, session.user.companyId, new URL(req.url));
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  const site = await prisma.site.findFirst({
    where: { companyId: resolved.companyId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      latitude: true,
      longitude: true,
      allowedRadius: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    site,
    defaultRadius: DEFAULT_SITE_RADIUS_M,
    canEdit: editRoles.has(role),
  });
}

/** 회사 대표 근무지 등록·수정 (1개) */
export async function PUT(req: Request) {
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user?.id || !role || !editRoles.has(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const resolved = resolveCompanyId(role, session.user.companyId, new URL(req.url));
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
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

  const { name, latitude, longitude, allowedRadius } = parsed.data;
  const radius = allowedRadius ?? DEFAULT_SITE_RADIUS_M;

  const existing = await prisma.site.findFirst({
    where: { companyId: resolved.companyId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  const site = existing
    ? await prisma.site.update({
        where: { id: existing.id },
        data: { name: name.trim(), latitude, longitude, allowedRadius: radius },
      })
    : await prisma.site.create({
        data: {
          companyId: resolved.companyId,
          name: name.trim(),
          latitude,
          longitude,
          allowedRadius: radius,
        },
      });

  return NextResponse.json({ site });
}
