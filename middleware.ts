import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const loggedIn = !!req.auth;
  const role = req.auth?.user?.role;

  const isAuthPage = pathname.startsWith("/login");
  const isPublicApi =
    pathname.startsWith("/api/auth") ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/icons/icon-192.png";

  if (isPublicApi) return NextResponse.next();

  if (!loggedIn && pathname === "/consent") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (!loggedIn && (pathname.startsWith("/employee") || pathname.startsWith("/admin") || pathname.startsWith("/super"))) {
    const url = new URL("/login", req.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  if (loggedIn && isAuthPage) {
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

  if (loggedIn && pathname.startsWith("/employee")) {
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
