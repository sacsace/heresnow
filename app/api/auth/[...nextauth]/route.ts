export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AuthRouteCtx = { params: Promise<{ nextauth: string[] }> };

async function loadHandlers() {
  const { handlers } = await import("@/auth");
  return handlers;
}

export async function GET(req: Request, ctx: AuthRouteCtx) {
  return (await loadHandlers()).GET(req, ctx);
}

export async function POST(req: Request, ctx: AuthRouteCtx) {
  return (await loadHandlers()).POST(req, ctx);
}
