import { PrismaClient } from "@prisma/client";
import { assertServerEnv } from "@/lib/env";

assertServerEnv();

/** schema/migration 변경 시 bump — dev global singleton 캐시 갱신용 */
const PRISMA_CLIENT_VERSION = "20260915003000_overtime_off";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaClientVersion?: string;
};

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

function resolvePrismaClient(): PrismaClient {
  if (
    process.env.NODE_ENV !== "production" &&
    globalForPrisma.prisma &&
    globalForPrisma.prismaClientVersion !== PRISMA_CLIENT_VERSION
  ) {
    void globalForPrisma.prisma.$disconnect();
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

export const prisma = resolvePrismaClient();
