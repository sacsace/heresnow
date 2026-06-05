import { PrismaClient } from "@prisma/client";

const email = process.argv[2]?.toLowerCase().trim();
if (!email) {
  console.error("Usage: node scripts/delete-attendance-by-email.mjs <email>");
  process.exit(1);
}

const prisma = new PrismaClient();

try {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { employee: true },
  });

  if (!user) {
    console.log(JSON.stringify({ ok: false, error: "USER_NOT_FOUND", email }));
    process.exit(1);
  }

  if (!user.employee) {
    console.log(JSON.stringify({ ok: false, error: "NO_EMPLOYEE", email }));
    process.exit(1);
  }

  const employeeId = user.employee.id;

  const before = await prisma.attendanceRecord.count({ where: { employeeId } });

  // AttendanceException 은 attendanceId FK cascade 로 함께 삭제됨
  const deleted = await prisma.attendanceRecord.deleteMany({ where: { employeeId } });

  const after = await prisma.attendanceRecord.count({ where: { employeeId } });

  console.log(
    JSON.stringify({
      ok: true,
      email,
      employeeId,
      employeeName: user.employee.name,
      attendanceBefore: before,
      attendanceDeleted: deleted.count,
      attendanceRemaining: after,
    })
  );
} catch (e) {
  console.error(e);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
