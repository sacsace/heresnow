import { loadEnvConfig } from "@next/env";

const projectDir = process.cwd();
loadEnvConfig(projectDir);

const url = process.env.DATABASE_URL ?? "";
if (url.includes(":changeme@")) {
  console.error(
    "[db:verify] DATABASE_URL 비밀번호가 아직 \"changeme\"입니다.\n" +
      "           .env 에서 실제 PostgreSQL 사용자(postgres 등) 비밀번호로 바꾼 뒤 다시 실행하세요."
  );
}

async function main() {
  const { prisma } = await import("../lib/prisma");
  try {
    await prisma.$queryRaw`SELECT 1`;
    const users = await prisma.user.count();
    console.log(`[db:verify] 연결 성공. User 행 수: ${users}`);
    if (users === 0) {
      console.log("[db:verify] 계정이 없습니다. npm run db:seed 를 실행하세요.");
      process.exitCode = 1;
    }
  } catch (e) {
    console.error("[db:verify] 연결 실패:", e instanceof Error ? e.message : e);
    console.error("[db:verify] PostgreSQL이 실행 중인지, DB·비밀번호·포트가 맞는지 확인하세요.");
    process.exit(1);
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

void main();
