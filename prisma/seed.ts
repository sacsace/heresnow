import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { addYears } from "../lib/pricing";

const prisma = new PrismaClient();

async function upsertTier(
  minSeats: number,
  maxSeats: number,
  pricePerYear: number,
  label: string,
  sortOrder: number,
  trialDays: number | null = null
) {
  return prisma.pricingTier.upsert({
    where: { minSeats_maxSeats: { minSeats, maxSeats } },
    create: { minSeats, maxSeats, pricePerYear, label, sortOrder, currency: "INR", trialDays },
    update: { pricePerYear, label, sortOrder, currency: "INR", trialDays },
  });
}

async function main() {
  const defaultPasswordHash = await bcrypt.hash("demo1234", 10);
  const adminPasswordHash = await bcrypt.hash("admin123", 10);

  await prisma.billingRequest.deleteMany();
  await prisma.approvalLog.deleteMany();
  await prisma.attendanceException.deleteMany();
  await prisma.attendanceRecord.deleteMany();
  await prisma.site.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();

  await upsertTier(1, 1, 0, "1명 · 7일 무료", 0, 7);
  const t1 = await upsertTier(1, 20, 1500, "1–20명", 1, null);
  const t2 = await upsertTier(21, 50, 2000, "21–50명", 2, null);
  const t3 = await upsertTier(51, 80, 2500, "51–80명", 3, null);
  const t4 = await upsertTier(81, 100, 3000, "81–100명", 4, null);

  const subsEnd = addYears(new Date(), 1);

  const acme = await prisma.company.create({
    data: {
      name: "ACME 현장시스템",
      timezone: "Asia/Seoul",
      pricingTierId: t1.id,
      seatLimit: t1.maxSeats,
      subscriptionEndsAt: subsEnd,
    },
  });
  const globex = await prisma.company.create({
    data: {
      name: "Globex 로지스틱스",
      timezone: "Asia/Seoul",
      pricingTierId: t1.id,
      seatLimit: t1.maxSeats,
      subscriptionEndsAt: subsEnd,
    },
  });

  await prisma.user.create({
    data: {
      email: "lee@msventures.in",
      passwordHash: adminPasswordHash,
      role: Role.SUPER_ADMIN,
      companyId: null,
      consentGivenAt: new Date(),
      consentVersion: "2026-04-01",
    },
  });

  await prisma.user.create({
    data: {
      email: "super@herenow.local",
      passwordHash: defaultPasswordHash,
      role: Role.SUPER_ADMIN,
      companyId: null,
      consentGivenAt: new Date(),
      consentVersion: "2026-04-01",
    },
  });

  const acmeAdmin = await prisma.user.create({
    data: {
      companyId: acme.id,
      email: "admin@acme.local",
      passwordHash: adminPasswordHash,
      role: Role.COMPANY_ADMIN,
      consentGivenAt: new Date(),
      consentVersion: "2026-04-01",
    },
  });
  await prisma.employee.create({
    data: {
      companyId: acme.id,
      userId: acmeAdmin.id,
      name: "김관리",
    },
  });

  const hrUser = await prisma.user.create({
    data: {
      companyId: acme.id,
      email: "hr@acme.local",
      passwordHash: defaultPasswordHash,
      role: Role.HR_MANAGER,
      consentGivenAt: new Date(),
      consentVersion: "2026-04-01",
    },
  });
  await prisma.employee.create({
    data: { companyId: acme.id, userId: hrUser.id, name: "이근태" },
  });

  const approver = await prisma.user.create({
    data: {
      companyId: acme.id,
      email: "approver@acme.local",
      passwordHash: defaultPasswordHash,
      role: Role.APPROVER,
      consentGivenAt: new Date(),
      consentVersion: "2026-04-01",
    },
  });
  await prisma.employee.create({
    data: { companyId: acme.id, userId: approver.id, name: "박승인" },
  });

  const empUser = await prisma.user.create({
    data: {
      companyId: acme.id,
      email: "employee@acme.local",
      passwordHash: defaultPasswordHash,
      role: Role.EMPLOYEE,
      consentGivenAt: new Date(),
      consentVersion: "2026-04-01",
    },
  });
  const emp = await prisma.employee.create({
    data: { companyId: acme.id, userId: empUser.id, name: "최현장" },
  });

  await prisma.attendanceRecord.create({
    data: {
      companyId: acme.id,
      employeeId: emp.id,
      siteId: null,
      type: "CHECK_IN",
      latitude: 37.56652,
      longitude: 126.9781,
      accuracy: 12,
      distanceFromSite: 0,
      status: "APPROVED",
      memo: "시드 데이터",
      isLate: false,
      isEarlyLeave: false,
    },
  });
  await prisma.attendanceRecord.create({
    data: {
      companyId: acme.id,
      employeeId: emp.id,
      siteId: null,
      type: "CHECK_OUT",
      latitude: 37.3948,
      longitude: 127.111,
      accuracy: 15,
      distanceFromSite: 0,
      status: "APPROVED",
      memo: "퇴근",
      isLate: false,
      isEarlyLeave: false,
    },
  });

  const globexEmpUser = await prisma.user.create({
    data: {
      companyId: globex.id,
      email: "worker@globex.local",
      passwordHash: defaultPasswordHash,
      role: Role.EMPLOYEE,
      consentGivenAt: new Date(),
      consentVersion: "2026-04-01",
    },
  });
  await prisma.employee.create({
    data: { companyId: globex.id, userId: globexEmpUser.id, name: "다른회사직원" },
  });

  const newHireUser = await prisma.user.create({
    data: {
      companyId: globex.id,
      email: "newhire@globex.local",
      passwordHash: defaultPasswordHash,
      role: Role.EMPLOYEE,
      consentGivenAt: null,
      consentVersion: null,
    },
  });
  await prisma.employee.create({
    data: { companyId: globex.id, userId: newHireUser.id, name: "신규(동의대기)" },
  });

  console.log(
    "Seed OK. 슈퍼(요금 수정): lee@msventures.in / admin123 · ACME 관리자: admin@acme.local / admin123 · 직원 demo1234"
  );
  console.log("동의 미완료 테스트: newhire@globex.local / demo1234");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
