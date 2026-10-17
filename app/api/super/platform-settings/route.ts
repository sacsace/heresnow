import { auth } from "@/auth";
import {
  getPlatformMenuFlags,
  updatePlatformMenuFlags,
} from "@/lib/platformMenuFlags";
import { rootForbiddenResponse } from "@/lib/requireRootUser";
import { NextResponse } from "next/server";
import { z } from "zod";

/** root만 — 플랫폼 메뉴 표시 설정 조회 */
export async function GET() {
  const session = await auth();
  const denied = rootForbiddenResponse(session);
  if (denied) return denied;

  const flags = await getPlatformMenuFlags();
  return NextResponse.json(flags);
}

const patchSchema = z.object({
  showWorkRequestsMenu: z.boolean().optional(),
  showBillingMenu: z.boolean().optional(),
});

/** root만 — 근태신청·결제하기 메뉴 on/off */
export async function PATCH(req: Request) {
  const session = await auth();
  const denied = rootForbiddenResponse(session);
  if (denied) return denied;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (
    parsed.data.showWorkRequestsMenu === undefined &&
    parsed.data.showBillingMenu === undefined
  ) {
    return NextResponse.json({ error: "No changes" }, { status: 400 });
  }

  const flags = await updatePlatformMenuFlags(parsed.data);
  return NextResponse.json(flags);
}
