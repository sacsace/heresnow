export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import {
  isLikelyGoogleMapsUrl,
  parseGoogleMapsCoords,
} from "@/lib/parseGoogleMapsUrl";
import { NextResponse } from "next/server";
import { z } from "zod";

const adminRoles = new Set(["COMPANY_ADMIN", "HR_MANAGER", "APPROVER", "SUPER_ADMIN"]);
const editRoles = new Set(["COMPANY_ADMIN", "HR_MANAGER", "SUPER_ADMIN"]);

const bodySchema = z.object({
  url: z.string().trim().min(8).max(2000),
});

async function resolveFinalUrl(startUrl: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(startUrl, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; HeresNow/1.0; +https://www.heresnow.in)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    const finalUrl = res.url || startUrl;
    const fromUrl = parseGoogleMapsCoords(finalUrl);
    if (fromUrl) return finalUrl;

    // 일부 단축 링크는 Location에만 좌표가 있고 body는 별도일 수 있음 → HTML에서도 시도
    const html = await res.text().catch(() => "");
    if (html && parseGoogleMapsCoords(html)) {
      return html.slice(0, 500_000);
    }
    return finalUrl;
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(req: Request) {
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || !role || !adminRoles.has(role) || !editRoles.has(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  let url = parsed.data.url.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  if (!isLikelyGoogleMapsUrl(url)) {
    return NextResponse.json(
      { error: "Not a Google Maps link" },
      { status: 400 }
    );
  }

  const direct = parseGoogleMapsCoords(url);
  if (direct) {
    return NextResponse.json({ latitude: direct.lat, longitude: direct.lng });
  }

  try {
    const resolved = await resolveFinalUrl(url);
    const coords = parseGoogleMapsCoords(resolved);
    if (!coords) {
      return NextResponse.json(
        { error: "Could not extract coordinates" },
        { status: 422 }
      );
    }
    return NextResponse.json({
      latitude: coords.lat,
      longitude: coords.lng,
    });
  } catch {
    return NextResponse.json(
      { error: "Could not resolve maps link" },
      { status: 502 }
    );
  }
}
