import type { NextConfig } from "next";

function buildContentSecurityPolicy(): string {
  const isProd = process.env.NODE_ENV === "production";
  // Hotfix: Next.js runtime uses inline chunks on production pages.
  // Keep inline enabled by default until nonce-based CSP is fully wired.
  const allowUnsafeInline = !isProd || process.env.CSP_ALLOW_UNSAFE_INLINE !== "false";
  const scriptSrc = [
    "'self'",
    ...(allowUnsafeInline ? ["'unsafe-inline'"] : []),
    ...(!isProd ? ["'unsafe-eval'"] : []),
    "https://maps.googleapis.com",
    "https://www.googletagmanager.com",
  ].join(" ");
  const styleSrc = [
    "'self'",
    ...(allowUnsafeInline ? ["'unsafe-inline'"] : []),
    "https://fonts.googleapis.com",
  ].join(" ");

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "object-src 'none'",
    `script-src ${scriptSrc}`,
    `style-src ${styleSrc}`,
    "img-src 'self' data: blob: https://maps.googleapis.com https://maps.gstatic.com https://*.googleapis.com https://*.gstatic.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https://maps.googleapis.com https://*.googleapis.com https://*.gstatic.com https://vitals.vercel-insights.com",
    "worker-src 'self' blob:",
    "media-src 'self' blob:",
    "frame-src 'self' https://www.google.com https://maps.google.com https://www.google.com/maps",
  ];
  if (process.env.NODE_ENV === "production") {
    directives.push("upgrade-insecure-requests");
  }
  return directives.join("; ");
}

const securityHeaders = [
  { key: "Content-Security-Policy", value: buildContentSecurityPolicy() },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-site" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Origin-Agent-Cluster", value: "?1" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(self), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["leaflet"],
  serverExternalPackages: ["pdfkit"],
  /**
   * dev 서버에 LAN/모바일에서 접속할 때 허용할 origin.
   * Next.js 15+에서 같은 네트워크 IP/호스트도 명시해야 _next/* 가 cross-origin 경고 없이 로드됨.
   * 필요 시 다른 IP/도메인을 추가하세요 (e.g. "192.168.1.50", "macbook.local").
   */
  allowedDevOrigins: ["192.168.0.120"],
  webpack: (config, { isServer, dev }) => {
    // Windows dev: HMR can corrupt webpack module cache (.next) — disable in dev.
    if (dev) {
      config.cache = false;
    }
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        fs: false,
        path: false,
        crypto: false,
      };
      // @vladmandic/face-api 의 내부 동적 require 경고는 라이브러리 고유 동작이며
      // 브라우저 경로에서만 사용되므로 노이즈 로그를 필터링한다.
      config.module = config.module ?? {};
      config.module.exprContextCritical = false;
    }
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      (warning: unknown) => {
        const isObj = (v: unknown): v is Record<string, unknown> =>
          typeof v === "object" && v !== null;
        const asText = (v: unknown): string =>
          typeof v === "string" ? v : v == null ? "" : String(v);

        const message =
          typeof warning === "string"
            ? warning
            : isObj(warning) && "message" in warning
              ? asText(warning.message)
              : "";

        const details =
          isObj(warning) && "details" in warning ? asText(warning.details) : "";
        const stack = isObj(warning) && "stack" in warning ? asText(warning.stack) : "";
        const moduleName =
          isObj(warning) && "module" in warning ? asText(warning.module) : "";
        const moduleResource =
          isObj(warning) &&
          "module" in warning &&
          isObj(warning.module) &&
          "resource" in warning.module
            ? asText(warning.module.resource)
            : "";
        const combined = `${message}\n${details}\n${stack}\n${moduleName}\n${moduleResource}`;
        return (
          message.includes("Critical dependency: require function is used in a way") &&
          combined.includes("@vladmandic/face-api")
        );
      },
    ];
    return config;
  },
  async headers() {
    const headers = [
      ...securityHeaders,
      ...(process.env.NODE_ENV === "production"
        ? ([
            {
              key: "Strict-Transport-Security",
              value: "max-age=63072000; includeSubDomains; preload",
            },
          ] as const)
        : []),
    ];
    return [
      { source: "/:path*", headers: [...headers] },
      {
        source: "/models/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/tfjs-wasm/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
