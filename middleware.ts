import { auth } from "@/auth.edge";
import { NextResponse } from "next/server";

const CANONICAL_SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.AUTH_URL ||
  "https://www.heresnow.in"
)
  .trim()
  .replace(/\/+$/, "");

function normalizeHost(raw: string): string {
  const first = raw.split(",")[0] ?? "";
  return first.trim().toLowerCase().replace(/\.$/, "").replace(/:80$|:443$/, "");
}

function normalizeProto(raw: string): "http" | "https" | "" {
  const first = (raw.split(",")[0] ?? "").trim().toLowerCase().replace(":", "");
  if (first === "https") return "https";
  if (first === "http") return "http";
  return "";
}

function canonicalHostFromEnv(): string | null {
  if (!CANONICAL_SITE_URL) return null;
  try {
    return normalizeHost(new URL(CANONICAL_SITE_URL).host);
  } catch {
    return null;
  }
}

function canonicalProtocolFromEnv(): "http" | "https" | null {
  if (!CANONICAL_SITE_URL) return null;
  try {
    return new URL(CANONICAL_SITE_URL).protocol === "http:" ? "http" : "https";
  } catch {
    return null;
  }
}

const CANONICAL_HOST = canonicalHostFromEnv();
const CANONICAL_PROTOCOL = canonicalProtocolFromEnv();

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const loggedIn = !!req.auth;
  const role = req.auth?.user?.role;
  const hostHeader = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  const protoHeader = normalizeProto(
    req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol
  );
  const reqHost = normalizeHost(hostHeader);

  const isAuthPage = pathname.startsWith("/login");
  const isDevHealth =
    process.env.NODE_ENV === "development" && pathname === "/api/dev/health";

  const isPublicApi =
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/public") ||
    pathname.startsWith("/api/integrations/") ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/favicon.png" ||
    pathname === "/logo.png" ||
    pathname === "/apple-touch-icon.png" ||
    pathname.startsWith("/icons/") ||
    isDevHealth;

  // Railway 기본 도메인 접근 방지: 운영에서는 지정한 정식 도메인으로 강제 이동
  if (
    process.env.NODE_ENV === "production" &&
    CANONICAL_HOST &&
    !isPublicApi &&
    reqHost &&
    reqHost !== CANONICAL_HOST
  ) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.host = CANONICAL_HOST;
    // 일부 프록시 환경에서는 x-forwarded-proto가 고정값(http)으로 들어와
    // https 요청도 무한 리다이렉트될 수 있어, 프로토콜 강제는 비활성화한다.
    return NextResponse.redirect(redirectUrl, 308);
  }

  if (isPublicApi) return NextResponse.next();

  if (pathname.startsWith("/api/") && !loggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!loggedIn && pathname === "/consent") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (!loggedIn && (pathname.startsWith("/employee") || pathname.startsWith("/admin") || pathname.startsWith("/super") || pathname.startsWith("/door"))) {
    const url = new URL("/login", req.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  if (loggedIn && (isAuthPage || pathname === "/signup")) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  if (loggedIn && pathname.startsWith("/admin")) {
    const ok =
      role === "COMPANY_ADMIN" ||
      role === "HR_MANAGER" ||
      role === "APPROVER" ||
      role === "SUPER_ADMIN";
    if (!ok) return NextResponse.redirect(new URL("/employee", req.url));
  }

  if (loggedIn && pathname.startsWith("/super")) {
    if (role !== "SUPER_ADMIN") {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  if (loggedIn && role === "SUPER_ADMIN" && pathname.startsWith("/admin")) {
    return NextResponse.redirect(new URL("/super", req.url));
  }

  if (loggedIn && pathname.startsWith("/door")) {
    if (role !== "DOOR") {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  if (loggedIn && pathname.startsWith("/employee")) {
    if (role === "DOOR") {
      return NextResponse.redirect(new URL("/door", req.url));
    }
    if (role === "SUPER_ADMIN") {
      return NextResponse.redirect(new URL("/super", req.url));
    }
    if (
      role !== "EMPLOYEE" &&
      role !== "COMPANY_ADMIN" &&
      role !== "HR_MANAGER" &&
      role !== "APPROVER"
    ) {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
