export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createFaceLoginToken } from "@/lib/faceLoginToken";
import { matchFaceLoginUser, parseProbeDescriptor } from "@/lib/faceLoginMatch";
import { getClientIp } from "@/lib/clientIp";
import { resolveFaceLoginCompanyId } from "@/lib/resolveFaceLoginCompany";
import { consumeRateLimit } from "@/lib/slidingWindowRateLimit";
import { NextResponse } from "next/server";
import { z } from "zod";
import { FACE_DESCRIPTOR_LENGTH } from "@/lib/faceMatch";

const FACE_LOGIN_MAX_ATTEMPTS = 15;
const FACE_LOGIN_WINDOW_MS = 60_000;

const bodySchema = z.object({
  descriptor: z.array(z.number().finite()).length(FACE_DESCRIPTOR_LENGTH),
  companyName: z.string().optional(),
});

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rate = consumeRateLimit(
    `face-login:${ip}`,
    FACE_LOGIN_MAX_ATTEMPTS,
    FACE_LOGIN_WINDOW_MS
  );
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterMs: rate.retryAfterMs },
      { status: 429 }
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_descriptor" }, { status: 400 });
  }

  const probe = parseProbeDescriptor(parsed.data.descriptor);
  if (!probe) {
    return NextResponse.json({ error: "invalid_descriptor" }, { status: 400 });
  }

  const company = await resolveFaceLoginCompanyId(parsed.data.companyName);
  if (!company.ok) {
    const status = company.reason === "missing_name" ? 400 : 404;
    return NextResponse.json({ error: company.reason }, { status });
  }

  try {
    const user = await matchFaceLoginUser(probe, company.companyId);
    if (!user) {
      return NextResponse.json({ error: "no_match" }, { status: 401 });
    }

    const loginToken = createFaceLoginToken(user.id);
    return NextResponse.json({ loginToken });
  } catch (e) {
    console.error("[face-login]", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
