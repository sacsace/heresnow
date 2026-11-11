import { PrismaClient } from "@prisma/client";
import { createCheckInFromEarlyCheckInApproval } from "../lib/earlyCheckInRequest";

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.workRequest.findMany({
    where: { type: "EARLY_CHECK_IN", status: "APPROVED" },
    select: {
      id: true,
      companyId: true,
      employeeId: true,
      workDate: true,
      reason: true,
      resolvedAt: true,
    },
  });
  console.log("approved early check-ins:", rows.length);
  for (const row of rows) {
    const result = await createCheckInFromEarlyCheckInApproval({
      companyId: row.companyId,
      employeeId: row.employeeId,
      workRequestId: row.id,
      workDate: row.workDate,
      reason: row.reason,
      timestamp: row.resolvedAt ?? new Date(),
    });
    console.log(row.id, row.workDate, result);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
