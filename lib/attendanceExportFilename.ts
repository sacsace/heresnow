import { getAttendanceExportLabels } from "@/lib/attendanceExportI18n";
import { DEFAULT_COMPANY_TIMEZONE } from "@/lib/companyTimezones";
import type { Locale } from "@/lib/i18n/dictionaries";
import { formatInTimeZone } from "date-fns-tz";

/** 파일명용 회사명 — "Private Limited" 등 제거 */
export function companyNameForExportFilename(name: string): string {
  const cleaned = name
    .replace(/\bprivate\s+limited\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,.-]+|[\s,.-]+$/g, "")
    .trim();
  return cleaned || name.trim() || "Company";
}

/** yyyymmdd_근태 목록 (회사명).xlsx — locale에 따라 목록 라벨 변경 */
export function attendanceExportFilename(
  companyName: string,
  timeZone?: string | null,
  locale: Locale = "ko"
): string {
  const tz = timeZone?.trim() || DEFAULT_COMPANY_TIMEZONE;
  const ymd = formatInTimeZone(new Date(), tz, "yyyyMMdd");
  const company = companyNameForExportFilename(companyName);
  const listLabel = getAttendanceExportLabels(locale).fileListLabel;
  const base = `${ymd}_${listLabel} (${company}).xlsx`;
  return base.replace(/[\\/:*?"<>|]/g, "_");
}

export function contentDispositionAttachment(filename: string): string {
  const asciiFallback = filename.replace(/[^\x20-\x7E]/g, "_");
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
