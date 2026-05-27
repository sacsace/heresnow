import type { Locale } from "@/lib/i18n/dictionaries";
import {
  ATTENDANCE_EXPORT_HALF_DAY,
  ATTENDANCE_EXPORT_LATE,
  ATTENDANCE_EXPORT_PRESENT,
} from "@/lib/attendanceExportMatrix";

export function parseExportLocale(v: string | null | undefined): Locale {
  return v === "en" ? "en" : "ko";
}

export type LegendRow = {
  symbol: string;
  meaning: string;
  fillArgb: string;
  fontArgb: string;
  bold?: boolean;
};

export type AttendanceExportLabels = {
  locale: Locale;
  fontName: string;
  sheetName: string;
  fileListLabel: string;
  nameCol: string;
  summaryHeaders: [string, string, string, string];
  legendTitle: string;
  legendColSymbol: string;
  legendColMeaning: string;
  legendRows: LegendRow[];
};

export const EXPORT_COLORS = {
  presentFill: "FFE8F5E9",
  presentFont: "FF1B5E20",
  lateFill: "FFFFF8E1",
  lateFont: "FFE65100",
  halfFill: "FFE3F2FD",
  halfFont: "FF1565C0",
  absentFill: "FFFFEBEE",
  absentFont: "FFC62828",
  legendTitleFill: "FFECEFF1",
  legendHeaderFill: "FF455A64",
  legendHeaderFont: "FFFFFFFF",
  dataHeaderFill: "FF263238",
  dataHeaderFont: "FFFFFFFF",
  summaryHeaderFill: "FF546E7A",
  summaryHeaderFont: "FFFFFFFF",
  border: "FFB0BEC5",
  noteFill: "FFF5F5F5",
  noteFont: "FF546E7A",
} as const;

export function getAttendanceExportLabels(locale: Locale): AttendanceExportLabels {
  if (locale === "en") {
    return {
      locale: "en",
      fontName: "Calibri",
      sheetName: "Attendance",
      fileListLabel: "Attendance List",
      nameCol: "Name",
      summaryHeaders: ["OT", "Absent days", "Work days", "Holiday work days"],
      legendTitle: "Calendar cell legend",
      legendColSymbol: "Symbol",
      legendColMeaning: "Meaning",
      legendRows: [
        {
          symbol: ATTENDANCE_EXPORT_PRESENT,
          meaning: "On time",
          fillArgb: EXPORT_COLORS.presentFill,
          fontArgb: EXPORT_COLORS.presentFont,
          bold: true,
        },
        {
          symbol: ATTENDANCE_EXPORT_LATE,
          meaning: "Late (checked in)",
          fillArgb: EXPORT_COLORS.lateFill,
          fontArgb: EXPORT_COLORS.lateFont,
          bold: true,
        },
        {
          symbol: ATTENDANCE_EXPORT_HALF_DAY,
          meaning: "Early leave (half day)",
          fillArgb: EXPORT_COLORS.halfFill,
          fontArgb: EXPORT_COLORS.halfFont,
          bold: true,
        },
        {
          symbol: "(blank)",
          meaning: "Absent",
          fillArgb: EXPORT_COLORS.absentFill,
          fontArgb: EXPORT_COLORS.absentFont,
        },
      ],
    };
  }

  return {
    locale: "ko",
    fontName: "맑은 고딕",
    sheetName: "근태",
    fileListLabel: "근태 목록",
    nameCol: "이름",
    summaryHeaders: ["OT", "결근일수", "근무일수", "휴일 근무일수"],
    legendTitle: "달력 셀 표기",
    legendColSymbol: "표기",
    legendColMeaning: "의미",
    legendRows: [
      {
        symbol: ATTENDANCE_EXPORT_PRESENT,
        meaning: "정상 출근",
        fillArgb: EXPORT_COLORS.presentFill,
        fontArgb: EXPORT_COLORS.presentFont,
        bold: true,
      },
      {
        symbol: ATTENDANCE_EXPORT_LATE,
        meaning: "지각 (출근은 했으나 지각)",
        fillArgb: EXPORT_COLORS.lateFill,
        fontArgb: EXPORT_COLORS.lateFont,
        bold: true,
      },
      {
        symbol: ATTENDANCE_EXPORT_HALF_DAY,
        meaning: "조퇴 (반차·반나절 근무)",
        fillArgb: EXPORT_COLORS.halfFill,
        fontArgb: EXPORT_COLORS.halfFont,
        bold: true,
      },
      {
        symbol: "(빈칸)",
        meaning: "결근",
        fillArgb: EXPORT_COLORS.absentFill,
        fontArgb: EXPORT_COLORS.absentFont,
      },
    ],
  };
}
