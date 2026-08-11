export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createPasskeyLoginToken } from "@/lib/passkeyLoginToken";
import { PASSKEY_LOGIN_CHALLENGE_COOKIE, cookieBaseOptions } from "@/lib/passkeyCookies";
import { resolvePasskeyConfig } from "@/lib/passkeyConfig";
import { fromBase64Url } from "@/lib/passkeyBase64url";
import { prisma } from "@/lib/prisma";
import {
  verifyAuthenticationResponse,
  type VerifiedAuthenticationResponse,
} from "@simplewebauthn/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

const Body = z.object({
  response: z.object({
    id: z.string().min(1),
  }).passthrough(),
});

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const expectedChallenge = cookieStore.get(PASSKEY_LOGIN_CHALLENGE_COOKIE)?.value;
  cookieStore.set(PASSKEY_LOGIN_CHALLENGE_COOKIE, "", { ...cookieBaseOptions(), maxAge: 0 });
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

  const credential = await prisma.userPasskeyCredential.findUnique({
    where: { credentialId: parsed.data.response.id },
    include: {
      user: {
        include: {
          employee: { select: { id: true } },
        },
      },
    },
  });
  if (!credential) {
    return NextResponse.json({ error: "NO_PASSKEY" }, { status: 404 });
  }

  const { rpID, expectedOrigin } = resolvePasskeyConfig(req);

  let verification: VerifiedAuthenticationResponse;
  try {
    verification = await verifyAuthenticationResponse({
      response: parsed.data.response as unknown as Parameters<
        typeof verifyAuthenticationResponse
      >[0]["response"],
      expectedChallenge,
      expectedOrigin,
      expectedRPID: rpID,
      authenticator: {
        credentialID: fromBase64Url(credential.credentialId),
        credentialPublicKey: fromBase64Url(credential.publicKey),
        counter: credential.counter,
      },
      requireUserVerification: false,
    });
  } catch {
    return NextResponse.json({ error: "VERIFICATION_FAILED" }, { status: 400 });
  }

  if (!verification.verified) {
    return NextResponse.json({ error: "VERIFICATION_FAILED" }, { status: 400 });
  }
  if (!credential.user) {
    return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
  }

  await prisma.userPasskeyCredential.update({
    where: { id: credential.id },
    data: {
      counter: verification.authenticationInfo.newCounter,
      lastUsedAt: new Date(),
    },
  });

  const loginToken = createPasskeyLoginToken(credential.user.id);
  return NextResponse.json({ loginToken });
}

