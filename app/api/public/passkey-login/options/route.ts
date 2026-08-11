export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { PASSKEY_LOGIN_CHALLENGE_COOKIE, cookieBaseOptions } from "@/lib/passkeyCookies";
import { resolvePasskeyConfig } from "@/lib/passkeyConfig";
import { fromBase64Url } from "@/lib/passkeyBase64url";
import { prisma } from "@/lib/prisma";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

const Body = z.object({
  email: z.string().trim().max(320).optional(),
});

export async function POST(req: Request) {
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

  const { rpID } = resolvePasskeyConfig(req);
  const normalizedEmail = parsed.data.email?.trim().toLowerCase();
  let allowCredentials:
    | {
        id: Uint8Array;
        type: "public-key";
      }[]
    | undefined;

  if (normalizedEmail) {
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        passkeys: {
          select: { credentialId: true },
        },
      },
    });
    if (!user || user.passkeys.length === 0) {
      return NextResponse.json({ error: "NO_PASSKEY" }, { status: 404 });
    }
    allowCredentials = user.passkeys.map((item) => ({
      id: fromBase64Url(item.credentialId),
      type: "public-key" as const,
    }));
  }

  const options = await generateAuthenticationOptions({
    rpID,
    timeout: 60_000,
    userVerification: "preferred",
    allowCredentials,
  });

  const cookieStore = await cookies();
  cookieStore.set(PASSKEY_LOGIN_CHALLENGE_COOKIE, options.challenge, cookieBaseOptions());
  return NextResponse.json(options);
}

