import { auth } from "@/auth";
import { PASSKEY_REGISTER_CHALLENGE_COOKIE, cookieBaseOptions } from "@/lib/passkeyCookies";
import { resolvePasskeyConfig } from "@/lib/passkeyConfig";
import { fromBase64Url } from "@/lib/passkeyBase64url";
import { prisma } from "@/lib/prisma";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { rpID, rpName } = resolvePasskeyConfig(req);
  const existing = await prisma.userPasskeyCredential.findMany({
    where: { userId: session.user.id },
    select: { credentialId: true, transports: true },
  });

  const options = await generateRegistrationOptions({
    rpID,
    rpName,
    userName: session.user.email,
    userDisplayName: session.user.email,
    userID: session.user.id,
    timeout: 60_000,
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "preferred",
      authenticatorAttachment: "platform",
    },
    excludeCredentials: existing.map((item) => ({
      id: fromBase64Url(item.credentialId),
      type: "public-key",
    })),
  });

  const cookieStore = await cookies();
  cookieStore.set(PASSKEY_REGISTER_CHALLENGE_COOKIE, options.challenge, cookieBaseOptions());
  return NextResponse.json(options);
}

