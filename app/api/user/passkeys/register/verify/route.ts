import { auth } from "@/auth";
import { PASSKEY_REGISTER_CHALLENGE_COOKIE, cookieBaseOptions } from "@/lib/passkeyCookies";
import { resolvePasskeyConfig } from "@/lib/passkeyConfig";
import { toBase64Url } from "@/lib/passkeyBase64url";
import { prisma } from "@/lib/prisma";
import { verifyRegistrationResponse, type VerifiedRegistrationResponse } from "@simplewebauthn/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  response: z.unknown(),
  nickname: z.string().trim().max(64).optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const cookieStore = await cookies();
  const expectedChallenge = cookieStore.get(PASSKEY_REGISTER_CHALLENGE_COOKIE)?.value;
  cookieStore.set(PASSKEY_REGISTER_CHALLENGE_COOKIE, "", { ...cookieBaseOptions(), maxAge: 0 });
  if (!expectedChallenge) {
    return NextResponse.json({ error: "CHALLENGE_MISSING" }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const { rpID, expectedOrigin } = resolvePasskeyConfig(req);

  let verification: VerifiedRegistrationResponse;
  try {
    verification = await verifyRegistrationResponse({
      response: parsed.data.response as Parameters<typeof verifyRegistrationResponse>[0]["response"],
      expectedChallenge,
      expectedOrigin,
      expectedRPID: rpID,
      requireUserVerification: false,
    });
  } catch {
    return NextResponse.json({ error: "VERIFICATION_FAILED" }, { status: 400 });
  }

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: "VERIFICATION_FAILED" }, { status: 400 });
  }

  const info = verification.registrationInfo;
  const credentialId = toBase64Url(info.credentialID);
  const publicKey = toBase64Url(info.credentialPublicKey);
  const transportsRaw =
    typeof parsed.data.response === "object" &&
    parsed.data.response !== null &&
    "response" in parsed.data.response
      ? (parsed.data.response as { response?: { transports?: string[] } }).response?.transports
      : undefined;
  const transportCsv = transportsRaw && transportsRaw.length > 0 ? transportsRaw.join(",") : null;

  await prisma.userPasskeyCredential.upsert({
    where: { credentialId },
    update: {
      userId: session.user.id,
      publicKey,
      counter: info.counter,
      deviceType: info.credentialDeviceType,
      backedUp: info.credentialBackedUp,
      transports: transportCsv,
      nickname: parsed.data.nickname || null,
      lastUsedAt: new Date(),
    },
    create: {
      userId: session.user.id,
      credentialId,
      publicKey,
      counter: info.counter,
      deviceType: info.credentialDeviceType,
      backedUp: info.credentialBackedUp,
      transports: transportCsv,
      nickname: parsed.data.nickname || null,
      lastUsedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}

