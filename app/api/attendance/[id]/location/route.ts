import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { computeDistanceFromSite } from "@/lib/siteGeofence";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  latitude: z.number().finite(),
  longitude: z.number().finite(),
  accuracy: z.number().finite().optional(),
});

/** 출퇴근 직후 GPS 보정 — 본인 기록만, 생성 후 30분 이내 */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.employeeId || !session.user.companyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await ctx.params;
    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const record = await prisma.attendanceRecord.findFirst({
      where: {
        id,
        companyId: session.user.companyId,
        employeeId: session.user.employeeId,
      },
      select: { id: true, timestamp: true, type: true, isBusinessTrip: true },
    });

    if (!record) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const ageMs = Date.now() - record.timestamp.getTime();
    if (ageMs > 30 * 60 * 1000) {
      return NextResponse.json({ error: "Location update window expired" }, { status: 400 });
    }

    const { latitude, longitude, accuracy } = parsed.data;

    const site = await prisma.site.findFirst({
      where: { companyId: session.user.companyId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        latitude: true,
        longitude: true,
        allowedRadius: true,
      },
    });

    let distanceFromSite = 0;
    const siteRelation =
      site && !(record.type === "CHECK_IN" && record.isBusinessTrip)
        ? { site: { connect: { id: site.id } } }
        : record.type === "CHECK_IN" && record.isBusinessTrip
          ? { site: { disconnect: true } }
          : {};

    if (site) {
      distanceFromSite = computeDistanceFromSite(site, latitude, longitude);
    }

    const updated = await prisma.attendanceRecord.update({
      where: { id: record.id },
      data: {
        latitude,
        longitude,
        accuracy: accuracy ?? null,
        distanceFromSite,
        ...siteRelation,
      },
      select: {
        id: true,
        latitude: true,
        longitude: true,
        distanceFromSite: true,
      },
    });

    return NextResponse.json(updated);
  } catch (e) {
    console.error("[attendance location PATCH]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
