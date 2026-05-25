import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(self), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["leaflet"],
  /**
   * dev 서버에 LAN/모바일에서 접속할 때 허용할 origin.
   * Next.js 15+에서 같은 네트워크 IP/호스트도 명시해야 _next/* 가 cross-origin 경고 없이 로드됨.
   * 필요 시 다른 IP/도메인을 추가하세요 (e.g. "192.168.1.50", "macbook.local").
   */
  allowedDevOrigins: ["192.168.0.120"],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        fs: false,
        path: false,
        crypto: false,
      };
      // @vladmandic/face-api 가 Node 전용 모듈을 동적 require 하면서 발생하는
      // "Critical dependency: require function..." 경고를 무시한다 (브라우저에서 미사용).
      config.module = config.module ?? {};
      config.module.exprContextCritical = false;
    }
    return config;
  },
  async headers() {
    const headers = [
      ...securityHeaders,
      ...(process.env.NODE_ENV === "production"
        ? ([
            {
              key: "Strict-Transport-Security",
              value: "max-age=31536000; includeSubDomains",
            },
          ] as const)
        : []),
    ];
    return [{ source: "/:path*", headers: [...headers] }];
  },
};

export default nextConfig;
