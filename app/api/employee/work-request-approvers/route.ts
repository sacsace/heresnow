export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { listWorkRequestApproverOptions } from "@/lib/workRequestApprovers";
import { subscriptionPunchForbiddenResponse } from "@/lib/requireActiveSubscriptionApi";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  const subscriptionDenied = await subscriptionPunchForbiddenResponse(session?.user?.companyId);
  if (subscriptionDenied) return subscriptionDenied;
  if (!session?.user?.companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const approvers = await listWorkRequestApproverOptions(
    session.user.companyId,
    session.user.id
  );

  return NextResponse.json({ approvers });
}
