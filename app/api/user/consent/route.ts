import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const CONSENT_VERSION = "2026-04-01";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      consentGivenAt: new Date(),
      consentVersion: CONSENT_VERSION,
    },
  });

  return NextResponse.json({ ok: true, consentVersion: CONSENT_VERSION });
}
