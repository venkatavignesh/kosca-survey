import ExcelJS from 'exceljs';
import fs from 'node:fs';
import path from 'node:path';

// Brand palette mirroring the in-app design tokens (ARGB hex for ExcelJS).
export const COLORS = {
  brand:       'FF4D47A8',
  brandLight:  'FFF0EFF9',
  brandText:   'FF312D63',
  border:      'FFE5E7EB',
  white:       'FFFFFFFF',
  textPrimary: 'FF111827',
  textMuted:   'FF6B7280',
  success:     'FFECFDF5',
  successText: 'FF047857',
  info:        'FFEFF6FF',
  infoText:    'FF1D4ED8',
  neutral:     'FFF1F5F9',
  neutralText: 'FF334155',
  danger:      'FFFEF2F2',
  dangerText:  'FF991B1B',
} as const;

export function thinBorder() {
  return {
    top: { style: 'thin' as const, color: { argb: COLORS.border } },
    left: { style: 'thin' as const, color: { argb: COLORS.border } },
    right: { style: 'thin' as const, color: { argb: COLORS.border } },
    bottom: { style: 'thin' as const, color: { argb: COLORS.border } },
  };
}

export function loadLogo(wb: ExcelJS.Workbook): number | null {
  try {
    const p = path.join(process.cwd(), 'public', 'kosca-logo.png');
    if (!fs.existsSync(p)) return null;
    const buf = fs.readFileSync(p);
    return wb.addImage({ buffer: buf as unknown as ArrayBuffer, extension: 'png' });
  } catch {
    return null;
  }
}

export function addBrandHeader(
  ws: ExcelJS.Worksheet,
  logoId: number | null,
  subtitle: string,
  totalColumns: number,
) {
  const lastCol = String.fromCharCode('A'.charCodeAt(0) + Math.max(0, totalColumns - 1));
  ws.mergeCells(`A1:${lastCol}1`);
  ws.mergeCells(`A2:${lastCol}2`);
  ws.mergeCells(`A3:${lastCol}3`);
  for (const r of [1, 2, 3]) {
    const row = ws.getRow(r);
    row.height = r === 1 ? 30 : 18;
    for (let i = 1; i <= totalColumns; i++) {
      const cell = row.getCell(i);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.brandLight } };
    }
  }
  const wordmark = ws.getCell('A1');
  wordmark.value = {
    richText: [
      { text: '   ', font: { color: { argb: COLORS.brandLight } } },
      { text: 'Kosca Distribution LLP', font: { bold: true, size: 14, color: { argb: COLORS.brand } } },
      { text: '  |  ', font: { size: 14, color: { argb: COLORS.textMuted } } },
      { text: 'Survey', font: { bold: true, size: 14, color: { argb: COLORS.brand } } },
    ],
  };
  wordmark.alignment = { vertical: 'middle', horizontal: 'left', indent: 4 };

  const sub = ws.getCell('A2');
  sub.value = subtitle;
  sub.font = { color: { argb: COLORS.brandText }, size: 11, italic: true };
  sub.alignment = { vertical: 'middle', horizontal: 'left', indent: 4 };

  ws.getRow(3).height = 4;
  for (let i = 1; i <= totalColumns; i++) {
    ws.getRow(3).getCell(i).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.brand },
    };
  }

  if (logoId != null) {
    ws.addImage(logoId, {
      tl: { col: 0.1, row: 0.15 },
      ext: { width: 36, height: 36 },
      editAs: 'oneCell',
    });
  }
}
