import type { Role } from "@prisma/client";
import { identifySingleFaceMatch, parseFaceDescriptor } from "@/lib/faceMatch";
import { prisma } from "@/lib/prisma";

function parseProbeDescriptor(raw: unknown): number[] | null {
  if (typeof raw === "string") {
    try {
      return parseFaceDescriptor(JSON.parse(raw));
    } catch {
      return null;
    }
  }
  return parseFaceDescriptor(raw);
}

export async function authorizeFaceLogin(
  credentials: Partial<Record<"descriptor", unknown>>
) {
  const probe = parseProbeDescriptor(credentials?.descriptor);
  if (!probe) return null;

  let employees;
  try {
    employees = await prisma.employee.findMany({
      where: {
        faceEnrolledAt: { not: null },
        company: { faceRecognitionEnabled: true },
      },
      select: {
        id: true,
        faceDescriptor: true,
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            companyId: true,
          },
        },
      },
    });
  } catch (e) {
    console.error("[auth] DB 연결 실패 — .env 의 DATABASE_URL(비밀번호·호스트)을 확인하세요.", e);
    return null;
  }

  const identified = identifySingleFaceMatch(employees, probe);
  if (!identified) return null;

  const { match: emp } = identified;
  return {
    id: emp.user.id,
    email: emp.user.email,
    role: emp.user.role as Role,
    companyId: emp.user.companyId,
    employeeId: emp.id,
  };
}
