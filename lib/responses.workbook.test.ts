import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { buildWorkbook } from './responses';

// We don't need a DB — buildWorkbook is a pure transform over the campaign +
// assignments shape that getCampaignWithResponses would have returned.
const fixture = (): any => ({
  campaign: {
    id: 'c1', title: 'Test campaign',
    deadline: new Date('2026-12-31T00:00:00Z'),
    questions: [
      {
        question: {
          id: 'q1', text: 'Q1',
          type: 'RADIO',
          required: true,
          allowText: false,
          options: ['A', 'B'],
        },
        audience: 'ALL',
        targets: [],
      },
    ],
  },
  assignments: [
    {
      id: 'a1',
      emailSentAt: new Date('2026-04-01T00:00:00Z'),
      emailOpenedAt: new Date('2026-04-02T00:00:00Z'),
      confirmedAt: new Date('2026-04-02T00:00:00Z'),
      submittedAt: new Date('2026-04-03T00:00:00Z'),
      employee: {
        id: 'e1', empCode: 'E1', name: 'Alice', email: 'a@x', designation: 'Dev',
        location: { name: 'Chennai' },
        officeType: { name: 'HO' },
        department: { name: 'IT' },
      },
      response: {
        answers: [{ questionId: 'q1', valueOptions: ['A'], valueText: null }],
      },
    },
    {
      id: 'a2',
      emailSentAt: null, emailOpenedAt: null, confirmedAt: null,
      submittedAt: null,
      employee: {
        id: 'e2', empCode: 'E2', name: 'Bob', email: 'b@x', designation: 'Dev',
        location: { name: 'Chennai' },
        officeType: { name: 'HO' },
        department: { name: 'IT' },
      },
      response: null,
    },
  ],
});

describe('buildWorkbook', () => {
  it('returns a parseable XLSX buffer with a Summary sheet', async () => {
    const buf = await buildWorkbook(fixture());
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(1000);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as any);
    const sheets = wb.worksheets.map((w) => w.name);
    expect(sheets[0]).toBe('Summary');
    // Submitted employee gets its own sheet — sheet names are derived from
    // empCode + name (cap 31 chars).
    expect(sheets.length).toBe(2);
    expect(sheets[1]).toContain('E1');
  });

  it('the Summary sheet contains an Emp Code column with both rows', async () => {
    const buf = await buildWorkbook(fixture());
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as any);
    const summary = wb.getWorksheet('Summary')!;
    // Row 4 = header, 5+ = data. We added two assignments.
    expect(String(summary.getRow(5).getCell(1).value)).toBe('E1');
    expect(String(summary.getRow(6).getCell(1).value)).toBe('E2');
  });
});
