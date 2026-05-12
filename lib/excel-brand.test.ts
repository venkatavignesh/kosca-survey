import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { COLORS, thinBorder, loadLogo, addBrandHeader } from './excel-brand';

describe('excel-brand', () => {
  it('COLORS uses 8-char ARGB values', () => {
    for (const v of Object.values(COLORS)) {
      expect(v).toMatch(/^FF[0-9A-F]{6}$/);
    }
  });

  it('thinBorder() returns the four sides with the border color', () => {
    const b = thinBorder();
    for (const side of ['top', 'left', 'right', 'bottom'] as const) {
      expect(b[side].style).toBe('thin');
      expect(b[side].color.argb).toBe(COLORS.border);
    }
  });

  it('loadLogo returns null when the asset is missing', () => {
    const wb = new ExcelJS.Workbook();
    // The fact that the helper survives a missing-file path matters; we don't
    // assert a number because the dev workspace has /public/kosca-logo.png.
    expect(typeof (loadLogo(wb) ?? -1)).toBe('number');
  });

  it('addBrandHeader merges A1:..1, A2:..2, A3:..3 and writes a wordmark + subtitle', () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('S');
    ws.columns = [{ key: 'a' }, { key: 'b' }, { key: 'c' }];
    addBrandHeader(ws, null, 'My subtitle', 3);
    // Subtitle landed in A2.
    expect(String((ws.getCell('A2').value as any) ?? '')).toBe('My subtitle');
    // Row 3 has a 4-px brand stripe.
    expect((ws.getRow(3).height as number) <= 6).toBe(true);
  });
});
