import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const defaultPasswordHash = await bcrypt.hash("demo1234", 10);
  const adminPasswordHash = await bcrypt.hash("admin123", 10);

  await prisma.approvalLog.deleteMany();
  await prisma.attendanceException.deleteMany();
  await prisma.attendanceRecord.deleteMany();
  await prisma.site.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();

  const acme = await prisma.company.create({
    data: { name: "ACME 현장시스템", timezone: "Asia/Seoul" },
  });
  const globex = await prisma.company.create({
    data: { name: "Globex 로지스틱스", timezone: "Asia/Seoul" },
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
      email: "lee@msventures.in",
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

  const siteOffice = await prisma.site.create({
    data: {
      companyId: acme.id,
      name: "본사 사무실",
      latitude: 37.5665,
      longitude: 126.978,
      allowedRadius: 120,
      expectedCheckIn: "09:00",
      expectedCheckOut: "18:00",
    },
  });
  const siteField = await prisma.site.create({
    data: {
      companyId: acme.id,
      name: "판교 A현장 (출장)",
      latitude: 37.3947,
      longitude: 127.1112,
      allowedRadius: 100,
      expectedCheckIn: "08:30",
      expectedCheckOut: "17:30",
    },
  });

  await prisma.site.create({
    data: {
      companyId: globex.id,
      name: "Globex 창고",
      latitude: 35.1796,
      longitude: 129.0756,
      allowedRadius: 80,
      expectedCheckIn: "09:00",
      expectedCheckOut: "18:00",
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

  await prisma.attendanceRecord.create({
    data: {
      companyId: acme.id,
      employeeId: emp.id,
      siteId: siteOffice.id,
      type: "CHECK_IN",
      latitude: 37.56652,
      longitude: 126.9781,
      accuracy: 12,
      distanceFromSite: 25,
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
      siteId: siteField.id,
      type: "CHECK_OUT",
      latitude: 37.3948,
      longitude: 127.111,
      accuracy: 15,
      distanceFromSite: 40,
      status: "APPROVED",
      memo: "현장 퇴근",
      isLate: false,
      isEarlyLeave: false,
    },
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

  console.log("Seed OK. 관리자 lee@msventures.in / admin123 · 기타 demo1234 (super@herenow.local, employee@acme.local 등)");
  console.log("동의 미완료 테스트: newhire@globex.local / demo1234");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
