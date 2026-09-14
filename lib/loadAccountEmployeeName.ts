import { prisma } from "@/lib/prisma";

export async function loadAccountEmployeeName(
  userId: string,
  employeeId: string | null | undefined
): Promise<string | null> {
  if (employeeId) {
    const byId = await prisma.employee.findFirst({
      where: { id: employeeId },
      select: { name: true },
    });
    if (byId?.name) return byId.name;
  }

  const byUser = await prisma.employee.findUnique({
    where: { userId },
    select: { name: true },
  });
  return byUser?.name ?? null;
}
