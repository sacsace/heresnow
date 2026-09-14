import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRaw`
    SELECT e.enumlabel AS label
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'OvertimeMode'
    ORDER BY e.enumsortorder
  `;
  const labels = rows.map((r) => r.label);
  console.log("OvertimeMode values:", labels.join(", "));

  if (!labels.includes("OFF")) {
    console.log("Adding OFF to OvertimeMode enum…");
    await prisma.$executeRawUnsafe(`ALTER TYPE "OvertimeMode" ADD VALUE 'OFF'`);
    console.log("Done.");
  } else {
    console.log("OFF already present.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
