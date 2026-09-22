import { calendarDayInTz } from "@/lib/attendancePunchRules";
import { isWorkDay, parseWorkDays } from "@/lib/companyWorkSchedule";
import { resolveTodayWorkStartAt } from "@/lib/doorTerminalMode";
import {
  parseWorkScheduleType,
  resolveEmployeeWorkSchedule,
} from "@/lib/employeeWorkSchedule";
import type { Locale } from "@/lib/i18n/dictionaries";
import { prisma } from "@/lib/prisma";
import { isSubscriptionExpired } from "@/lib/subscriptionAccess";
import { checkInReminderCopy, sendWebPush } from "@/lib/webPush";
import type { CheckInReminderKind } from "@prisma/client";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

/** 출근 15분 전·후 알림 */
export const REMINDER_OFFSET_MS = 15 * 60 * 1000;
/** 5분 크론 간격 — 크론 주기와 동일한 ±5분 윈도 (한 번의 tick 에서 반드시 포착) */
export const CRON_WINDOW_MS = 5 * 60 * 1000;

function isInWindow(now: Date, target: Date, windowMs: number): boolean {
  return Math.abs(now.getTime() - target.getTime()) <= windowMs;
}

function formatWorkStartLabel(workStartAt: Date, timeZone: string, locale: Locale): string {
  const pattern = locale === "en" ? "h:mm a" : "HH:mm";
  try {
    return formatInTimeZone(workStartAt, timeZone, pattern);
  } catch {
    return formatInTimeZone(workStartAt, "UTC", pattern);
  }
}

async function hasCheckInOnWorkDate(
  employeeId: string,
  workDate: string,
  timeZone: string
): Promise<boolean> {
  const tz = timeZone.trim() || "UTC";
  let dayStart: Date;
  let dayEnd: Date;
  try {
    dayStart = fromZonedTime(`${workDate} 00:00:00`, tz);
    dayEnd = fromZonedTime(`${workDate} 23:59:59.999`, tz);
  } catch {
    dayStart = fromZonedTime(`${workDate} 00:00:00`, "UTC");
    dayEnd = fromZonedTime(`${workDate} 23:59:59.999`, "UTC");
  }

  const record = await prisma.attendanceRecord.findFirst({
    where: {
      employeeId,
      type: "CHECK_IN",
      timestamp: { gte: dayStart, lte: dayEnd },
    },
    select: { id: true },
  });
  return Boolean(record);
}

async function trySendReminder(params: {
  employeeId: string;
  workDate: string;
  kind: CheckInReminderKind;
  workStartAt: Date;
  timeZone: string;
  locale: Locale;
  subscriptions: Array<{ id: string; endpoint: string; p256dh: string; auth: string }>;
}): Promise<{ sent: boolean; removedSubscriptionIds: string[] }> {
  const { employeeId, workDate, kind, workStartAt, timeZone, locale, subscriptions } = params;
  if (subscriptions.length === 0) return { sent: false, removedSubscriptionIds: [] };

  try {
    await prisma.checkInReminderLog.create({
      data: { employeeId, workDate, reminderKind: kind },
    });
  } catch {
    return { sent: false, removedSubscriptionIds: [] };
  }

  const payload = checkInReminderCopy(kind, locale, formatWorkStartLabel(workStartAt, timeZone, locale));
  const removedSubscriptionIds: string[] = [];
  let sent = false;

  for (const sub of subscriptions) {
    const result = await sendWebPush(sub, payload);
    if (result.ok) {
      sent = true;
      continue;
    }
    if (result.gone) {
      removedSubscriptionIds.push(sub.id);
    }
  }

  if (removedSubscriptionIds.length > 0) {
    await prisma.pushSubscription.deleteMany({
      where: { id: { in: removedSubscriptionIds } },
    });
  }

  return { sent, removedSubscriptionIds };
}

export type CheckInReminderRunResult = {
  scanned: number;
  beforeSent: number;
  afterSent: number;
  skipped: number;
  staleSubscriptionsRemoved: number;
};

/** 출근 ±15분 알림 배치 (미출근·근무일·FREE 제외) */
export async function runCheckInReminders(now = new Date()): Promise<CheckInReminderRunResult> {
  const result: CheckInReminderRunResult = {
    scanned: 0,
    beforeSent: 0,
    afterSent: 0,
    skipped: 0,
    staleSubscriptionsRemoved: 0,
  };

  const rows = await prisma.pushSubscription.findMany({
    select: {
      id: true,
      endpoint: true,
      p256dh: true,
      auth: true,
      locale: true,
      user: {
        select: {
          id: true,
          role: true,
          employee: {
            select: {
              id: true,
              workScheduleType: true,
              shiftCode: true,
              workStartTime: true,
              workEndTime: true,
              workScheduleByDay: true,
              company: {
                select: {
                  subscriptionEndsAt: true,
                  timezone: true,
                  workStartTime: true,
                  workEndTime: true,
                  workDays: true,
                  workScheduleByDay: true,
                  shiftPresets: true,
                },
              },
            },
          },
        },
      },
    },
  });

  type EmployeeBucket = {
    employeeId: string;
    timeZone: string;
    workDate: string;
    workStartAt: Date;
    locale: Locale;
    subscriptions: Array<{ id: string; endpoint: string; p256dh: string; auth: string }>;
  };

  const buckets = new Map<string, EmployeeBucket>();

  for (const row of rows) {
    result.scanned += 1;
    const employee = row.user.employee;
    const company = employee?.company;
    if (!employee || !company) {
      result.skipped += 1;
      continue;
    }
    if (row.user.role === "DOOR" || row.user.role === "SUPER_ADMIN") {
      result.skipped += 1;
      continue;
    }
    if (isSubscriptionExpired(company.subscriptionEndsAt)) {
      result.skipped += 1;
      continue;
    }
    if (parseWorkScheduleType(employee.workScheduleType) === "FREE") {
      result.skipped += 1;
      continue;
    }

    const timeZone = company.timezone.trim() || "Asia/Kolkata";
    const schedule = resolveEmployeeWorkSchedule(employee, company);
    const workDays = parseWorkDays(schedule.workDays);
    if (!isWorkDay(now, timeZone, workDays)) {
      result.skipped += 1;
      continue;
    }

    const workStartAt = resolveTodayWorkStartAt(now, timeZone, schedule);
    const beforeTarget = new Date(workStartAt.getTime() - REMINDER_OFFSET_MS);
    const afterTarget = new Date(workStartAt.getTime() + REMINDER_OFFSET_MS);
    const inBefore = isInWindow(now, beforeTarget, CRON_WINDOW_MS);
    const inAfter = isInWindow(now, afterTarget, CRON_WINDOW_MS);
    if (!inBefore && !inAfter) {
      result.skipped += 1;
      continue;
    }

    const workDate = calendarDayInTz(now, timeZone);
    if (await hasCheckInOnWorkDate(employee.id, workDate, timeZone)) {
      result.skipped += 1;
      continue;
    }

    const locale: Locale = row.locale === "en" ? "en" : "ko";
    const existing = buckets.get(employee.id);
    const sub = { id: row.id, endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth };
    if (existing) {
      existing.subscriptions.push(sub);
      if (locale === "en") existing.locale = "en";
    } else {
      buckets.set(employee.id, {
        employeeId: employee.id,
        timeZone,
        workDate,
        workStartAt,
        locale,
        subscriptions: [sub],
      });
    }
  }

  for (const bucket of buckets.values()) {
    if (isInWindow(now, new Date(bucket.workStartAt.getTime() - REMINDER_OFFSET_MS), CRON_WINDOW_MS)) {
      const sendResult = await trySendReminder({
        employeeId: bucket.employeeId,
        workDate: bucket.workDate,
        kind: "BEFORE_15",
        workStartAt: bucket.workStartAt,
        timeZone: bucket.timeZone,
        locale: bucket.locale,
        subscriptions: bucket.subscriptions,
      });
      if (sendResult.sent) result.beforeSent += 1;
      result.staleSubscriptionsRemoved += sendResult.removedSubscriptionIds.length;
    }

    if (isInWindow(now, new Date(bucket.workStartAt.getTime() + REMINDER_OFFSET_MS), CRON_WINDOW_MS)) {
      const sendResult = await trySendReminder({
        employeeId: bucket.employeeId,
        workDate: bucket.workDate,
        kind: "AFTER_15",
        workStartAt: bucket.workStartAt,
        timeZone: bucket.timeZone,
        locale: bucket.locale,
        subscriptions: bucket.subscriptions,
      });
      if (sendResult.sent) result.afterSent += 1;
      result.staleSubscriptionsRemoved += sendResult.removedSubscriptionIds.length;
    }
  }

  return result;
}
