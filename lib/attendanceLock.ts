import { Prisma } from "@prisma/client";

type TxClient = Prisma.TransactionClient;

/**
 * 직원 단위 출퇴근 직렬화 잠금.
 * 같은 직원에 대한 동시 출퇴근 요청을 트랜잭션 범위에서 순차 처리한다.
 */
export async function acquireAttendanceEmployeeLock(
  tx: TxClient,
  companyId: string,
  employeeId: string
): Promise<void> {
  const lockKey = `attendance:${companyId}:${employeeId}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
}

