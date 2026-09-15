export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createFaceLoginToken } from "@/lib/faceLoginToken";
import {
  matchFaceLoginUserMultiFrame,
  parseProbeDescriptor,
} from "@/lib/faceLoginMatch";
import { dedupeFaceProbes } from "@/lib/faceProbeDedupe";
import { resolveFaceIdentityPolicy } from "@/lib/faceIdentityPolicy";
import { getClientIp } from "@/lib/clientIp";
import { resolveFaceLoginCompanyId } from "@/lib/resolveFaceLoginCompany";
import { consumeRateLimit } from "@/lib/slidingWindowRateLimit";
import { FACE_DESCRIPTOR_LENGTH } from "@/lib/faceMatch";
import { NextResponse } from "next/server";
import { z } from "zod";

const FACE_LOGIN_MAX_ATTEMPTS = 120;
const FACE_LOGIN_WINDOW_MS = 60_000;

const descriptorSchema = z.array(z.number().finite()).length(FACE_DESCRIPTOR_LENGTH);

const bodySchema = z
  .object({
    companyName: z.string().min(1),
    /** @deprecated single frame — rejected; use faceDescriptors */
    descriptor: descriptorSchema.optional(),
    /** Multi-frame login — min 3 distinct frames required */
    faceDescriptors: z.array(descriptorSchema).min(3).max(8).optional(),
  })
  .refine((d) => (d.faceDescriptors?.length ?? 0) >= 3, {
    message: "faceDescriptors min 3 required",
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
    return NextResponse.json(
      { error: "invalid_descriptor", code: "MULTIFRAME_REQUIRED" },
      { status: 400 }
    );
  }

  const policy = resolveFaceIdentityPolicy();
  const multiProbes =
    parsed.data.faceDescriptors
      ?.map((d) => parseProbeDescriptor(d))
      .filter((d): d is number[] => d != null) ?? [];

  const unique = dedupeFaceProbes(multiProbes);
  if (unique.length < policy.multiFrameRequiredMatches) {
    return NextResponse.json(
      { error: "invalid_descriptor", code: "INSUFFICIENT_FRAME_DIVERSITY" },
      { status: 400 }
    );
  }

  const company = await resolveFaceLoginCompanyId(parsed.data.companyName);
  if (!company.ok) {
    const status =
      company.reason === "missing_name"
        ? 400
        : company.reason === "ambiguous"
          ? 409
          : 404;
    return NextResponse.json({ error: company.reason }, { status });
  }

  try {
    const result = await matchFaceLoginUserMultiFrame(unique.slice(0, 8), company.companyId);
    if (!("user" in result)) {
      const status =
        result.reason === "ambiguous"
          ? 409
          : result.reason === "no_enrolled"
            ? 404
            : 401;
      const body: Record<string, unknown> = {
        error: result.reason,
        code: result.reason.toUpperCase(),
      };
      if (process.env.NODE_ENV === "development") {
        body.bestDistance = result.bestDistance;
        body.secondDistance = result.secondDistance;
        body.confidencePercent = result.confidencePercent;
        body.detail = result.detail;
      }
      return NextResponse.json(body, { status });
    }

    const loginToken = await createFaceLoginToken(result.user.id);
    return NextResponse.json({
      loginToken,
      ...(process.env.NODE_ENV === "development"
        ? { confidencePercent: result.confidencePercent }
        : {}),
    });
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.error("[face-login]", e);
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
