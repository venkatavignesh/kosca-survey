import { prisma } from './db';
import { toCSV } from './csv';
import ExcelJS from 'exceljs';
import { formatDateTime, formatDate } from './dates';
import { COLORS, thinBorder, loadLogo, addBrandHeader } from './excel-brand';

export type EmployeeFilters = {
  locationIds?: string[];
  officeTypeIds?: string[];
  departmentIds?: string[];
  q?: string;
};

// Shared where-builder so the Responses + Report pages stay in sync.
// Pass an existing `where` object (e.g. `{ campaignId }`) and this mutates the
// `employee` relation filter to apply the demographic + name/code search.
export function applyEmployeeFilters(where: any, filters?: EmployeeFilters) {
  if (filters?.locationIds?.length) where.employee = { ...(where.employee || {}), locationId: { in: filters.locationIds } };
  if (filters?.officeTypeIds?.length) where.employee = { ...(where.employee || {}), officeTypeId: { in: filters.officeTypeIds } };
  if (filters?.departmentIds?.length) where.employee = { ...(where.employee || {}), departmentId: { in: filters.departmentIds } };
  const q = filters?.q?.trim();
  if (q) {
    where.employee = {
      ...(where.employee || {}),
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { empCode: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { designation: { contains: q, mode: 'insensitive' } },
      ],
    };
  }
  return where;
}

export async function getCampaignWithResponses(campaignId: string, filters?: EmployeeFilters) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      questions: {
        orderBy: { order: 'asc' },
        include: { question: true, targets: true },
      },
    },
  });
  if (!campaign) return null;

  const where: any = applyEmployeeFilters({ campaignId }, filters);

  const assignments = await prisma.campaignAssignment.findMany({
    where,
    include: {
      employee: { include: { location: true, officeType: true, department: true } },
      response: { include: { answers: true } },
    },
    orderBy: { employee: { empCode: 'asc' } },
  });

  return { campaign, assignments };
}

export function buildCsv(data: NonNullable<Awaited<ReturnType<typeof getCampaignWithResponses>>>) {
  const { campaign, assignments } = data;
  const orderedQs = campaign.questions.map((cq) => cq.question);
  const headers = [
    'empCode', 'name', 'email', 'designation',
    'location', 'officeType', 'department',
    'emailSentAt', 'emailOpenedAt', 'submittedAt',
    ...orderedQs.map((q) => q.text),
  ];
  const rows = assignments.map((a) => {
    const e = a.employee;
    const baseFields = [
      e.empCode, e.name, e.email, e.designation,
      e.location.name, e.officeType.name, e.department.name,
      a.emailSentAt ? a.emailSentAt.toISOString() : '',
      a.emailOpenedAt ? a.emailOpenedAt.toISOString() : '',
      a.submittedAt ? a.submittedAt.toISOString() : '',
    ];
    const answersByQ = new Map((a.response?.answers || []).map((ans) => [ans.questionId, ans]));
    const answerCells = orderedQs.map((q) => {
      const ans = answersByQ.get(q.id);
      if (!ans) return '';
      const isText = q.type === 'TEXT' || q.type === 'LONG_TEXT';
      if (isText) return ans.valueText || '';
      const opts = (ans.valueOptions as string[] | null) || [];
      const optionsCell = opts.join('; ');
      // Choice question with allowText: append the comment after the option(s)
      // so a single CSV column carries both the picked option(s) and any
      // additional comment the respondent wrote. Format: "OptA; OptB | comment text".
      if (q.allowText && ans.valueText && ans.valueText.trim()) {
        return optionsCell ? `${optionsCell} | ${ans.valueText.trim()}` : ans.valueText.trim();
      }
      return optionsCell;
    });
    return [...baseFields, ...answerCells];
  });
  return toCSV(headers, rows);
}

// Excel sheet names: max 31 chars, can't contain : \ / ? * [ ]
function safeSheetName(empCode: string, name: string, used: Set<string>): string {
  const raw = `${empCode} ${name}`.replace(/[:\\/?*[\]]/g, ' ').replace(/\s+/g, ' ').trim();
  let base = raw.slice(0, 31);
  if (!base) base = empCode || 'Employee';
  let candidate = base;
  let n = 2;
  while (used.has(candidate)) {
    const suffix = ` (${n++})`;
    candidate = base.slice(0, 31 - suffix.length) + suffix;
  }
  used.add(candidate);
  return candidate;
}

function statusOf(a: { submittedAt: Date | null; confirmedAt: Date | null; emailOpenedAt: Date | null; emailSentAt: Date | null }) {
  if (a.submittedAt) return { label: 'Submitted', bg: COLORS.success, fg: COLORS.successText, tab: COLORS.successText };
  if (a.confirmedAt) return { label: 'Confirmed', bg: COLORS.info, fg: COLORS.infoText, tab: COLORS.infoText };
  if (a.emailOpenedAt) return { label: 'Opened', bg: COLORS.info, fg: COLORS.infoText, tab: COLORS.infoText };
  if (a.emailSentAt) return { label: 'Sent', bg: COLORS.neutral, fg: COLORS.neutralText, tab: COLORS.neutralText };
  return { label: 'Pending', bg: COLORS.danger, fg: COLORS.dangerText, tab: COLORS.dangerText };
}

export async function buildWorkbook(
  data: NonNullable<Awaited<ReturnType<typeof getCampaignWithResponses>>>,
): Promise<Buffer> {
  const { campaign, assignments } = data;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Kosca Distribution LLP — Survey';
  wb.company = 'Kosca Distribution LLP';
  wb.title = campaign.title;
  wb.created = new Date();
  const logoId = loadLogo(wb);

  // ---- Summary ----
  const summary = wb.addWorksheet('Summary', {
    views: [{ state: 'frozen', ySplit: 4 }],
    properties: { tabColor: { argb: COLORS.brand } },
  });
  // Column widths only (no headers — we render the header row manually so it
  // sits below the branded strip).
  summary.columns = [
    { key: 'empCode', width: 12 },
    { key: 'name', width: 24 },
    { key: 'email', width: 28 },
    { key: 'designation', width: 22 },
    { key: 'location', width: 16 },
    { key: 'officeType', width: 18 },
    { key: 'department', width: 18 },
    { key: 'status', width: 14 },
    { key: 'emailSentAt', width: 22 },
    { key: 'emailOpenedAt', width: 22 },
    { key: 'submittedAt', width: 22 },
  ];

  const summarySubtitle = `${campaign.title}  ·  ${assignments.length} recipient${assignments.length === 1 ? '' : 's'}${campaign.deadline ? `  ·  Deadline ${formatDate(campaign.deadline)}` : ''}`;
  addBrandHeader(summary, logoId, summarySubtitle, summary.columns.length);

  // Column-headers row (row 4).
  const headerLabels = ['empCode', 'name', 'email', 'designation', 'location', 'officeType', 'department', 'status', 'emailSentAt', 'emailOpenedAt', 'submittedAt'];
  const headerRow = summary.getRow(4);
  headerRow.values = headerLabels;
  headerRow.height = 22;
  headerRow.font = { bold: true, color: { argb: COLORS.white }, size: 11 };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.brand } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.eachCell((cell) => { cell.border = thinBorder(); });

  assignments.forEach((a, i) => {
    const e = a.employee;
    const s = statusOf(a);
    const row = summary.addRow({
      empCode: e.empCode,
      name: e.name,
      email: e.email,
      designation: e.designation,
      location: e.location.name,
      officeType: e.officeType.name,
      department: e.department.name,
      status: s.label,
      emailSentAt: a.emailSentAt ? formatDateTime(a.emailSentAt) : '—',
      emailOpenedAt: a.emailOpenedAt ? formatDateTime(a.emailOpenedAt) : '—',
      submittedAt: a.submittedAt ? formatDateTime(a.submittedAt) : '—',
    });
    // Zebra striping with brand-lavender tint on every odd data row.
    const isZebra = i % 2 === 1;
    row.eachCell((cell) => {
      cell.border = thinBorder();
      cell.alignment = { vertical: 'middle', wrapText: false };
      if (isZebra) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.brandLight } };
      }
    });
    // Color the status cell (semantic pill look).
    const statusCell = row.getCell('status');
    statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: s.bg } };
    statusCell.font = { bold: true, color: { argb: s.fg } };
    statusCell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  // ---- Per-employee answer sheets ----
  const used = new Set<string>();
  // Only employees who actually have a submitted response get their own sheet;
  // pending recipients are visible in Summary but a blank Q/A sheet is noise.
  const submitted = assignments.filter((a) => a.submittedAt);

  for (const a of submitted) {
    const e = a.employee;
    const s = statusOf(a);
    const sheetName = safeSheetName(e.empCode, e.name, used);
    const ws = wb.addWorksheet(sheetName, {
      views: [{ state: 'frozen', ySplit: 7 }],
      properties: { tabColor: { argb: s.tab } },
    });
    ws.columns = [
      { key: 'sno', width: 8 },
      { key: 'q', width: 60 },
      { key: 'a', width: 60 },
    ];

    // Rows 1–3: branded company header (logo + Kosca Distribution LLP | Survey + campaign title).
    addBrandHeader(ws, logoId, campaign.title, 3);

    // Rows 4–6: per-employee identity strip in brand-lavender.
    const fillBrandLight = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: COLORS.brandLight } };

    ws.mergeCells('A4:C4');
    const id1 = ws.getCell('A4');
    id1.value = `${e.name}  ·  ${e.empCode}  ·  ${e.designation}`;
    id1.font = { bold: true, size: 13, color: { argb: COLORS.brandText } };
    id1.fill = fillBrandLight;
    id1.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    ws.getRow(4).height = 24;

    ws.mergeCells('A5:C5');
    const id2 = ws.getCell('A5');
    id2.value = `${e.location.name} › ${e.officeType.name} › ${e.department.name}`;
    id2.font = { color: { argb: COLORS.brandText }, size: 11 };
    id2.fill = fillBrandLight;
    id2.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    ws.mergeCells('A6:C6');
    const id3 = ws.getCell('A6');
    id3.value = `Submitted: ${a.submittedAt ? formatDateTime(a.submittedAt) : '—'}`;
    id3.font = { color: { argb: COLORS.brandText }, size: 11, italic: true };
    id3.fill = fillBrandLight;
    id3.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    ws.getRow(6).height = 18;

    // Row 7: Q/A header
    const head = ws.getRow(7);
    head.values = ['S.No.', 'Question', 'Answer'];
    head.height = 22;
    head.font = { bold: true, color: { argb: COLORS.white }, size: 11 };
    head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.brand } };
    head.alignment = { vertical: 'middle', horizontal: 'center' };
    head.eachCell((cell) => { cell.border = thinBorder(); });

    // Visible questions (respecting audience scoping).
    const visibleCqs = campaign.questions.filter(
      (cq) => cq.audience === 'ALL' || cq.targets.some((t) => t.employeeId === e.id),
    );
    const answersByQ = new Map(
      (a.response?.answers || []).map((ans) => [ans.questionId, ans]),
    );

    visibleCqs.forEach((cq, i) => {
      const q = cq.question;
      const ans = answersByQ.get(q.id);
      const isText = q.type === 'TEXT' || q.type === 'LONG_TEXT';
      let answerCell = '—';
      let answerMissing = false;
      if (ans) {
        if (isText) {
          if (ans.valueText && ans.valueText.trim()) answerCell = ans.valueText;
          else { answerCell = '—'; answerMissing = true; }
        } else {
          const opts = (ans.valueOptions as string[] | null) || [];
          const joined = opts.join('; ');
          if (q.allowText && ans.valueText && ans.valueText.trim()) {
            answerCell = joined ? `${joined} | ${ans.valueText.trim()}` : ans.valueText.trim();
          } else {
            answerCell = joined || '—';
            if (!joined) answerMissing = true;
          }
        }
      } else {
        answerMissing = true;
      }

      const row = ws.addRow({
        sno: i + 1,
        q: q.text + (q.required ? ' *' : ''),
        a: answerCell,
      });
      const isZebra = i % 2 === 1;
      row.alignment = { wrapText: true, vertical: 'top' };
      row.eachCell((cell) => {
        cell.border = thinBorder();
        if (isZebra) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.brandLight } };
        }
      });
      // S.No. cell: centered, brand-tinted box even on non-zebra rows so the column reads visually.
      const sno = row.getCell(1);
      sno.alignment = { vertical: 'top', horizontal: 'center' };
      sno.font = { bold: true, color: { argb: COLORS.brandText } };
      if (!isZebra) {
        sno.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.brandLight } };
      }
      // Required questions: bold-text the question
      if (q.required) {
        row.getCell(2).font = { bold: true, color: { argb: COLORS.textPrimary } };
      }
      // Missing answer → light red tint on the answer cell so it pops in the workbook.
      if (answerMissing) {
        row.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.danger } };
        row.getCell(3).font = { italic: true, color: { argb: COLORS.dangerText } };
      }
    });
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}
