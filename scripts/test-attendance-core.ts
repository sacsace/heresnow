import assert from "node:assert/strict";
import {
  FOUR_H_MS,
  MIN_PUNCH_GAP_MS,
  capCheckOutTimestamp,
  evaluatePunchEligibility,
  resolveLateCheckOutTimestamp,
} from "@/lib/attendancePunchRules";
import {
  resolveDoorPunchTimeWindow,
  resolveDoorTerminalMode,
} from "@/lib/doorTerminalMode";
import { fromZonedTime } from "date-fns-tz";

const TZ = "Asia/Kolkata";

function zdt(localDateTime: string, tz = TZ): Date {
  return fromZonedTime(localDateTime, tz);
}

function isoMinute(d: Date): string {
  return d.toISOString().slice(0, 16);
}

function run(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

const companySchedule = {
  workStartTime: "09:00",
  workEndTime: "18:00",
  workDays: "1,2,3,4,5",
  workScheduleByDay: null,
};

run("1) no record allows check-in", () => {
  const now = zdt("2026-08-10 09:00:00");
  const r = evaluatePunchEligibility(now, TZ, null);
  assert.equal(r.canCheckIn, true);
  assert.equal(r.canCheckOut, false);
});

run("2) no record blocks check-out", () => {
  const now = zdt("2026-08-10 09:00:00");
  const r = evaluatePunchEligibility(now, TZ, null);
  assert.equal(r.checkOutBlock, "NOT_CHECKED_IN");
});

run("3) check-in then check-in is blocked", () => {
  const checkInAt = zdt("2026-08-10 09:00:00");
  const now = zdt("2026-08-10 09:10:00");
  const r = evaluatePunchEligibility(now, TZ, { type: "CHECK_IN", timestamp: checkInAt });
  assert.equal(r.canCheckIn, false);
  assert.equal(r.checkInBlock, "ALREADY_CHECKED_IN");
});

run("4) check-in then check-out succeeds after 3 minutes", () => {
  const checkInAt = zdt("2026-08-10 09:00:00");
  const now = new Date(checkInAt.getTime() + MIN_PUNCH_GAP_MS);
  const r = evaluatePunchEligibility(now, TZ, { type: "CHECK_IN", timestamp: checkInAt });
  assert.equal(r.canCheckOut, true);
});

run("5) check-out then check-out is blocked", () => {
  const outAt = zdt("2026-08-10 18:00:00");
  const now = zdt("2026-08-10 18:10:00");
  const r = evaluatePunchEligibility(now, TZ, { type: "CHECK_OUT", timestamp: outAt });
  assert.equal(r.canCheckOut, false);
  assert.equal(r.checkOutBlock, "NOT_CHECKED_IN");
});

run("6) cooldown blocks re-check-in within 4 hours", () => {
  const outAt = zdt("2026-08-10 18:00:00");
  const now = new Date(outAt.getTime() + 3 * 60 * 60 * 1000);
  const r = evaluatePunchEligibility(now, TZ, { type: "CHECK_OUT", timestamp: outAt });
  assert.equal(r.canCheckIn, false);
  assert.equal(r.checkInBlock, "COOLDOWN");
});

run("7) re-check-in allowed exactly at 4 hours", () => {
  const outAt = zdt("2026-08-10 18:00:00");
  const now = new Date(outAt.getTime() + FOUR_H_MS);
  const r = evaluatePunchEligibility(now, TZ, { type: "CHECK_OUT", timestamp: outAt });
  assert.equal(r.canCheckIn, true);
});

run("8) re-check-in allowed after 5 hours", () => {
  const outAt = zdt("2026-08-10 18:00:00");
  const now = new Date(outAt.getTime() + 5 * 60 * 60 * 1000);
  const r = evaluatePunchEligibility(now, TZ, { type: "CHECK_OUT", timestamp: outAt });
  assert.equal(r.canCheckIn, true);
});

run("9) midnight exception allows check-in before 4 hours", () => {
  const outAt = zdt("2026-08-10 23:00:00");
  const now = zdt("2026-08-11 00:30:00");
  const r = evaluatePunchEligibility(now, TZ, { type: "CHECK_OUT", timestamp: outAt });
  assert.equal(r.canCheckIn, true);
});

run("10) timezone-based day boundary is respected", () => {
  const ny = "America/New_York";
  const outAt = zdt("2026-08-10 23:00:00", ny);
  const now = zdt("2026-08-11 00:30:00", ny);
  const r = evaluatePunchEligibility(now, ny, { type: "CHECK_OUT", timestamp: outAt });
  assert.equal(r.canCheckIn, true);
});

run("11) check-out blocked at +1 minute", () => {
  const inAt = zdt("2026-08-10 09:00:00");
  const now = new Date(inAt.getTime() + 60_000);
  const r = evaluatePunchEligibility(now, TZ, { type: "CHECK_IN", timestamp: inAt });
  assert.equal(r.canCheckOut, false);
  assert.equal(r.checkOutBlock, "MIN_INTERVAL");
});

run("12) check-out blocked at +2m59s", () => {
  const inAt = zdt("2026-08-10 09:00:00");
  const now = new Date(inAt.getTime() + (2 * 60 + 59) * 1000);
  const r = evaluatePunchEligibility(now, TZ, { type: "CHECK_IN", timestamp: inAt });
  assert.equal(r.canCheckOut, false);
});

run("13) check-out allowed at +3 minutes", () => {
  const inAt = zdt("2026-08-10 09:00:00");
  const now = new Date(inAt.getTime() + MIN_PUNCH_GAP_MS);
  const r = evaluatePunchEligibility(now, TZ, { type: "CHECK_IN", timestamp: inAt });
  assert.equal(r.canCheckOut, true);
});

run("14) 20h work is not capped", () => {
  const inAt = zdt("2026-08-10 08:00:00");
  const outAt = zdt("2026-08-11 04:00:00");
  const capped = capCheckOutTimestamp(inAt, outAt);
  assert.equal(capped.capped, false);
  assert.equal(isoMinute(capped.timestamp), isoMinute(outAt));
});

run("15) 21h work is not capped", () => {
  const inAt = zdt("2026-08-10 08:00:00");
  const outAt = zdt("2026-08-11 05:00:00");
  const capped = capCheckOutTimestamp(inAt, outAt);
  assert.equal(capped.capped, false);
  assert.equal(isoMinute(capped.timestamp), isoMinute(outAt));
});

run("16) 24h work is capped at 21h", () => {
  const inAt = zdt("2026-08-10 08:00:00");
  const outAt = zdt("2026-08-11 08:00:00");
  const capped = capCheckOutTimestamp(inAt, outAt);
  assert.equal(capped.capped, true);
  const expected = zdt("2026-08-11 05:00:00");
  assert.equal(isoMinute(capped.timestamp), isoMinute(expected));
});

run("17) stale 48h check-out correction uses earlier of +21h and 23:59", () => {
  const inAt = zdt("2026-08-01 09:00:00");
  const corrected = resolveLateCheckOutTimestamp(inAt, TZ);
  const expected = zdt("2026-08-01 23:59:59");
  assert.equal(isoMinute(corrected.timestamp), isoMinute(expected));
  assert.equal(corrected.basis, "END_OF_DAY");
});

run("19-22) door terminal mode switch timeline", () => {
  const before = resolveDoorTerminalMode(zdt("2026-08-10 17:29:00"), TZ, companySchedule);
  const at = resolveDoorTerminalMode(zdt("2026-08-10 17:30:00"), TZ, companySchedule);
  const late = resolveDoorTerminalMode(zdt("2026-08-10 23:59:00"), TZ, companySchedule);
  const nextDay = resolveDoorTerminalMode(zdt("2026-08-11 00:00:00"), TZ, companySchedule);
  assert.equal(before.mode, "CHECK_IN");
  assert.equal(at.mode, "CHECK_OUT");
  assert.equal(late.mode, "CHECK_OUT");
  assert.equal(nextDay.mode, "CHECK_IN");
});

run("24-27) door time window gate", () => {
  const window = resolveDoorPunchTimeWindow(zdt("2026-08-10 12:00:00"), TZ, companySchedule);
  assert.equal(isoMinute(new Date(window.checkInOpenAt)), isoMinute(zdt("2026-08-10 07:30:00")));
  assert.equal(isoMinute(new Date(window.checkOutOpenAt)), isoMinute(zdt("2026-08-10 18:00:00")));
  assert.equal(zdt("2026-08-10 07:29:00").getTime() < new Date(window.checkInOpenAt).getTime(), true);
  assert.equal(zdt("2026-08-10 17:50:00").getTime() < new Date(window.checkOutOpenAt).getTime(), true);
  assert.equal(zdt("2026-08-10 18:00:00").getTime() >= new Date(window.checkOutOpenAt).getTime(), true);
});

console.log("All attendance core tests passed.");

