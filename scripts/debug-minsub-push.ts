import { PrismaClient } from "@prisma/client";
import { calendarDayInTz } from "@/lib/attendancePunchRules";
import { resolveEmployeeWorkSchedule } from "@/lib/employeeWorkSchedule";
import { workStartTimeForWeekday } from "@/lib/companyWorkSchedule";
import { localWeekday } from "@/lib/companyWorkSchedule";
import { resolveTodayWorkStartAt } from "@/lib/doorTerminalMode";
import { CRON_WINDOW_MS, REMINDER_OFFSET_MS } from "@/lib/checkInReminders";
import { fromZonedTime } from "date-fns-tz";

const p = new PrismaClient();

async function main() {
  const email = process.argv[2] ?? "minsub.lee@gmail.com";
  const emp = await p.employee.findFirst({
    where: { user: { email } },
    include: {
      user: { select: { id: true, email: true } },
      company: true,
    },
  });
  if (!emp?.company) {
    console.log("employee not found");
    return;
  }
  const tz = emp.company.timezone?.trim() || "Asia/Kolkata";
  const schedule = resolveEmployeeWorkSchedule(emp, emp.company);
  const now = fromZonedTime("2026-09-23 01:44:00", tz);
  const wd = localWeekday(now, tz);
  const startStr = workStartTimeForWeekday(wd, schedule);
  const workStartAt = resolveTodayWorkStartAt(now, tz, schedule);
  const beforeTarget = new Date(workStartAt.getTime() - REMINDER_OFFSET_MS);
  const inBefore = Math.abs(now.getTime() - beforeTarget.getTime()) <= CRON_WINDOW_MS;
  const workDate = calendarDayInTz(now, tz);
  const subs = await p.pushSubscription.count({ where: { userId: emp.userId } });
  const log = await p.checkInReminderLog.findUnique({
    where: {
      employeeId_workDate_reminderKind: {
        employeeId: emp.id,
        workDate,
        reminderKind: "BEFORE_15",
      },
    },
  });
  console.log({
    email,
    workScheduleType: emp.workScheduleType,
    tz,
    weekday: wd,
    startStr,
    workDate,
    now: now.toISOString(),
    workStartAt: workStartAt.toISOString(),
    beforeTarget: beforeTarget.toISOString(),
    inBeforeWindow: inBefore,
    pushSubscriptions: subs,
    before15AlreadySent: Boolean(log),
    logSentAt: log?.sentAt?.toISOString() ?? null,
  });
}

main()
  .catch(console.error)
  .finally(() => p.$disconnect());
