import {
  ATTENDANCE_EXPORT_HALF_DAY,
  ATTENDANCE_EXPORT_LATE,
  ATTENDANCE_EXPORT_PRESENT,
} from "@/lib/attendanceExportMatrix";
import type { AttendanceExportLabels, LegendRow } from "@/lib/attendanceExportI18n";
import { EXPORT_COLORS } from "@/lib/attendanceExportI18n";
import type { AttendanceMatrix } from "@/lib/attendanceExportMatrix";
import type ExcelJS from "exceljs";

const FONT_SIZE = 9;
const LEGEND_TITLE_ROWS = 1;
const LEGEND_HEADER_ROWS = 1;
const LEGEND_GAP_AFTER = 1;

export function legendRowCount(labels: AttendanceExportLabels): number {
  return labels.legendRows.length;
}

/** 데이터 표 헤더가 있는 행 번호 (1-based) */
export function dataHeaderRowIndex(labels: AttendanceExportLabels): number {
  return LEGEND_TITLE_ROWS + LEGEND_HEADER_ROWS + legendRowCount(labels) + LEGEND_GAP_AFTER;
}

function solidFill(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

function thinBorder(): Partial<ExcelJS.Borders> {
  const side: ExcelJS.Border = { style: "thin", color: { argb: EXPORT_COLORS.border } };
  return { top: side, left: side, bottom: side, right: side };
}

function baseFont(name: string, bold = false, colorArgb?: string): Partial<ExcelJS.Font> {
  return {
    name,
    size: FONT_SIZE,
    bold,
    ...(colorArgb ? { color: { argb: colorArgb } } : {}),
  };
}

function styleCell(
  cell: ExcelJS.Cell,
  opts: {
    fontName: string;
    bold?: boolean;
    fontArgb?: string;
    fillArgb?: string;
    hAlign?: "left" | "center" | "right";
    wrap?: boolean;
  }
) {
  cell.font = baseFont(opts.fontName, opts.bold, opts.fontArgb);
  if (opts.fillArgb) cell.fill = solidFill(opts.fillArgb);
  cell.alignment = {
    vertical: "middle",
    horizontal: opts.hAlign ?? "center",
    wrapText: opts.wrap ?? false,
  };
  cell.border = thinBorder();
}

export function styleCalendarValue(
  cell: ExcelJS.Cell,
  value: string | number | null | undefined,
  fontName: string
) {
  const text = value === null || value === undefined ? "" : String(value);
  cell.value = value;

  if (text === ATTENDANCE_EXPORT_PRESENT) {
    styleCell(cell, {
      fontName,
      bold: true,
      fontArgb: EXPORT_COLORS.presentFont,
      fillArgb: EXPORT_COLORS.presentFill,
    });
    return;
  }
  if (text === ATTENDANCE_EXPORT_LATE) {
    styleCell(cell, {
      fontName,
      bold: true,
      fontArgb: EXPORT_COLORS.lateFont,
      fillArgb: EXPORT_COLORS.lateFill,
    });
    return;
  }
  if (text === ATTENDANCE_EXPORT_HALF_DAY) {
    styleCell(cell, {
      fontName,
      bold: true,
      fontArgb: EXPORT_COLORS.halfFont,
      fillArgb: EXPORT_COLORS.halfFill,
    });
    return;
  }
  styleCell(cell, { fontName, hAlign: "center" });
}

function writeLegendSymbolCell(cell: ExcelJS.Cell, row: LegendRow, fontName: string) {
  const display = row.symbol.startsWith("(") ? row.symbol : row.symbol;
  cell.value = display;
  styleCell(cell, {
    fontName,
    bold: row.bold,
    fontArgb: row.fontArgb,
    fillArgb: row.fillArgb,
  });
}

export function writeAttendanceLegend(
  ws: ExcelJS.Worksheet,
  labels: AttendanceExportLabels,
  mergeThroughCol: number
) {
  const font = labels.fontName;
  const mergeEnd = Math.max(2, mergeThroughCol);

  const titleRow = ws.addRow([labels.legendTitle]);
  titleRow.height = 22;
  ws.mergeCells(titleRow.number, 1, titleRow.number, mergeEnd);
  const titleCell = titleRow.getCell(1);
  styleCell(titleCell, {
    fontName: font,
    bold: true,
    fillArgb: EXPORT_COLORS.legendTitleFill,
    hAlign: "left",
  });
  titleCell.font = { ...titleCell.font, size: 10 };

  const headerRow = ws.addRow([labels.legendColSymbol, labels.legendColMeaning]);
  headerRow.height = 18;
  for (let c = 1; c <= 2; c++) {
    styleCell(headerRow.getCell(c), {
      fontName: font,
      bold: true,
      fontArgb: EXPORT_COLORS.legendHeaderFont,
      fillArgb: EXPORT_COLORS.legendHeaderFill,
      hAlign: c === 1 ? "center" : "left",
    });
  }

  for (const legend of labels.legendRows) {
    const row = ws.addRow([legend.symbol.startsWith("(") ? legend.symbol : legend.symbol, legend.meaning]);
    row.height = 18;
    writeLegendSymbolCell(row.getCell(1), legend, font);
    styleCell(row.getCell(2), {
      fontName: font,
      hAlign: "left",
      fillArgb: "FFFFFFFF",
    });
  }

  ws.addRow([]);
}

export function styleAttendanceDataSheet(
  ws: ExcelJS.Worksheet,
  matrix: AttendanceMatrix,
  labels: AttendanceExportLabels,
  dataHeaderRow: number,
  visualWidth: (v: unknown) => number
) {
  const font = labels.fontName;
  const firstSummaryCol = matrix.dateHeaders.length + 2;
  const lastCol = firstSummaryCol + labels.summaryHeaders.length - 1;

  const headerRow = ws.getRow(dataHeaderRow);
  headerRow.height = 20;
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    const isSummary = colNumber >= firstSummaryCol;
    styleCell(cell, {
      fontName: font,
      bold: true,
      fontArgb: isSummary ? EXPORT_COLORS.summaryHeaderFont : EXPORT_COLORS.dataHeaderFont,
      fillArgb: isSummary ? EXPORT_COLORS.summaryHeaderFill : EXPORT_COLORS.dataHeaderFill,
      hAlign: colNumber === 1 ? "left" : "center",
    });
  });

  for (let r = dataHeaderRow + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    row.height = 16;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      if (colNumber === 1) {
        styleCell(cell, { fontName: font, hAlign: "left", fillArgb: "FFFFFFFF" });
        return;
      }
      if (colNumber >= 2 && colNumber < firstSummaryCol) {
        styleCalendarValue(cell, cell.value as string, font);
        return;
      }
      if (colNumber >= firstSummaryCol) {
        styleCell(cell, {
          fontName: font,
          hAlign: "center",
          fillArgb: colNumber === firstSummaryCol ? "FFE8EAF6" : "FFF5F5F5",
        });
      }
    });
  }

  const nameColWidth = matrix.rows.reduce((max, row) => Math.max(max, visualWidth(row.name)), 0);
  ws.getColumn(1).width = Math.min(24, Math.max(8, visualWidth(labels.nameCol), nameColWidth) + 2);
  for (let c = 2; c < firstSummaryCol; c++) {
    ws.getColumn(c).width = 5.5;
  }
  const summaryWidths = [
    matrix.rows.reduce((max, row) => Math.max(max, visualWidth(row.otTotal)), 0),
    matrix.rows.reduce((max, row) => Math.max(max, visualWidth(row.absentDays)), 0),
    matrix.rows.reduce((max, row) => Math.max(max, visualWidth(row.workDays)), 0),
    matrix.rows.reduce((max, row) => Math.max(max, visualWidth(row.holidayWorkDays)), 0),
  ];
  for (let i = 0; i < labels.summaryHeaders.length; i++) {
    const col = firstSummaryCol + i;
    const header = labels.summaryHeaders[i]!;
    ws.getColumn(col).width = Math.min(
      24,
      Math.max(8, visualWidth(header), summaryWidths[i] ?? 0) + 2
    );
  }

  ws.views = [
    {
      state: "frozen",
      xSplit: 1,
      ySplit: dataHeaderRow,
      topLeftCell: ws.getCell(dataHeaderRow + 1, 2).address,
    },
  ];

  return { firstSummaryCol, lastCol };
}
