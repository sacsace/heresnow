import { PrismaClient } from "@prisma/client";
import { assertServerEnv } from "@/lib/env";

assertServerEnv();

/** schema/migration 변경 시 bump — dev global singleton 캐시 갱신용 */
const PRISMA_CLIENT_VERSION = "20260915070002_user_session_kick";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaClientVersion?: string;
};

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

function prismaClientIsStale(client: PrismaClient): boolean {
  const delegate = client as PrismaClient & {
    userSession?: unknown;
    userSessionKick?: unknown;
  };
  return delegate.userSession == null || delegate.userSessionKick == null;
}

function resolvePrismaClient(): PrismaClient {
  const cached = globalForPrisma.prisma;
  const versionMismatch =
    process.env.NODE_ENV !== "production" &&
    cached &&
    globalForPrisma.prismaClientVersion !== PRISMA_CLIENT_VERSION;
  const missingDelegates = cached != null && prismaClientIsStale(cached);

  if (versionMismatch || missingDelegates) {
    void cached?.$disconnect();
    globalForPrisma.prisma = undefined;
    globalForPrisma.prismaClientVersion = undefined;
  }

  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
    if (process.env.NODE_ENV !== "production") {
      globalForPrisma.prismaClientVersion = PRISMA_CLIENT_VERSION;
    }
  }

  return globalForPrisma.prisma;
}

/** import 시점 스냅샷 대신 매 접근마다 resolve — dev HMR·generate 후 stale delegate 방지 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = resolvePrismaClient();
    const value = Reflect.get(client as object, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
