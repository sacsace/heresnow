import type { Role } from "@prisma/client";
import { identifySingleFaceMatch, parseFaceDescriptor } from "@/lib/faceMatch";
import { prisma } from "@/lib/prisma";

export function parseProbeDescriptor(raw: unknown): number[] | null {
  if (typeof raw === "string") {
    try {
      return parseFaceDescriptor(JSON.parse(raw));
    } catch {
      return null;
    }
  }
  if (Array.isArray(raw)) {
    return parseFaceDescriptor(raw);
  }
  return null;
}

export type FaceLoginUser = {
  id: string;
  email: string;
  role: Role;
  companyId: string | null;
  employeeId: string;
};

export async function matchFaceLoginUser(
  probe: number[],
  companyId: string
): Promise<FaceLoginUser | null> {
  const employees = await prisma.employee.findMany({
    where: {
      companyId,
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

  const identified = identifySingleFaceMatch(employees, probe);
  if (!identified) return null;

  const emp = identified.match;
  return {
    id: emp.user.id,
    email: emp.user.email,
    role: emp.user.role as Role,
    companyId: emp.user.companyId,
    employeeId: emp.id,
  };
}
